# LLM Integration with LiteLLM

This application uses LiteLLM to provide flexible LLM integration, allowing you to use different AI models including Google Gemini, OpenAI, Claude, and many others.

## Configuration

### Environment Variables

Set these in your `.env` file:

```bash
# LLM Configuration
LLM_MODEL=gemini/gemini-1.5-flash         # Default model to use
LLM_MAX_TOKENS=2048                       # Maximum tokens for responses
LLM_TEMPERATURE=0.3                       # Temperature for responses (0-1)

# API Keys (set based on your chosen model)
GEMINI_API_KEY=your-gemini-api-key        # For Google Gemini models
OPENAI_API_KEY=your-openai-api-key        # For OpenAI models
ANTHROPIC_API_KEY=your-anthropic-api-key  # For Claude models
```

### Supported Models

You can use any model supported by LiteLLM. Popular options:

#### Google Gemini
```bash
LLM_MODEL=gemini/gemini-1.5-flash
LLM_MODEL=gemini/gemini-1.5-pro
```

#### OpenAI
```bash
LLM_MODEL=gpt-4o
LLM_MODEL=gpt-4o-mini
LLM_MODEL=gpt-3.5-turbo
```

#### Anthropic Claude
```bash
LLM_MODEL=claude-3-5-sonnet-20241022
LLM_MODEL=claude-3-haiku-20240307
```

#### Other Providers
LiteLLM supports 100+ models from providers like:
- Azure OpenAI
- AWS Bedrock
- Cohere
- Hugging Face
- Ollama (local models)
- And many more

## Features Using LLM

The application uses LLM services for:

1. **Similarity Detection**: Analyzing if submissions are duplicates or remixes
2. **Content Quality Analysis**: Scoring remix improvements and content quality
3. **Intelligent XP Calculation**: Quality-based XP bonuses and penalties

## Fallback Behavior

If the LLM service fails:
- The system falls back to basic text similarity algorithms
- Functionality continues with reduced accuracy
- Errors are logged for debugging

## API Key Setup

### Google Gemini
1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Create a new API key
3. Set `GEMINI_API_KEY` in your environment

### OpenAI
1. Go to [OpenAI API Keys](https://platform.openai.com/api-keys)
2. Create a new secret key
3. Set `OPENAI_API_KEY` in your environment

## Performance Considerations

- Gemini models are generally faster and cheaper than GPT-4
- For high-volume applications, consider using faster models like `gemini-1.5-flash`
- The system caches similarity results to avoid redundant LLM calls

## Monitoring

Check your application logs for:
- LLM API usage and costs
- Fallback occurrences
- Rate limiting issues

## Troubleshooting

### Common Issues

1. **API Key Invalid**: Verify your API key is correct and has proper permissions
2. **Rate Limiting**: Consider implementing request throttling or using different models
3. **Network Issues**: Check your internet connection and API endpoint availability

### Debug Mode

Set `NODE_ENV=development` to see detailed LLM service logs.