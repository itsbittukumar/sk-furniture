terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.50"
    }
  }
  # Remote S3 backend is configured in backend.tf (partial config, values
  # passed in at `terraform init` time - see backend.tf for the full command).
}

provider "aws" {
  region = var.region
}
