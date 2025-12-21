resource "google_secret_manager_secret" "hevy_api_key" {
  secret_id = "hevy-api-key"
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret" "keiser_credentials" {
  secret_id = "keiser-credentials" # JSON blob: {username, password}
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret" "fitbit_client_secret" {
  secret_id = "fitbit-client-secret"
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret" "strava_client_secret" {
  secret_id = "strava-client-secret"
  replication {
    auto {}
  }
}

# Add IAM binding to allow Cloud Functions (Default SA) to access these secrets
data "google_project" "project" {
}

resource "google_project_iam_member" "secret_accessor" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${data.google_project.project.number}-compute@developer.gserviceaccount.com"
}
