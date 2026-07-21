#!/bin/bash
set -e

echo "=== Step 1: Install Docker ==="
sudo apt update
sudo apt install -y docker.io docker-compose-plugin curl
sudo usermod -aG docker $USER
echo "Docker installed. You'll need to log out/back in for group changes, or use 'sudo' for docker commands below."

echo "=== Step 2: Set up Judge0 ==="
sudo mkdir -p /opt/judge0
cd /opt/judge0

echo ""
echo ">>> ACTION NEEDED: Copy your docker-compose.yml and judge0.conf into /opt/judge0 now."
echo ">>> From your LOCAL machine (not this VM), run:"
echo "    scp docker-compose.yml judge0.conf azureuser@<VM_PUBLIC_IP>:/opt/judge0/"
echo ""
read -p "Press Enter once the files are copied into /opt/judge0..."

sudo docker compose up -d

echo "Waiting 15s for Judge0 to initialize..."
sleep 15

echo "=== Verifying Judge0 is running locally on the VM ==="
curl -s http://localhost:2358/languages | head -c 300
echo ""
echo "If you saw a JSON list of languages above, Judge0 is working."

echo ""
echo "=== Step 3: Install Cloudflare Tunnel ==="
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o cloudflared
chmod +x cloudflared
sudo mv cloudflared /usr/local/bin/cloudflared

echo ""
echo ">>> ACTION NEEDED: Authenticate with Cloudflare (opens a URL — open it in your browser and log in)"
cloudflared tunnel login

echo ""
read -p "Enter a name for your tunnel (e.g., judge0-tunnel): " TUNNEL_NAME
cloudflared tunnel create "$TUNNEL_NAME"

TUNNEL_ID=$(cloudflared tunnel list | grep "$TUNNEL_NAME" | awk '{print $1}')
echo "Tunnel ID: $TUNNEL_ID"

read -p "Enter the subdomain you want (e.g., judge0.yourdomain.com): " TUNNEL_HOSTNAME
cloudflared tunnel route dns "$TUNNEL_NAME" "$TUNNEL_HOSTNAME"

echo "=== Writing tunnel config ==="
sudo mkdir -p /etc/cloudflared
sudo tee /etc/cloudflared/config.yml > /dev/null << EOF
tunnel: $TUNNEL_ID
credentials-file: /root/.cloudflared/$TUNNEL_ID.json
ingress:
  - hostname: $TUNNEL_HOSTNAME
    service: http://localhost:2358
  - service: http_status:404
EOF

# Move credentials to where root's cloudflared service expects them
sudo mkdir -p /root/.cloudflared
sudo cp ~/.cloudflared/$TUNNEL_ID.json /root/.cloudflared/

echo "=== Installing tunnel as a system service (auto-starts on reboot) ==="
sudo cloudflared service install
sudo systemctl enable cloudflared
sudo systemctl start cloudflared

sleep 5
echo "=== Checking tunnel service status ==="
sudo systemctl status cloudflared --no-pager

echo ""
echo "=== DONE ==="
echo "Test from ANY machine (not this VM) with:"
echo "  curl https://$TUNNEL_HOSTNAME/languages"
echo ""
echo "If that returns a JSON list of languages, the full Render -> Cloudflare -> Azure round-trip path is proven."
echo "Set JUDGE0_API_URL=https://$TUNNEL_HOSTNAME in your Render environment variables."
