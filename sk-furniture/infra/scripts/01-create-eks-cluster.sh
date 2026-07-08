#!/usr/bin/env bash
# Creates the EKS cluster from infra/eksctl/cluster-config.yaml and points
# kubectl at it. Takes 15-20 minutes - eksctl provisions a VPC, control plane,
# and managed node group.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="$SCRIPT_DIR/../eksctl/cluster-config.yaml"
CLUSTER_NAME=$(grep -A1 "^metadata:" "$CONFIG_FILE" | grep "name:" | awk '{print $2}')
REGION=$(grep "region:" "$CONFIG_FILE" | awk '{print $2}')

echo "==> Creating EKS cluster '$CLUSTER_NAME' in $REGION (this takes ~15-20 min)"
eksctl create cluster -f "$CONFIG_FILE"

echo "==> Updating local kubeconfig"
aws eks update-kubeconfig --name "$CLUSTER_NAME" --region "$REGION"

echo "==> Verifying cluster access"
kubectl get nodes -o wide

echo "==> Verifying the aws-ebs-csi-driver addon is active"
kubectl get pods -n kube-system -l app.kubernetes.io/name=aws-ebs-csi-driver

echo ""
echo "Cluster '$CLUSTER_NAME' is ready."
echo "Next: run infra/scripts/02-install-cluster-addons.sh"
