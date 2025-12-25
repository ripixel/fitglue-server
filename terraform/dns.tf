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
# Note: Firebase will provide DNS instructions after creation
# The custom domain resource will output the required DNS records
resource "google_firebase_hosting_custom_domain" "main" {
  provider      = google-beta
  project       = var.project_id
  site_id       = var.project_id
  custom_domain = var.domain_name

  # Don't wait for DNS verification in Terraform
  # We'll configure DNS manually based on Firebase's instructions
  wait_dns_verification = false

  depends_on = [
    google_dns_managed_zone.main
  ]
}

# Automatically add DNS records required by Firebase Hosting
# This runs after the custom domain is created and parses the required_dns_updates output
resource "null_resource" "firebase_dns_records" {
  # Re-run if the custom domain changes
  triggers = {
    custom_domain_id = google_firebase_hosting_custom_domain.main.id
  }

  provisioner "local-exec" {
    command = <<-EOT
      # Wait a moment for Firebase to populate required_dns_updates
      sleep 5

      # Get the required DNS updates from Terraform state
      DESIRED_RECORDS=$(terraform output -json firebase_custom_domain_dns | jq -r '.desired[]? // empty')

      if [ -n "$DESIRED_RECORDS" ]; then
        echo "$DESIRED_RECORDS" | jq -c '.' | while read -r record_set; do
          DOMAIN=$(echo "$record_set" | jq -r '.domain_name')

          echo "$record_set" | jq -c '.records[]' | while read -r record; do
            TYPE=$(echo "$record" | jq -r '.type')
            RDATA=$(echo "$record" | jq -r '.rdata')
            ACTION=$(echo "$record" | jq -r '.required_action')

            if [ "$ACTION" = "ADD" ]; then
              # Check if record already exists
              EXISTING=$(gcloud dns record-sets list \
                --zone=${google_dns_managed_zone.main.name} \
                --name="$DOMAIN" \
                --type="$TYPE" \
                --format=json 2>/dev/null || echo "[]")

              if [ "$EXISTING" = "[]" ]; then
                echo "Adding $TYPE record for $DOMAIN: $RDATA"
                gcloud dns record-sets create "$DOMAIN" \
                  --zone=${google_dns_managed_zone.main.name} \
                  --type="$TYPE" \
                  --ttl=300 \
                  --rrdatas="$RDATA" || echo "Record may already exist, continuing..."
              else
                echo "Record already exists for $DOMAIN ($TYPE), skipping..."
              fi
            fi
          done
        done
      else
        echo "No DNS records required yet. Firebase may still be processing the custom domain."
      fi
    EOT
  }

  depends_on = [
    google_firebase_hosting_custom_domain.main
  ]
}
