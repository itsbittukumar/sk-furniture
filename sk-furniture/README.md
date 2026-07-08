# SK Furniture — E-commerce Platform

A full-stack furniture store: React + Vite frontend, Node/Express + MongoDB backend,
JWT auth, an admin dashboard, and real product images. Built to run locally, in
Docker, or on any Kubernetes cluster (AWS EKS, GKE, AKS, kind, minikube, etc).

```
sk-furniture/
├── backend/         Node/Express API + MongoDB models
├── frontend/         React (Vite) storefront + admin dashboard
├── k8s/              Kubernetes manifests (namespace, mongo, backend, frontend, ingress)
├── docker-compose.yml
└── README.md
```

## What you get

- Public storefront: browse by category, search, view product detail, cart, checkout
- Real user accounts: signup/login with bcrypt-hashed passwords and JWT sessions, stored in MongoDB
- Role-based access: only `role: admin` accounts can add/edit/delete products, edit the
  homepage/sale banner, or view the customer and order lists — enforced **server-side**
  in `backend/src/middleware/auth.js`, not just hidden in the UI
- Admin dashboard: add furniture (with image URL, price, stock, category), edit price/stock/deal
  flags inline, edit the homepage headline/subtext and sale banner, view registered customers and orders
- Seed script creates one admin account and 18 starter products with visible placeholder images
  (`backend/src/seed.js`) — replace the image URLs any time via the admin form

---

## 1. Run it locally (fastest way to try it)

Requirements: Node.js 20+, and either a local MongoDB or Docker.

```bash
# 1. Start MongoDB (skip if you already have one running)
docker run -d --name sk-mongo -p 27017:27017 mongo:7

# 2. Backend
cd backend
cp .env.example .env          # edit if needed
npm install
npm run seed                  # creates admin user + starter catalog
npm run dev                   # http://localhost:5000

# 3. Frontend (in a new terminal)
cd ../frontend
cp .env.example .env          # VITE_API_URL=/api works with the dev proxy below
npm install
npm run dev                   # http://localhost:5173
```

The Vite dev server proxies `/api` to `http://localhost:5000` automatically
(see `frontend/vite.config.js`), so you don't need to change anything to test.

Log in as admin with **username `admin`, password `admin@123`** (change this — see below).

---

## 2. Run it with Docker Compose (one command, no local Node/Mongo needed)

```bash
docker compose up --build -d
docker compose exec backend npm run seed
```

Open **http://localhost:8080**. The frontend container proxies `/api` to the backend
container internally, so nothing else needs configuring.

To stop: `docker compose down` (add `-v` to also delete the MongoDB volume).

---

## 3. Deploy to Kubernetes (AWS EKS or any cluster)

### 3.1 Build and push images to a registry

Kubernetes needs to pull your images from a registry it can reach. For AWS EKS,
that's usually Amazon ECR.

```bash
# Set these to your own values
export AWS_REGION=ap-south-1
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
export REGISTRY=$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

# Create ECR repositories (one-time)
aws ecr create-repository --repository-name sk-furniture-backend  --region $AWS_REGION
aws ecr create-repository --repository-name sk-furniture-frontend --region $AWS_REGION

# Authenticate Docker to ECR
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $REGISTRY

# Build and push the backend
docker build -t $REGISTRY/sk-furniture-backend:1.0.0 ./backend
docker push $REGISTRY/sk-furniture-backend:1.0.0

# Build and push the frontend
docker build -t $REGISTRY/sk-furniture-frontend:1.0.0 ./frontend
docker push $REGISTRY/sk-furniture-frontend:1.0.0
```

(Using a different registry — Docker Hub, GCR, ACR? Just `docker login` there instead
and tag images as `<your-registry>/sk-furniture-backend:1.0.0` etc.)

### 3.2 Point the manifests at your images

Edit these two lines:

- `k8s/03-backend.yaml` → `image: sk-furniture-backend:latest`
- `k8s/04-seed-job.yaml` → `image: sk-furniture-backend:latest`
- `k8s/05-frontend.yaml` → `image: sk-furniture-frontend:latest`

Replace with e.g. `123456789012.dkr.ecr.ap-south-1.amazonaws.com/sk-furniture-backend:1.0.0`.

### 3.3 Create/connect to your cluster

If you don't have an EKS cluster yet:

```bash
eksctl create cluster \
  --name sk-furniture-cluster \
  --region ap-south-1 \
  --nodes 2 \
  --node-type t3.medium \
  --managed
```

Point `kubectl` at the cluster (works the same for EKS or any other cluster):

```bash
aws eks update-kubeconfig --name sk-furniture-cluster --region ap-south-1
kubectl get nodes     # sanity check
```

### 3.4 Set real secrets (don't leave the sample password in place)

Instead of editing `k8s/01-secrets.yaml` directly, create the secret from the
command line so real values never sit in version control:

```bash
kubectl create namespace sk-furniture

kubectl create secret generic sk-backend-secret \
  --namespace sk-furniture \
  --from-literal=MONGO_URI="mongodb://mongo:27017/skfurniture" \
  --from-literal=JWT_SECRET="$(openssl rand -hex 32)" \
  --from-literal=SEED_ADMIN_USERNAME="admin" \
  --from-literal=SEED_ADMIN_PASSWORD="<pick-a-strong-password>" \
  --from-literal=SEED_ADMIN_EMAIL="admin@yourdomain.com"
```

Then skip applying `k8s/00-namespace.yaml` and `k8s/01-secrets.yaml` (already done above).

### 3.5 Apply everything

```bash
kubectl apply -f k8s/00-namespace.yaml      # skip if you created it via CLI above
kubectl apply -f k8s/01-secrets.yaml        # skip if you created it via CLI above
kubectl apply -f k8s/02-mongo.yaml
kubectl apply -f k8s/03-backend.yaml
kubectl apply -f k8s/05-frontend.yaml

# Wait for backend pods to be ready, then seed the database once:
kubectl -n sk-furniture rollout status deployment/backend
kubectl apply -f k8s/04-seed-job.yaml
kubectl -n sk-furniture logs job/sk-seed -f

# Optional: ingress + autoscaling
kubectl apply -f k8s/06-ingress.yaml
kubectl apply -f k8s/07-hpa.yaml
```

### 3.6 Expose it to the internet

**Option A — Ingress (recommended, one domain):**
Install an ingress controller if the cluster doesn't have one:

```bash
# ingress-nginx (works on any cluster)
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.10.1/deploy/static/provider/aws/deploy.yaml
```

Then edit `k8s/06-ingress.yaml` — set `host:` to your real domain — and re-apply it.
Point your domain's DNS at the ingress controller's external address:

```bash
kubectl get svc -n ingress-nginx ingress-nginx-controller
# copy the EXTERNAL-IP / hostname into your DNS provider as an A/CNAME record
```

**Option B — quick test without a domain (LoadBalancer Service):**

```bash
kubectl -n sk-furniture patch svc frontend -p '{"spec": {"type": "LoadBalancer"}}'
kubectl -n sk-furniture get svc frontend      # use the EXTERNAL-IP shown
```

### 3.7 Verify

```bash
kubectl -n sk-furniture get pods
kubectl -n sk-furniture get svc
curl http://<external-ip-or-domain>/api/health   # should return {"status":"ok"}
```

Open the site in a browser and log in with the admin credentials you set in step 3.4.

---

## Updating the app later

```bash
# Rebuild and push a new image tag, then:
kubectl -n sk-furniture set image deployment/backend  backend=$REGISTRY/sk-furniture-backend:1.0.1
kubectl -n sk-furniture set image deployment/frontend frontend=$REGISTRY/sk-furniture-frontend:1.0.1
kubectl -n sk-furniture rollout status deployment/backend
kubectl -n sk-furniture rollout status deployment/frontend
```

## Notes on the security model

- Passwords are hashed with bcrypt before being stored — never stored in plain text.
- JWTs are signed with `JWT_SECRET` (set your own long random value — don't keep the sample).
- Every product-editing, storefront-settings, customer-list, and all-orders endpoint checks
  `role === "admin"` on the server, so a customer can't call the API directly to bypass the UI.
- Signup always creates a `customer` account — there is no public way to register as admin.
  Create additional admins by editing a user's `role` field directly in MongoDB, or by
  extending `seed.js`.
- For production, also: put MongoDB behind a private subnet/security group (don't expose
  27017 publicly), enable TLS on the Ingress (e.g. via cert-manager + Let's Encrypt), and
  rotate `JWT_SECRET` if it's ever leaked.

## Swapping in real product photos

The seed data uses `placehold.co` images so the storefront always shows something
on first run. To use your own photography: host the images anywhere public (S3 bucket,
Cloudinary, your own CDN) and paste the URL into the **Image URL** field when adding or
editing a product in the admin dashboard — no code changes needed.

---

## Where is the data actually stored?

**Database:** MongoDB, running as its own pod in the cluster (`k8s/02-mongo.yaml`).
The backend never stores data in files or in memory — every user, product, cart, and
order is a document in this MongoDB instance, reached via the connection string in
the `MONGO_URI` secret (`mongodb://mongo:27017/skfurniture`).

**Disk:** MongoDB's data directory (`/data/db` inside the container) is mounted from a
**PersistentVolumeClaim** (`mongo-pvc`, 5Gi). On EKS, the default StorageClass provisions
this as a real **Amazon EBS volume** — so data survives pod restarts, node replacement,
and redeploys. It's only lost if someone explicitly deletes the PVC.

```bash
# See the PVC and which EBS volume backs it
kubectl -n sk-furniture get pvc mongo-pvc
kubectl -n sk-furniture describe pvc mongo-pvc
```

**Important limitation of the current setup:** it's a single MongoDB pod with one EBS
volume — good for getting a real store running quickly, but not highly available (if
that one node goes down, Mongo is briefly unavailable) and you're responsible for
backups. For a production launch, either:
- Take scheduled EBS snapshots of the volume (or `mongodump` to S3 on a cron), or
- Swap in a managed database instead of the in-cluster pod — **Amazon DocumentDB**
  (MongoDB-compatible) or **MongoDB Atlas** — and just change `MONGO_URI` to point at
  it. No application code changes needed either way, since Mongoose only cares about
  the connection string.

Everything else (product images, if you switch to your own hosted photos) lives
wherever you host them (S3, Cloudinary, etc.) — the app just stores the URL string.

---

## Two ways to run this in production

### Option A — Deploy directly to EKS by hand
Follow section 3 above (`eksctl create cluster` → build/push images → `kubectl apply`
the manifests in order → seed once → expose via Ingress). Good for a first deploy or
occasional manual updates.

### Option B — CI/CD pipeline (recommended once it's live)
`.github/workflows/deploy.yml` is a ready-to-use GitHub Actions pipeline. On every
push to `main` it:
1. Builds the backend and frontend Docker images
2. Tags each with the commit SHA and pushes them to Amazon ECR
3. Updates the `backend` and `frontend` Deployments in EKS to that new tag
4. Waits for the rollout to finish and runs a health-check against `/api/health`

**One-time setup before the pipeline can run:**
```bash
# 1. Cluster, namespace, secret, ECR repos, and mongo/backend/frontend must already
#    exist once (Option A, steps 3.3–3.5) — the pipeline only updates images after that.

# 2. Give GitHub Actions AWS credentials, as repo secrets:
#    Settings → Secrets and variables → Actions → New repository secret
#      AWS_ACCESS_KEY_ID
#      AWS_SECRET_ACCESS_KEY
```

Then just `git push` to `main` and watch the Actions tab — it builds and deploys
automatically. To roll back, re-run the workflow for an older commit, or:
```bash
kubectl -n sk-furniture rollout undo deployment/backend
kubectl -n sk-furniture rollout undo deployment/frontend
```

**Alternative: OIDC instead of access keys (more secure, no long-lived secrets).**
Create an IAM role trusted by GitHub's OIDC provider and reference its ARN with
`role-to-assume` in `aws-actions/configure-aws-credentials` instead of the key/secret
pair — AWS's guide: https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services

---

## Full infrastructure setup (prerequisites, eksctl, Terraform, Jenkins)

For a from-scratch AWS account → running cluster → automated Jenkins deploys,
see **[infra/README.md](infra/README.md)**. It covers, in order:

1. `infra/scripts/00-install-prerequisites.sh` — installs AWS CLI, kubectl, eksctl, Helm, Docker
2. Creating the cluster — either `infra/scripts/01-create-eks-cluster.sh` (eksctl) or
   `infra/terraform/` (Terraform, using the terraform-aws-modules VPC + EKS modules)
3. `infra/scripts/02-install-cluster-addons.sh` — ingress-nginx, metrics-server, storage class, cluster-autoscaler
4. `infra/scripts/03-deploy-app.sh` — first manual deploy of SK Furniture itself
5. The root `Jenkinsfile` — automated build/push/deploy pipeline for every push after that
