# Azure VM Stop / Resume Guide (Judge0 Deployment)

This document explains how to **pause and resume the Azure Virtual Machine (VM)** hosting the Judge0 code execution engine. Since student accounts operate on a limited free tier credit system, stopping the VM when not in use prevents unnecessary credit consumption.

---

## 📋 Target Environment Specs
- **Provider**: Microsoft Azure (Free for Students / Free Tier)
- **Virtual Machine size**: `Standard_B2s` (2 vCPUs, 4 GB RAM) or `Standard_B1ms` (1 vCPU, 2 GB RAM + Swap)
- **OS**: Ubuntu 22.04 LTS / Ubuntu 24.04 LTS
- **Stack**: Docker & Docker Compose running Judge0, PostgreSQL, and Redis

---

## 1. Why Stop the Azure VM?
When an Azure VM is running in a **"Running"** state, you are billed by the minute for compute power (vCPUs and RAM). 

By stopping the VM through the Azure Portal or Azure CLI:
- The VM state shifts to **"Stopped (deallocated)"**.
- **Billing for compute resources stops completely.**
- The OS disk storage (Managed Disk) remains preserved, along with your database and docker configurations.
- You can restart the VM later and resume testing without losing any configuration.

---

## 2. Option A: Stop Docker Containers Only (Keep VM Running)
Use this option during active development sessions when you want to free up system resources on the VM without shutting down the server.

### Stop Containers
1. SSH into the VM:
   ```bash
   ssh -i your-key.pem azureuser@AZURE_VM_PUBLIC_IP
   ```
2. Navigate to the Judge0 folder:
   ```bash
   cd ~/Quiz-Portal/leetcode-clone/quiz-evaluator/docker/judge0
   ```
3. Shut down the containers:
   ```bash
   docker compose down
   ```
This stops the Judge0 server, workers, Redis, and DB containers while keeping the VM online.

### Start Containers
1. SSH back into the VM.
2. Run:
   ```bash
   cd ~/Quiz-Portal/leetcode-clone/quiz-evaluator/docker/judge0
   docker compose up -d
   ```

---

## 3. Option B: Stop Entire Azure VM (Deallocate - Recommended)
Use this option at the end of a study or development session to save your Azure credits.

### Stop the VM via Azure Portal
1. Go to the [Azure Portal](https://portal.azure.com/).
2. Navigate to **Virtual Machines** and select your VM (e.g., `judge0-vm`).
3. Click the **Stop** button in the top menu.
4. Ensure the status updates to **Stopped (deallocated)**. 
   *(Note: Simply running `sudo shutdown` from SSH does NOT deallocate resources; you must stop it from the Azure portal or CLI to halt billing).*

### Start the VM
1. Go to **Virtual Machines** in the Azure Portal.
2. Select your VM and click **Start**.
3. Wait about 30–60 seconds for the public IP to become active.

---

## 4. ⚠️ Important: Handling IP Address Changes
By default, Azure assigns a **Dynamic Public IP** address to free-tier VMs. When a VM is deallocated and started again:
- Its Public IP address **will change**.
- You must update your backend `.env` file with the new IP address:
  ```env
  JUDGE0_API_URL=http://NEW_AZURE_PUBLIC_IP:2358
  ```
- Restart your backend server (`npm run dev`) to apply the change.

### How to avoid IP changes (Optional)
If you want to keep the IP static:
1. Navigate to your VM's **Public IP Address** resource in the Azure Portal.
2. Under **Configuration**, change the IP assignment from **Dynamic** to **Static**.
3. *Note: Static IP addresses on Azure carry a very small hourly charge even when the VM is stopped, which may deduct slightly from student credits. Dynamic is recommended for strict cost savings.*

---

## 5. 💡 Auto-Shutdown: The Best Free Tier Feature
To prevent accidentally running out of credits overnight:
1. Go to your VM resource in the **Azure Portal**.
2. Scroll down the left sidebar to **Operations** and select **Auto-shutdown**.
3. Enable it, set a local time (e.g., `10:00 PM`), select your timezone, and save.
4. The VM will automatically deallocate itself daily at the specified time.
