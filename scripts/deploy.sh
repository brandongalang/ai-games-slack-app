#!/bin/bash

# AI Games Slack App Deployment Script
# Usage: ./scripts/deploy.sh [environment]

set -e  # Exit on any error

ENVIRONMENT=${1:-production}
IMAGE_NAME="ai-games-slack-app"
IMAGE_TAG=${2:-latest}

echo "🚀 Starting deployment for environment: $ENVIRONMENT"

# Load environment variables
if [ -f ".env.$ENVIRONMENT" ]; then
    echo "📋 Loading environment variables from .env.$ENVIRONMENT"
    source ".env.$ENVIRONMENT"
elif [ -f ".env" ]; then
    echo "📋 Loading environment variables from .env"
    source ".env"
else
    echo "⚠️  No environment file found. Make sure to set environment variables manually."
fi

# Validate required environment variables
required_vars=("SLACK_BOT_TOKEN" "SLACK_SIGNING_SECRET" "SLACK_APP_TOKEN" "SUPABASE_URL" "SUPABASE_SERVICE_ROLE_KEY")
for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        echo "❌ Error: Required environment variable $var is not set"
        exit 1
    fi
done

echo "✅ Environment variables validated"

# Build the Docker image
echo "🔨 Building Docker image..."
docker build -t "$IMAGE_NAME:$IMAGE_TAG" .

# Stop existing container if running
echo "🛑 Stopping existing container..."
docker stop "$IMAGE_NAME" 2>/dev/null || true
docker rm "$IMAGE_NAME" 2>/dev/null || true

# Run new container
echo "🏃 Starting new container..."
docker run -d \
    --name "$IMAGE_NAME" \
    --restart unless-stopped \
    -p 3000:3000 \
    -e NODE_ENV="$ENVIRONMENT" \
    -e SLACK_BOT_TOKEN="$SLACK_BOT_TOKEN" \
    -e SLACK_SIGNING_SECRET="$SLACK_SIGNING_SECRET" \
    -e SLACK_APP_TOKEN="$SLACK_APP_TOKEN" \
    -e SUPABASE_URL="$SUPABASE_URL" \
    -e SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY" \
    -e ADMIN_USERS="$ADMIN_USERS" \
    -e OPENAI_API_KEY="${OPENAI_API_KEY:-}" \
    -v "$(pwd)/logs:/app/logs" \
    "$IMAGE_NAME:$IMAGE_TAG"

# Wait for container to start
echo "⏳ Waiting for container to start..."
sleep 10

# Check if container is running
if docker ps | grep -q "$IMAGE_NAME"; then
    echo "✅ Container is running successfully!"
    
    # Run health check
    echo "🏥 Running health check..."
    for i in {1..5}; do
        if curl -f http://localhost:3000/health >/dev/null 2>&1; then
            echo "✅ Health check passed!"
            break
        else
            echo "⏳ Health check attempt $i/5 failed, retrying in 5 seconds..."
            sleep 5
        fi
        
        if [ $i -eq 5 ]; then
            echo "❌ Health check failed after 5 attempts"
            docker logs "$IMAGE_NAME" --tail 50
            exit 1
        fi
    done
    
    echo "🎉 Deployment completed successfully!"
    echo "📊 Container status:"
    docker ps | grep "$IMAGE_NAME"
    
else
    echo "❌ Container failed to start"
    docker logs "$IMAGE_NAME" --tail 50
    exit 1
fi