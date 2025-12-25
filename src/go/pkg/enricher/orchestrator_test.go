package enricher

import (
	"context"
	"testing"
	"time"

	"github.com/ripixel/fitglue-server/src/go/pkg/mocks"
	pb "github.com/ripixel/fitglue-server/src/go/pkg/types/pb"
)

type mockProvider struct {
	name   string
	result *EnrichmentResult
}

func (m *mockProvider) Name() string { return m.name }
func (m *mockProvider) Enrich(ctx context.Context, activity *pb.StandardizedActivity, user *pb.UserRecord, inputConfig map[string]string) (*EnrichmentResult, error) {
	return m.result, nil
}

func TestProcess_Pipelines(t *testing.T) {
	// Setup Matches
	mockDB := &mocks.MockDatabase{
		GetUserFunc: func(ctx context.Context, id string) (map[string]interface{}, error) {
			return map[string]interface{}{
				"user_id": id,
				"pipelines": []interface{}{
					map[string]interface{}{
						"id":     "pipeline-1",
						"source": "SOURCE_HEVY",
						"enrichers": []interface{}{
							map[string]interface{}{
								"name": "mock-a",
							},
						},
						"destinations": []interface{}{"strava"},
					},
					map[string]interface{}{
						"id":     "pipeline-2",
						"source": "SOURCE_HEVY",
						"enrichers": []interface{}{
							map[string]interface{}{
								"name": "mock-b",
							},
						},
						"destinations": []interface{}{"gcs"},
					},
				},
			}, nil
		},
	}
	mockStore := &mocks.MockBlobStore{
		WriteFunc: func(ctx context.Context, bucket, object string, data []byte) error { return nil },
	}

	orc := NewOrchestrator(mockDB, mockStore, "test-bucket")

	// Register Mock Providers
	orc.Register(&mockProvider{name: "mock-a", result: &EnrichmentResult{Name: "Enriched A"}})
	orc.Register(&mockProvider{name: "mock-b", result: &EnrichmentResult{Name: "Enriched B"}})

	// Input
	payload := &pb.ActivityPayload{
		UserId:    "u1",
		Source:    pb.ActivitySource_SOURCE_HEVY,
		Timestamp: time.Now().Format(time.RFC3339),
		StandardizedActivity: &pb.StandardizedActivity{
			Name: "Original",
		},
	}

	// Execute
	events, err := orc.Process(context.Background(), payload)
	if err != nil {
		t.Fatalf("Process failed: %v", err)
	}

	// Assert
	if len(events) != 2 {
		t.Fatalf("Expected 2 events, got %d", len(events))
	}

	// Verify Event 1
	e1 := events[0]
	if e1.PipelineId != "pipeline-1" {
		t.Errorf("Event 0 expected pipeline-1, got %s", e1.PipelineId)
	}
	if e1.Name != "Enriched A" {
		t.Errorf("Event 0 expected Enriched A, got %s", e1.Name)
	}
	if len(e1.Destinations) != 1 || e1.Destinations[0] != "strava" {
		t.Errorf("Event 0 destinations mismatch")
	}

	// Verify Event 2
	e2 := events[1]
	if e2.PipelineId != "pipeline-2" {
		t.Errorf("Event 1 expected pipeline-2, got %s", e2.PipelineId)
	}
	if e2.Name != "Enriched B" {
		t.Errorf("Event 1 expected Enriched B, got %s", e2.Name)
	}
	if len(e2.Destinations) != 1 || e2.Destinations[0] != "gcs" {
		t.Errorf("Event 1 destinations mismatch")
	}
}
