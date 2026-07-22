
# 🚀 QuizPortal Deployment Handbook

> Complete deployment, infrastructure, debugging, Judge0 VM, Ngrok, Render, Vercel, Redis (Upstash), Azure VM, Docker, SSH, and production notes.

---

# Architecture

```
                Vercel (Frontend)
                        │
                        ▼
               Render (Node Backend)
                        │
          ┌─────────────┴─────────────┐
          │                           │
          ▼                           ▼
   Upstash Redis               Judge0 API
                                   │
                                   ▼
                           Ngrok Tunnel
                                   │
                                   ▼
                              Azure VM
```

---

# 1. Azure VM

## Check VM status

```powershell
Test-NetConnection <VM_IP> -Port 22
```

Example

```powershell
Test-NetConnection 85.211.180.108 -Port 22
```

---

## SSH into VM

```bash
ssh azureuser@85.211.180.108
```

---

## Copy files

PowerShell

```powershell
scp `
"E:\project\docker-compose.yml" `
"E:\project\judge0.conf" `
"E:\project\setup-judge0.sh" `
azureuser@85.211.180.108:~/
```

Git Bash

```bash
scp docker-compose.yml judge0.conf setup-judge0.sh azureuser@85.211.180.108:~/
```

---

## Verify uploaded files

```bash
ls -lah
```

---

# 2. Network Troubleshooting

Check SSH

```powershell
Test-NetConnection 85.211.180.108 -Port 22
```

Ping

```powershell
ping 85.211.180.108
```

Trace

```powershell
tracert 85.211.180.108
```

Public IP

```powershell
curl https://ifconfig.me
```

---

## Check routing

```powershell
route print
```

Delete broken default route

```powershell
route delete 0.0.0.0
```

---

## Disable Internet Connection Sharing

```powershell
Stop-Service SharedAccess

Set-Service SharedAccess -StartupType Disabled
```

Verify

```powershell
Get-Service SharedAccess
```

---

## Check Adapter

```powershell
Get-NetIPConfiguration
```

```powershell
ipconfig /all
```

```powershell
ipconfig
```

---

## Check DNS

```powershell
Get-DnsClientServerAddress -InterfaceAlias "Wi-Fi" -AddressFamily IPv4
```

---

## Check IPv4

```powershell
Get-NetIPInterface -InterfaceAlias "Wi-Fi" -AddressFamily IPv4
```

---

## Check IPv4 binding

```powershell
Get-NetAdapterBinding -Name "Wi-Fi" -ComponentID ms_tcpip
```

---

## Internet Test

Cloudflare

```powershell
Test-NetConnection 1.1.1.1 -Port 443
```

Google

```powershell
Test-NetConnection 8.8.8.8 -Port 53
```

Github

```powershell
Test-NetConnection github.com -Port 22
```

Github SSH

```powershell
Test-NetConnection ssh.github.com -Port 443
```

---

# 3. Verify SSH Service

Azure CLI

```bash
az vm run-command invoke \
-g quiz-portal-rg \
-n judge0-vm \
--command-id RunShellScript \
--scripts "sudo systemctl status ssh --no-pager"
```

---

Verify sshd listening

```bash
az vm run-command invoke \
-g quiz-portal-rg \
-n judge0-vm \
--command-id RunShellScript \
--scripts "sudo ss -tlnp | grep :22"
```

---

# 4. Judge0 Installation

Create directory

```bash
sudo mkdir -p /opt/judge0
```

Copy files

```bash
sudo cp docker-compose.yml /opt/judge0/

sudo cp judge0.conf /opt/judge0/
```

Verify

```bash
ls -lah /opt/judge0
```

---

Give execute permission

```bash
chmod +x setup-judge0.sh
```

Run

```bash
./setup-judge0.sh
```

---

# 5. Docker

Docker Version

```bash
docker --version
```

Compose Version

```bash
docker compose version
```

Containers

```bash
docker ps
```

All containers

```bash
docker ps -a
```

Logs

```bash
docker compose logs
```

Realtime Logs

```bash
docker compose logs -f
```

Start

```bash
docker compose up -d
```

Stop

```bash
docker compose down
```

Restart

```bash
docker compose restart
```

---

# 6. Judge0 Testing

Languages

```bash
curl http://localhost:2358/languages
```

Health

```bash
curl http://localhost:2358
```

---

# 7. Ngrok Installation

Download

```bash
curl -sSL https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-amd64.tgz -o ngrok.tgz
```

Extract

```bash
tar -xzf ngrok.tgz
```

Install

```bash
sudo mv ngrok /usr/local/bin/
```

Verify

```bash
ngrok version
```

---

Authenticate

```bash
ngrok config add-authtoken YOUR_AUTHTOKEN
```

---

Run tunnel

```bash
ngrok http \
--domain=woven-estate-overpay.ngrok-free.dev \
2358
```

---

Expected

```
https://woven-estate-overpay.ngrok-free.dev
```

---

Test

```bash
curl https://woven-estate-overpay.ngrok-free.dev/languages
```

---

# 8. Run Ngrok as Service

Create

```bash
sudo nano /etc/systemd/system/ngrok.service
```

Contents

```ini
[Unit]
Description=Ngrok Judge0 Tunnel
After=network.target docker.service

[Service]
User=azureuser
WorkingDirectory=/home/azureuser
ExecStart=/usr/local/bin/ngrok http --domain=woven-estate-overpay.ngrok-free.dev 2358
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Save

```
CTRL+O

ENTER

CTRL+X
```

Reload

```bash
sudo systemctl daemon-reload
```

Enable

```bash
sudo systemctl enable ngrok
```

Start

```bash
sudo systemctl start ngrok
```

Status

```bash
sudo systemctl status ngrok
```

Logs

```bash
journalctl -u ngrok -f
```

Restart

```bash
sudo systemctl restart ngrok
```

---

# 9. Render Backend

Deploy

```
Root Directory

backend
```

Build

```
npm install
```

Start

```
npm start
```

---

Environment Variables

```
NODE_ENV=production

PORT=10000

CLIENT_URL=https://your-frontend.vercel.app

BACKEND_URL=https://your-backend.onrender.com

JUDGE0_API_URL=https://woven-estate-overpay.ngrok-free.dev

REDIS_URL=rediss://default:password@noble-dassie-181752.upstash.io:6379

SUPABASE_URL=...

SUPABASE_ANON_KEY=...

SUPABASE_SERVICE_ROLE_KEY=...

JWT_SECRET=...

GOOGLE_CLIENT_ID=...

GOOGLE_CLIENT_SECRET=...
```

---

Health

```
https://backend.onrender.com/health
```

Swagger

```
https://backend.onrender.com/api-docs
```

Metrics

```
https://backend.onrender.com/metrics
```

---

# 10. Vercel Frontend

Framework

```
Vite
```

Root

```
frontend
```

Build

```
npm run build
```

Output

```
dist
```

---

Environment Variables

```
VITE_BACKEND_URL=https://backend.onrender.com
```

---

Redeploy

```
Deployments

Redeploy
```

---

# 11. Upstash Redis

TCP Endpoint

```
rediss://default:password@noble-dassie-181752.upstash.io:6379
```

Always use

```
rediss://
```

Never

```
redis://
```

---

# 12. Redis Debugging

Common Errors

```
ECONNRESET
```

```
missing 'error' handler
```

```
Could not connect to Redis
```

---

Fixes

✅ Use TLS

```
rediss://
```

---

Attach error handler

```javascript
redis.on("error", console.error);
```

---

Reuse clients

Avoid

```javascript
new Redis()
new Redis()
new Redis()
```

Prefer

```javascript
duplicateClient()
```

---

Socket.io

Use dedicated

```
pubClient

subClient
```

---

BullMQ

Reuse

```
connection
```

---

# 13. Production Process

Runs

```
Express Server

Submission Worker

Audit Worker
```

via

```
start-production.js
```

---

# 14. Useful Docker Commands

Images

```bash
docker images
```

Prune

```bash
docker system prune
```

Disk

```bash
docker system df
```

Restart

```bash
docker restart CONTAINER
```

Shell

```bash
docker exec -it CONTAINER bash
```

---

# 15. Azure Useful Commands

Disk

```bash
df -h
```

Memory

```bash
free -h
```

CPU

```bash
top
```

Processes

```bash
htop
```

(if installed)

IP

```bash
hostname -I
```

OS

```bash
uname -a
```

Updates

```bash
sudo apt update
```

Upgrade

```bash
sudo apt upgrade
```

---

# 16. Git Commands

Status

```bash
git status
```

Add

```bash
git add .
```

Commit

```bash
git commit -m "message"
```

Push

```bash
git push origin main
```

Pull

```bash
git pull
```

---

# 17. Production URLs

Frontend

```
https://quizportal.vercel.app
```

Backend

```
https://quizportal-backend.onrender.com
```

Judge0

```
https://woven-estate-overpay.ngrok-free.dev
```

Swagger

```
https://backend/api-docs
```

Metrics

```
https://backend/metrics
```

Health

```
https://backend/health
```

---

# 18. Deployment Order

```
1. Azure VM

2. Install Docker

3. Install Judge0

4. Verify localhost:2358

5. Install Ngrok

6. Verify Judge0 URL

7. Deploy Backend on Render

8. Configure Redis

9. Configure Supabase

10. Deploy Frontend on Vercel

11. Test End-to-End

12. Monitor Logs
```

---

# 19. Production Checklist

- [ ] Azure VM running
- [ ] Docker running
- [ ] Judge0 containers healthy
- [ ] localhost:2358 works
- [ ] Ngrok tunnel active
- [ ] Judge0 URL reachable
- [ ] Redis connected
- [ ] Socket.io connected
- [ ] BullMQ workers online
- [ ] Render backend healthy
- [ ] Vercel frontend deployed
- [ ] Swagger accessible
- [ ] Metrics accessible
- [ ] Health endpoint OK
- [ ] Full code execution tested
- [ ] Redis cache working
- [ ] Submission queue working
- [ ] Audit queue working
- [ ] End-to-End quiz submission verified
