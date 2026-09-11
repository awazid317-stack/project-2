# PolarGrid AI - Complete Setup & Deployment Guide

## 🚀 Quick Start (5 minutes)

### Prerequisites
- Docker & Docker Compose installed
- Node.js 16+ (for frontend development)
- Python 3.11+ (for backend development)
- Git

### Option 1: Docker Compose (Recommended)

```bash
# Clone repository
git clone https://github.com/codeheist/polargrid-ai.git
cd polargrid-ai

# Build and start all services
docker-compose up --build

# Access dashboard
# Frontend: http://localhost:3000
# Backend API: http://localhost:5000/api
# Database: localhost:5432
```

### Option 2: Manual Setup

#### Backend Setup

```bash
# Install Python dependencies
cd backend
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows
pip install -r requirements.txt

# Setup database
# Ensure PostgreSQL 12+ is running on localhost:5432
psql -U postgres -f ../polargrid_schema.sql

# Configure environment
cat > .env << EOF
DATABASE_URL=postgresql://user:password@localhost:5432/polargrid
FLASK_ENV=development
FLASK_DEBUG=1
EOF

# Run backend
python app.py
# Server runs on http://localhost:5000
```

#### Frontend Setup

```bash
# Install React dependencies
cd frontend
npm install

# Start development server
npm run dev
# Dashboard runs on http://localhost:5000
```

---

## 📋 Folder Structure

```
polargrid-ai/
├── backend/
│   ├── app.py                 # Flask REST API
│   ├── requirements.txt        # Python dependencies
│   └── .env                   # Environment variables
├── frontend/
│   ├── src/
│   │   ├── App.jsx           # Main React component
│   │   ├── App.css           # Global styles
│   │   ├── components/
│   │   │   ├── Sidebar.jsx
│   │   │   ├── MetricsCard.jsx
│   │   │   └── PowerFlowDiagram.jsx
│   │   ├── pages/
│   │   │   ├── Overview.jsx
│   │   │   ├── Forecasting.jsx
│   │   │   ├── AIDispatch.jsx
│   │   │   ├── EnergySources.jsx
│   │   │   ├── KPIs.jsx
│   │   │   ├── EquipmentHealth.jsx
│   │   │   ├── Communications.jsx
│   │   │   └── Settings.jsx
│   │   └── utils/
│   │       └── mockDataSimulator.js
│   ├── package.json
│   └── index.html
├── polargrid_schema.sql       # Database schema
├── Dockerfile                  # Container image
├── docker-compose.yml         # Multi-container orchestration
├── nginx.conf                 # Reverse proxy config
└── README.md
```

---

## 🗄️ DATABASE SETUP

### PostgreSQL + TimescaleDB

```bash
# Install PostgreSQL 12+
# macOS: brew install postgresql@12
# Ubuntu: sudo apt-get install postgresql postgresql-contrib
# Windows: Download from postgresql.org

# Install TimescaleDB extension
# Follow: https://docs.timescale.com/install/latest/

# Create database
createdb polargrid
psql polargrid < polargrid_schema.sql

# Verify installation
psql polargrid
\dt  # List tables
\dx  # List extensions
```

### Connection String
```
postgresql://polargrid_user:password@localhost:5432/polargrid
```

---

## 🔌 API ENDPOINTS

### Health Check
```bash
GET /api/health
```

### Stations
```bash
GET /api/stations
GET /api/stations/<station_id>
```

### Current Status
```bash
GET /api/stations/<station_id>/current-status
# Returns: generation, battery, load, weather, alerts
```

### Forecast
```bash
GET /api/stations/<station_id>/forecast?hours=24
# Returns: weather forecast and generation predictions
```

### Dispatch
```bash
GET /api/stations/<station_id>/dispatch?hours=24
# Returns: 24-hour dispatch plan
```

### KPIs
```bash
GET /api/stations/<station_id>/kpis?days=30
# Returns: renewable fraction, diesel usage, CO2, uptime
```

### Alerts
```bash
GET /api/stations/<station_id>/alerts
POST /api/stations/<station_id>/alerts
POST /api/stations/<station_id>/alerts/<alert_id>/resolve
```

### Scenarios (Simulation)
```bash
POST /api/stations/<station_id>/simulate
Body: { "type": "storm" | "comms_outage" | "equipment_failure" }
```

---

## 🎯 MOCK DATA SIMULATOR

The frontend uses `mockDataSimulator.js` to generate realistic energy management data:

```javascript
import simulator from './utils/mockDataSimulator';

// Get current state
const state = simulator.getCurrentState();

// Trigger simulation
simulator.triggerSimulation('storm');      // 30-second storm simulation
simulator.triggerSimulation('comms_outage'); // Comms outage
simulator.triggerSimulation('equipment_failure'); // Equipment failure

// Reset
simulator.resetSimulation();

// Get historical data
const history = simulator.getHistoricalData(7); // 7-day history
const kpis = simulator.getDailyKPIs(30);
const dispatch = simulator.get24HourDispatchPlan();
```

---

## 🚢 DEPLOYMENT

### Render.com (Recommended for Hackathon)

```bash
# 1. Create account at render.com
# 2. Create PostgreSQL database service
# 3. Create Web Service from GitHub

# Environment variables in Render
DATABASE_URL=postgresql://...
FLASK_ENV=production

# Build command: pip install -r backend/requirements.txt
# Start command: cd backend && gunicorn --bind 0.0.0.0:5000 app:app
```

### Railway.app

```bash
# 1. Link GitHub repository
# 2. Add PostgreSQL plugin
# 3. Environment variables automatically populated

# Deploy with: git push
```

### AWS EC2 + RDS

```bash
# 1. Launch EC2 instance (Ubuntu 20.04)
# 2. Create RDS PostgreSQL database
# 3. SSH into instance and deploy:

sudo apt-get update
sudo apt-get install -y docker.io docker-compose git

git clone https://github.com/codeheist/polargrid-ai.git
cd polargrid-ai

# Update DATABASE_URL in docker-compose.yml
docker-compose up -d

# Access via: http://instance-ip:80
```

### Docker Hub Registry

```bash
# Build and push image
docker build -t codeheist/polargrid-ai:latest .
docker push codeheist/polargrid-ai:latest

# Pull and run
docker run -p 80:80 codeheist/polargrid-ai:latest
```

---

## 🔐 SECURITY CHECKLIST

- [ ] Change default database password
- [ ] Set `FLASK_ENV=production`
- [ ] Enable HTTPS with SSL certificate (Let's Encrypt)
- [ ] Configure CORS whitelist
- [ ] Use environment variables for secrets
- [ ] Set security headers in nginx
- [ ] Enable PostgreSQL authentication
- [ ] Implement API rate limiting
- [ ] Use strong API keys for external services
- [ ] Regular security updates

---

## 📊 MONITORING & LOGGING

### Flask Logging
```python
import logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
logger.info("Event message")
```

### Database Monitoring
```sql
-- Check active connections
SELECT datname, usename, state FROM pg_stat_activity;

-- Slow queries
SELECT query, mean_exec_time FROM pg_stat_statements ORDER BY mean_exec_time DESC;

-- TimescaleDB hypertable stats
SELECT * FROM timescaledb_information.hypertables;
```

### Container Logs
```bash
# Docker Compose
docker-compose logs -f backend
docker-compose logs -f postgres

# Individual container
docker logs container_name -f
```

---

## 🧪 TESTING

### Backend Tests
```bash
cd backend
pytest tests/
```

### Frontend Testing
```bash
cd frontend
npm test
npm run build
```

### Load Testing
```bash
# Install Apache Bench or similar
ab -n 1000 -c 10 http://localhost:5000/api/health
```

---

## 🐛 TROUBLESHOOTING

### Database Connection Error
```bash
# Check PostgreSQL is running
psql -U postgres

# Verify DATABASE_URL
echo $DATABASE_URL

# Reset connection
docker-compose restart postgres
```

### Frontend Won't Load
```bash
# Clear node_modules and reinstall
cd frontend
rm -rf node_modules package-lock.json
npm install
npm run dev
```

### API 502 Bad Gateway
```bash
# Check backend logs
docker-compose logs backend

# Restart backend
docker-compose restart backend
```

### High Memory Usage
```bash
# Check Docker resource usage
docker stats

# Increase limits in docker-compose.yml
services:
  backend:
    mem_limit: 1g
    memswap_limit: 2g
```

---

## 📈 PERFORMANCE OPTIMIZATION

### Database Indexes
```sql
-- Already created in schema.sql
CREATE INDEX idx_sensor_data_station_time ON sensor_data(station_id, time DESC);
```

### Frontend Optimization
```javascript
// Code splitting with React.lazy
const OverviewPage = React.lazy(() => import('./pages/Overview'));

// Memoization
const MetricsCard = React.memo(({ label, value }) => (...));
```

### Caching Strategy
```python
from flask_caching import Cache
cache = Cache(app, config={'CACHE_TYPE': 'simple'})

@app.route('/api/kpis')
@cache.cached(timeout=300)  # Cache for 5 minutes
def get_kpis():
    return jsonify(...)
```

---

## 📚 DOCUMENTATION

- API Documentation: http://localhost:5000/docs (Swagger UI)
- Database Schema: See `polargrid_schema.sql`
- Frontend Components: See `frontend/src/components/`
- Mock Data Simulator: See `frontend/src/utils/mockDataSimulator.js`

---

## 🎓 LEARNING RESOURCES

- React: https://react.dev
- Flask: https://flask.palletsprojects.com/
- PostgreSQL: https://www.postgresql.org/docs/
- TimescaleDB: https://docs.timescale.com/
- Docker: https://docs.docker.com/

---

## 📞 SUPPORT

- Team: CodeHeist
- Hackathon: VIT Bhopal Internal Hackathon 2026
- Problem Statement: AI-Driven Smart Energy Management for Polar Research Stations

---

## 📝 LICENSE

MIT License - See LICENSE file for details

---

## 🎉 Ready to Deploy!

```bash
# One-command deployment
docker-compose up --build

# Your PolarGrid AI dashboard is live! 🚀
```
