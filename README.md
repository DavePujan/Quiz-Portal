# 🧠 QuizPortal (LeetCode Clone)

[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)
[![React](https://img.shields.io/badge/React-19-blue.svg?logo=react)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-v18+-green.svg?logo=node.js)](https://nodejs.org/)
[![Docker](https://img.shields.io/badge/Docker-Supported-blue.svg?logo=docker)](https://www.docker.com/)

A modern, high-performance, full-stack assessment platform and coding sandbox. It features automated code evaluation (via **Judge0**), real-time updates (via **Socket.io**), semantic question classification (via **AI Assistant Providers**), background processing queues (via **BullMQ/Redis**), and production telemetry (via **Prometheus & Grafana**).

---

## 🚀 Key Features

### 👨‍🎓 Student Experience

- **Interactive Code Editor**: Monaco Editor integration with syntax highlighting, auto-completion, and language starter templates.
- **Instant Feedback**: Automated code execution with detailed stdout, stderr, runtime, and memory metrics.
- **Gamified Leaderboards**: Real-time ranking updates based on quiz points and solve times.
- **Analytics & History**: Performance charts (via Recharts) and submission question-by-question reviews.

### 👩‍🏫 Teacher Workspace

- **Quiz Builder**: Create custom assessment paths containing MCQs, Descriptive, and Coding questions.
- **AI-Assisted Question Generator**: Generate questions on-demand using Gemini, OpenRouter, Cerebras, or Mistral AI providers.
- **Normalized Analytics**: Score distributions, topic performance graphs, and difficulty statistics.
- **Manual Evaluations**: Portal to review student answers, grade code submissions, add feedback, and award marks.

### 🛡️ Admin & System Telemetry

- **Role Control**: Moderate access requests and configure user roles (Student, Teacher, Admin, Master).
- **Audit Logging**: Trace all teacher/admin actions via database-logged audit trails.
- **Observability**: Prometheus metrics endpoint (`/metrics`) combined with Grafana dashboards to track server response codes, job processing delays, and system load.

---

## 🏗️ System Architecture

### Production Topology

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

### Component & Port Topology

The diagram below illustrates the communication network, protocols, and standard ports used by QuizPortal:

```mermaid
graph TD
    %% Frontend / Clients
    subgraph Client [Client Side]
        Browser["React SPA Client<br>(Vercel / Vite Server)"]
    end

    %% API Layer
    subgraph APILayer [API & Event Gateway]
        ExpressServer["Express Backend API Server<br>(Render / Node.js)"]
    end

    %% State and Queue Databases
    subgraph Storage [Databases & Brokers]
        Postgres[("PostgreSQL / Supabase DB<br>(Port 5432)")]
        RedisBroker[("Upstash Redis Broker<br>(rediss:// TLS)")]
    end

    %% Asynchronous Processing
    subgraph JobProcessing [Processing & Sandboxing]
        SubWorker["Submission Worker<br>(BullMQ / Node.js)"]
        AuditWorker["Audit Worker<br>(BullMQ / Node.js)"]
      
        subgraph SandboxStack [Judge0 Sandbox Environment]
            JudgeServer["Judge0 API Server<br>(Azure VM / Docker)"]
            JudgeWorker["Judge0 Runner Worker<br>(Docker)"]
            NgrokTunnel["Ngrok Secure Tunnel<br>(HTTPS Endpoint)"]
        end
    end

    %% Telemetry
    subgraph MetricsStack [Telemetry & Monitoring]
        Prometheus["Prometheus Server<br>(Port 9090)"]
        Grafana["Grafana UI Console<br>(Port 3000)"]
    end

    %% Connections
    Browser <-->|"HTTP API / REST<br>WebSockets (Socket.io)"| ExpressServer
    ExpressServer <-->|"SQL Queries / Auth Checks"| Postgres
    ExpressServer -->|"Push Job payload"| RedisBroker
  
    SubWorker <-->|"Pop & Lock Jobs / Update Progress"| RedisBroker
    AuditWorker <-->|"Pop Audit payloads / Persist logs"| RedisBroker
    AuditWorker -.->|"Async Write Log"| Postgres
  
    SubWorker -->|"POST /submissions?base64_encoded=true"| NgrokTunnel
    NgrokTunnel -->|"HTTP Proxy (2358)"| JudgeServer
    JudgeServer -->|"Spawn Code Execution"| JudgeWorker
    SubWorker <-->|"Status Polls & Results"| NgrokTunnel
  
    %% Socket updates
    SubWorker -->|"Emit 'worker-status' Event"| ExpressServer
    ExpressServer -->|"Forward Status to Room 'jobId'"| Browser

    %% Monitoring Connections
    Prometheus -.->|"Scrape /metrics endpoint"| ExpressServer
    Grafana -->|"Query Dashboard Data"| Prometheus
```

---

## 🌐 Production Deployment & Infrastructure Handbook

### 1. Judge0 Infrastructure (Azure VM)

Set up Judge0 on an Azure VM runner:

```bash
# 1. SSH into Azure VM
ssh azureuser@<VM_IP>

# 2. Create target directory
sudo mkdir -p /opt/judge0

# 3. Copy deployment configs
sudo cp docker-compose.yml /opt/judge0/
sudo cp judge0.conf /opt/judge0/
chmod +x setup-judge0.sh

# 4. Start Judge0 containers
./setup-judge0.sh
```

#### Test Local Judge0 Endpoint
```bash
curl http://localhost:2358/languages
curl http://localhost:2358
```

---

### 2. Ngrok Tunnel Service (`ngrok.service`)

Expose Judge0 securely to Render via Ngrok systemd service:

Create `/etc/systemd/system/ngrok.service`:

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

Enable & Start Service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable ngrok
sudo systemctl start ngrok
sudo systemctl status ngrok
```

---

### 3. Backend Deployment (Render)

- **Root Directory**: `leetcode-clone/backend`
- **Build Command**: `npm install`
- **Start Command**: `npm start` (or `node start-production.js`)

#### Environment Variables Checklist
```env
NODE_ENV=production
PORT=10000
CLIENT_URL=https://your-frontend.vercel.app
BACKEND_URL=https://your-backend.onrender.com
JUDGE0_API_URL=https://woven-estate-overpay.ngrok-free.dev
REDIS_URL=rediss://default:password@noble-dassie-181752.upstash.io:6379
SUPABASE_URL=https://<your-project>.supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
JWT_SECRET=your_production_jwt_secret
```

#### Backend Endpoints
- **Health**: `https://backend.onrender.com/health`
- **Swagger Docs**: `https://backend.onrender.com/api-docs`
- **Metrics**: `https://backend.onrender.com/metrics`

---

### 4. Frontend Deployment (Vercel)

- **Framework**: Vite
- **Root Directory**: `leetcode-clone/frontend`
- **Build Command**: `npm run build`
- **Output Directory**: `dist`

#### Environment Variables
```env
VITE_BACKEND_URL=https://your-backend.onrender.com
```

---

### 5. Upstash Redis & Connection Guidelines

Always use TLS connection format for Upstash Redis in production:
```text
rediss://default:password@noble-dassie-181752.upstash.io:6379
```

> [!IMPORTANT]
> - Always use `rediss://` (TLS). Never use unencrypted `redis://` for Upstash endpoints.
> - Attach an error handler to prevent unhandled rejections:
>   `redis.on("error", console.error);`
> - Reuse connection clients across BullMQ workers and Socket.io adapters rather than instantiating `new Redis()` per request.

---

### 6. Deployment Order & Production Checklist

#### Deployment Sequence
1. Provision Azure VM & install Docker.
2. Deploy Judge0 sandbox containers and verify `localhost:2358`.
3. Start Ngrok systemd service and test public HTTPS endpoint.
4. Provision Upstash Redis instance and test connection.
5. Deploy Express Backend & BullMQ Workers on Render.
6. Deploy Vite Frontend on Vercel.
7. Test end-to-end quiz creation, submission, and code execution.

#### Pre-Flight Verification Checklist
- [x] Azure VM running & Docker engine healthy
- [x] Judge0 containers healthy on port 2358
- [x] Ngrok active tunnel online
- [x] Upstash Redis connected over `rediss://`
- [x] BullMQ background workers processing queues
- [x] Render backend `/health` endpoint OK
- [x] Vercel frontend deployed & routed
- [x] Swagger documentation accessible at `/api-docs`
- [x] End-to-end code execution & test case evaluation verified

---

## 🛠️ Technology Stack

| Layer                    | Technologies                                                                                       |
| :----------------------- | :------------------------------------------------------------------------------------------------- |
| **Frontend**       | React 19, Vite, Tailwind CSS 4, Monaco Editor, Recharts, Lucide React, Socket.io Client            |
| **Backend**        | Node.js, Express, Socket.io, BullMQ, Redis, pg (PostgreSQL Client), Supabase JS, Swagger (OpenAPI) |
| **Sandboxing**     | Judge0 API (Azure VM + Docker Engine + Ngrok Tunnel)                                               |
| **Databases**      | Supabase (PostgreSQL), Upstash Redis (BullMQ Queue & Cache)                                        |
| **Telemetry**      | Prometheus (prom-client), Grafana                                                                  |
| **AI Integration** | Google Gemini, OpenRouter, Cerebras, Mistral AI                                                    |

---

## 📁 Repository Structure

```text
Quiz Portal/
├── leetcode-clone/
│   ├── backend/                # Node.js API server & background workers
│   │   ├── config/             # System features and settings configs
│   │   ├── controllers/        # Express route controllers
│   │   ├── middleware/         # Auth, institution, and rate limiting middlewares
│   │   ├── models/             # Schema definitions and DB helper classes
│   │   ├── queues/             # BullMQ task queues definitions
│   │   ├── routes/             # API routing (student, teacher, admin, auth, etc.)
│   │   ├── utils/              # Third-party wrappers (AI providers, keepAlive, logger)
│   │   ├── workers/            # BullMQ workers (submission compilation, audit logger)
│   │   ├── server.js           # Server startup script
│   │   └── start-production.js # Multi-process production launcher
│   ├── frontend/               # React client SPA (Vite)
│   │   ├── public/             # Static files, robots.txt, assets
│   │   ├── src/                # Component logic, views, pages, context providers
│   │   │   ├── auth/           # OAuth handlers, Login views, ProtectedRoute
│   │   │   ├── components/     # Global reusable UI parts (sidebar, buttons, etc.)
│   │   │   ├── layouts/        # Dashboard layouts (admin, student, teacher views)
│   │   │   ├── pages/          # Main route components (CreateQuiz, ActiveQuizzes, etc.)
│   │   │   └── utils/          # Client API call helpers
│   │   └── package.json        # Frontend configuration & scripts
│   ├── supabase/               # Supabase functions & migration scripts
│   └── docker-compose.dev.yml  # Docker environment (Redis, Prometheus, Grafana)
├── schema.sql                  # Main PostgreSQL database tables & constraints schema
└── .gitignore                  # Global workspace ignored files configuration
```

---

## 🚦 Getting Started (Local Development)

### Step 1: Start Infrastructure

Navigate to the backend directory and launch the Docker Compose stack to start Redis, Prometheus, and Grafana:

```bash
cd leetcode-clone/backend
npm run infra:up
```

---

### Step 2: Configure Environment Variables

Create a `.env` file in `leetcode-clone/backend/.env`:

```env
PORT=5000
CLIENT_URL=http://localhost:5173
DATABASE_URL=your_postgres_connection_string
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=your_jwt_secret_key

# Sandbox Code Execution
JUDGE0_API_URL=http://localhost:2358
```

Create a `.env` file in `leetcode-clone/frontend/.env`:

```env
VITE_BACKEND_URL=http://localhost:5000
```

---

### Step 3: Run the Application

#### Start the Backend (API Server & BullMQ Workers)

```bash
cd leetcode-clone/backend
npm install
npm run dev
```

#### Start the Frontend Client

```bash
cd leetcode-clone/frontend
npm install
npm run dev
```

The React development server will start at `http://localhost:5173`.

---

## 📈 Monitoring & Telemetry

- **Prometheus Scraper**: Metrics are exposed at `http://localhost:5000/metrics`.
- **Grafana Console**: Visit `http://localhost:3000` (default credentials: `admin/admin`) to configure data sources and build charts showing active requests, response rates, and queue execution durations.

---

## 📖 API Documentation (Swagger)

The platform backend includes OpenAPI/Swagger documentation:

- **Swagger UI Portal**: Access the interactive dashboard at `http://localhost:5000/api-docs` when the backend server is running.
- **Regenerate Spec**:
  ```bash
  cd leetcode-clone/backend
  npm run swagger-gen
  ```

---

## 🧪 Running Tests

- **Backend API tests**: `npm run test:runner` inside `backend/`
- **Frontend test suite**: `npm run test:runner` inside `frontend/`
