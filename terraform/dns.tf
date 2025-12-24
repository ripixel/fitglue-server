resource "google_dns_managed_zone" "fitglue_tech" {
  name        = "fitglue-tech"
  dns_name    = "fitglue.tech."
  description = "Managed zone for fitglue.tech"
  visibility  = "public"

  labels = {
    managed-by = "terraform"
  }
}
