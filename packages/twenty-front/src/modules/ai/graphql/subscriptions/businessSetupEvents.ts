import { gql } from '@apollo/client';

/**
 * Main business setup events subscription
 * Subscribes to all business setup events with filtering capabilities
 */
export const BUSINESS_SETUP_EVENTS_SUBSCRIPTION = gql`
  subscription OnBusinessSetupEvents($input: BusinessSetupEventInput!) {
    onBusinessSetupEvent(input: $input) {
      id
      type
      payload {
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
        ... on AIAgentWelcomeChatErrorPayload {
          userId
          workspaceId
          error
          attempts
          timestamp
        }
      }
      metadata {
        source
        version
        timestamp
        processingTime
        retryCount
      }
    }
  }
`;

/**
 * Onboarding-specific events subscription
 * Optimized for onboarding status changes only
 */
export const ONBOARDING_STATUS_SUBSCRIPTION = gql`
  subscription OnOnboardingStatusChanged($input: OnboardingEventInput!) {
    onOnboardingStatusChanged(input: $input) {
      userId
      workspaceId
      status
      previousStatus
      timestamp
    }
  }
`;

/**
 * AI Agent-specific events subscription
 * Optimized for AI agent welcome chat events only
 */
export const AI_AGENT_EVENTS_SUBSCRIPTION = gql`
  subscription OnAIAgentEvents($input: AIAgentEventInput!) {
    onAIAgentEvents(input: $input) {
      eventType
      threadId
      messageId
      status
      error
      timestamp
    }
  }
`;

/**
 * Health check subscription for testing connectivity
 */
export const HEALTH_CHECK_SUBSCRIPTION = gql`
  subscription OnHealthCheck {
    onHealthCheck
  }
`;
