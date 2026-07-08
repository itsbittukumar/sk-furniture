#!/usr/bin/env bash
# Installs everything the cluster needs to actually run and expose the app:
#   - a default gp3 StorageClass (so the MongoDB PVC provisions automatically)
#   - metrics-server (required for the HorizontalPodAutoscalers)
#   - ingress-nginx controller (exposes the app to the internet)
#   - cluster-autoscaler (optional - scales nodes up/down with demand)
# Safe to re-run.
set -euo pipefail

log() { echo -e "\n\033[1;34m==> $1\033[0m"; }

CLUSTER_NAME="${CLUSTER_NAME:-sk-furniture-cluster}"
REGION="${AWS_REGION:-ap-south-1}"

log "Adding required Helm repos"
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx || true
helm repo add metrics-server https://kubernetes-sigs.github.io/metrics-server/ || true
helm repo add autoscaler https://kubernetes.github.io/autoscaler || true
helm repo update

log "Setting a default gp3 StorageClass"
kubectl apply -f - <<'EOF'
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: gp3
  annotations:
    storageclass.kubernetes.io/is-default-class: "true"
provisioner: ebs.csi.aws.com
volumeBindingMode: WaitForFirstConsumer
parameters:
  type: gp3
EOF

log "Installing metrics-server (needed for HPA)"
helm upgrade --install metrics-server metrics-server/metrics-server \
  --namespace kube-system \
  --set args={--kubelet-insecure-tls}

log "Installing ingress-nginx controller (provisions an AWS Network Load Balancer)"
helm upgrade --install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx --create-namespace \
  --set controller.service.type=LoadBalancer \
  --set controller.service.annotations."service\.beta\.kubernetes\.io/aws-load-balancer-type"=nlb

log "Installing cluster-autoscaler (optional but recommended)"
helm upgrade --install cluster-autoscaler autoscaler/cluster-autoscaler \
  --namespace kube-system \
  --set autoDiscovery.clusterName="$CLUSTER_NAME" \
  --set awsRegion="$REGION" \
  --set rbac.serviceAccount.create=true

log "Waiting for the ingress-nginx load balancer to be provisioned (can take a few minutes)"
kubectl -n ingress-nginx get svc ingress-nginx-controller -w &
WATCH_PID=$!
sleep 60
kill $WATCH_PID 2>/dev/null || true

echo ""
echo "Cluster add-ons installed."
echo "Get your load balancer address any time with:"
echo "  kubectl -n ingress-nginx get svc ingress-nginx-controller"
echo "Next: run infra/scripts/03-deploy-app.sh"
