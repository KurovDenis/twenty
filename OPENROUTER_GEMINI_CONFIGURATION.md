# OpenRouter Gemini Integration

This document describes the configuration required to use Google's Gemini 2.5 Flash model via OpenRouter for the welcome step in Twenty CRM.

## Environment Variables

Add the following environment variables to your `.env` file:

```
OPENAI_COMPATIBLE_BASE_URL=https://openrouter.ai/api/v1
OPENAI_COMPATIBLE_API_KEY=<your-openrouter-api-key>
OPENAI_COMPATIBLE_MODEL_NAMES=google/gemini-2.5-flash
DEFAULT_MODEL_ID=google/gemini-2.5-flash
```

## Configuration Explanation

- **OPENAI_COMPATIBLE_BASE_URL**: Points to OpenRouter's API endpoint which provides compatibility with OpenAI's API format.
- **OPENAI_COMPATIBLE_API_KEY**: Your OpenRouter API key for authentication.
- **OPENAI_COMPATIBLE_MODEL_NAMES**: Specifies which models are available through the OpenAI-compatible interface. Here we specify only Gemini 2.5 Flash.
- **DEFAULT_MODEL_ID**: Sets the default model to be used when none is specified. This is an additional safeguard to ensure Gemini is used.

## Obtaining an OpenRouter API Key

1. Sign up for an account at [OpenRouter](https://openrouter.ai/)
2. Navigate to the API Keys section
3. Create a new API key with appropriate rate limits
4. Copy the key into your `.env` file

## Security Considerations

- Keep your API key secure and never commit it to version control
- Consider using environment variable management solutions for production deployments
- Regularly rotate your API keys for enhanced security