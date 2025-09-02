import { gql } from '@apollo/client';

/**
 * Расширенная подписка business setup с SGR событиями
 */
export const ENHANCED_BUSINESS_SETUP_EVENTS_SUBSCRIPTION = gql`
  subscription OnEnhancedBusinessSetupEvents($input: BusinessSetupEventInput!) {
    onBusinessSetupEvent(input: $input) {
      id
      type
      payload {
        ... on SGRStreamingPayload {
          threadId
          stepId
          token
          fullJson
          toolName
          toolArgs
          error
          timestamp
          metadata {
            stepNumber
            totalSteps
            processingTime
            tokensEmitted
          }
        }
        ... on OnboardingStatusChangedPayload {
          userId
          workspaceId
          status
          previousStatus
          timestamp
        }
        ... on AIAgentWelcomeChatPayload {
          userId
          workspaceId
          threadId
          aiResponse
          timestamp
        }
      }
      metadata {
        source
        version
        timestamp
        sgrStreaming
      }
    }
  }
`;
