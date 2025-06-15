# AI Games Slack App - Deployment Guide

## 🚀 Quick Start

### Prerequisites
- Docker and Docker Compose installed
- Node.js 18+ (for local development)
- Slack App configured with appropriate permissions
- Supabase project set up with required tables

### Environment Setup

1. **Copy environment template:**
   ```bash
   cp .env.example .env
   ```

2. **Configure environment variables:**
   Edit `.env` with your actual values:
   - Slack Bot Token, Signing Secret, and App Token
   - Supabase URL and Service Role Key
   - Admin user Slack IDs (comma-separated)
   - Optional: LLM API keys for future features

## 🐳 Docker Deployment

### Production Deployment

1. **Build and run with Docker Compose:**
   ```bash
   # Build and start the application
   npm run docker:prod
   
   # Or manually:
   docker-compose up -d
   ```

2. **Check application status:**
   ```bash
   # View logs
   docker-compose logs -f ai-games-app
   
   # Check health
   curl http://localhost:3000/health
   ```

3. **Stop the application:**
   ```bash
   npm run docker:stop
   # Or: docker-compose down
   ```

### Development with Docker

```bash
# Run development version with hot reloading
npm run docker:dev

# Or manually:
docker-compose --profile dev up
```

### Quick Deploy Script

```bash
# Deploy to production
npm run deploy

# Deploy to specific environment
./scripts/deploy.sh production

# Deploy with custom image tag
./scripts/deploy.sh production v1.2.3
```

## 🔧 Manual Deployment

### Local Development

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Build the application:**
   ```bash
   npm run build
   ```

3. **Start the application:**
   ```bash
   npm start
   ```

### Production Server

1. **Clone and setup:**
   ```bash
   git clone <your-repo-url>
   cd ai-games-slack-app
   npm ci --only=production
   npm run build
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env.production
   # Edit .env.production with production values
   ```

3. **Start with PM2 (recommended):**
   ```bash
   npm install -g pm2
   pm2 start dist/app.js --name "ai-games-app"
   pm2 save
   pm2 startup
   ```

## ☁️ Cloud Deployment

### Docker Hub / Container Registry

1. **Build and tag image:**
   ```bash
   docker build -t your-registry/ai-games-slack-app:latest .
   docker push your-registry/ai-games-slack-app:latest
   ```

2. **Deploy on server:**
   ```bash
   docker pull your-registry/ai-games-slack-app:latest
   docker run -d --name ai-games-app \
     --restart unless-stopped \
     -p 3000:3000 \
     --env-file .env.production \
     your-registry/ai-games-slack-app:latest
   ```

### Heroku Deployment

1. **Create Heroku app:**
   ```bash
   heroku create your-app-name
   heroku addons:create heroku-postgresql:hobby-dev
   ```

2. **Set environment variables:**
   ```bash
   heroku config:set SLACK_BOT_TOKEN=xoxb-your-token
   heroku config:set SLACK_SIGNING_SECRET=your-secret
   # ... add all required environment variables
   ```

3. **Deploy:**
   ```bash
   git push heroku main
   ```

### AWS ECS / Azure Container Instances / Google Cloud Run

See the respective cloud provider documentation for container deployment. The Docker image built by this project is compatible with all major cloud container services.

## 🔍 Monitoring and Health Checks

### Health Endpoint

The application provides a health check endpoint at `/health`:

```bash
curl http://localhost:3000/health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "uptime": 3600,
  "environment": "production",
  "version": "1.0.0"
}
```

### Optional Monitoring Stack

Enable Prometheus and Grafana monitoring:

```bash
# Start with monitoring
docker-compose --profile monitoring up -d

# Access Grafana at http://localhost:3001
# Username: admin, Password: admin
```

### Logging

- Application logs are written to `/app/logs` in the container
- Docker logs: `docker logs ai-games-app`
- Production: Configure log aggregation (ELK Stack, Datadog, etc.)

## 🔒 Security Considerations

### Production Checklist

- [ ] Use strong, unique secrets for all tokens
- [ ] Enable HTTPS with valid SSL certificates
- [ ] Configure firewall rules (only expose port 3000)
- [ ] Regularly update dependencies (`npm audit`)
- [ ] Monitor security logs in `/privacy` and `/security` admin commands
- [ ] Set up backup strategy for Supabase data
- [ ] Configure rate limiting appropriately
- [ ] Review admin user list regularly

### Environment Variables

Never commit actual secrets to version control. Use:
- Environment-specific `.env` files (not committed)
- Cloud provider secret managers
- Container orchestration secrets (Kubernetes secrets, Docker secrets)

## 🚨 Troubleshooting

### Common Issues

1. **Health check fails:**
   ```bash
   # Check if app is listening on correct port
   docker exec ai-games-app netstat -tlnp
   
   # Check application logs
   docker logs ai-games-app --tail 50
   ```

2. **Slack connection issues:**
   - Verify bot token has correct permissions
   - Check signing secret matches Slack app configuration
   - Ensure app token is valid for Socket Mode

3. **Database connection issues:**
   - Verify Supabase URL and service role key
   - Check network connectivity to Supabase
   - Review RLS policies in Supabase

4. **Memory/Performance issues:**
   ```bash
   # Monitor resource usage
   docker stats ai-games-app
   
   # Increase memory limits in docker-compose.yml if needed
   ```

### Getting Help

- Check application logs: `docker logs ai-games-app`
- Review Slack app event logs in Slack API dashboard
- Monitor health endpoint: `curl http://localhost:3000/health`
- Check Supabase dashboard for database errors

## 📈 Scaling

### Horizontal Scaling

The application is designed to be stateless and can be scaled horizontally:

1. **Load Balancer Setup:**
   - Use nginx, HAProxy, or cloud load balancer
   - Distribute traffic across multiple container instances
   - Configure health checks on `/health` endpoint

2. **Database Considerations:**
   - Supabase handles database scaling automatically
   - Consider connection pooling for high-traffic scenarios
   - Monitor database performance in Supabase dashboard

3. **Rate Limiting:**
   - Current rate limiting is per-instance
   - Consider Redis-based rate limiting for multi-instance deployments

### Vertical Scaling

```yaml
# In docker-compose.yml
services:
  ai-games-app:
    deploy:
      resources:
        limits:
          memory: 1G
          cpus: '1.0'
        reservations:
          memory: 512M
          cpus: '0.5'
```