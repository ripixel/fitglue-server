output "fitglue_tech_name_servers" {
  description = "Name servers for the environment's zone. Configure these at your registrar (for Prod) or in the Prod zone's NS records (for Dev/Test)."
  value       = google_dns_managed_zone.main.name_servers
}

output "base_url" {
  description = "Base URL for OAuth redirects"
  value       = local.base_url
}

output "firebase_custom_domain_dns" {
  description = "Required DNS updates for Firebase Hosting custom domain"
  value       = try(google_firebase_hosting_custom_domain.main.required_dns_updates, null)
}
