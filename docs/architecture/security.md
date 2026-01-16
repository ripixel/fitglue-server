# Security Architecture

This document describes FitGlue's security model, authorization patterns, and access control mechanisms.

## Overview

FitGlue follows a **"Deny All" baseline** security philosophy. All access is denied by default and must be explicitly granted.

## Auth Boundary

FitGlue operates with two distinct trust zones:

```
┌───────────────────────────────────────────────────────────────────┐
│                     UNTRUSTED (Client)                            │
│                                                                   │
│  • Web App (Browser)                                              │
│  • Mobile App                                                     │
│  • External Webhooks                                              │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │              AUTH BOUNDARY (Firebase Auth)                   │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                   │
├───────────────────────────────────────────────────────────────────┤
│                     TRUSTED (Internal)                            │
│                                                                   │
│  • Cloud Functions (after auth validation)                        │
│  • Pub/Sub Messages (system-generated)                            │
│  • Background Jobs                                                │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

### Key Principles

1. **Clients are never trusted** - All client requests must be authenticated
2. **Internal messages are trusted** - Pub/Sub events from our system are pre-authenticated
3. **Auth happens at the boundary** - HTTP handlers validate auth; downstream functions trust the context

## AuthorizationService

The `AuthorizationService` provides centralized authorization checks across all handlers.

### Methods

#### `requireAccess(userId: string, resourceOwnerId: string): void`

Verifies the authenticated user has access to a resource.

```typescript
// In a handler
const pipeline = await ctx.stores.pipeline.get(pipelineId);
ctx.services.authorization.requireAccess(ctx.auth.userId, pipeline.userId);
// If not authorized, throws ForbiddenError
```

**Rules:**
- ✅ User matches resource owner → Access granted
- ✅ User is admin → Access granted
- ❌ Otherwise → `ForbiddenError` thrown

#### `requireAdmin(): void`

Verifies the authenticated user has admin privileges.

```typescript
// In an admin-only handler
ctx.services.authorization.requireAdmin();
// If not admin, throws ForbiddenError
```

**Rules:**
- ✅ User has `isAdmin: true` → Access granted
- ❌ Otherwise → `ForbiddenError` thrown

### Usage Pattern

All handlers that access user resources must call `requireAccess()`:

```typescript
export async function handleGetPipeline(
  ctx: FrameworkContext,
  req: Request
): Promise<Response> {
  // 1. Parse request
  const { pipelineId } = req.params;

  // 2. Fetch resource
  const pipeline = await ctx.stores.pipeline.get(pipelineId);
  if (!pipeline) {
    throw new NotFoundError('Pipeline not found');
  }

  // 3. Authorize access
  ctx.services.authorization.requireAccess(ctx.auth.userId, pipeline.userId);

  // 4. Return response (only reached if authorized)
  return Response.json(pipeline);
}
```

## ForbiddenError Handling

When authorization fails, handlers throw `ForbiddenError`:

```typescript
// shared/src/errors/forbidden.ts
export class ForbiddenError extends BaseError {
  constructor(message = 'Access denied') {
    super('FORBIDDEN', message, 403);
  }
}
```

The framework catches this and returns:
```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Access denied"
  }
}
```

## Firestore Security Rules

Firestore uses a **"Deny All" baseline** with explicit grants:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Default: deny all
    match /{document=**} {
      allow read, write: if false;
    }

    // Users can read/write their own data
    match /users/{userId} {
      allow read, write: if request.auth != null
                         && request.auth.uid == userId;
    }

    // Pipelines: user owns their pipelines
    match /pipelines/{pipelineId} {
      allow read, write: if request.auth != null
                         && resource.data.user_id == request.auth.uid;
    }

    // Executions: read-only for users
    match /executions/{executionId} {
      allow read: if request.auth != null
                  && resource.data.user_id == request.auth.uid;
    }
  }
}
```

### Philosophy

1. **Deny by default** - No implicit access
2. **User isolation** - Users can only access their own data
3. **Minimal privileges** - Only grant what's needed
4. **Client reads only** - Writes happen through Cloud Functions

## Webhook Authentication

External webhooks use HMAC signature verification:

```typescript
// hevy-handler
function verifySignature(payload: string, signature: string, secret: string): boolean {
  const expected = crypto.createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}
```

### Ingress API Keys

Each user has unique ingress API keys (`fg_sk_...`) used for webhook authentication:

1. Webhook includes key in header (`X-Hevy-Webhook-Secret`)
2. Handler looks up user by key
3. Key validates the request came from an authorized source

## OAuth Token Management

OAuth tokens for external services (Strava, Fitbit) are:

1. **Stored encrypted** in Firestore (user document)
2. **Refreshed automatically** when expired
3. **Scoped minimally** - Only request needed permissions

## Related Documentation

- [Services & Stores](services-and-stores.md) - Business logic architecture
- [Architecture Overview](overview.md) - System components
- [Error Codes](../reference/errors.md) - Error handling
