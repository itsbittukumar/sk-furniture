#!/usr/bin/env bash
# Installs everything needed on a fresh Linux machine (or Jenkins agent) to
# build, push, and deploy SK Furniture to EKS: AWS CLI v2, kubectl, eksctl,
# helm, and Docker. Safe to re-run - each step checks if the tool already
# exists before installing.
#
# Tested on Ubuntu/Debian. Run with: bash 00-install-prerequisites.sh
set -euo pipefail

log() { echo -e "\n\033[1;34m==> $1\033[0m"; }

ARCH=$(uname -m)
case "$ARCH" in
  x86_64) ARCH_TAG="amd64" ;;
  aarch64) ARCH_TAG="arm64" ;;
  *) echo "Unsupported architecture: $ARCH"; exit 1 ;;
esac

log "Updating apt and installing base packages"
sudo apt-get update -y
sudo apt-get install -y curl unzip tar git ca-certificates gnupg lsb-release jq

# ---------------------------------------------------------------------------
log "Checking / installing AWS CLI v2"
if command -v aws &>/dev/null; then
  echo "AWS CLI already installed: $(aws --version)"
else
  curl -sSL "https://awscli.amazonaws.com/awscli-exe-linux-$(uname -m).zip" -o /tmp/awscliv2.zip
  unzip -q /tmp/awscliv2.zip -d /tmp
  sudo /tmp/aws/install
  rm -rf /tmp/awscliv2.zip /tmp/aws
  echo "Installed: $(aws --version)"
fi

# ---------------------------------------------------------------------------
log "Checking / installing kubectl"
if command -v kubectl &>/dev/null; then
  echo "kubectl already installed: $(kubectl version --client --short 2>/dev/null || kubectl version --client)"
else
  KUBECTL_VERSION=$(curl -sL https://dl.k8s.io/release/stable.txt)
  curl -sSL "https://dl.k8s.io/release/${KUBECTL_VERSION}/bin/linux/${ARCH_TAG}/kubectl" -o /tmp/kubectl
  chmod +x /tmp/kubectl
  sudo mv /tmp/kubectl /usr/local/bin/kubectl
  echo "Installed kubectl ${KUBECTL_VERSION}"
fi

# ---------------------------------------------------------------------------
log "Checking / installing eksctl"
if command -v eksctl &>/dev/null; then
  echo "eksctl already installed: $(eksctl version)"
else
  curl -sSL "https://github.com/eksctl-io/eksctl/releases/latest/download/eksctl_Linux_${ARCH_TAG}.tar.gz" | tar xz -C /tmp
  sudo mv /tmp/eksctl /usr/local/bin/eksctl
  echo "Installed: $(eksctl version)"
fi

# ---------------------------------------------------------------------------
log "Checking / installing Helm"
if command -v helm &>/dev/null; then
  echo "Helm already installed: $(helm version --short)"
else
  curl -sSL https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
  echo "Installed: $(helm version --short)"
fi

# ---------------------------------------------------------------------------
log "Checking / installing Terraform"
if command -v terraform &>/dev/null; then
  echo "Terraform already installed: $(terraform version | head -1)"
else
  curl -fsSL https://apt.releases.hashicorp.com/gpg | sudo gpg --dearmor -o /usr/share/keyrings/hashicorp-archive-keyring.gpg
  echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" | \
    sudo tee /etc/apt/sources.list.d/hashicorp.list
  sudo apt-get update -y
  sudo apt-get install -y terraform
  echo "Installed: $(terraform version | head -1)"
fi

# ---------------------------------------------------------------------------
log "Checking / installing Docker"
if command -v docker &>/dev/null; then
  echo "Docker already installed: $(docker --version)"
else
  curl -fsSL https://get.docker.com -o /tmp/get-docker.sh
  sudo sh /tmp/get-docker.sh
  sudo usermod -aG docker "$USER" || true
  echo "Installed Docker. Log out/in (or run 'newgrp docker') for group changes to apply."
fi

# ---------------------------------------------------------------------------
log "Verifying AWS credentials are configured"
if aws sts get-caller-identity &>/dev/null; then
  aws sts get-caller-identity
  echo "AWS credentials OK."
else
  echo "AWS credentials are NOT configured yet."
  echo "Run: aws configure"
  echo "(or export AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_DEFAULT_REGION)"
fi

log "All prerequisites installed. Versions:"
aws --version
kubectl version --client
eksctl version
helm version --short
terraform version | head -1
docker --version || true
