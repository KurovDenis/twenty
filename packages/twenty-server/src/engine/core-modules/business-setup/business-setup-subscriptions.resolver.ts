import { Inject, Logger, UseFilters, UseGuards, UsePipes } from '@nestjs/common';
import { Args, Resolver, Subscription } from '@nestjs/graphql';
import { RedisPubSub } from 'graphql-redis-subscriptions';
import { isDefined } from 'twenty-shared/utils';

import { PreventNestToAutoLogGraphqlErrorsFilter } from 'src/engine/core-modules/graphql/filters/prevent-nest-to-auto-log-graphql-errors.filter';
import { ResolverValidationPipe } from 'src/engine/core-modules/graphql/pipes/resolver-validation.pipe';
import { User } from 'src/engine/core-modules/user/user.entity';
import { AuthUser } from 'src/engine/decorators/auth/auth-user.decorator';
import { UserAuthGuard } from 'src/engine/guards/user-auth.guard';
import { WorkspaceAuthGuard } from 'src/engine/guards/workspace-auth.guard';

import {
  AIAgentEventInput,
  AIAgentEventSubscriptionResponse,
  BusinessSetupEventInput,
  BusinessSetupEventType,
  OnboardingEventInput,
  OnboardingStatusSubscriptionResponse,
  SUBSCRIPTION_CHANNELS,
  SubscriptionEventPayload,
} from './types/business-setup-subscription.types';

/**
 * BusinessSetupSubscriptionsResolver
 * 
 * Provides GraphQL subscriptions for business setup events including:
 * - Onboarding status changes
 * - AI agent welcome chat events
 * - Business setup progress events
 */
@Resolver()
@UseGuards(WorkspaceAuthGuard, UserAuthGuard)
@UsePipes(ResolverValidationPipe)
@UseFilters(PreventNestToAutoLogGraphqlErrorsFilter)
export class BusinessSetupSubscriptionsResolver {
  private readonly logger = new Logger(BusinessSetupSubscriptionsResolver.name);

  constructor(@Inject('PUB_SUB') private readonly pubSub: RedisPubSub) {}

  /**
   * Main business setup events subscription
   * Handles all types of business setup events with filtering
   */
  @Subscription(() => SubscriptionEventPayload, {
    filter: (
      payload: SubscriptionEventPayload,
      variables: { input: BusinessSetupEventInput },
      context: { req: { user: User } },
    ) => {
      const user = context.req?.user;
      if (!user) {
        return false;
      }
      
      // Security: Only allow events for the authenticated user's workspace
      const isWorkspaceMatching = (payload.payload as any)?.workspaceId === variables.input.workspaceId;
      
      // Optional user filtering
      const isUserMatching = !isDefined(variables.input.userId) || 
                            (payload.payload as any)?.userId === variables.input.userId;
      
      // Optional event type filtering
      const isEventTypeMatching = !isDefined(variables.input.eventTypes) ||
                                 variables.input.eventTypes.includes(payload.type);
      
      // Log filtered events for debugging
      // Note: Logger not available in filter context, using console.log
      if (!isWorkspaceMatching || !isUserMatching || !isEventTypeMatching) {
        console.debug(
          `Filtered event: workspace=${isWorkspaceMatching}, user=${isUserMatching}, type=${isEventTypeMatching}`,
        );
      }
      
      return isWorkspaceMatching && isUserMatching && isEventTypeMatching;
    },
  })
  onBusinessSetupEvent(
    @Args('input') input: BusinessSetupEventInput,
    @AuthUser() user: User,
  ) {
    this.logger.log(`Starting business setup events subscription for workspace: ${input.workspaceId}`);
    return this.pubSub.asyncIterator(SUBSCRIPTION_CHANNELS.BUSINESS_SETUP_EVENTS);
  }

  /**
   * Onboarding-specific events subscription
   * Optimized for onboarding status changes
   */
  @Subscription(() => OnboardingStatusSubscriptionResponse, {
    filter: (
      payload: SubscriptionEventPayload,
      variables: { input: OnboardingEventInput },
      context: { req: { user: User } },
    ) => {
      const user = context.req?.user;
      if (!user) {
        return false;
      }
      
      // Only onboarding events
      const isOnboardingEvent = payload.type === BusinessSetupEventType.ONBOARDING_STATUS_CHANGED;
      
      // Security: Only allow events for the authenticated user's workspace
      const isWorkspaceMatching = (payload.payload as any)?.workspaceId === variables.input.workspaceId;
      
      // Optional user filtering
      const isUserMatching = !isDefined(variables.input.userId) || 
                            (payload.payload as any)?.userId === variables.input.userId;
      
      return isOnboardingEvent && isWorkspaceMatching && isUserMatching;
    },
    resolve: (payload: SubscriptionEventPayload) => {
      // Transform the payload to match the response type
      const eventPayload = payload.payload as any;
      
      // Type guard to ensure we have the right payload type
      if (payload.type === BusinessSetupEventType.ONBOARDING_STATUS_CHANGED) {
        return {
          userId: eventPayload?.userId || '',
          workspaceId: eventPayload?.workspaceId || '',
          status: eventPayload?.status || '',
          previousStatus: eventPayload?.previousStatus || '',
          timestamp: eventPayload?.timestamp || new Date(),
        };
      }
      
      // Fallback for unexpected payload types
      return {
        userId: eventPayload?.userId || '',
        workspaceId: eventPayload?.workspaceId || '',
        status: 'UNKNOWN',
        previousStatus: 'UNKNOWN',
        timestamp: new Date(),
      };
    },
  })
  onOnboardingStatusChanged(
    @Args('input') input: OnboardingEventInput,
    @AuthUser() user: User,
  ) {
    this.logger.log(`Starting onboarding events subscription for workspace: ${input.workspaceId}`);
    return this.pubSub.asyncIterator([
      SUBSCRIPTION_CHANNELS.BUSINESS_SETUP_EVENTS,
      SUBSCRIPTION_CHANNELS.ONBOARDING_EVENTS,
    ]);
  }

  /**
   * AI Agent-specific events subscription
   * Optimized for AI agent welcome chat events
   */
  @Subscription(() => AIAgentEventSubscriptionResponse, {
    filter: (
      payload: SubscriptionEventPayload,
      variables: { input: AIAgentEventInput },
      context: { req: { user: User } },
    ) => {
      const user = context.req?.user;
      if (!user) {
        return false;
      }
      
      // Only AI agent events
      const isAIAgentEvent = payload.type.startsWith('AI_AGENT_');
      
      // Security: Only allow events for the authenticated user's workspace
      const isWorkspaceMatching = (payload.payload as any)?.workspaceId === variables.input.workspaceId;
      
      // Optional user filtering
      const isUserMatching = !isDefined(variables.input.userId) || 
                            (payload.payload as any)?.userId === variables.input.userId;
      
      // Optional thread filtering
      const isThreadMatching = !isDefined(variables.input.threadId) ||
                              (payload.payload as any)?.threadId === variables.input.threadId;
      
      return isAIAgentEvent && isWorkspaceMatching && isUserMatching && isThreadMatching;
    },
    resolve: (payload: SubscriptionEventPayload) => {
      // Transform the payload to match the response type
      const eventPayload = payload.payload as any;
      let status = 'UNKNOWN';
      let error: string | undefined;
      
      if (payload.type === BusinessSetupEventType.AI_AGENT_WELCOME_CHAT_CREATED) {
        status = 'CHAT_CREATED';
      } else if (payload.type === BusinessSetupEventType.AI_AGENT_WELCOME_CHAT_FAILED) {
        status = 'CHAT_FAILED';
        error = eventPayload?.error;
      }
      
      return {
        eventType: payload.type,
        threadId: eventPayload?.threadId || null,
        messageId: eventPayload?.messageId || null,
        status,
        error: error || null,
        timestamp: eventPayload?.timestamp || new Date(),
      };
    },
  })
  onAIAgentEvents(
    @Args('input') input: AIAgentEventInput,
    @AuthUser() user: User,
  ) {
    this.logger.log(`Starting AI agent events subscription for workspace: ${input.workspaceId}`);
    return this.pubSub.asyncIterator([
      SUBSCRIPTION_CHANNELS.BUSINESS_SETUP_EVENTS,
      SUBSCRIPTION_CHANNELS.AI_AGENT_EVENTS,
    ]);
  }

  /**
   * Health check subscription for testing connectivity
   */
  @Subscription(() => String, {
    filter: (
      payload: any,
      variables: any,
      context: { req: { user: User } },
    ) => {
      // Allow health check for all authenticated users
      return !!context.req?.user;
    },
  })
  onHealthCheck(@AuthUser() user: User) {
    this.logger.log(`Health check subscription started for user: ${user.id}`);
    return this.pubSub.asyncIterator('healthCheck');
  }
}