# StatsMate: Regression Analysis for Non-Programmers

StatsMate is a full-stack web app that lets social science students run regression analyses without writing code. Upload a CSV, choose an outcome and predictors, and get the coefficient table, diagnostic plots, a plain-language interpretation, and the R code to reproduce the analysis.

> Built by a six-person team for CSC 230 (Software Engineering) at the University of Tampa, Fall 2025. Originally hosted at [Dpatel0805693/Jakadd](https://github.com/Dpatel0805693/Jakadd). This copy is maintained by Jordano Liberato, who led the team.

**Demo:** _video coming soon_

## My role

Team lead and statistics lead. I designed and built:

- **The R statistical services** (OLS and logistic regression via R/Plumber and broom), including diagnostics and reproducible R code generation
- **The AI gateway**: OpenAI-backed variable-type detection, model suggestion and result interpretation, with response caching and a monthly cost cap
- **The Docker setup** and the **integration test suites** for the R and AI services
- Frontend technical direction for the analysis and results workflow

Teammates built the core API and database (Khalil), orchestration (Amanda), the UI (Dhwani), visualizations (Anthony) and documentation (Darwin). See the [team table](#-development-team).

## Engineering notes (2026 cleanup)

After the course, I audited the code and fixed the issues a production review would catch:

| Issue | Fix |
|---|---|
| User-supplied formulas and column names went straight into R's `as.formula()`, so a formula like `y ~ system("...")` could run code on the server | Formulas are built only from column names that exist in the data; formula strings may contain only basic operators (`r-services/utils.R`) |
| The R services could read any file path sent to them | File reads are restricted to the uploads directory |
| Logistic results were described as unit changes in the outcome, but logistic coefficients are log-odds | Interpretations now use odds ratios (with confidence intervals) and flag likely separation |
| The AI gateway was built and tested but never called by the analysis pipeline | The pipeline now calls it, with a deterministic template as the fallback |
| Queued jobs were removed from the queue but never run | Replaced with a concurrency limiter where queued requests wait and then run |
| The CSV reader split lines on commas, breaking on quoted fields | Uses a real CSV parser |

Unit tests for the orchestration layer: `cd integration-api && npm install && npm test`.

---

## 🎯 Features

| Feature | Description |
|---------|-------------|
| **OLS Regression** | Linear regression with R², coefficients, and diagnostics |
| **Logistic Regression** | Binary outcome analysis with odds ratios |
| **AI Interpretation** | Plain-language explanations of statistical results |
| **Interactive Visualizations** | Coefficient plots, residual diagnostics |
| **Downloadable R Code** | Reproducible analysis scripts |
| **Educational Tooltips** | Hover explanations for statistical terms |

---

## 📋 Prerequisites

### Required Software

| Software | Version | Download |
|----------|---------|----------|
| **Docker Desktop** | 4.0+ | [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop) |
| **Git** | Any | [git-scm.com/downloads](https://git-scm.com/downloads) |

### System Requirements

- **OS**: Windows 10/11, macOS 10.15+, or Linux
- **RAM**: 8GB minimum (16GB recommended)
- **Disk Space**: 5GB free space
- **Internet**: Required for first build (downloads Docker images)

### Ports Used

| Port | Service |
|------|---------|
| 5173 | Frontend (React) |
| 3000 | Core API (Node.js) |
| 5001 | Integration API |
| 8000 | R OLS Service |
| 8001 | AI Gateway |
| 8002 | R Logistic Service |
| 8004 | R Reserved Service |
| 27017 | MongoDB |

---

## 🚀 Quick Start Guide

### Step 1: Install Docker Desktop

1. Download from [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop)
2. Run the installer
3. **Restart your computer**
4. Open Docker Desktop and wait for it to fully start
   - Windows: Look for the whale icon in system tray (should be steady, not animating)
   - Mac: Look for the whale icon in menu bar

### Step 2: Clone the Repository

```bash
git clone https://github.com/j-lib/statsmate.git
cd statsmate
```

### Step 3: Create Environment File

Create a `.env` file in the project root:

```env
# MongoDB
MONGO_URI=mongodb://mongodb:27017/csc230

# JWT Secret
JWT_SECRET=your-super-secret-jwt-key-change-in-production

# OpenAI API Key (optional - enables AI interpretations)
OPENAI_API_KEY=sk-your-openai-api-key-here

# Optional
NODE_ENV=production
```

**Note**: Get your OpenAI API key from [platform.openai.com/api-keys](https://platform.openai.com/api-keys)

### Step 4: Start the Application

```bash
docker-compose up --build
```

First run takes **5-15 minutes** as Docker downloads and builds everything.

Watch for this message indicating success:
```
csc230-frontend  | VITE v5.x.x ready in xxx ms
csc230-frontend  | ➜ Local: http://localhost:5173/
```

### Step 5: Open StatsMate

🌐 **Open your browser to: [http://localhost:5173](http://localhost:5173)**

---

## 📖 How to Use StatsMate

### 1️⃣ Create an Account

1. Click **"Sign Up"** on the homepage
2. Enter your email and password
3. Click **"Create Account"**
4. Log in with your credentials

### 2️⃣ Upload Your Data

1. Click **"Upload"** in the navigation bar
2. Click **"Choose File"** and select a CSV file
3. Wait for the upload confirmation
4. Your file appears in the dashboard

### 3️⃣ Configure Your Analysis

1. Click on your uploaded file
2. **Select Dependent Variable** (what you want to predict)
   - For OLS: Choose a continuous variable (e.g., grades, income)
   - For Logistic: Choose a binary variable (e.g., pass/fail, yes/no)
3. **Select Independent Variables** (predictors)
4. **Choose Model Type**:
   - **Linear Regression (OLS)** - for continuous outcomes
   - **Logistic Regression** - for binary (0/1) outcomes

### 4️⃣ Run Analysis

1. Click **"Run Analysis"**
2. Wait for processing (typically 1-5 seconds)
3. View results across four tabs:

| Tab | Contents |
|-----|----------|
| **AI Interpretation** | Plain-language summary of findings |
| **Statistical Output** | Coefficients table, p-values, model diagnostics |
| **Visualizations** | Coefficient plots, residual plots |
| **R Code** | Reproducible R script for your analysis |

### 5️⃣ Download Results

Click **"Download Results"** to save your analysis.

---

## 📁 Sample Data

Test datasets are available in the `examples/` folder (`student_performance.csv`, `logistic_regression_sample.csv`, `voting_data.csv`, `survey.csv`). Note that the small logistic sample data is perfectly separable, so StatsMate will warn about separation.

### Example: OLS Analysis
- **Dependent**: Any continuous variable (e.g., `final_grade`)
- **Independent**: `study_hours`, `prior_gpa`, `attendance_rate`
- **Model**: Linear Regression (OLS)

### Example: Logistic Analysis
- **Dependent**: Any binary variable (e.g., `passed`, `voted`)
- **Independent**: `study_hours`, `prior_gpa`
- **Model**: Logistic Regression

---

## 🛠️ Common Commands

| Command | Description |
|---------|-------------|
| `docker-compose up --build` | Start application |
| `docker-compose up -d --build` | Start in background |
| `docker-compose down` | Stop application |
| `docker-compose logs` | View all logs |
| `docker-compose logs <service>` | View specific service logs |
| `docker ps` | Check running containers |

---

## ❗ Troubleshooting

### Docker Desktop Not Starting

**Windows:**
```powershell
wsl --install
wsl --update
```
Then restart your computer.

### "Port Already in Use"

**Windows:**
```powershell
netstat -ano | findstr :5173
taskkill /PID <PID_NUMBER> /F
```

**Mac/Linux:**
```bash
lsof -i :5173
kill -9 <PID_NUMBER>
```

### "Cannot Connect to Docker Daemon"

Start Docker Desktop and wait for the whale icon to be steady.

### Build Fails - "No Space Left"

```bash
docker system prune -a
```

### Analysis Fails

```bash
docker-compose down
docker-compose up --build
```

### Logistic Regression "Failed to Converge"

This is a statistical issue (complete separation). Try:
- Adding more predictor variables
- Using a larger dataset

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    StatsMate Platform                        │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │  Frontend   │    │  Core API   │    │  MongoDB    │     │
│  │   (React)   │───▶│  (Node.js)  │───▶│  Database   │     │
│  │  Port 5173  │    │  Port 3000  │    │ Port 27017  │     │
│  └─────────────┘    └──────┬──────┘    └─────────────┘     │
│                            │                                 │
│                            ▼                                 │
│                   ┌─────────────────┐                       │
│                   │ Integration API │                       │
│                   │   Port 5001     │                       │
│                   └────────┬────────┘                       │
│                            │                                 │
│         ┌──────────────────┼──────────────────┐             │
│         ▼                  ▼                  ▼             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │   R - OLS   │    │ R - Logistic│    │ AI Gateway  │     │
│  │  Port 8000  │    │  Port 8002  │    │  Port 8001  │     │
│  └─────────────┘    └─────────────┘    └─────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

### Services

| Service | Technology | Purpose |
|---------|------------|---------|
| **Frontend** | React, Vite, Tailwind | User interface |
| **Core API** | Node.js, Express | Authentication, file management |
| **Integration API** | Node.js, Express | Analysis orchestration |
| **R-OLS** | R, Plumber | OLS regression analysis |
| **R-Logistic** | R, Plumber | Logistic regression analysis |
| **AI Gateway** | Node.js, OpenAI | AI-powered interpretations |
| **MongoDB** | MongoDB 7 | Data persistence |

---

## 📂 Project Structure

```
├── backend/                    # Core API
│   ├── routes/                 # API endpoints
│   ├── models/                 # MongoDB schemas
│   ├── middleware/             # Auth, upload handling
│   └── Dockerfile
├── frontend/                   # React application
│   ├── src/
│   │   ├── components/         # UI components
│   │   ├── pages/              # Page components
│   │   └── services/           # API client
│   └── Dockerfile
├── integration-api/            # Analysis orchestration
│   ├── routes/analyzeRoute.js  # Pipeline: CSV → R service → interpretation
│   ├── limiter.js              # Concurrency limit + wait queue
│   ├── interpretation.js       # AI formatting + template fallback
│   ├── test/                   # Unit tests (npm test)
│   └── Dockerfile
├── ai-gateway/                 # AI service
│   └── Dockerfile
├── r-services/                 # R statistical services
│   ├── plumber_ols.R
│   ├── plumber_logistic.R
│   ├── utils.R                 # Data loading + formula validation
│   └── Dockerfile.*
├── docs/                       # Team dynamics and requirements document
├── tests/                      # Integration tests for the R and AI services
├── examples/                   # Sample datasets
├── docker-compose.yml          # Container orchestration
└── README.md
```

---

## 👥 Development Team

| Name | Role |
|------|------|
| **Jordano** | R Stats & AI Gateway Lead, Frontend Tech Lead |
| **Dhwani** | Frontend UI Lead |
| **Khalil** | Core API & Database Lead |
| **Amanda** | Integration & Orchestration Lead |
| **Anthony** | Data Visualizations Lead |
| **Darwin** | Documentation Lead |

---

## 🎓 For Instructors/Graders

### Verification Steps

1. Clone and start:
   ```bash
   git clone https://github.com/j-lib/statsmate.git
   cd statsmate
   docker-compose up --build
   ```

2. Verify 8 containers running:
   ```bash
   docker ps
   ```

3. Open [http://localhost:5173](http://localhost:5173)

4. Create account → Upload CSV → Run analysis

5. Verify all 4 result tabs display correctly

### Key Technical Achievements

- ✅ Microservices architecture (8 Docker containers)
- ✅ Real-time statistical analysis via R/Plumber
- ✅ JWT authentication
- ✅ File upload with validation
- ✅ Interactive visualizations (Recharts)
- ✅ AI-powered result interpretation
- ✅ Reproducible R code generation
- ✅ Educational tooltip system

---

## 📄 License

CSC 230 - Software Engineering | Educational purposes only.

---

<div align="center">

**Happy Analyzing! 📈**

Made with ❤️ by the StatsMate Team

</div>
