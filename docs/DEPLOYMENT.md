# Deployment and Maintenance Guide

This guide covers deploying the AI Games Slack App in various environments and maintaining it in production.

## Table of Contents

1. [Deployment Options](#deployment-options)
2. [Docker Deployment](#docker-deployment)
3. [Cloud Platform Deployment](#cloud-platform-deployment)
4. [Production Checklist](#production-checklist)
5. [Monitoring and Logging](#monitoring-and-logging)
6. [Backup and Recovery](#backup-and-recovery)
7. [Maintenance Tasks](#maintenance-tasks)
8. [Scaling Considerations](#scaling-considerations)
9. [Troubleshooting](#troubleshooting)

## Deployment Options

### Recommended Platforms

#### Production-Ready Options
1. **Railway** - Simple, developer-friendly platform
2. **Render** - Easy deployment with automatic SSL
3. **Heroku** - Mature platform with extensive add-ons
4. **DigitalOcean App Platform** - Managed container platform
5. **AWS ECS/Fargate** - Enterprise-grade container orchestration
6. **Google Cloud Run** - Serverless container platform

#### Self-Hosted Options
1. **Docker Compose** - Single server deployment
2. **Kubernetes** - Multi-server orchestration
3. **VPS Deployment** - Direct server installation

### Platform Comparison

| Platform | Complexity | Cost | Auto-scaling | Database | SSL |
|----------|------------|------|--------------|----------|-----|
| Railway | Low | $$ | Yes | External | Auto |
| Render | Low | $$ | Yes | External | Auto |
| Heroku | Low | $$$ | Yes | Add-on | Auto |
| DigitalOcean | Medium | $$ | Yes | External | Auto |
| AWS ECS | High | $ | Yes | RDS | Manual |
| Self-hosted | High | $ | Manual | Self-managed | Manual |

## Docker Deployment

### Prerequisites

```bash
# Install Docker and Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose
sudo apt-get install docker-compose-plugin
```

### Build and Deploy

#### 1. Prepare Environment
```bash
# Clone repository
git clone <your-repo-url>
cd ai-games-slack-app

# Copy environment template
cp .env.example .env
# Edit .env with your configuration
nano .env
```

#### 2. Build Image
```bash
# Build production image
docker build -t ai-games-slack-app:latest .

# Or build with specific tag
docker build -t ai-games-slack-app:v1.0.0 .
```

#### 3. Run Container
```bash
# Run with environment file
docker run -d \
  --name ai-games-app \
  --env-file .env \
  -p 3000:3000 \
  --restart unless-stopped \
  ai-games-slack-app:latest

# Check logs
docker logs -f ai-games-app
```

### Docker Compose Deployment

#### `docker-compose.yml`
```yaml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: ai-games-app
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    env_file:
      - .env
    volumes:
      - ./logs:/app/logs
    depends_on:
      - redis
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  redis:
    image: redis:7-alpine
    container_name: ai-games-redis
    restart: unless-stopped
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes

  nginx:
    image: nginx:alpine
    container_name: ai-games-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
      - ./logs/nginx:/var/log/nginx
    depends_on:
      - app

volumes:
  redis_data:
```

#### Deploy with Docker Compose
```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Update deployment
docker-compose pull
docker-compose up -d

# Stop services
docker-compose down
```

### Production Docker Configuration

#### Multi-stage Dockerfile Optimization
```dockerfile
# Production-optimized Dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:18-alpine AS runtime
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --chown=nextjs:nodejs . .

USER nextjs
EXPOSE 3000
ENV PORT 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js

CMD ["node", "dist/app.js"]
```

## Cloud Platform Deployment

### Railway Deployment

#### 1. Setup Railway
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Initialize project
railway init
```

#### 2. Configure Environment Variables
```bash
# Set environment variables
railway variables set SLACK_BOT_TOKEN=xoxb-your-token
railway variables set SLACK_SIGNING_SECRET=your-secret
railway variables set SUPABASE_URL=https://your-project.supabase.co
# ... add all required variables
```

#### 3. Deploy
```bash
# Deploy to Railway
railway up

# View logs
railway logs
```

### Render Deployment

#### 1. Create `render.yaml`
```yaml
services:
  - type: web
    name: ai-games-slack-app
    env: node
    plan: starter
    buildCommand: npm run build
    startCommand: npm start
    healthCheckPath: /health
    autoDeploy: true
    envVars:
      - key: NODE_ENV
        value: production
      - key: SLACK_BOT_TOKEN
        sync: false
      - key: SLACK_SIGNING_SECRET
        sync: false
      - key: SUPABASE_URL
        sync: false
      - key: SUPABASE_SERVICE_ROLE_KEY
        sync: false
```

#### 2. Deploy to Render
1. Connect GitHub repository to Render
2. Configure environment variables in dashboard
3. Deploy automatically on git push

### Heroku Deployment

#### 1. Setup Heroku
```bash
# Install Heroku CLI
npm install -g heroku

# Login
heroku login

# Create app
heroku create ai-games-slack-app
```

#### 2. Configure Environment
```bash
# Set environment variables
heroku config:set SLACK_BOT_TOKEN=xoxb-your-token
heroku config:set SLACK_SIGNING_SECRET=your-secret
heroku config:set NODE_ENV=production
# ... add all variables
```

#### 3. Deploy
```bash
# Deploy
git push heroku main

# View logs
heroku logs --tail
```

### AWS ECS Deployment

#### 1. Create Task Definition
```json
{
  "family": "ai-games-slack-app",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "arn:aws:iam::account:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "ai-games-app",
      "image": "your-ecr-repo/ai-games-slack-app:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        }
      ],
      "secrets": [
        {
          "name": "SLACK_BOT_TOKEN",
          "valueFrom": "arn:aws:secretsmanager:region:account:secret:slack-bot-token"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/ai-games-slack-app",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

#### 2. Create Service
```bash
# Create ECS service
aws ecs create-service \
  --cluster ai-games-cluster \
  --service-name ai-games-service \
  --task-definition ai-games-slack-app:1 \
  --desired-count 2 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-12345],securityGroups=[sg-12345],assignPublicIp=ENABLED}"
```

## Production Checklist

### Pre-Deployment

#### Security
- [ ] Environment variables configured securely
- [ ] Secrets stored in secure vault (not in code)
- [ ] HTTPS enabled with valid SSL certificate
- [ ] Rate limiting configured
- [ ] Input validation implemented
- [ ] CORS properly configured
- [ ] Security headers set

#### Performance
- [ ] Database connection pooling enabled
- [ ] Caching layer configured (Redis)
- [ ] Static assets optimized
- [ ] Compression enabled (gzip)
- [ ] CDN configured for static content
- [ ] Database indexes optimized

#### Monitoring
- [ ] Health check endpoint implemented
- [ ] Application metrics collection
- [ ] Error tracking configured
- [ ] Log aggregation set up
- [ ] Alerting rules configured
- [ ] Uptime monitoring enabled

#### Backup
- [ ] Database backup strategy implemented
- [ ] Automated backup testing
- [ ] Disaster recovery plan documented
- [ ] Data retention policies set
- [ ] Backup monitoring configured

### Post-Deployment

#### Verification
- [ ] Health check returns 200 OK
- [ ] Slack commands respond correctly
- [ ] Database connections working
- [ ] LLM API calls successful
- [ ] Scheduled jobs running
- [ ] Logs being generated properly

#### Load Testing
```bash
# Basic load test with Apache Bench
ab -n 1000 -c 10 http://your-domain.com/health

# More comprehensive testing with Artillery
npm install -g artillery
artillery run load-test.yml
```

#### Performance Monitoring
- [ ] Response times within acceptable limits (<500ms)
- [ ] Memory usage stable
- [ ] CPU usage reasonable (<70%)
- [ ] Database performance acceptable
- [ ] Error rates minimal (<1%)

## Monitoring and Logging

### Application Monitoring

#### Health Checks
```javascript
// Enhanced health check endpoint
app.get('/health', async (req, res) => {
  const checks = {
    database: await checkDatabase(),
    slack: await checkSlackAPI(),
    llm: await checkLLMAPI(),
    redis: await checkRedis()
  };
  
  const healthy = Object.values(checks).every(check => check.status === 'ok');
  
  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    checks
  });
});
```

#### Metrics Collection
```javascript
// Application metrics
const promClient = require('prom-client');

const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status']
});

const slackCommandsTotal = new promClient.Counter({
  name: 'slack_commands_total',
  help: 'Total number of Slack commands processed',
  labelNames: ['command']
});
```

### Logging Strategy

#### Log Levels
- **ERROR**: Application errors and exceptions
- **WARN**: Performance issues and recoverable errors
- **INFO**: Important application events
- **DEBUG**: Detailed debugging information

#### Structured Logging
```javascript
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});
```

### External Monitoring Tools

#### Application Performance Monitoring
- **New Relic**: Comprehensive APM solution
- **DataDog**: Infrastructure and application monitoring
- **Sentry**: Error tracking and performance monitoring
- **Grafana + Prometheus**: Open-source monitoring stack

#### Uptime Monitoring
- **Pingdom**: Website uptime monitoring
- **UptimeRobot**: Free uptime monitoring
- **StatusCake**: Performance and uptime monitoring

## Backup and Recovery

### Database Backup

#### Automated Supabase Backup
```bash
# Daily backup script
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="backup_${DATE}.sql"

# Export database
pg_dump "${SUPABASE_DB_URL}" > "${BACKUP_FILE}"

# Upload to cloud storage
aws s3 cp "${BACKUP_FILE}" "s3://your-backup-bucket/database/"

# Clean up local file
rm "${BACKUP_FILE}"

# Keep only last 30 days of backups
aws s3 ls "s3://your-backup-bucket/database/" | \
  head -n -30 | \
  awk '{print $4}' | \
  xargs -I {} aws s3 rm "s3://your-backup-bucket/database/{}"
```

#### Backup Verification
```bash
# Test backup restoration
#!/bin/bash
BACKUP_FILE="$1"

# Create test database
createdb test_restore

# Restore backup
pg_restore -d test_restore "${BACKUP_FILE}"

# Run basic tests
psql test_restore -c "SELECT COUNT(*) FROM users;"
psql test_restore -c "SELECT COUNT(*) FROM submissions;"

# Cleanup
dropdb test_restore
```

### Application State Backup

#### Configuration Backup
```bash
# Backup environment configuration
kubectl get configmap ai-games-config -o yaml > config-backup.yaml
kubectl get secret ai-games-secrets -o yaml > secrets-backup.yaml
```

#### Volume Backup
```bash
# Backup persistent volumes
docker run --rm -v ai-games-data:/data -v $(pwd):/backup alpine \
  tar czf /backup/data-backup.tar.gz -C /data .
```

### Disaster Recovery Plan

#### Recovery Time Objectives (RTO)
- **Database**: 15 minutes
- **Application**: 5 minutes
- **Full System**: 30 minutes

#### Recovery Point Objectives (RPO)
- **Database**: 1 hour (hourly backups)
- **Configuration**: 24 hours (daily backups)
- **Logs**: 1 hour (real-time replication)

#### Recovery Procedures

1. **Database Recovery**:
   ```bash
   # Restore from latest backup
   pg_restore -d ai_games_prod backup_latest.sql
   ```

2. **Application Recovery**:
   ```bash
   # Deploy from last known good image
   docker run -d --env-file .env ai-games-slack-app:last-known-good
   ```

3. **Configuration Recovery**:
   ```bash
   # Restore Kubernetes configuration
   kubectl apply -f config-backup.yaml
   kubectl apply -f secrets-backup.yaml
   ```

## Maintenance Tasks

### Regular Maintenance Schedule

#### Daily Tasks
- [ ] Monitor application health and performance
- [ ] Check error logs for new issues
- [ ] Verify backup completion
- [ ] Monitor disk space and resource usage

#### Weekly Tasks
- [ ] Review performance metrics and trends
- [ ] Update security patches if available
- [ ] Clean up old log files
- [ ] Test disaster recovery procedures
- [ ] Review and rotate access logs

#### Monthly Tasks
- [ ] Security audit and vulnerability scan
- [ ] Performance optimization review
- [ ] Database maintenance and optimization
- [ ] Backup retention policy enforcement
- [ ] Documentation updates

#### Quarterly Tasks
- [ ] Dependency updates and security patches
- [ ] Capacity planning review
- [ ] Disaster recovery testing
- [ ] Security credential rotation
- [ ] Architecture review and optimization

### Database Maintenance

#### Performance Optimization
```sql
-- Analyze database performance
ANALYZE;

-- Update table statistics
VACUUM ANALYZE users;
VACUUM ANALYZE submissions;
VACUUM ANALYZE xp_events;

-- Check for unused indexes
SELECT schemaname, tablename, attname, n_distinct, correlation
FROM pg_stats
WHERE schemaname = 'public'
ORDER BY n_distinct DESC;
```

#### Data Cleanup
```sql
-- Clean up old XP events (keep last 2 years)
DELETE FROM xp_events 
WHERE created_at < NOW() - INTERVAL '2 years';

-- Archive old submissions
INSERT INTO submissions_archive 
SELECT * FROM submissions 
WHERE created_at < NOW() - INTERVAL '1 year';

DELETE FROM submissions 
WHERE created_at < NOW() - INTERVAL '1 year';
```

### Security Maintenance

#### Access Review
```bash
# Review admin access
echo "Current admin users:"
grep ADMIN_SLACK_IDS .env

# Review API key usage
echo "Checking API key rotation dates..."
# Implementation specific to your secret management
```

#### Security Scanning
```bash
# Scan for vulnerabilities
npm audit

# Update dependencies
npm update

# Container security scan
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  -v $PWD:/tmp aquasec/trivy image ai-games-slack-app:latest
```

## Scaling Considerations

### Horizontal Scaling

#### Load Balancer Configuration
```nginx
upstream ai_games_backend {
    server app1:3000;
    server app2:3000;
    server app3:3000;
    keepalive 32;
}

server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://ai_games_backend;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

#### Auto-scaling Configuration
```yaml
# Kubernetes HPA
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: ai-games-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: ai-games-app
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

### Vertical Scaling

#### Resource Optimization
```yaml
# Container resource limits
resources:
  requests:
    memory: "256Mi"
    cpu: "250m"
  limits:
    memory: "512Mi"
    cpu: "500m"
```

#### Database Scaling
```sql
-- Connection pooling configuration
max_connections = 100
shared_buffers = 256MB
effective_cache_size = 1GB
work_mem = 4MB
maintenance_work_mem = 64MB
```

### Performance Optimization

#### Caching Strategy
```javascript
// Redis caching implementation
const redis = require('redis');
const client = redis.createClient(process.env.REDIS_URL);

async function getCachedLeaderboard() {
  const cached = await client.get('leaderboard:global');
  if (cached) {
    return JSON.parse(cached);
  }
  
  const leaderboard = await generateLeaderboard();
  await client.setex('leaderboard:global', 300, JSON.stringify(leaderboard));
  return leaderboard;
}
```

#### Database Query Optimization
```sql
-- Add indexes for common queries
CREATE INDEX CONCURRENTLY idx_users_total_xp ON users(total_xp DESC);
CREATE INDEX CONCURRENTLY idx_submissions_created_at ON submissions(created_at DESC);
CREATE INDEX CONCURRENTLY idx_xp_events_user_created ON xp_events(user_id, created_at DESC);
```

## Troubleshooting

### Common Production Issues

#### High Memory Usage
```bash
# Check container memory usage
docker stats ai-games-app

# Monitor Node.js heap
node --inspect app.js
# Use Chrome DevTools to analyze memory
```

**Solutions**:
- Implement memory leak detection
- Optimize cache retention policies
- Add memory limits to containers
- Use streaming for large data processing

#### Database Connection Issues
```bash
# Check database connections
SELECT pid, usename, application_name, client_addr, state
FROM pg_stat_activity 
WHERE state = 'active';
```

**Solutions**:
- Implement connection pooling
- Add connection retry logic
- Monitor connection limits
- Use read replicas for scaling

#### Slack API Rate Limits
```javascript
// Rate limiting implementation
const rateLimit = require('express-rate-limit');

const slackLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 50, // 50 requests per minute
  message: 'Too many requests to Slack API'
});
```

**Solutions**:
- Implement exponential backoff
- Cache Slack API responses
- Use batch operations where possible
- Monitor rate limit headers

### Debugging Techniques

#### Log Analysis
```bash
# Find error patterns
grep "ERROR" /var/log/ai-games/app.log | \
  awk '{print $NF}' | sort | uniq -c | sort -nr

# Monitor real-time logs
tail -f /var/log/ai-games/app.log | grep -E "(ERROR|WARN)"
```

#### Performance Profiling
```javascript
// Add performance monitoring
const { performance } = require('perf_hooks');

function profileFunction(fn, name) {
  return async (...args) => {
    const start = performance.now();
    const result = await fn(...args);
    const duration = performance.now() - start;
    
    console.log(`${name} took ${duration.toFixed(2)}ms`);
    return result;
  };
}
```

### Emergency Procedures

#### Application Restart
```bash
# Graceful restart
docker kill -s SIGTERM ai-games-app
docker run -d --name ai-games-app --env-file .env ai-games-slack-app:latest

# Kubernetes rolling restart
kubectl rollout restart deployment/ai-games-app
```

#### Rollback Procedures
```bash
# Docker rollback
docker stop ai-games-app
docker run -d --name ai-games-app --env-file .env ai-games-slack-app:previous

# Kubernetes rollback
kubectl rollout undo deployment/ai-games-app
kubectl rollout status deployment/ai-games-app
```

#### Emergency Maintenance Mode
```javascript
// Add to application
app.use((req, res, next) => {
  if (process.env.MAINTENANCE_MODE === 'true') {
    return res.status(503).json({
      error: 'Service Unavailable',
      message: 'AI Games is temporarily down for maintenance'
    });
  }
  next();
});
```

---

**Production Ready**: Following this deployment and maintenance guide ensures your AI Games Slack App runs reliably in production with proper monitoring, backup, and scaling capabilities.