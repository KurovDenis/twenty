# Welcome Step Gemini Integration Guide

## Overview

This document describes the implementation of Google's Gemini 2.5 Flash model through OpenRouter for the welcome step in Twenty CRM. All LLM interactions in the welcome step now exclusively use the Gemini 2.5 Flash model via OpenRouter as an OpenAI-compatible provider.

## Implementation Details

### 1. OpenRouter Configuration

The system uses OpenRouter's API as an OpenAI-compatible service. Configuration is done through environment variables:

```bash
# OpenAI-compatible API config for OpenRouter
OPENAI_COMPATIBLE_BASE_URL=https://openrouter.ai/api/v1
OPENAI_COMPATIBLE_API_KEY=your_openrouter_api_key_here
OPENAI_COMPATIBLE_MODEL_NAMES=google/gemini-2.5-flash
# Set as default model
DEFAULT_MODEL_ID=google/gemini-2.5-flash
```

### 2. Dedicated Welcome Agent

A dedicated agent for the welcome step has been implemented with the following characteristics:

- **Name**: Welcome Greeting Bot
- **Description**: Simple greeting bot for welcome status
- **Model**: google/gemini-2.5-flash (enforced)
- **Prompt**: Simplified to act only as a greeting bot

The agent is either created automatically when needed or fetched if already existing. This ensures that every welcome interaction uses the correct model.

### 3. Simplified Welcome Message

The welcome message has been simplified to be a simple greeting, removing any business setup guidance:

```
👋 Hello [UserName]!

I AM A WELCOME BOT AND NOTHING MORE. I'm here to greet you in [WorkspaceName].

Have a great day!
```

### 4. Model Enforcement

Multiple mechanisms ensure the Gemini model is always used:

1. **Agent Configuration**: The welcome agent explicitly uses `google/gemini-2.5-flash` as its model
2. **Context Override**: The execution context includes `modelId: 'google/gemini-2.5-flash'` to enforce the model
3. **Default Model**: The system's default model is set to Gemini via environment variable

## Technical Implementation

### Model Registration

OpenRouter integration leverages Twenty's existing support for OpenAI-compatible providers through the `AiModelRegistryService`. When configured with the appropriate environment variables, the system automatically registers the Gemini model during bootstrap.

### Agent Execution Flow

1. When onboarding is completed, the system triggers welcome chat creation
2. A dedicated Gemini-based agent is fetched or created
3. A personalized welcome message is generated
4. The agent executes with explicit model configuration
5. The response is saved to the chat thread

### Error Handling

The implementation includes a comprehensive retry mechanism with:

- Maximum 3 retry attempts
- Exponential backoff between attempts
- Proper error logging and event emission

## Testing

Dedicated tests verify the proper use of the Gemini model:

1. Tests for agent creation with the correct model
2. Tests for model enforcement in the execution context
3. Tests for proper response handling

## Usage Guidelines

To ensure all welcome interactions use the Gemini model:

1. Always configure OpenRouter API key and base URL
2. Never modify the agent's model configuration
3. Use the included testing utilities to verify proper model usage

For detailed implementation see:
- `business-setup-welcome-agent.service.ts`
- `business-setup-welcome-agent-gemini.spec.ts`