# Nexus OS: Personal AI Command Center

🚀 **Nexus OS** is a fully automated, deeply personalized Telegram AI assistant. Built on **n8n** (visual workflow automation) and a custom **Node.js Express API**, it routes your daily tasks through four highly specialized agents. 

Unlike generic ChatGPT wrappers, Nexus OS is your private infrastructure. It understands your routines, tracks your data in a local SQLite database, and actively helps you manage your life from your pocket.

---

## 🔹 The Four Agents

📰 **News Agent (`/news`)**
* Scrapes the web every morning to compile a custom briefing.
* Filters out the noise and delivers only the most relevant tech and global headlines.
* Formats the output beautifully directly into your chat.

💻 **DSA Agent (`/dsa`)**
* Acts as your strict coding accountability partner.
* Fetches targeted Data Structures & Algorithms challenges based on specific sub-topics.
* Serves up real, company-wise interview questions and tracks your problem-solving streak.

🏋️‍♂️ **Gym Agent (`/gym`)**
* A completely frictionless way to log your fitness journey.
* Text it your workout sets, reps, and nutrition metrics.
* It automatically analyzes your logs (tracking progressive overload) and manages your macros.

💰 **Finance Agent (`/finance`)**
* Instantly categorizes and logs your daily expenses.
* Message it what you bought, and it handles the database entry.
* Keeps your budget strictly on track and monitors your pacing.

---

## 🛠️ Architecture & Tech Stack

* **Core Engine:** [n8n](https://n8n.io) (Open-source workflow automation)
* **API & Backend:** Node.js, Express.js
* **Database:** SQLite3
* **Interface:** Telegram Bot API
* **Deployment:** Nginx, PM2, Certbot (SSL), Ubuntu VPS

---

## 🚀 Getting Started (Local Development)

If you want to run Nexus OS locally on your machine before deploying it to a VPS:

### 1. Prerequisites
* [Node.js (v18 or higher)](https://nodejs.org/)
* A Telegram Bot Token (from [@BotFather](https://t.me/botfather) on Telegram)

### 2. Installation
Clone the repository and install dependencies:
```bash
git clone https://github.com/yourusername/dev-os.git
cd dev-os
npm install
```

### 3. Environment Variables
Create a `.env` file in the root directory:
```env
TELEGRAM_BOT_TOKEN="your_telegram_bot_token"
PORT=3000
```

### 4. Initialize Database
Run the initialization script to set up your local SQLite database:
```bash
node init-db.js
```

### 5. Start the Services
The project includes a convenient script that will start your local API, run `n8n`, and set up a temporary `localtunnel` so Telegram can send webhooks to your local machine!

```bash
node start-services.js
```
*Note: Wait a few seconds for n8n to start. You can then access the n8n interface at `http://localhost:5678`.*

### 6. Import Workflows
1. Open n8n in your browser (`http://localhost:5678`).
2. Go to **Workflows** > **Add Workflow**.
3. Click the menu in the top right > **Import from File**.
4. Import the JSON files located in the `workflows/` directory.
5. Save and activate them.

---

## 🌍 Production Deployment (VPS)

Ready to host it 24/7 on your own server? Check out the complete [Deployment Guide](DEPLOYMENT.md) for step-by-step instructions on setting this up on an Ubuntu VPS with Nginx and PM2.

---

## 🤝 Contributing
This is just V1. The architecture is modular, and more agents are coming. Feel free to fork the repository, build your own specialized agents, and submit pull requests!
