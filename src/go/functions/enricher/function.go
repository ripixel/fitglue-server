package enricher

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/GoogleCloudPlatform/functions-framework-go/functions"
	"github.com/cloudevents/sdk-go/v2/event"

	shared "github.com/ripixel/fitglue-server/src/go/pkg"
	"github.com/ripixel/fitglue-server/src/go/pkg/fit"
	"github.com/ripixel/fitglue-server/src/go/pkg/framework"
	"github.com/ripixel/fitglue-server/src/go/pkg/pkg/bootstrap"
	"github.com/ripixel/fitglue-server/src/go/pkg/types"
	pb "github.com/ripixel/fitglue-server/src/go/pkg/types/pb"
)

var (
	svc     *bootstrap.Service
	svcOnce sync.Once
	svcErr  error
)

func init() {
	functions.CloudEvent("EnrichActivity", EnrichActivity)
}

func initService(ctx context.Context) (*bootstrap.Service, error) {
	if svc != nil {
		return svc, nil
	}
	svcOnce.Do(func() {
		svc, svcErr = bootstrap.NewService(ctx)
		if svcErr != nil {
			slog.Error("Failed to initialize service", "error", svcErr)
		}
	})
	return svc, svcErr
}

// EnrichActivity is the entry point
func EnrichActivity(ctx context.Context, e event.Event) error {
	svc, err := initService(ctx)
	if err != nil {
		return fmt.Errorf("service init failed: %v", err)
	}
	return framework.WrapCloudEvent("enricher", svc, enrichHandler)(ctx, e)
}

// enrichHandler contains the business logic
func enrichHandler(ctx context.Context, e event.Event, fwCtx *framework.FrameworkContext) (interface{}, error) {
	// Parse Pub/Sub message
	var msg types.PubSubMessage
	if err := e.DataAs(&msg); err != nil {
		return nil, fmt.Errorf("event.DataAs: %v", err)
	}

	var rawEvent pb.ActivityPayload
	if err := json.Unmarshal(msg.Message.Data, &rawEvent); err != nil {
		return nil, fmt.Errorf("json unmarshal: %v", err)
	}

	fwCtx.Logger.Info("Starting enrichment", "timestamp", rawEvent.Timestamp)

	// Logic: Merge Data
	startTime, _ := time.Parse(time.RFC3339, rawEvent.Timestamp)
	duration := 3600 // 1 hour in seconds

	var powerStream, hrStream []int
	switch rawEvent.Source {
	case pb.ActivitySource_SOURCE_HEVY:
		powerStream = make([]int, duration)
		hrStream = make([]int, duration)
	case pb.ActivitySource_SOURCE_KEISER:
		powerStream = make([]int, duration)
		hrStream = make([]int, duration)
	default:
		return nil, fmt.Errorf("unknown source: %v", rawEvent.Source)
	}

	// Generate FIT
	fitBytes, err := fit.GenerateFitFile(startTime, duration, powerStream, hrStream)
	if err != nil {
		fwCtx.Logger.Error("FIT generation failed", "error", err)
		return nil, err
	}

	// Save to GCS
	bucketName := fwCtx.Service.Config.GCSArtifactBucket
	if bucketName == "" {
		bucketName = "fitglue-artifacts"
	}
	objName := fmt.Sprintf("activities/%s/%d.fit", rawEvent.UserId, startTime.Unix())
	if err := fwCtx.Service.Store.Write(ctx, bucketName, objName, fitBytes); err != nil {
		fwCtx.Logger.Error("GCS write failed", "error", err)
		return nil, err
	}

	// Generate Description
	desc := "Enhanced Activity\n\n#PowerMap #HeartrateMap"

	// Publish to Router
	enrichedEvent := &pb.EnrichedActivityEvent{
		UserId:      rawEvent.UserId,
		GcsUri:      fmt.Sprintf("gs://%s/%s", bucketName, objName),
		Description: desc,
	}
	payload, _ := json.Marshal(enrichedEvent)

	if _, err := fwCtx.Service.Pub.Publish(ctx, shared.TopicEnrichedActivity, payload); err != nil {
		fwCtx.Logger.Error("Failed to publish", "error", err)
		return nil, err
	}

	fwCtx.Logger.Info("Enrichment complete")
	return enrichedEvent, nil
}
