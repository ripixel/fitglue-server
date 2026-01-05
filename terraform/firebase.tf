resource "google_firebase_web_app" "web" {
  provider = google-beta
  project  = var.project_id
  display_name = "fitglue-web"
}

data "google_firebase_web_app_config" "web" {
  provider   = google-beta
  web_app_id = google_firebase_web_app.web.app_id
}
