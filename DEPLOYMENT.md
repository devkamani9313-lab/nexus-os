# Production Deployment Guide: Node.js API + SQLite + n8n on IONOS VPS

This guide walks you through deploying your entire system on a fresh Ubuntu 24.04 VPS.

---

## Prerequisites (Before starting)
You need a domain name (e.g., from GoDaddy, Namecheap, or IONOS).
Point **two subdomains** to your VPS IP by adding **DNS A Records**:
* `n8n.yourdomain.com` ➔ `<your_vps_ip>`
* `api.yourdomain.com` ➔ `<your_vps_ip>`

---

## Step 1: Connect to your VPS via SSH
Open PowerShell or Terminal on your computer and run:
```bash
ssh root@<your_vps_ip>
```
*Type `yes` when prompted, and enter your root password.*

---

## Step 2: Update System & Install Dependencies
Run these commands in your SSH terminal to install Node.js 20, Git, and build tools:
```bash
# Update package list
sudo apt update && sudo apt upgrade -y

# Setup NodeSource Node.js 20 repository
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# Install Node.js, Git, and Nginx
sudo apt install -y nodejs git build-essential nginx python3-certbot-nginx certbot
```

---

## Step 3: Clone Project & Initialize App
```bash
# Clone your repository (replace with your repo URL)
git clone <your_github_repository_url> dev-os
cd dev-os

# Install npm packages
npm install

# Initialize your SQLite Database
node init-db.js
```

---

## Step 4: Create Environment Variables (`.env`)
Create the `.env` file on the server:
```bash
nano .env
```
Paste your production settings (replace the values with your actual tokens/keys):
```env
TELEGRAM_BOT_TOKEN="your_telegram_bot_token"
DEEPSEEK_API_KEY="your_deepseek_api_key"
PORT=3000
DATABASE_URL="/root/dev-os/database.db"
```
*Press `Ctrl + O` then `Enter` to save, and `Ctrl + X` to exit.*

---

## Step 5: Install & Configure PM2 (Process Manager)
PM2 keeps your processes running 24/7 in the background and restarts them on system reboots:
```bash
# Install PM2 globally
sudo npm install -g pm2

# Start your Express API
pm2 start api.js --name "nexus-api"

# Start n8n Server
pm2 start npx --name "n8n-server" -- n8n start

# Configure PM2 to auto-start on system reboot
pm2 save
pm2 startup
```
*Note: The terminal will print a command starting with `sudo env PATH=...` after running `pm2 startup`. Copy and run that exact printed command to finalize auto-start.*

---

## Step 6: Configure Nginx (Reverse Proxy)
Nginx will route incoming traffic on port 80/443 to n8n (`5678`) and your API (`3000`).

Create the config file:
```bash
sudo nano /etc/nginx/sites-available/dev-os
```

Paste this configuration (replace `yourdomain.com` with your actual domain):
```nginx
server {
    server_name n8n.yourdomain.com;

    location / {
        proxy_pass http://localhost:5678;
        proxy_set_header Connection '';
        proxy_http_version 1.1;
        chunked_transfer_encoding off;
        proxy_buffering off;
        proxy_cache off;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
*Press `Ctrl + O` then `Enter` to save, and `Ctrl + X` to exit.*

Activate the configuration:
```bash
# Link the site to enabled list
sudo ln -s /etc/nginx/sites-available/dev-os /etc/nginx/sites-enabled/

# Test Nginx syntax
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

---

## Step 7: Secure with Free SSL Certificates (HTTPS)
Secure both subdomains using Let's Encrypt:
```bash
sudo certbot --nginx -d n8n.yourdomain.com -d api.yourdomain.com
```
*Enter your email, agree to the terms, and choose `Redirect` to force all traffic to secure HTTPS.*

---

## Step 8: Configure n8n Webhook URL
1. Navigate to `https://n8n.yourdomain.com` in your web browser.
2. Complete the initial signup/login.
3. Import your updated workflow: [dsa_agent_workflow.json](./workflows/dsa_agent_workflow.json).
4. Save and activate the workflow. 
5. n8n will automatically register its secure webhook (`https://n8n.yourdomain.com/webhook/...`) with Telegram!

---

## 🛠️ Useful Server Commands

* **Check running processes:** `pm2 status`
* **Restart the Node.js API:** `pm2 restart nexus-api`
* **Restart n8n:** `pm2 restart n8n-server`
* **View API logs (realtime):** `pm2 logs nexus-api`
* **View n8n logs (realtime):** `pm2 logs n8n-server`
