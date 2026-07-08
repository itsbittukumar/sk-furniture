# SK Furniture — Infrastructure & Deployment Plan

This folder has everything needed to go from a blank AWS account to a running
cluster and a working Jenkins pipeline. Pick **either** the eksctl path or the
Terraform path to create the cluster — don't run both against the same name.

```
infra/
├── scripts/
│   ├── 00-install-prerequisites.sh   installs aws cli, kubectl, eksctl, helm, docker
│   ├── 01-create-eks-cluster.sh      creates the cluster (eksctl path)
│   ├── 02-install-cluster-addons.sh  ingress-nginx, metrics-server, storageclass, autoscaler
│   └── 03-deploy-app.sh              builds, pushes, and deploys SK Furniture itself
├── eksctl/
│   └── cluster-config.yaml           cluster definition used by 01-create-eks-cluster.sh
└── terraform/
    ├── versions.tf / variables.tf / main.tf / outputs.tf   (Terraform path, alternative to eksctl)
```

---

## Full plan, in order

### Step 1 — Install prerequisites (once, on your machine or the Jenkins agent)

```bash
bash infra/scripts/00-install-prerequisites.sh
aws configure    # if it reports credentials aren't set up yet
```

Installs: AWS CLI v2, kubectl, eksctl, Helm, Docker. Idempotent — safe to re-run.

### Step 2 — Create the EKS cluster (choose ONE)

**Option A: eksctl (simpler, good default)**
```bash
bash infra/scripts/01-create-eks-cluster.sh
```
Reads `infra/eksctl/cluster-config.yaml` — a VPC, a 2–6 node managed node group
(t3.medium), the IAM OIDC provider (needed for IRSA), and the `aws-ebs-csi-driver`
addon (needed for the MongoDB volume) are all created for you. Takes ~15–20 minutes.

**Option B: Terraform (better if you already manage other AWS infra with Terraform)**
```bash
cd infra/terraform
terraform init
terraform plan   -var="cluster_name=sk-furniture-cluster" -var="region=ap-south-1"
terraform apply  -var="cluster_name=sk-furniture-cluster" -var="region=ap-south-1"

# then point kubectl at it (Terraform prints this exact command as an output):
aws eks update-kubeconfig --name sk-furniture-cluster --region ap-south-1
```
Uses the well-tested `terraform-aws-modules/vpc` and `terraform-aws-modules/eks`
modules: private subnets for nodes + NAT gateway, IRSA enabled, and an IRSA role
already wired up for the EBS CSI driver addon. Also creates a spare IRSA role for
the AWS Load Balancer Controller in case you want ALB ingress instead of
ingress-nginx later.

Either path leaves you with a working cluster and `kubectl` pointed at it — Steps 3+
are identical after that.

### Step 3 — Install what the cluster needs to actually serve traffic

```bash
bash infra/scripts/02-install-cluster-addons.sh
```
Installs: a default `gp3` StorageClass (so the MongoDB PVC provisions
automatically), `metrics-server` (required for the HPAs in `k8s/07-hpa.yaml`),
the `ingress-nginx` controller (provisions an AWS Network Load Balancer for you),
and `cluster-autoscaler` (nodes scale 2→6 automatically under load).

### Step 4 — First deploy of the application (manual, once)

```bash
export ADMIN_PASSWORD='pick-a-strong-password'
bash infra/scripts/03-deploy-app.sh
```
This builds both Docker images, creates the ECR repos if missing, pushes the
images, creates the namespace/secret, deploys MongoDB + backend + frontend,
runs the seed job (creates the admin account + starter catalog), and applies
the Ingress + autoscalers. At the end it prints the load balancer hostname —
point your domain's DNS (CNAME) at it, or hit it directly to test.

### Step 5 — Hand off future deploys to Jenkins

From here on, use the `Jenkinsfile` at the project root instead of re-running
step 4 by hand — see the Jenkins section below.

---

## Provisioning the cluster with Terraform, run entirely through Jenkins

This is the flow to use if you want Jenkins (not your own terminal) to create
the cluster itself, via Terraform. It's a **separate Jenkins job** from the
app-deploy pipeline, because infrastructure changes rarely while the app
deploys on every push.

### One-time setup

1. **Create the Terraform remote state backend** (S3 bucket + DynamoDB lock
   table) — do this once, by hand, from anywhere with AWS credentials:
   ```bash
   AWS_REGION=ap-south-1 bash infra/scripts/05-bootstrap-terraform-backend.sh
   ```
   It prints a bucket name like `sk-furniture-tfstate-123456789012` — copy it.

2. **Edit `infra/terraform/Jenkinsfile`** and set `TF_STATE_BUCKET` to that
   exact bucket name. Commit and push:
   ```bash
   git add infra/terraform/Jenkinsfile
   git commit -m "Set terraform state bucket"
   git push
   ```

3. **Jenkins agent needs Terraform** in addition to the other tools — already
   covered if you ran `infra/scripts/00-install-prerequisites.sh` or
   `infra/scripts/04-setup-jenkins-server.sh` (both install Terraform now).

4. **Jenkins agent's AWS identity needs broad infra permissions** for this job
   specifically (it creates VPCs, IAM roles, EKS clusters, EC2 instances) —
   wider than the app-deploy job needs. Easiest: attach `AdministratorAccess`
   to the instance role for initial setup, then narrow it down later once you
   know exactly what Terraform touches.

### Create the Terraform Jenkins job

1. Jenkins dashboard → **New Item** → name it `sk-furniture-infra` → **Pipeline** → OK
2. **Pipeline** section:
   - Definition: **Pipeline script from SCM**
   - SCM: **Git**, Repository URL: your GitHub repo
   - Script Path: `infra/terraform/Jenkinsfile`
3. Save.

### Run it

1. **Build with Parameters** → `ACTION = plan` → Build. Read the plan output
   in the console log — this only previews, it changes nothing.
2. Happy with the plan? **Build with Parameters** → `ACTION = apply` → Build.
   The pipeline pauses at an **Approval** step (`input` prompt) — click
   **Proceed** in the Jenkins UI to actually create the cluster. It then runs
   `terraform apply`, points kubectl at the new cluster, and installs the
   cluster add-ons (ingress-nginx, metrics-server, storage class, autoscaler)
   automatically.
3. First time only, deploy the app itself the same way as before:
   ```bash
   ADMIN_PASSWORD='StrongPassword123' bash infra/scripts/03-deploy-app.sh
   ```
   (Run this from the Jenkins server / any machine with kubectl pointed at the
   cluster — or wire it as an extra stage in this same Jenkinsfile if you'd
   rather it run automatically after apply.)
4. From then on, use the **app-deploy** pipeline (root `Jenkinsfile`, see
   below) for every code push — you don't need to touch the Terraform job
   again unless you're changing cluster infrastructure itself (node count,
   instance type, VPC, etc.), in which case: edit `infra/terraform/*.tf`,
   push, run this job again with `ACTION = plan` then `ACTION = apply`.

### Tearing the cluster down

**Build with Parameters** → `ACTION = destroy` → Build → approve the prompt.
Terraform removes the cluster, node group, and VPC. (Run
`kubectl delete namespace sk-furniture` first if you want a clean app
teardown too, though destroying the cluster removes everything either way.)

---

## Setting up the app-deploy Jenkins pipeline

1. **Jenkins agent needs the same tools** as your workstation: run
   `infra/scripts/00-install-prerequisites.sh` on whatever host/container runs
   the Jenkins agent (docker, aws cli, kubectl).

2. **Give the Jenkins agent AWS access.** Two options:
   - **Simplest for EKS:** run the Jenkins agent on an EC2 instance (or as an
     EKS pod) with an IAM role attached that has ECR push/pull and
     `eks:DescribeCluster` + cluster access (add the role's ARN to the
     cluster's `aws-auth` ConfigMap / EKS access entries). No credentials to
     store in Jenkins at all — the `Jenkinsfile` as written assumes this.
   - **Otherwise:** install the *AWS Credentials* and *Pipeline: AWS Steps*
     Jenkins plugins, add an "AWS Credentials" entry in
     *Manage Jenkins → Credentials* named `aws-jenkins-creds`, and wrap the AWS
     CLI/kubectl stages in the `Jenkinsfile` with:
     ```groovy
     withCredentials([[$class: 'AmazonWebServicesCredentialsBinding', credentialsId: 'aws-jenkins-creds']]) {
         // existing sh steps go here
     }
     ```

3. **Create the pipeline job:** New Item → Pipeline → "Pipeline script from SCM"
   → point it at this repo → Script Path `Jenkinsfile`.

4. **First run:** tick the `RUN_SEED` build parameter so it seeds the database
   (only needed once — safe to leave off after that; the seed script skips
   re-seeding if data already exists).

5. **Every push after that:** just run the job (or wire an SCM webhook so it
   triggers automatically). It builds both images tagged with the Git commit
   SHA, pushes to ECR, updates the two Deployments, waits for the rollout, and
   runs a health-check against `/api/health`.

Rollback if a deploy goes bad:
```bash
kubectl -n sk-furniture rollout undo deployment/backend
kubectl -n sk-furniture rollout undo deployment/frontend
```

---

## Tearing it down

```bash
# Delete the app first (leaves the cluster running)
kubectl delete namespace sk-furniture

# Then the cluster:
eksctl delete cluster --name sk-furniture-cluster --region ap-south-1
# — or, if you used Terraform —
cd infra/terraform && terraform destroy
```
