#!/bin/bash
set -e

# Script to configure secrets for Firebase Auth backend hooks
# Usage: ./scripts/configure_auth_secrets.sh <environment>

ENV=${1:-dev}
if [[ ! "$ENV" =~ ^(dev|test|prod)$ ]]; then
  echo "❌ Error: Invalid environment '$ENV'"
  echo "Usage: $0 <dev|test|prod>"
  exit 1
fi

PROJECT_ID="fitglue-server-${ENV}"
echo "🔧 Configuring Auth Secrets for $PROJECT_ID..."

# Function to configure a secret
configure_secret() {
    SECRET_ID=$1
    PROMPT_TEXT=$2

    echo ""
    echo "Enter value for $SECRET_ID ($PROMPT_TEXT):"
    read -s SECRET_VALUE
    echo ""

    if [ -z "$SECRET_VALUE" ]; then
        echo "⚠️  Skipping $SECRET_ID (empty input)"
        return
    fi

    # Create secret if it doesn't exist
    if ! gcloud secrets describe "$SECRET_ID" --project="$PROJECT_ID" > /dev/null 2>&1; then
        echo "Creating secret $SECRET_ID..."
        gcloud secrets create "$SECRET_ID" --replication-policy="automatic" --project="$PROJECT_ID"
    fi

    # Add new version
    echo "Adding new version to $SECRET_ID..."
    echo -n "$SECRET_VALUE" | gcloud secrets versions add "$SECRET_ID" --data-file=- --project="$PROJECT_ID"
    echo "✅ $SECRET_ID updated"
}

# Example: If we needed a service account key for migration, we'd ask here.
# Currently, with Identity Platform and Cloud Functions, we mostly rely on ADC.
# But keeping this script for future extensibility (e.g. if we need a specific Admin SDK cert).

echo "Auth setup mostly relies on ADC. If you have specific secrets (like a specialized Service Account Key for admin tasks), add them here."
echo "Currently, no manual secrets are required for the basic auth hooks."

