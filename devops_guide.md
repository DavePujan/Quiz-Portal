# Quiz Portal DevOps Runbook

Use this runbook together with [deployment architecture.md](deployment%20architecture.md). It describes how to deploy and operate the production stack ($0/month free tier + Azure B2S for Judge0 paid from the $100 credit).

## Environment Variables Reference

### Render (API + Workers) — set in Render Dashboard > Environment

```dotenv
NODE_ENV=production
PORT=5000
CLIENT_URL=https://your-app.vercel.app
DATABASE_URL=postgresql://...                  # Supabase pooler URL (Settings > Database > Connection String > URI, use "Transaction" pooler)
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
JWT_SECRET=...
REFRESH_SECRET=...
REDIS_URL=rediss://default:<password>@<region>.upstash.io:6379   # Upstash TLS URL (note: rediss:// not redis://)
JUDGE0_API_URL=https://judge0.your-domain.com  # Enforced Cloudflare Tunnel URL (no public VM ports open)
JUDGE0_API_KEY=...                             # If using Judge0 AUTHN_TOKEN
GOOGLE_ID=...
GOOGLE_SECRET=...
GOOGLE_CALLBACK_URL=https://your-api.onrender.com/auth/google/callback
GITHUB_ID=...
GITHUB_SECRET=...
GITHUB_CALLBACK_URL=https://your-api.onrender.com/auth/github/callback
OPENAI_API_KEY=...
GEMINI_API_KEY=...
USE_NEW_ACADEMIC_MODEL=true
BACKEND_URL=https://your-api.onrender.com      # Workers use this to connect to API via socket.io-client
```

### Vercel (Frontend) — set in Vercel Dashboard > Settings > Environment Variables

```dotenv
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=...
VITE_API_URL=https://your-api.onrender.com
VITE_USE_NEW_ACADEMIC_MODEL=true
```

> [!CAUTION]
> Only `VITE_*` variables go into Vercel. Never put `SUPABASE_SERVICE_ROLE_KEY`, AI keys, or `JWT_SECRET` in the frontend build.

---

## Phase 1: Infrastructure Provisioning

### 1a. Supabase (Database)

1. Create a free Supabase project at [supabase.com](https://supabase.com).
2. Run `schema.sql` in the SQL Editor to create all tables, indexes, and constraints.
3. Copy the **Project URL**, **Anon Key**, **Service Role Key**, and **Pooled Connection String** for use in env vars. (Note: Google/GitHub OAuth credentials and redirects are configured directly on your cloud platform/OAuth portals pointing to the Render API, not in the Supabase Dashboard, as authentication is custom).

### 1b. Upstash (Redis)

1. Create a free Redis database at [upstash.com](https://upstash.com).
2. Copy the **TLS connection URL** (starts with `rediss://`). Upstash enforces TLS by default — no extra config needed.
3. This single Redis instance serves BullMQ queues, rate limiting (`rate-limit-redis`), Socket.io adapter (`@socket.io/redis-adapter`), and token blacklisting.

> [!NOTE]
> This is your **app-level Redis only**. Judge0 has its own bundled Redis inside docker-compose — they are completely independent.

### 1c. Azure Judge0 VM (B2S — Paid from $100 Credit)

> [!IMPORTANT]
> **VM choice: B2S (2 vCPU / 4GB RAM, ~$30–35/month).** This gives ~3 months of runway on $100 credit. The B1S (1GB) is too tight — Judge0's docker-compose runs 4 containers (API, worker, Postgres, Redis) and the actual sandboxed code-execution containers on top of that. 4GB provides the headroom needed for concurrent submissions without OOM.

1. Log into the Azure Portal with your $100 credit account.
2. Create a **B2S** Ubuntu 22.04 LTS VM.
   - Region: choose the cheapest available (e.g., East US, Central India).
   - Disk: 30GB Standard SSD (included in VM cost or very cheap).
   - Authentication: SSH key (not password).
3. **NSG Inbound Rules:** Allow SSH (port 22) from your admin IP only. **Do NOT open port 2358 inbound.**
4. **NSG Outbound Rules:** Default-deny internet egress to prevent submitted user code from reaching external services. (Temporarily allow outbound during initial setup to pull Docker images and install packages, then enforce default-deny).
5. SSH in and deploy Judge0:
   ```bash
   # Install Docker
   sudo apt update && sudo apt install -y docker.io docker-compose-plugin
   sudo usermod -aG docker $USER
   # Re-login for group change
   
   # Deploy Judge0
   mkdir -p /opt/judge0 && cd /opt/judge0
   # Copy docker-compose.yml and judge0.conf from your repo
   # (scp or git clone)
   docker compose up -d
   
   # Verify
   curl http://localhost:2358/languages | head
   ```
6. **Judge0's bundled Postgres and Redis stay on the VM.** They handle Judge0-internal job metadata and queueing — completely separate from your app's Supabase/Upstash. Don't point Judge0 at Upstash; it would add latency for zero benefit.

7. **Set up Cloudflare Tunnel (Required for secure Render → Judge0 connectivity):**
   ```bash
   # Install cloudflared
   curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared
   chmod +x /usr/local/bin/cloudflared
   
   # Create tunnel (requires free Cloudflare account)
   cloudflared tunnel login
   cloudflared tunnel create judge0-tunnel
   cloudflared tunnel route dns judge0-tunnel judge0.your-domain.com
   
   # Configure tunnel to forward to Judge0
   cat > ~/.cloudflared/config.yml << EOF
   tunnel: <tunnel-id>
   credentials-file: /root/.cloudflared/<tunnel-id>.json
   ingress:
     - hostname: judge0.your-domain.com
       service: http://localhost:2358
     - service: http_status:404
   EOF
   
   # Run as service
   cloudflared service install
   systemctl enable cloudflared
   systemctl start cloudflared
   ```
   With this setup, all cross-cloud traffic arrives via Cloudflare's encrypted outbound tunnel. Port 2358 is completely closed to the internet.

---

## Phase 2: Application Deployment

### 2a. Backend API (Render Web Service)

1. Go to [render.com](https://render.com), create a new **Web Service** (free tier).
2. Connect your GitHub repository.
3. Set **Root Directory** to `leetcode-clone/backend`.
4. Set **Build Command** to `npm ci --omit=dev`.
5. Set **Start Command** to `node server.js`.
6. Add all environment variables from the reference above.
7. Render auto-deploys on push to your connected branch.

### 2b. Submission Worker (Render Background Worker)

1. Create a new **Background Worker** service on Render (free tier).
2. Same GitHub repo, same root directory (`leetcode-clone/backend`).
3. Set **Build Command** to `npm ci --omit=dev`.
4. Set **Start Command** to `node workers/submission.worker.js`.
5. Add the same environment variables (especially `REDIS_URL`, `JUDGE0_API_URL`, `BACKEND_URL`, `DATABASE_URL`).

### 2c. Audit Worker (Render Background Worker)

1. Same as 2b but with **Start Command** `node workers/audit.worker.js`.

### 2d. Supabase Edge Functions

```bash
cd leetcode-clone/supabase
npx supabase functions deploy evaluate-attempt
```

### 2e. Frontend (Vercel)

1. Go to [vercel.com](https://vercel.com), import your GitHub repository.
2. Set **Root Directory** to `leetcode-clone/frontend`.
3. Set **Build Command** to `npm run build` (Vercel usually auto-detects Vite).
4. Add the `VITE_*` environment variables.
5. Deploy. Vercel auto-deploys on push.

### 2f. Keep-Alive Cron (Prevent Cold Starts)

Set up a free cron job at [cron-job.org](https://cron-job.org) to ping your Render API's `/health` endpoint every 10 minutes during expected demo/usage hours. This prevents Render's free-tier spin-down and Supabase's inactivity pause.

---

## Phase 3: Validation, Cutover, and Rollback

1. **Validation:**
   - Verify frontend loads and connects to the Render API via HTTPS.
   - Test OAuth flows (Google, GitHub) — confirm callback URLs match the Render service URL.
   - Submit a code execution problem. Confirm the Submission Worker picks it up from Upstash, calls Judge0 on the Azure B2S VM, and writes results back to Supabase.
   - Submit an MCQ quiz. Confirm the `evaluate-attempt` edge function scores it correctly.
   - Verify Socket.io status updates reach the frontend in real time.
   - Test 2–3 concurrent code submissions to confirm the B2S VM handles the load without OOM.

2. **Rollback Plan:**
   - Render supports instant rollback to any previous deploy via the dashboard.
   - Vercel supports the same via its deployment history.
   - If the issue is in the workers, stop the Render background worker services. Pending jobs remain safe in the Upstash Redis queue. Once the previous worker deploy is restored, it will dequeue and process them.
   - **Handling In-Flight Jobs:** Jobs must be idempotent (check-then-write using a unique execution ID) so that BullMQ's stalled-job requeuing cannot produce duplicate DB writes or double-charge external AI calls.

---

## Security Operations: Secrets Rotation

> [!CAUTION]
> `SUPABASE_SERVICE_ROLE_KEY` bypasses Row Level Security (RLS) entirely.

- **Rotation Policy:** Rotate immediately upon suspected compromise, or on a regular schedule.
- **Rotation Procedure:**
  1. Generate the new key in the Supabase Dashboard.
  2. Update the key in all three Render services' environment variables.
  3. Trigger a manual redeploy of each Render service to pick up the new key.
  4. Revoke the old key.

---

## Azure Credit Monitoring

> [!WARNING]
> At ~$30–35/month, your $100 credit gives **~3 months** of Judge0 VM runtime. Monitor remaining credit in the Azure Portal under **Cost Management + Billing > Credits**.

- Set up **budget alerts** at 50% and 90% of remaining credit (or 1 month before expected depletion) to avoid surprise shutdowns and ensure early warnings for reaction/migration planning.
- When credit is exhausted, decide:
  - **Downgrade to B1S** (~$8–9/month, self-funded) if traffic is low enough.
  - **Move Judge0 to Oracle Cloud Always Free** (4 ARM OCPUs, 24GB RAM, $0 — check ARM compatibility with Judge0 images first).
  - **Switch to Judge0 RapidAPI hosted** (50 free requests/day) if self-hosting is no longer needed.

---

## Free-Tier Operational Notes

### Daily Monitoring

| What to Watch | Where |
| :--- | :--- |
| API cold start latency | Render dashboard > Logs |
| Upstash command usage | Upstash console > Usage tab (stay under 500K/month) |
| Judge0 VM health + memory | SSH: `docker stats`, `free -m`, `docker logs` |
| Azure credit remaining | Azure Portal > Cost Management |
| Supabase DB size | Supabase dashboard > Database > Usage (stay under 500MB) |
| BullMQ failed jobs | Render worker logs |

### When to Upgrade

Move off the free tier when any of these happen:
- Cold starts become unacceptable for real users (→ upgrade Render to paid, or migrate API to Railway/Fly.io).
- Upstash 500K command limit is hit (→ upgrade Upstash plan, starts at $10/month).
- Judge0 needs heavier concurrent submission support (→ upgrade VM to B2ms or larger).
- Supabase 500MB DB limit or 1-week pause becomes an issue (→ upgrade Supabase Pro, $25/month).
