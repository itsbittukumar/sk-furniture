#!/usr/bin/env bash
# Sets up a Jenkins server (on a fresh Ubuntu EC2 instance) with every tool the
# SK Furniture Jenkinsfile needs: Java, Jenkins, Docker, AWS CLI, kubectl, eksctl, Helm.
# Run this ON the EC2 instance that will run Jenkins:
#   bash infra/scripts/04-setup-jenkins-server.sh
set -euo pipefail

log() { echo -e "\n\033[1;34m==> $1\033[0m"; }

log "Installing Java 17 (required by modern Jenkins)"
sudo apt-get update -y
sudo apt-get install -y fontconfig openjdk-17-jre

log "Adding the Jenkins apt repo and installing Jenkins"
sudo mkdir -p /usr/share/keyrings
curl -fsSL https://pkg.jenkins.io/debian-stable/jenkins.io-2023.key | \
  sudo tee /usr/share/keyrings/jenkins-keyring.asc > /dev/null
echo "deb [signed-by=/usr/share/keyrings/jenkins-keyring.asc] https://pkg.jenkins.io/debian-stable binary/" | \
  sudo tee /etc/apt/sources.list.d/jenkins.list > /dev/null
sudo apt-get update -y
sudo apt-get install -y jenkins

log "Installing Docker and giving the jenkins user access to it"
if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com -o /tmp/get-docker.sh
  sudo sh /tmp/get-docker.sh
fi
sudo usermod -aG docker jenkins

log "Installing AWS CLI v2, kubectl, eksctl, and Helm (same as infra/scripts/00-install-prerequisites.sh)"
bash "$(dirname "${BASH_SOURCE[0]}")/00-install-prerequisites.sh"

log "Restarting Jenkins so the docker group membership takes effect"
sudo systemctl enable jenkins
sudo systemctl restart jenkins

log "Waiting for Jenkins to start"
until curl -s -o /dev/null http://localhost:8080; do sleep 2; done

echo ""
echo "Jenkins is up on http://<this-server-ip>:8080"
echo "Initial admin password:"
sudo cat /var/lib/jenkins/secrets/initialAdminPassword
echo ""
echo "Next: open that URL, paste the password above, install suggested plugins,"
echo "then follow infra/README.md 'Setting up the Jenkins pipeline'."
