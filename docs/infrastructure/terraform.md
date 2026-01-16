# Terraform Infrastructure

FitGlue's infrastructure is managed as code using Terraform. This document describes the workspace strategy, key resources, and deployment patterns.

## Overview

All cloud resources are defined in `/terraform/` and deployed via CI/CD.

## Workspace Strategy

FitGlue uses **Terraform Workspaces** with environment-specific variable files:

| Workspace | GCP Project | Variable File | URL |
|-----------|-------------|---------------|-----|
| `dev` | `fitglue-server-dev` | `envs/dev.tfvars` | `dev.fitglue.tech` |
| `test` | `fitglue-server-test` | `envs/test.tfvars` | `test.fitglue.tech` |
| `prod` | `fitglue-server-prod` | `envs/prod.tfvars` | `fitglue.tech` |

### Switching Workspaces

```bash
cd terraform

# List workspaces
terraform workspace list

# Switch to dev
terraform workspace select dev

# Plan with environment-specific vars
terraform plan -var-file=envs/dev.tfvars
```

## State Management

Terraform state is stored locally with workspace isolation:

```
terraform/
├── terraform.tfstate.d/
│   ├── dev/
│   │   └── terraform.tfstate
│   ├── test/
│   │   └── terraform.tfstate
│   └── prod/
│       └── terraform.tfstate
```

> [!NOTE]
> State is stored in the repository for simplicity. For larger teams, consider remote state (GCS bucket).

## Key Resources

### Cloud Functions (`functions.tf`)

All serverless functions are defined with:
- Gen 2 (Cloud Run-backed) configuration
- Pub/Sub triggers or HTTP triggers
- Environment variables from `envs/*.tfvars`
- Service account bindings

```hcl
resource "google_cloudfunctions2_function" "enricher" {
  name     = "enricher"
  location = var.region

  build_config {
    runtime     = "go125"
    entry_point = "EnrichActivity"
    source {
      storage_source {
        bucket = google_storage_bucket.source.name
        object = google_storage_bucket_object.go_source.name
      }
    }
  }

  service_config {
    available_memory   = "512M"
    timeout_seconds    = 300
    environment_variables = {
      GCS_BUCKET = google_storage_bucket.activities.name
    }
  }

  event_trigger {
    trigger_region = var.region
    event_type     = "google.cloud.pubsub.topic.v1.messagePublished"
    pubsub_topic   = google_pubsub_topic.raw_activities.id
  }
}
```

### Pub/Sub Topics (`pubsub.tf`)

Event-driven messaging between functions:

| Topic | Publisher | Subscriber |
|-------|-----------|------------|
| `raw-activities` | Webhook handlers | Enricher |
| `enriched-activities` | Enricher | Router |
| `strava-upload-jobs` | Router | Strava Uploader |

### Firestore (`firestore.tf`)

Database configuration with indexes for common queries:

```hcl
resource "google_firestore_database" "main" {
  name        = "(default)"
  location_id = var.region
  type        = "FIRESTORE_NATIVE"
}

resource "google_firestore_index" "executions_by_user" {
  collection = "executions"
  fields {
    field_path = "user_id"
    order      = "ASCENDING"
  }
  fields {
    field_path = "created_at"
    order      = "DESCENDING"
  }
}
```

### Cloud Storage (`storage.tf`)

Buckets for FIT files and artifacts:

| Bucket | Purpose | Lifecycle |
|--------|---------|-----------|
| `{project}-activities` | Enriched FIT files | 90 days |
| `{project}-source` | Function source code | N/A |

### Secrets (`secrets.tf`)

Secret Manager for sensitive values:

- OAuth client secrets
- Webhook signing secrets
- API keys

```hcl
resource "google_secret_manager_secret" "strava_client_secret" {
  secret_id = "strava-client-secret"
  replication {
    auto {}
  }
}
```

### DNS (`dns.tf`)

Cloud DNS zones for domain management:

```hcl
resource "google_dns_managed_zone" "main" {
  name        = "fitglue-zone"
  dns_name    = "${var.subdomain}.fitglue.tech."
  description = "DNS zone for ${var.environment}"
}
```

### IAM (`iam.tf`)

Service accounts and permissions:

| Service Account | Purpose | Key Roles |
|-----------------|---------|-----------|
| `deployer` | CI/CD deployment | Editor, Run Admin |
| `functions` | Function execution | Pub/Sub Publisher, Storage Object Admin |

## Deployment

### Manual Deployment

```bash
cd terraform

# Initialize
terraform init

# Select workspace
terraform workspace select dev

# Plan
terraform plan -var-file=envs/dev.tfvars -out=plan.tfplan

# Apply
terraform apply plan.tfplan
```

### CI/CD Deployment

Deployments are automated via CircleCI:

1. **Dev**: Automatic on `main` branch
2. **Test**: Automatic after Dev succeeds
3. **Prod**: Manual approval required

See [CI/CD Guide](cicd.md) for details.

## File Reference

| File | Purpose |
|------|---------|
| `main.tf` | Provider configuration |
| `variables.tf` | Variable declarations |
| `outputs.tf` | Output values |
| `versions.tf` | Provider version constraints |
| `functions.tf` | Cloud Functions |
| `pubsub.tf` | Pub/Sub topics and subscriptions |
| `firestore.tf` | Database and indexes |
| `storage.tf` | GCS buckets |
| `secrets.tf` | Secret Manager |
| `dns.tf` | Cloud DNS |
| `iam.tf` | Service accounts and bindings |
| `auth.tf` | OAuth configurations |
| `apis.tf` | API enablement |

## Related Documentation

- [CI/CD Guide](cicd.md) - Deployment pipeline
- [Architecture Overview](../architecture/overview.md) - System components
- [ADR 002](../decisions/ADR.md#002) - Environment isolation decision
