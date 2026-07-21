#!/bin/bash
set -e

# ==== CONFIG — edit these before running ====
RESOURCE_GROUP="quiz-portal-rg"
LOCATION="malaysiawest"          # cheapest allowed region close to India (prevents quota errors)
VM_NAME="judge0-vm"
VM_SIZE="Standard_B2s_v2"
ADMIN_USERNAME="azureuser"
SSH_KEY_PATH="$HOME/.ssh/id_rsa.pub"   # must already exist; run ssh-keygen if not
NSG_NAME="judge0-nsg"
VNET_NAME="judge0-vnet"
SUBNET_NAME="judge0-subnet"
ENABLE_AUTO_SHUTDOWN="false"           # set to "true" for dev/testing cost savings; "false" for 24/7 production
AUTO_SHUTDOWN_TIME="0200"              # HHMM 24-hour format (e.g. 0200 = 2:00 AM)
TIME_ZONE="Singapore Standard Time"    # Malaysia/Singapore Standard Time (GMT+8) for malaysiawest

echo "Detecting public IPv4..."
# Enforce IPv4 lookup on both endpoints
MY_IP=$(curl -4 -fsS https://api.ipify.org 2>/dev/null || curl -4 -fsS https://ifconfig.me 2>/dev/null || echo "")

# Validate that the string matches an IPv4 format. If not, prompt manually.
if ! [[ "$MY_IP" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]]; then
    echo "❌ Could not determine a valid IPv4 address automatically."
    read -rp "Please enter your public IPv4 address manually: " MY_IP
fi

echo "Detected IPv4: $MY_IP"
echo "This will be the ONLY IP allowed to SSH into the VM."
read -p "Press Enter to continue, or Ctrl+C to abort and edit the script..."

# ==== 1. Resource Group ====
az group create \
  --name "$RESOURCE_GROUP" \
  --location "$LOCATION"

# ==== 2. Virtual Network + Subnet ====
az network vnet create \
  --resource-group "$RESOURCE_GROUP" \
  --name "$VNET_NAME" \
  --address-prefix 10.0.0.0/16 \
  --subnet-name "$SUBNET_NAME" \
  --subnet-prefix 10.0.1.0/24

# ==== 3. Network Security Group ====
az network nsg create \
  --resource-group "$RESOURCE_GROUP" \
  --name "$NSG_NAME"

# Allow SSH ONLY from your current IP
az network nsg rule create \
  --resource-group "$RESOURCE_GROUP" \
  --nsg-name "$NSG_NAME" \
  --name "Allow-SSH-AdminIP" \
  --priority 100 \
  --direction Inbound \
  --access Allow \
  --protocol Tcp \
  --source-address-prefixes "$MY_IP/32" \
  --source-port-ranges '*' \
  --destination-address-prefixes '*' \
  --destination-port-ranges 22

# Explicitly deny all other inbound traffic (port 2358 stays closed — Cloudflare Tunnel handles egress-only access)
az network nsg rule create \
  --resource-group "$RESOURCE_GROUP" \
  --nsg-name "$NSG_NAME" \
  --name "Deny-All-Inbound" \
  --priority 4096 \
  --direction Inbound \
  --access Deny \
  --protocol '*' \
  --source-address-prefixes '*' \
  --source-port-ranges '*' \
  --destination-address-prefixes '*' \
  --destination-port-ranges '*'

# Associate NSG with the subnet
az network vnet subnet update \
  --resource-group "$RESOURCE_GROUP" \
  --vnet-name "$VNET_NAME" \
  --name "$SUBNET_NAME" \
  --network-security-group "$NSG_NAME"

# ==== 4. Create the VM ====
az vm create \
  --resource-group "$RESOURCE_GROUP" \
  --name "$VM_NAME" \
  --image "Ubuntu2204" \
  --size "$VM_SIZE" \
  --admin-username "$ADMIN_USERNAME" \
  --ssh-key-values "$SSH_KEY_PATH" \
  --vnet-name "$VNET_NAME" \
  --subnet "$SUBNET_NAME" \
  --public-ip-sku Standard \
  --public-ip-address "${VM_NAME}-ip" \
  --os-disk-size-gb 64 \
  --tags Project=QuizPortal Environment=Production Owner=Pujan

# ==== 5. Configure Auto-Shutdown ====
if [ "$ENABLE_AUTO_SHUTDOWN" = "true" ]; then
  echo "Configuring VM auto-shutdown at $AUTO_SHUTDOWN_TIME $TIME_ZONE..."
  SUB_ID=$(az account show --query id --output tsv)
  az resource create \
    --resource-group "$RESOURCE_GROUP" \
    --resource-type "Microsoft.DevTestLab/schedules" \
    --name "shutdown-computevm-$VM_NAME" \
    --properties "{\"status\":\"Enabled\",\"taskType\":\"ComputeVmShutdownTask\",\"dailyRecurrence\":{\"time\":\"$AUTO_SHUTDOWN_TIME\"},\"timeZoneId\":\"$TIME_ZONE\",\"notificationSettings\":{\"status\":\"Disabled\"},\"targetResourceId\":\"/subscriptions/$SUB_ID/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.Compute/virtualMachines/$VM_NAME\"}"
else
  echo "Auto-shutdown is disabled by configuration (ENABLE_AUTO_SHUTDOWN=false)."
fi

# ==== 6. Output connection info ====
echo ""
echo "=== VM Created ==="
az vm show -d -g "$RESOURCE_GROUP" -n "$VM_NAME" --query "{PublicIP:publicIps, PrivateIP:privateIps}" -o table

echo ""
echo "SSH in with:"
echo "  ssh $ADMIN_USERNAME@<PublicIP from above>"
echo ""
echo "IMPORTANT: Port 2358 is NOT open inbound. Judge0 will only be reachable via"
echo "the Cloudflare Tunnel you set up in step 2 below — this is intentional."
