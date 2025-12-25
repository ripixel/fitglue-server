package router

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"sync"

	"github.com/GoogleCloudPlatform/functions-framework-go/functions"
	"github.com/cloudevents/sdk-go/v2/event"

	shared "github.com/ripixel/fitglue-server/src/go/pkg"
	"github.com/ripixel/fitglue-server/src/go/pkg/bootstrap"
	"github.com/ripixel/fitglue-server/src/go/pkg/framework"
	"github.com/ripixel/fitglue-server/src/go/pkg/types"
	pb "github.com/ripixel/fitglue-server/src/go/pkg/types/pb"
)

var (
	svc     *bootstrap.Service
	svcOnce sync.Once
	svcErr  error
)

func init() {
	functions.CloudEvent("RouteActivity", RouteActivity)
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

// RouteActivity is the entry point
func RouteActivity(ctx context.Context, e event.Event) error {
	svc, err := initService(ctx)
	if err != nil {
		return fmt.Errorf("service init failed: %v", err)
	}
	return framework.WrapCloudEvent("router", svc, routeHandler)(ctx, e)
}

// routeHandler contains the business logic
func routeHandler(ctx context.Context, e event.Event, fwCtx *framework.FrameworkContext) (interface{}, error) {
	// Parse Pub/Sub message
	var msg types.PubSubMessage
	if err := e.DataAs(&msg); err != nil {
		return nil, fmt.Errorf("event.DataAs: %v", err)
	}

	var eventPayload pb.EnrichedActivityEvent
	if err := json.Unmarshal(msg.Message.Data, &eventPayload); err != nil {
		return nil, fmt.Errorf("json unmarshal: %v", err)
	}

	fwCtx.Logger.Info("Starting routing", "source", eventPayload.Source, "pipeline", eventPayload.PipelineId)

	// Since we moved routing logic to the Enricher/Pipeline configuration,
	// the event already carries the list of intended destinations.
	destinations := eventPayload.Destinations

	// Fan-out
	routings := []string{}
	fwCtx.Logger.Info("Resolved destinations from payload", "dests", destinations)

	for _, dest := range destinations {
		var topic string
		switch dest {
		case "strava":
			topic = shared.TopicJobUploadStrava
		default:
			fwCtx.Logger.Warn("Unknown destination", "dest", dest)
			continue
		}

		resID, err := fwCtx.Service.Pub.Publish(ctx, topic, msg.Message.Data)
		if err != nil {
			fwCtx.Logger.Error("Failed to publish to queue", "dest", dest, "topic", topic, "error", err)
		} else {
			routings = append(routings, dest+":"+resID)
		}
	}

	fwCtx.Logger.Info("Routed activity", "routes", routings)
	return map[string]interface{}{
		"routings": routings,
	}, nil
}
