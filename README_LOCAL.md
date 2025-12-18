# Local Development

## Prerequisites
- [Google Cloud SDK](https://cloud.google.com/sdk/docs/install) installed.
- [Functions Framework](https://github.com/GoogleCloudPlatform/functions-framework-go) (installed via go.mod / npm).
- Environment Variables setup.

## Running Services

Each service can be run locally on a specific port.

### 1. Hevy Handler (Port 8080)
```bash
cd functions/hevy-handler
npm run dev
# Listens on 8080 by default
```

### 2. Keiser Poller (Port 8084)
```bash
cd functions/keiser-poller
PORT=8084 npm run dev
```

### 3. Enricher (Port 8081)
```bash
cd functions/enricher
go run cmd/main.go
# Listens on 8081
```

### 4. Router (Port 8082)
```bash
cd functions/router
go run cmd/main.go
# Listens on 8082
```

### 5. Strava Uploader (Port 8083)
```bash
cd functions/strava-uploader
go run cmd/main.go
# Listens on 8083
```

## Testing Triggers via HTTP

Since all functions are wrapped in HTTP by the framework, you can trigger them via `curl`:

**Trigger Enricher (Cloud Event)**
```bash
curl -X POST localhost:8081 \
  -H "Content-Type: application/json" \
  -H "Ce-Id: 1234" \
  -H "Ce-Specversion: 1.0" \
  -H "Ce-Type: google.cloud.pubsub.topic.v1.messagePublished" \
  -H "Ce-Source: //pubsub.googleapis.com/projects/YOUR_PROJECT/topics/topic-raw-activity" \
  -d '{
        "message": {
          "data": "BASE64_ENCODED_JSON_PAYLOAD"
        }
      }'
```
