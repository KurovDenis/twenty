# Welcome Step Gemini Integration Checklist

Use this checklist to verify the proper implementation of Google's Gemini 2.5 Flash via OpenRouter for the welcome step.

## Environment Configuration

- [ ] Set `OPENAI_COMPATIBLE_BASE_URL` to `https://openrouter.ai/api/v1`
- [ ] Configure `OPENAI_COMPATIBLE_API_KEY` with a valid OpenRouter API key
- [ ] Set `OPENAI_COMPATIBLE_MODEL_NAMES` to include `google/gemini-2.5-flash`
- [ ] Set `DEFAULT_MODEL_ID` to `google/gemini-2.5-flash`

## Code Implementation

- [x] Modified `BusinessSetupWelcomeAgentService` to create or use a dedicated Gemini agent
- [x] Updated agent creation to explicitly use `modelId: 'google/gemini-2.5-flash'`
- [x] Added `modelId: 'google/gemini-2.5-flash'` to execution context for enforcement
- [x] Simplified welcome message to be only a greeting bot
- [x] Replaced Russian comments with English comments
- [x] Added repository injection for agent entity

## Testing

- [x] Created unit tests to verify agent creation with correct model
- [x] Added tests for model enforcement regardless of existing agent configuration
- [x] Added test for welcome message simplification

## Verification Steps

1. Configure environment variables according to the checklist
2. Start the server with `npx nx start twenty-server`
3. Complete user onboarding to trigger welcome chat creation
4. Verify in logs that the welcome agent is using `google/gemini-2.5-flash`
5. Confirm welcome message is simplified to greeting only
6. Run tests with `npx nx test twenty-server --testNamePattern="business-setup-welcome-agent-gemini"`

## Additional Checks

- [ ] Verify OpenRouter account has access to Gemini 2.5 Flash model
- [ ] Check OpenRouter usage logs to confirm Gemini model invocation
- [ ] Ensure API rate limits are appropriate for expected traffic
- [ ] Test recovery from network failures (retry mechanism)

## Important Notes

1. This implementation ensures ALL LLM interactions in the welcome step use ONLY Gemini 2.5 Flash via OpenRouter
2. No fallback to other models is allowed - if Gemini is not available, the operation should fail
3. The welcome bot is now ONLY a greeting bot with no business setup guidance

## Common Issues

- If OpenRouter returns an error about model availability, verify your OpenRouter plan includes access to Gemini models
- If retry attempts are exhausted, check network connectivity to OpenRouter
- If welcome chat is not created, verify onboarding status changes are correctly emitted