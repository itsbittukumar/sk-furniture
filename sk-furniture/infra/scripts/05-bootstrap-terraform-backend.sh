#!/usr/bin/env bash
# One-time setup: creates the S3 bucket + DynamoDB table Terraform needs to
# store its state remotely and lock it during Jenkins runs. Run this ONCE,
# by hand, before the Terraform Jenkins pipeline runs for the first time.
#
# Usage:
#   AWS_REGION=ap-south-1 bash infra/scripts/05-bootstrap-terraform-backend.sh
set -euo pipefail

log() { echo -e "\n\033[1;34m==> $1\033[0m"; }

AWS_REGION="${AWS_REGION:-ap-south-1}"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
BUCKET_NAME="sk-furniture-tfstate-${ACCOUNT_ID}"
LOCK_TABLE="sk-furniture-tf-locks"

log "Creating S3 bucket for Terraform state: $BUCKET_NAME"
if aws s3api head-bucket --bucket "$BUCKET_NAME" 2>/dev/null; then
  echo "Bucket already exists, skipping."
else
  if [ "$AWS_REGION" = "us-east-1" ]; then
    aws s3api create-bucket --bucket "$BUCKET_NAME" --region "$AWS_REGION"
  else
    aws s3api create-bucket --bucket "$BUCKET_NAME" --region "$AWS_REGION" \
      --create-bucket-configuration LocationConstraint="$AWS_REGION"
  fi
  aws s3api put-bucket-versioning --bucket "$BUCKET_NAME" \
    --versioning-configuration Status=Enabled
  aws s3api put-bucket-encryption --bucket "$BUCKET_NAME" \
    --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
  aws s3api put-public-access-block --bucket "$BUCKET_NAME" \
    --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
fi

log "Creating DynamoDB table for state locking: $LOCK_TABLE"
if aws dynamodb describe-table --table-name "$LOCK_TABLE" --region "$AWS_REGION" &>/dev/null; then
  echo "Table already exists, skipping."
else
  aws dynamodb create-table \
    --table-name "$LOCK_TABLE" \
    --attribute-definitions AttributeName=LockID,AttributeType=S \
    --key-schema AttributeName=LockID,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --region "$AWS_REGION"
  aws dynamodb wait table-exists --table-name "$LOCK_TABLE" --region "$AWS_REGION"
fi

echo ""
echo "Terraform backend ready:"
echo "  bucket:         $BUCKET_NAME"
echo "  dynamodb_table: $LOCK_TABLE"
echo "  region:         $AWS_REGION"
echo ""
echo "Use these exact values in the Jenkins pipeline's TF_STATE_BUCKET / TF_LOCK_TABLE"
echo "environment variables (infra/terraform/Jenkinsfile)."
