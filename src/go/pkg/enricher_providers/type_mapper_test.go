package enricher_providers_test

import (
	"context"
	"testing"

	"github.com/ripixel/fitglue-server/src/go/pkg/domain/activity"
	"github.com/ripixel/fitglue-server/src/go/pkg/enricher_providers"
	pb "github.com/ripixel/fitglue-server/src/go/pkg/types/pb"
)

func TestTypeMapperProvider_Enrich(t *testing.T) {
	provider := enricher_providers.NewTypeMapperProvider()
	ctx := context.Background()

	tests := []struct {
		name         string
		activityName string
		rulesJson    string
		expectedType pb.ActivityType
	}{
		{
			name:         "Matches substring (Yoga)",
			activityName: "Morning Yoga Flow",
			rulesJson:    `[{"substring": "Yoga", "target_type": "YOGA"}]`,
			expectedType: pb.ActivityType_ACTIVITY_TYPE_YOGA,
		},
		{
			name:         "Matches substring case-insensitive",
			activityName: "sunday morning run",
			rulesJson:    `[{"substring": "run", "target_type": "RUNNING"}]`,
			expectedType: pb.ActivityType_ACTIVITY_TYPE_RUN,
		},
		{
			name:         "No match keeps original type",
			activityName: "Heavy Lift",
			rulesJson:    `[{"substring": "Yoga", "target_type": "YOGA"}]`,
			expectedType: pb.ActivityType_ACTIVITY_TYPE_WEIGHT_TRAINING,
		},
		{
			name:         "Empty rules JSON does nothing",
			activityName: "Any Activity",
			rulesJson:    "",
			expectedType: pb.ActivityType_ACTIVITY_TYPE_WEIGHT_TRAINING,
		},
		{
			name:         "Invalid JSON does nothing",
			activityName: "Any Activity",
			rulesJson:    `{invalid}`,
			expectedType: pb.ActivityType_ACTIVITY_TYPE_WEIGHT_TRAINING,
		},
		{
			name:         "First match wins",
			activityName: "Yoga and Run",
			rulesJson:    `[{"substring": "Yoga", "target_type": "YOGA"}, {"substring": "Run", "target_type": "RUNNING"}]`,
			expectedType: pb.ActivityType_ACTIVITY_TYPE_YOGA,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			act := &pb.StandardizedActivity{
				Name: tt.activityName,
				Type: pb.ActivityType_ACTIVITY_TYPE_WEIGHT_TRAINING, // Default
			}
			config := map[string]string{}
			if tt.rulesJson != "" {
				config["rules"] = tt.rulesJson
			}

			res, err := provider.Enrich(ctx, act, nil, config, false)
			if err != nil {
				t.Fatalf("Enrich failed: %v", err)
			}

			if act.Type != tt.expectedType {
				t.Errorf("expected type %v, got %v", tt.expectedType, act.Type)
			}

			if act.Type != pb.ActivityType_ACTIVITY_TYPE_WEIGHT_TRAINING {
				// If type changed, check metadata
				expectedStravaName := activity.GetStravaActivityType(act.Type)
				if res.Metadata["new_type"] != expectedStravaName {
					t.Errorf("Metadata new_type expected %s, got %s", expectedStravaName, res.Metadata["new_type"])
				}
			}
		})
	}
}
