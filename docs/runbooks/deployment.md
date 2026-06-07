# Production Deployment — Talos OS v8.0

Guide for deploying Talos OS to production environments.

## 1. Purpose

This runbook covers deploying the Talos OS Core orchestrator and its dependencies
to a production environment. It assumes Docker-based deployment on a Linux host
or cloud VM.

---

## 2. Architecture Overview

```
Internet
    │
    ▼
┌─────────────┐
│  Nginx/Caddy │  ← SSL termination, reverse proxy
└──────┬──────┘
       │
       ▼
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│ Talos Core   │────▶│  Supabase     │────▶│  PostgreSQL   │
│ (port 8642)  │     │  (port 54321) │     │  (port 5432)  │
└──────┬──────┘     └──────────────┘     └──────────────┘
       │
       ▼
┌─────────────┐
│  Ollama      │  ← Local AI inference
│  (port 11434)│
└──────────────┘
```

---

## 3. Docker Deployment

### 3.1 Dockerfile (`infrastructure/docker/Dockerfile.core`)

Multi-stage build for minimal production image:

```dockerfile
# Stage 1: Base
FROM node:20-alpine AS base
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# Stage 2: Dependencies
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/core/package.json ./packages/core/
COPY packages/db/package.json ./packages/db/
COPY packages/memory/package.json ./packages/memory/
COPY talos-agents/ ./talos-agents/
RUN pnpm install --frozen-lockfile --prod=false

# Stage 3: Build
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

# Stage 4: Runner (production)
FROM base AS runner
ENV NODE_ENV=production
COPY --from=builder /app/packages/core/dist ./packages/core/dist
COPY --from=builder /app/packages/db/dist ./packages/db/dist
COPY --from=builder /app/packages/memory/dist ./packages/memory/dist
COPY --from=builder /app/talos-agents ./talos-agents
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder /app/packages/core/package.json ./packages/core/package.json
COPY --from=builder /app/packages/db/package.json ./packages/db/package.json
COPY --from=builder /app/packages/memory/package.json ./packages/memory/package.json

EXPOSE 8642
ENV TALOS_PORT=8642
CMD ["node", "packages/core/dist/api/server.js"]
```

### 3.2 Build and Push

```bash
# Build locally
docker build -f infrastructure/docker/Dockerfile.core -t talos-core:latest .

# Tag for registry
docker tag talos-core:latest registry.metis.corp/talos-core:8.0.0
docker tag talos-core:latest registry.metis.corp/talos-core:latest

# Push
docker push registry.metis.corp/talos-core:8.0.0
docker push registry.metis.corp/talos-core:latest
```

### 3.3 docker-compose.yml

```yaml
services:
  talos-core:
    image: registry.metis.corp/talos-core:latest
    ports:
      - "8642:8642"
    environment:
      NODE_ENV: production
      TALOS_PORT: 8642
      TALOS_WORKFLOW_DB_ENABLED: "true"
      TALOS_WORKFLOW_CODE_ENABLED: "false"
      TALOS_OWL_ALPHA_ENABLED: "true"
      OLLAMA_URL: "http://ollama:11434"
      DATABASE_URL: "postgresql://postgres:${POSTGRES_PASSWORD}@supabase-db:5432/talos"
    depends_on:
      - supabase-db
      - ollama
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8642/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  supabase-db:
    image: supabase/postgres:15.6.1
    ports:
      - "5432:5432"
    environment:
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: talos
    volumes:
      - supabase-data:/var/lib/postgresql/data
    restart: unless-stopped

  ollama:
    image: ollama/ollama:latest
    ports:
      - "11434:11434"
    volumes:
      - ollama-data:/root/.ollama
    restart: unless-stopped

volumes:
  supabase-data:
  ollama-data:
```

---

## 4. Environment Variables

### 4.1 Required

| Variable | Value | Description |
|----------|-------|-------------|
| `NODE_ENV` | `production` | Node.js environment |
| `TALOS_PORT` | `8642` | API server port |
| `DATABASE_URL` | `postgresql://...` | Supabase PostgreSQL connection string |
| `POSTGRES_PASSWORD` | (secret) | PostgreSQL password |

### 4.2 Optional — AI Engine

| Variable | Default | Description |
|----------|---------|-------------|
| `OLLAMA_URL` | `http://127.0.0.1:11434` | Ollama endpoint |
| `TALOS_OWL_ALPHA_ENABLED` | `true` | Owl Alpha model (opt-OUT) |
| `NVIDIA_API_KEY` | — | NVIDIA NIM cloud fallback |
| `TALOS_WORKFLOW_CODE_ENABLED` | `false` | Code/condition nodes (security risk if ON) |

### 4.3 Optional — Workflow Engine

| Variable | Default | Description |
|----------|---------|-------------|
| `TALOS_WORKFLOW_DB_ENABLED` | `false` | Use Supabase for workflow persistence |
| `TALOS_WORKFLOW_DIR` | `.talos/workflows` | JSON file storage directory |

### 4.4 Security Notes

- **Never** set `TALOS_WORKFLOW_CODE_ENABLED=true` in production unless you fully trust all workflow authors. It allows arbitrary JavaScript execution via `new Function()`.
- **Never** commit secrets to the repository. Use environment variables or Docker secrets.
- The `DATABASE_URL` should use a dedicated service role, not the postgres superuser.

---

## 5. Database Setup

### 5.1 Supabase Hosted vs Local

| Option | Use Case | Setup |
|--------|----------|-------|
| Supabase Hosted | Production with managed infra | Create project at supabase.com, run migrations via CLI |
| Docker Compose | Self-hosted production | Use `supabase/postgres` image, apply migrations manually |

### 5.2 Migrations

```bash
# Push all pending migrations
supabase db push

# Or apply manually
psql -h localhost -p 5432 -U postgres -d talos \
  -f supabase/migrations/0001_init.sql \
  -f supabase/migrations/0002_skills.sql \
  -f supabase/migrations/0003_workflows.sql
```

### 5.3 Generate Types

```bash
supabase gen types typescript --local > packages/db/src/types.ts
```

### 5.4 Indexes

All migrations include performance indexes. Key indexes:

| Table | Index | Purpose |
|-------|-------|---------|
| `talos_tasks` | `idx_tasks_status` | Task queue queries |
| `talos_tasks` | `idx_tasks_agent` | Agent assignment lookups |
| `talos_workflow_runs` | `idx_runs_workflow` | Run history by workflow |
| `talos_workflow_runs` | `idx_runs_started` | Recent runs |
| `talos_run_logs` | `idx_run_logs_run` | Node logs per run |
| `talos_spend_ledger` | `idx_spend_period` | Budget period queries |

---

## 6. Reverse Proxy

### 6.1 Nginx Configuration

```nginx
server {
    listen 80;
    server_name talos.metis.corp;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name talos.metis.corp;

    ssl_certificate /etc/letsencrypt/live/talos.metis.corp/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/talos.metis.corp/privkey.pem;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;

    location / {
        proxy_pass http://127.0.0.1:8642;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }

    # Health check endpoint
    location /health {
        proxy_pass http://127.0.0.1:8642/health;
        access_log off;
    }
}
```

### 6.2 Caddy Configuration (Alternative)

```caddyfile
talos.metis.corp {
    tls /etc/letsencrypt/live/talos.metis.corp/fullchain.pem \
        /etc/letsencrypt/live/talos.metis.corp/privkey.pem

    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
    }

    reverse_proxy 127.0.0.1:8642 {
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
    }
}
```

---

## 7. SSL/TLS

### 7.1 Let's Encrypt (Certbot)

```bash
# Install certbot
apt install certbot python3-certbot-nginx

# Obtain certificate
certbot certonly --nginx -d talos.metis.corp

# Auto-renewal
certbot renew --dry-run
```

### 7.2 Self-Signed (Development Only)

```bash
# Generate self-signed cert
openssl req -x509 -nodes -days 365 \
  -newkey rsa:2048 \
  -keyout /etc/ssl/private/talos.key \
  -out /etc/ssl/certs/talos.crt \
  -subj "/CN=talos.metis.corp"
```

---

## 8. Monitoring

### 8.1 Health Check Endpoint

The Core API exposes a health check at `GET /health`:

```json
{
  "status": "ok",
  "version": "8.0.0",
  "uptime": 3600,
  "providers": [
    { "id": "ollama", "healthy": true, "latencyMs": 45 },
    { "id": "g0dm0d3", "healthy": true, "latencyMs": 230 },
    { "id": "owl-alpha", "healthy": true, "latencyMs": 180 }
  ]
}
```

### 8.2 Docker Healthcheck

The Dockerfile and docker-compose include health checks:

```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:8642/health"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```

### 8.3 Logging

Logs are written to stdout/stderr (Docker captures them):

```bash
# View logs
docker compose logs -f talos-core

# View recent logs
docker compose logs --tail=100 talos-core
```

### 8.4 Key Metrics to Monitor

| Metric | Warning | Critical |
|--------|---------|----------|
| API response time | > 500ms | > 2000ms |
| Ollama latency | > 5000ms | > 15000ms |
| Error rate | > 1% | > 5% |
| Memory usage | > 512MB | > 1GB |
| Disk usage | > 80% | > 95% |
| Workflow failure rate | > 10% | > 30% |

---

## 9. Scaling

### 9.1 Horizontal Scaling

The Core API is stateless (in-memory caches are lost on restart).
For horizontal scaling:

1. Run multiple `talos-core` containers behind the load balancer
2. Use `TALOS_WORKFLOW_DB_ENABLED=true` so all instances share state
3. Session/council state is in-memory — consider Redis for shared state (not yet implemented)

### 9.2 Vertical Scaling

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| CPU | 2 cores | 4 cores |
| RAM | 2 GB | 4 GB |
| Disk | 20 GB | 50 GB |
| Network | 100 Mbps | 1 Gbps |

### 9.3 Ollama Scaling

Ollama runs locally for low-latency inference. For scaling:

- Use G0DM0D3 LAN peers for distributed Ollama instances
- Configure `getOnlineDevices()` to discover peer nodes
- Each peer runs its own Ollama instance with `capability_score`

### 9.4 Database Scaling

- Use Supabase hosted for managed scaling
- Or use PgBouncer for connection pooling
- Monitor `pg_stat_activity` for slow queries

---

## 10. Backup

### 10.1 Database Backup

```bash
# Full backup
pg_dump -h localhost -p 5432 -U postgres talos > backup_$(date +%Y%m%d).sql

# Compressed
pg_dump -h localhost -p 5432 -U postgres talos | gzip > backup_$(date +%Y%m%d).sql.gz

# Restore
psql -h localhost -p 5432 -U postgres talos < backup_20260607.sql
```

### 10.2 Automated Backup

```bash
# Cron job (daily at 2 AM)
0 2 * * * pg_dump -h localhost -p 5432 -U postgres talos | gzip > /backups/talos_$(date +\%Y\%m\%d).sql.gz

# Retain last 30 days
find /backups -name "talos_*.sql.gz" -mtime +30 -delete
```

### 10.3 Workflow Data Backup

If using JSON file persistence (`TALOS_WORKFLOW_DB_ENABLED=false`):

```bash
# Backup workflow files
tar czf workflow_backup_$(date +%Y%m%d).tar.gz .talos/workflows/

# Restore
tar xzf workflow_backup_20260607.tar.gz
```

### 10.4 Volume Backup (Docker)

```bash
# Backup named volumes
docker run --rm -v talos-os_supabase-data:/data -v $(pwd):/backup \
  alpine tar czf /backup/supabase_data_$(date +%Y%m%d).tar.gz /data

# Restore
docker run --rm -v talos-os_supabase-data:/data -v $(pwd):/backup \
  alpine tar xzf /backup/supabase_data_20260607.tar.gz -C /
```

---

## 11. Security Checklist

| Item | Status | Notes |
|------|--------|-------|
| HTTPS enabled | Required | Let's Encrypt or self-signed |
| `TALOS_WORKFLOW_CODE_ENABLED` | `false` | Prevents RCE |
| `POSTGRES_PASSWORD` | Strong | Not default `postgres` |
| `.env` not committed | Required | In `.gitignore` |
| No secrets in logs | Required | Review docker logs |
| Firewall ports | Minimal | Only 80, 443, 22 |
| Container not running as root | Required | Dockerfile uses non-root user |
| Regular dependency updates | Recommended | `pnpm update` + audit |

---

## 12. Deployment Checklist

Before deploying to production:

- [ ] All tests pass (`pnpm test`)
- [ ] Build succeeds (`pnpm build`)
- [ ] Environment variables set in production
- [ ] Database migrations applied (`pnpm db:migrate`)
- [ ] Docker image built and pushed
- [ ] Reverse proxy configured with SSL
- [ ] Health check endpoint responding
- [ ] Ollama running with required models
- [ ] Backups configured and tested
- [ ] Monitoring alerts configured
- [ ] `TALOS_WORKFLOW_CODE_ENABLED=false` (unless intentionally ON)
- [ ] `TALOS_WORKFLOW_DB_ENABLED=true` (for production persistence)

---

## 13. Rollback

### 13.1 Docker Rollback

```bash
# List available images
docker images | grep talos-core

# Rollback to previous version
docker stop talos-core
docker run -d --name talos-core \
  -p 8642:8642 \
  -e NODE_ENV=production \
  registry.metis.corp/talos-core:8.0.0-rc1
```

### 13.2 Database Rollback

```bash
# Restore from backup
psql -h localhost -p 5432 -U postgres talos < backup_20260606.sql

# Or drop and re-apply migrations
docker compose down -v
docker compose up -d supabase-db
pnpm db:migrate
```

---

## 14. Disaster Recovery

### 14.1 RPO (Recovery Point Objective)

- **Database:** Last backup (daily) = 24 hours RPO
- **Workflows:** Real-time if using Supabase; last JSON backup if using files
- **Memory/Cortex:** Supabase-hosted = real-time

### 14.2 RTO (Recovery Time Objective)

- **Container restart:** < 30 seconds
- **Full redeploy:** < 5 minutes
- **Database restore:** < 15 minutes (depends on backup size)

### 14.3 Recovery Steps

1. Stop the failed container
2. Restore database from backup if needed
3. Deploy the last known good image
4. Verify health check endpoint
5. Resume operations
6. Post-incident review
