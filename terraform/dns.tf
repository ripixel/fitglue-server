locals {
  # Prod gets the root domain, others get subdomains
  dns_zone_name = var.environment == "prod" ? "fitglue-tech" : "${var.environment}-fitglue-tech"
  dns_name      = var.environment == "prod" ? "fitglue.tech." : "${var.environment}.fitglue.tech."

  # Base URL for OAuth redirects
  base_url = var.environment == "prod" ? "https://fitglue.tech" : "https://${var.environment}.fitglue.tech"
}

resource "google_dns_managed_zone" "main" {
  name        = local.dns_zone_name
  dns_name    = local.dns_name
  description = "Managed zone for ${local.dns_name}"
  visibility  = "public"

  labels = {
    managed-by  = "terraform"
    environment = var.environment
  }

  depends_on = [
    google_project_service.apis
  ]
}

# Delegation for Dev subdomain (only in Prod)
resource "google_dns_record_set" "dev_delegation" {
  count        = var.environment == "prod" ? 1 : 0
  managed_zone = google_dns_managed_zone.main.name
  project      = var.project_id
  name         = "dev.fitglue.tech."
  type         = "NS"
  ttl          = 300

  rrdatas = [
    "ns-cloud-d1.googledomains.com.",
    "ns-cloud-d2.googledomains.com.",
    "ns-cloud-d3.googledomains.com.",
    "ns-cloud-d4.googledomains.com.",
  ]
}

# Delegation for Test subdomain (only in Prod)
# TODO: Update these nameservers after deploying Test environment
resource "google_dns_record_set" "test_delegation" {
  count        = var.environment == "prod" ? 1 : 0
  managed_zone = google_dns_managed_zone.main.name
  project      = var.project_id
  name         = "test.fitglue.tech."
  type         = "NS"
  ttl          = 300

  rrdatas = [
    "ns-cloud-a1.googledomains.com.",
    "ns-cloud-a2.googledomains.com.",
    "ns-cloud-a3.googledomains.com.",
    "ns-cloud-a4.googledomains.com.",
  ]
}

# Firebase Hosting Custom Domain
resource "google_firebase_hosting_custom_domain" "main" {
  provider      = google-beta
  project       = var.project_id
  site_id       = var.project_id
  custom_domain = var.domain_name

  wait_dns_verification = true

  depends_on = [
    google_dns_managed_zone.main
  ]
}

# DNS TXT record for Firebase domain verification
resource "google_dns_record_set" "firebase_verification" {
  managed_zone = google_dns_managed_zone.main.name
  name         = google_firebase_hosting_custom_domain.main.required_dns_updates[0].domain_name
  type         = "TXT"
  ttl          = 300
  rrdatas      = [google_firebase_hosting_custom_domain.main.required_dns_updates[0].records[0]]
}

# DNS A records for Firebase Hosting
resource "google_dns_record_set" "firebase_a" {
  managed_zone = google_dns_managed_zone.main.name
  name         = "${var.domain_name}."
  type         = "A"
  ttl          = 300
  rrdatas      = google_firebase_hosting_custom_domain.main.required_dns_updates[1].records
}
