# OpenRouter Configuration for Welcome Step

Add the following environment variables to your server's `.env` file (located at `packages/twenty-server/.env`):

```bash
# OpenAI-compatible API config for OpenRouter
OPENAI_COMPATIBLE_BASE_URL=https://openrouter.ai/api/v1
OPENAI_COMPATIBLE_API_KEY=your_openrouter_api_key_here
OPENAI_COMPATIBLE_MODEL_NAMES=google/gemini-2.5-flash

# Set default model to use for all interactions
DEFAULT_MODEL_ID=google/gemini-2.5-flash
```

These settings will configure the Twenty server to use OpenRouter as an OpenAI-compatible provider and specifically use Google's Gemini 2.5 Flash model for all LLM interactions.