#!/usr/bin/env bash
# Deploys SK Furniture itself onto an already-running, already-configured EKS
# cluster (run 01 and 02 first, or use Terraform - either way kubectl must
# already point at the right cluster). Builds images, pushes to ECR, applies
# every manifest in k8s/, seeds the database once, and prints the URL.
#
# Usage:
#   AWS_REGION=ap-south-1 JWT_SECRET=$(openssl rand -hex 32) \
#   ADMIN_PASSWORD=SomeStrongPassword \
#   bash infra/scripts/03-deploy-app.sh
set -euo pipefail

log() { echo -e "\n\033[1;34m==> $1\033[0m"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

AWS_REGION="${AWS_REGION:-ap-south-1}"
NAMESPACE="sk-furniture"
JWT_SECRET="${JWT_SECRET:-$(openssl rand -hex 32)}"
ADMIN_USERNAME="${ADMIN_USERNAME:-admin}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:?Set ADMIN_PASSWORD before running this script}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@skfurniture.com}"
IMAGE_TAG="${IMAGE_TAG:-$(git -C "$ROOT_DIR" rev-parse --short HEAD 2>/dev/null || date +%s)}"

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGISTRY="$ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"

log "Ensuring ECR repositories exist"
aws ecr describe-repositories --repository-names sk-furniture-backend  --region "$AWS_REGION" >/dev/null 2>&1 \
  || aws ecr create-repository --repository-name sk-furniture-backend  --region "$AWS_REGION" >/dev/null
aws ecr describe-repositories --repository-names sk-furniture-frontend --region "$AWS_REGION" >/dev/null 2>&1 \
  || aws ecr create-repository --repository-name sk-furniture-frontend --region "$AWS_REGION" >/dev/null

log "Logging in to ECR"
aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$REGISTRY"

log "Building and pushing backend image ($IMAGE_TAG)"
docker build -t "$REGISTRY/sk-furniture-backend:$IMAGE_TAG" "$ROOT_DIR/backend"
docker push "$REGISTRY/sk-furniture-backend:$IMAGE_TAG"

log "Building and pushing frontend image ($IMAGE_TAG)"
docker build -t "$REGISTRY/sk-furniture-frontend:$IMAGE_TAG" "$ROOT_DIR/frontend"
docker push "$REGISTRY/sk-furniture-frontend:$IMAGE_TAG"

log "Creating namespace"
kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -

log "Creating/updating backend secret"
kubectl -n "$NAMESPACE" create secret generic sk-backend-secret \
  --from-literal=MONGO_URI="mongodb://mongo:27017/skfurniture" \
  --from-literal=JWT_SECRET="$JWT_SECRET" \
  --from-literal=SEED_ADMIN_USERNAME="$ADMIN_USERNAME" \
  --from-literal=SEED_ADMIN_PASSWORD="$ADMIN_PASSWORD" \
  --from-literal=SEED_ADMIN_EMAIL="$ADMIN_EMAIL" \
  --dry-run=client -o yaml | kubectl apply -f -

log "Deploying MongoDB"
kubectl apply -f "$ROOT_DIR/k8s/02-mongo.yaml"
kubectl -n "$NAMESPACE" rollout status deployment/mongo --timeout=180s

log "Deploying backend (image: $REGISTRY/sk-furniture-backend:$IMAGE_TAG)"
sed "s#image: sk-furniture-backend:latest#image: $REGISTRY/sk-furniture-backend:$IMAGE_TAG#" \
  "$ROOT_DIR/k8s/03-backend.yaml" | kubectl apply -f -
kubectl -n "$NAMESPACE" rollout status deployment/backend --timeout=180s

log "Deploying frontend (image: $REGISTRY/sk-furniture-frontend:$IMAGE_TAG)"
sed "s#image: sk-furniture-frontend:latest#image: $REGISTRY/sk-furniture-frontend:$IMAGE_TAG#" \
  "$ROOT_DIR/k8s/05-frontend.yaml" | kubectl apply -f -
kubectl -n "$NAMESPACE" rollout status deployment/frontend --timeout=180s

log "Seeding the database (creates admin user + starter catalog, skips if already seeded)"
kubectl -n "$NAMESPACE" delete job sk-seed --ignore-not-found
sed "s#image: sk-furniture-backend:latest#image: $REGISTRY/sk-furniture-backend:$IMAGE_TAG#" \
  "$ROOT_DIR/k8s/04-seed-job.yaml" | kubectl apply -f -
kubectl -n "$NAMESPACE" wait --for=condition=complete job/sk-seed --timeout=120s
kubectl -n "$NAMESPACE" logs job/sk-seed

log "Applying ingress and autoscalers"
kubectl apply -f "$ROOT_DIR/k8s/06-ingress.yaml"
kubectl apply -f "$ROOT_DIR/k8s/07-hpa.yaml"

log "Deployment complete"
echo "Point your domain's DNS at this load balancer (or use it directly for testing):"
kubectl -n ingress-nginx get svc ingress-nginx-controller -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null || true
echo ""
echo "Admin login -> username: $ADMIN_USERNAME"
