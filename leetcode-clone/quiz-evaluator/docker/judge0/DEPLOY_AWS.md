Yes — if using **Amazon Web Services (AWS)** with free credits, the deployment can effectively be **free until the credits are consumed**. 💳
If using a **t3.small or t3.medium EC2** and staying within the credits (often $100–$300 for students/startups), the Judge0 setup you posted will cost **$0 until credits expire**.

Below is a **clean, precise step-by-step guide tailored to your repo structure**.

---

# 1️⃣ Create AWS EC2 Instance

Go to **AWS Console → EC2 → Launch Instance**

Settings:

```
Name: judge0-server
AMI: Ubuntu Server 22.04 LTS
Instance Type: t3.small (or t3.medium if heavy load)
Storage: 20 GB gp3
Key pair: create or use existing
```

Security Group → Add inbound rules:

| Type       | Port |
| ---------- | ---- |
| SSH        | 22   |
| Custom TCP | 2358 |

Launch instance.

---

# 2️⃣ SSH into the instance

```bash
ssh -i your-key.pem ubuntu@AWS_PUBLIC_IP
```

Test connection.

---

# 3️⃣ Upload your project

Your structure:

```
Quiz-Portal/
 └── leetcode-clone/
      └── quiz-evaluator/docker/judge0
```

Upload via git:

```bash
git clone https://github.com/YOUR_REPO.git
cd Quiz-Portal/leetcode-clone
```

Or upload with SCP.

---

# 4️⃣ Move to Judge0 folder

```bash
cd quiz-evaluator/docker/judge0
```

This folder should contain:

```
docker-compose.yml
judge0.conf
aws-bootstrap.sql
Dockerfile.judge0
```

---

# 5️⃣ Install Docker

Run exactly:

```bash
sudo apt update
sudo apt install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
```

Add Docker repo:

```bash
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
| sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
```

Then:

```bash
sudo chmod a+r /etc/apt/keyrings/docker.gpg
```

Add repo:

```bash
echo \
"deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
$(. /etc/os-release && echo $VERSION_CODENAME) stable" \
| sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
```

Install docker:

```bash
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

Allow docker without sudo:

```bash
sudo usermod -aG docker $USER
newgrp docker
```

Test:

```
docker --version
```

---

# 6️⃣ Start Judge0 stack

Inside:

```
quiz-evaluator/docker/judge0
```

Run:

```bash
docker compose pull
docker compose up -d
```

Check containers:

```bash
docker ps
```

Expected:

```
judge0-server
judge0-worker
judge0-db
judge0-redis
```

---

# 7️⃣ Wait for Judge0 API

Test:

```bash
curl http://localhost:2358/languages
```

You should see JSON list of languages.

---

# 8️⃣ Bootstrap languages

Run:

```bash
docker exec -i judge0-db-1 psql -U judge0 -d judge0 < aws-bootstrap.sql
```

Check:

```bash
docker exec -it judge0-db-1 psql -U judge0 -d judge0
```

Then:

```sql
SELECT id,name,is_archived
FROM languages
WHERE id IN (50,54,62,63,68,71);
```

Expected:

```
is_archived = false
```

---

# 9️⃣ Run language matrix test

From repo root:

```bash
pwsh -File tests-scripts/judge0-language-matrix.ps1
```

Expected output:

```
C => Accepted
C++ => Accepted
Java => Accepted
JavaScript => Accepted
Python => Accepted
PHP => Accepted
```

---

# 🔟 Open Judge0 API publicly

Test from browser:

```
http://AWS_PUBLIC_IP:2358/languages
```

If working → Judge0 deployed.

---

# 1️⃣1️⃣ Connect your backend

In backend `.env`:

```
JUDGE0_API_URL=http://AWS_PUBLIC_IP:2358
```

Restart backend:

```
pm2 restart backend
```

or

```
npm start
```

Your submit API will now send code to AWS Judge0.

---

# 1️⃣2️⃣ Test full submission flow

Use your existing endpoint:

```
POST /api/submit
```

From your code:

```js
runBatch(publicSubmissions)
```

Your backend will call:

```
POST /submissions/batch?wait=true
```

Exactly what Judge0 expects.

---

# 1️⃣3️⃣ If Java/JS fail

Small instances sometimes fail compilation.

Upgrade instance:

```
t3.small → t3.medium
```

Then restart:

```bash
docker compose down
docker compose up -d
```

---

# 1️⃣4️⃣ Enable swap (recommended)

On small instances:

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

Add permanently:

```bash
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

This prevents:

```
Java compile OOM
Node compile OOM
```

---

# 1️⃣5️⃣ Scaling workers

Edit compose:

```
worker:
  image: judge0/judge0:latest
```

Scale:

```bash
docker compose up --scale worker=4 -d
```

Now Judge0 can execute **4 submissions simultaneously**.

---

# 1️⃣6️⃣ Final architecture

Your deployed system becomes:

```
Users
 ↓
Frontend (Vercel)
 ↓
Backend (Node API)
 ↓
BullMQ Queue
 ↓
submission.worker.js
 ↓
AWS Judge0 API
 ↓
Docker sandbox
```

Exactly how coding platforms work.

---

# 💰 Cost (with credits)

If you have AWS credits:

| Resource     | Cost       |
| ------------ | ---------- |
| EC2 t3.small | ~$15/month |
| EBS          | ~$2/month  |

With **$100 credits → ~6 months free**.

---

# 🚀 Final result

Your project will now have:

```
Public Judge0 API
Full coding execution engine
Sandboxed compilation
Batch test execution
Scalable workers
```

This makes your project **very close to a real LeetCode architecture**.

---

If you'd like, I can also show a **much better AWS architecture for your project**:

```
ALB
EC2 Backend
EC2 Judge0 Cluster
Redis Elasticache
S3 testcases
```

This is how coding platforms scale to **50k+ submissions/hour**.
