# AWS Stop / Resume Guide (Judge0 Deployment)

This document explains how to **pause and resume the AWS infrastructure** used for the Judge0 execution engine to avoid unnecessary AWS credit usage.

Target environment:

* Provider: AWS
* Instance: EC2 (`t3.small` or `t3.medium`)
* OS: Ubuntu 22.04
* Stack:

  * Judge0
  * PostgreSQL
  * Redis
  * Docker
  * Docker Compose

---

# 1. Why Stop the Instance

When the EC2 instance is running:

* CPU
* RAM
* networking

are billed (or deducted from AWS credits).

Stopping the instance:

* stops compute charges
* keeps the disk (EBS volume)
* preserves Judge0 data and configuration

You can **resume later without reinstalling anything**.

---

# 2. Recommended Workflow

For short pauses (hours or overnight):

Stop the **Docker containers only**

For longer pauses (days or weeks):

Stop the **EC2 instance**

---

# 3. Option A — Stop Judge0 Only (Keep Server Running)

SSH into the server:

```
ssh -i your-key.pem ubuntu@AWS_PUBLIC_IP
```

Navigate to the Judge0 folder:

```
cd ~/Quiz-Portal/leetcode-clone/quiz-evaluator/docker/judge0
```

Stop all containers:

```
docker compose down
```

This stops:

* Judge0 API
* Judge0 worker
* Redis
* PostgreSQL

Disk data remains safe.

---

# 4. Resume Judge0

SSH again:

```
ssh -i your-key.pem ubuntu@AWS_PUBLIC_IP
```

Start services:

```
cd ~/Quiz-Portal/leetcode-clone/quiz-evaluator/docker/judge0
docker compose up -d
```

Verify:

```
docker ps
```

Expected containers:

* judge0-server
* judge0-worker
* judge0-db
* judge0-redis

Test API:

```
curl http://localhost:2358/languages
```

---

# 5. Option B — Stop Entire EC2 Instance (Recommended)

Go to:

AWS Console → EC2 → Instances

Select instance:

```
judge0-server
```

Click:

```
Instance state → Stop instance
```

What happens:

* compute stops
* billing pauses
* disk remains attached

Important:

Public IP **may change** after restart unless Elastic IP is used.

---

# 6. Resume the EC2 Instance

Go to:

AWS Console → EC2 → Instances

Select instance.

Click:

```
Instance state → Start instance
```

Wait ~30 seconds.

Then SSH again:

```
ssh -i your-key.pem ubuntu@NEW_PUBLIC_IP
```

---

# 7. Restart Judge0 After EC2 Resume

Sometimes Docker auto-starts containers.

Check:

```
docker ps
```

If not running:

```
cd ~/Quiz-Portal/leetcode-clone/quiz-evaluator/docker/judge0
docker compose up -d
```

---

# 8. Quick Health Check

Verify Judge0:

```
curl http://localhost:2358/languages
```

Verify language execution:

```
curl http://localhost:2358/submissions?wait=true \
-H "Content-Type: application/json" \
-d '{"source_code":"print(2)","language_id":71}'
```

Expected:

```
stdout: "2"
status: Accepted
```

---

# 9. If Public IP Changed

Update backend environment variable:

```
JUDGE0_API_URL=http://NEW_AWS_IP:2358
```

Restart backend.

---

# 10. Optional (Recommended): Use Elastic IP

Elastic IP keeps the same public address after restart.

AWS Console:

EC2 → Elastic IP → Allocate → Associate with instance

Then your backend URL will never change.

---

# 11. Emergency Restart

If Judge0 crashes:

```
docker compose restart
```

Or full reset:

```
docker compose down
docker compose up -d
```

---

# 12. Monitoring Containers

Check running services:

```
docker ps
```

Check logs:

```
docker logs judge0-server
```

Worker logs:

```
docker logs judge0-worker
```

---

# 13. Disk Cleanup (Optional)

Remove unused images:

```
docker system prune -a
```

Be careful: this removes cached images.

---

# 14. Cost Saving Strategy

Best practice during development:

Work session:

```
Start EC2
Start Judge0
Develop/Test
```

End session:

```
docker compose down
Stop EC2 instance
```

This ensures AWS credits last longer.

---

# 15. Summary

Pause compute only:

```
docker compose down
```

Resume services:

```
docker compose up -d
```

Pause entire server:

```
AWS Console → Stop instance
```

Resume server:

```
AWS Console → Start instance
```

Judge0 API endpoint:

```
http://EC2_PUBLIC_IP:2358
```
