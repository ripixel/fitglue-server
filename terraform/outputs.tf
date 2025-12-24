output "fitglue_tech_name_servers" {
  description = "Name servers for fitglue.tech. Configure these at your registrar."
  value       = google_dns_managed_zone.fitglue_tech.name_servers
}
