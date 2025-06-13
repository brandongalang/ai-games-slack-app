# AI Games LLM Services

Microservice for LLM-powered features in the AI Games Slack app.

## Features

- **Clarity Scoring**: Analyze AI prompts for clarity and effectiveness
- **Similarity Detection**: Compare prompts to detect remixes and duplicates  
- **Digest Generation**: Create weekly/mid-week summaries of top prompts
- **Authentication**: API key-based security for internal communication

## API Endpoints

### Health Check
```
GET /health
```

### Clarity Scoring
```
POST /api/clarity/score
Content-Type: application/json
Authorization: Bearer YOUR_API_KEY

{
  "prompt": "Your AI prompt text here",
  "title": "Optional title",
  "description": "Optional description"
}
```

### Similarity Analysis
```
POST /api/similarity/compare
Content-Type: application/json
Authorization: Bearer YOUR_API_KEY

{
  "prompt1": "First prompt text",
  "prompt2": "Second prompt text",
  "title1": "Optional title 1",
  "title2": "Optional title 2"
}
```

### Digest Generation
```
POST /api/digest/generate
Content-Type: application/json
Authorization: Bearer YOUR_API_KEY

{
  "prompts": [...],
  "period": "weekly|mid-week",
  "context": "Optional additional context"
}
```

## Local Development

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

3. **Run in development mode:**
   ```bash
   npm run dev
   ```

## Docker Deployment

1. **Build image:**
   ```bash
   npm run docker:build
   ```

2. **Run container:**
   ```bash
   npm run docker:run
   ```

## Cloud Run Deployment

1. **Build and push to Google Container Registry:**
   ```bash
   gcloud builds submit --tag gcr.io/YOUR_PROJECT/ai-games-llm-services
   ```

2. **Deploy to Cloud Run:**
   ```bash
   gcloud run deploy ai-games-llm-services \
     --image gcr.io/YOUR_PROJECT/ai-games-llm-services \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated \
     --set-env-vars="NODE_ENV=production,OPENAI_API_KEY=your-key,LLM_SERVICE_API_KEY=your-api-key"
   ```

## Environment Variables

- `NODE_ENV`: Environment (development/production)
- `PORT`: Server port (default: 8080)
- `OPENAI_API_KEY`: OpenAI API key for LLM calls
- `LLM_SERVICE_API_KEY`: Internal API key for authentication
- `SUPABASE_URL`: Supabase project URL (if needed)
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key (if needed)