# Multi-stage build for PolarGrid AI

# Stage 1: Python backend
FROM python:3.11-slim AS backend

WORKDIR /app/backend

# Install system dependencies
RUN apt-get update && apt-get install -y \
    postgresql-client \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY backend/ .

EXPOSE 5000

CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "4", "app:app"]

# Stage 2: React frontend
FROM node:18-alpine AS frontend

WORKDIR /app/frontend

# Copy package files
COPY frontend/package*.json ./

# Install dependencies
RUN npm ci

# Copy frontend code
COPY frontend/src ./src
COPY frontend/public ./public
COPY frontend/index.html ./

# Build
RUN npm run build

# Stage 3: Production image
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    postgresql-client \
    nginx \
    && rm -rf /var/lib/apt/lists/*

# Copy Python backend from stage 1
COPY --from=backend /app/backend /app/backend

# Copy built frontend from stage 2
COPY --from=frontend /app/frontend/dist /app/frontend/dist

# Setup Nginx
RUN mkdir -p /etc/nginx/sites-enabled
COPY nginx.conf /etc/nginx/sites-enabled/default

# Create startup script
RUN echo '#!/bin/bash\n\
nginx -g "daemon off;" &\n\
cd /app/backend && gunicorn --bind 0.0.0.0:5000 --workers 4 app:app' \
> /app/start.sh && chmod +x /app/start.sh

EXPOSE 80 5000

CMD ["/app/start.sh"]
