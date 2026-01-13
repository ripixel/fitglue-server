# Error Codes Reference

FitGlue uses structured error types for consistent error handling across Go and TypeScript.

## Error Packages

| Language | Location |
|----------|----------|
| Go | `pkg/errors/errors.go` |
| TypeScript | `shared/src/errors/index.ts` |

## Error Codes

All codes are strings matching between Go and TypeScript.

### User Errors

| Code | Retryable | Description |
|------|:---------:|-------------|
| `USER_NOT_FOUND` | ❌ | User doesn't exist |
| `USER_UNAUTHORIZED` | ❌ | Missing or invalid authentication |
| `USER_FORBIDDEN` | ❌ | Insufficient permissions |

### Integration Errors

| Code | Retryable | Description |
|------|:---------:|-------------|
| `INTEGRATION_NOT_FOUND` | ❌ | Integration not configured |
| `INTEGRATION_EXPIRED` | ✅ | Token needs refresh |
| `INTEGRATION_AUTH_FAILED` | ❌ | OAuth failed |
| `INTEGRATION_RATE_LIMITED` | ✅ | Hit API rate limit |

### Pipeline Errors

| Code | Retryable | Description |
|------|:---------:|-------------|
| `PIPELINE_NOT_FOUND` | ❌ | Pipeline doesn't exist |
| `PIPELINE_INVALID_CONFIG` | ❌ | Invalid configuration |

### Enricher Errors

| Code | Retryable | Description |
|------|:---------:|-------------|
| `ENRICHER_FAILED` | ✅ | Transient failure |
| `ENRICHER_NOT_FOUND` | ❌ | Enricher type unknown |
| `ENRICHER_TIMEOUT` | ✅ | Took too long |
| `ENRICHER_SKIPPED` | ❌ | Activity filtered |

### Activity Errors

| Code | Retryable | Description |
|------|:---------:|-------------|
| `ACTIVITY_NOT_FOUND` | ❌ | Activity doesn't exist |
| `ACTIVITY_INVALID_FORMAT` | ❌ | Malformed activity data |

### Infrastructure Errors

| Code | Retryable | Description |
|------|:---------:|-------------|
| `STORAGE_ERROR` | ✅ | Firestore/GCS issue |
| `PUBSUB_ERROR` | ✅ | Pub/Sub issue |
| `SECRET_ERROR` | ✅ | Secret Manager issue |
| `NOTIFICATION_ERROR` | ✅ | FCM issue |

### General Errors

| Code | Retryable | Description |
|------|:---------:|-------------|
| `VALIDATION_ERROR` | ❌ | Invalid input |
| `INTERNAL_ERROR` | ❌ | Unexpected error |
| `TIMEOUT_ERROR` | ✅ | Operation timed out |

## Usage

### Go

```go
import "github.com/ripixel/fitglue-server/src/go/pkg/errors"

// Use sentinel error
return nil, errors.ErrUserNotFound

// Wrap with context
return nil, errors.ErrUserNotFound.WithCause(err).WithMetadata("userId", userId)

// Check retryable
if errors.IsRetryable(err) {
    // retry
}
```

### TypeScript

```typescript
import { ErrUserNotFound, isRetryable } from '@fitglue/shared';

// Throw sentinel
throw ErrUserNotFound;

// Wrap with context
throw ErrUserNotFound.withCause(err).withMetadata('userId', userId);

// Check retryable
if (isRetryable(err)) {
    // retry
}
```
