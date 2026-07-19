# 🚀 Deploying Judge0 on Microsoft Azure (Student / Free Tier)

Deploying Judge0 on **Microsoft Azure** using the **Azure for Students** subscription provides you with $100 in free credits and access to various B-series virtual machines. By choosing a low-cost VM size, you can run the code execution engine for **$0 throughout your studies**.

Here is a step-by-step guide to provisioning and configuring Judge0 on Azure.

---

## 1️⃣ Create an Azure Virtual Machine
1. Sign in to the [Azure Portal](https://portal.azure.com/).
2. Search for **Virtual Machines** and click **Create** ➔ **Azure virtual machine**.
3. Configure the VM with the following settings:
   - **Subscription**: `Azure for Students` (or your active subscription)
   - **Resource Group**: Create new (e.g., `quizportal-rg`)
   - **Virtual Machine Name**: `judge0-vm`
   - **Region**: Select a region close to you (e.g., `East US`)
   - **Image**: `Ubuntu Server 22.04 LTS - x64 Gen2`
   - **Size**: Select `Standard_B2s` (2 vCPUs, 4 GB RAM — recommended) or `Standard_B1ms` (1 vCPU, 2 GB RAM — minimum requirement with Swap enabled). Both are very cheap and covered well by free credits.
   - **Authentication Type**: `SSH public key`
   - **Username**: `azureuser`
   - **Key pair name**: `judge0-vm-key` (Download the private `.pem` key when prompted during creation).

4. **Inbound Port Rules**:
   - Under **Inbound port rules**, select **Allow selected ports**.
   - Check **SSH (22)**.

5. Click **Next: Disks**:
   - **OS disk type**: `Standard SSD` (cost-effective) or `Premium SSD` (faster compilations).
   - **Size**: 30 GB is more than enough for Docker and Judge0 image files.

6. Click **Review + Create**, then click **Create**. Save the downloaded `.pem` private key file securely.

---

## 2️⃣ Configure Network Security Group (Open Judge0 Port)
Judge0 listens on port `2358` by default. You need to open this port in Azure's firewall to allow your backend server to talk to it:
1. Navigate to the newly created **Virtual Machine** page.
2. Select **Networking** in the left-hand menu.
3. Click **Add inbound port rule** and configure:
   - **Source**: `Any` (or restrict to your backend server's IP address for security)
   - **Source port ranges**: `*`
   - **Destination**: `Any`
   - **Service**: `Custom`
   - **Destination port ranges**: `2358`
   - **Protocol**: `TCP`
   - **Action**: `Allow`
   - **Priority**: `1000` (or any free priority number)
   - **Name**: `Allow_Judge0_API_Port`
4. Click **Add**.

---

## 3️⃣ SSH into the Azure Virtual Machine
1. Open a terminal on your computer.
2. Set permissions on your downloaded private key (macOS/Linux only):
   ```bash
   chmod 400 judge0-vm-key.pem
   ```
3. Connect to the Azure VM:
   ```bash
   ssh -i judge0-vm-key.pem azureuser@<AZURE_VM_PUBLIC_IP>
   ```

---

## 4️⃣ Install Docker & Docker Compose on the VM
Once connected to the VM, install Docker by running the following commands:
```bash
sudo apt update
sudo apt install -y ca-certificates curl gnupg

# Add Docker's official GPG key
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Set up the repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Configure Docker to run without sudo
sudo usermod -aG docker $USER
newgrp docker
```
Verify the installation:
```bash
docker --version
```

---

## 5️⃣ Enable Swap Memory (Crucial for B-Series VMs)
Standard Student VM sizes (like `Standard_B1ms` or `Standard_B2s`) have limited RAM. Compiling languages like Java, C++, or running Node processes can cause Out-Of-Memory (OOM) crashes. Setting up a 2GB swap partition solves this:
```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

---

## 6️⃣ Deploy Judge0 Stack
1. Clone the QuizPortal repository on the VM:
   ```bash
   git clone https://github.com/DavePujan/Quiz-Portal.git
   cd Quiz-Portal/leetcode-clone/quiz-evaluator/docker/judge0
   ```
2. Pull the images and start the services in detached mode:
   ```bash
   docker compose pull
   docker compose up -d
   ```
3. Verify that the four required containers are running:
   ```bash
   docker ps
   ```
   *Expected containers: `judge0-server`, `judge0-worker`, `judge0-db`, `judge0-redis`.*

4. Test that the API is responding locally on port 2358:
   ```bash
   curl http://localhost:2358/languages
   ```

---

## 7️⃣ Bootstrap Programming Languages
To activate and verify the languages (C, C++, Java, JavaScript, Python, PHP) used by the QuizPortal platform:
1. Load the bootstrap SQL file into the Judge0 PostgreSQL database:
   ```bash
   docker exec -i judge0-db-1 psql -U judge0 -d judge0 < azure-bootstrap.sql
   ```
2. Run the language matrix script from the repository root to verify compilation and execution health:
   ```bash
   # Ensure PowerShell is installed on the VM or run the script locally targeting the Azure public IP
   # Script: tests-scripts/judge0-language-matrix.ps1
   ```

---

## 8️⃣ Connect the Backend API
1. On your backend host (local machine or production hosting), open your `.env` configuration file.
2. Update the `JUDGE0_API_URL` environment variable to point to your Azure VM:
   ```env
   JUDGE0_API_URL=http://<AZURE_VM_PUBLIC_IP>:2358
   ```
3. Restart the backend API server.
4. Verify by submitting code through the frontend React editor.

---

## 🛑 Stopping and Pausing
To prevent running through your $100 student credits, make sure to read the [Azure VM Stop/Resume Guide](file:///e:/z_projects/Quiz%20Portal/azure_stop.md) at the root of the project to properly deallocate your VM when you are not using it.
