# Partial S3 backend configuration - the actual bucket/table/region values are
# NOT hardcoded here on purpose, so this file works the same for every
# environment. They're supplied at `terraform init` time with -backend-config
# flags (see infra/terraform/Jenkinsfile, or run manually):
#
#   terraform init \
#     -backend-config="bucket=sk-furniture-tfstate-<your-account-id>" \
#     -backend-config="key=sk-furniture/eks/terraform.tfstate" \
#     -backend-config="region=ap-south-1" \
#     -backend-config="dynamodb_table=sk-furniture-tf-locks" \
#     -backend-config="encrypt=true"
#
# Run infra/scripts/05-bootstrap-terraform-backend.sh once first to create
# that bucket and table.
terraform {
  backend "s3" {}
}
