package framework

import (
	"context"
	"log/slog"

	"github.com/cloudevents/sdk-go/v2/event"
	"github.com/ripixel/fitglue-server/src/go/pkg/execution"
	"github.com/ripixel/fitglue-server/src/go/pkg/pkg/bootstrap"
)

// HandlerFunc is the signature for a cloud function handler
// It receives the context, event, service, logger, and execution ID
// Returns outputs (for logging) and error
type HandlerFunc func(ctx context.Context, e event.Event, svc *bootstrap.Service, logger *slog.Logger, execID string) (interface{}, error)

// WrapHandler wraps a handler with automatic execution logging
// Similar to TypeScript's createCloudFunction
func WrapHandler(serviceName string, svc *bootstrap.Service, handler HandlerFunc) func(context.Context, event.Event) error {
	return func(ctx context.Context, e event.Event) error {
		// Create logger
		logger := slog.With("service", serviceName)

		// Log execution start
		execID, err := execution.LogStart(ctx, svc.DB, serviceName, execution.ExecutionOptions{
			TriggerType: "pubsub",
		})
		if err != nil {
			logger.Error("Failed to log execution start", "error", err)
			// Continue anyway - don't fail the function just because logging failed
		}

		logger = logger.With("execution_id", execID)
		logger.Info("Function started")

		// Execute handler
		outputs, handlerErr := handler(ctx, e, svc, logger, execID)

		// Log execution result
		if handlerErr != nil {
			logger.Error("Function failed", "error", handlerErr)
			if logErr := execution.LogFailure(ctx, svc.DB, execID, handlerErr); logErr != nil {
				logger.Warn("Failed to log execution failure", "error", logErr)
			}
			return handlerErr
		}

		logger.Info("Function completed successfully")
		if logErr := execution.LogSuccess(ctx, svc.DB, execID, outputs); logErr != nil {
			logger.Warn("Failed to log execution success", "error", logErr)
		}

		return nil
	}
}
