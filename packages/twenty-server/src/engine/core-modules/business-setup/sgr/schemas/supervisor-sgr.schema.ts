import { z } from 'zod';

import { BusinessSetupStatus } from '../../enums/business-setup-status.enum';

/**
 * Supervisor Tool Union - Available tools for supervisor routing decisions
 */
export type SupervisorToolUnion =
  | 'check_business_setup_status'
  | 'route_to_specialized_agent'
  | 'process_directly'
  | 'status_change'
  | 'complete_routing';

/**
 * Business Setup Status Schema for validation
 */
export const BusinessSetupStatusSchema = z.nativeEnum(BusinessSetupStatus);

/**
 * Supervisor Step Schema - Structured reasoning schema for supervisor agent
 *
 * This schema enforces consistent decision-making patterns for the supervisor agent:
 * 1. Current state analysis
 * 2. Planning next steps (1-3 steps max for focused reasoning)
 * 3. Task completion tracking
 * 4. Tool selection with type-safe parameters
 */
export const SupervisorStepSchema = z.object({
  current_state: z
    .string()
    .min(10)
    .max(500)
    .describe(
      'Current understanding of user request and business setup status',
    ),

  plan_remaining_steps: z
    .array(z.string())
    .min(1)
    .max(3)
    .describe('Next 1-3 planned steps to handle the request'),

  task_completed: z
    .boolean()
    .describe('Whether the request routing is complete'),

  function: z.discriminatedUnion('tool', [
    /**
     * Check Business Setup Status Tool
     * Retrieves current business setup status for routing decisions
     */
    z.object({
      tool: z.literal('check_business_setup_status'),
      userId: z.string().uuid('Valid userId is required'),
      workspaceId: z.string().uuid('Valid workspaceId is required'),
    }),

    /**
     * Route to Specialized Agent Tool
     * Delegates request to appropriate specialized agent based on status
     */
    z.object({
      tool: z.literal('route_to_specialized_agent'),
      status: BusinessSetupStatusSchema,
      reason: z
        .string()
        .min(20)
        .max(500)
        .describe('Clear reason for routing to this agent'),
      message: z
        .string()
        .min(10)
        .max(1000)
        .describe('Message to send to specialized agent'),
    }),

    /**
     * Process Directly Tool
     * Handle simple queries without routing to specialized agents
     */
    z.object({
      tool: z.literal('process_directly'),
      response: z
        .string()
        .min(10)
        .max(1000)
        .describe('Direct response to user query'),
      reason: z
        .string()
        .min(10)
        .max(400)
        .describe('Why this query can be handled directly'),
    }),

    /**
     * Status Change Tool
     * Triggers progression to next business setup stage
     */
    z.object({
      tool: z.literal('status_change'),
      from_status: BusinessSetupStatusSchema,
      to_status: BusinessSetupStatusSchema,
      reason: z
        .string()
        .min(20)
        .max(300)
        .describe('Reason for status transition'),
      trigger_event: z
        .string()
        .optional()
        .describe('Optional event that triggered this transition'),
    }),

    /**
     * Complete Routing Tool
     * Signals completion of routing decision
     */
    z.object({
      tool: z.literal('complete_routing'),
      success: z.boolean().describe('Whether routing was successful'),
      final_message: z
        .string()
        .min(10)
        .max(500)
        .describe('Final message to user about routing outcome'),
      routed_to: z
        .string()
        .optional()
        .describe('Agent or service the request was routed to'),
    }),
  ]),
});

/**
 * Type inference for Supervisor Step Result
 */
export type SupervisorStepResult = z.infer<typeof SupervisorStepSchema>;

/**
 * Type helpers for tool functions
 */
export type CheckBusinessSetupStatusTool = Extract<
  SupervisorStepResult['function'],
  { tool: 'check_business_setup_status' }
>;
export type RouteToSpecializedAgentTool = Extract<
  SupervisorStepResult['function'],
  { tool: 'route_to_specialized_agent' }
>;
export type ProcessDirectlyTool = Extract<
  SupervisorStepResult['function'],
  { tool: 'process_directly' }
>;
export type StatusChangeTool = Extract<
  SupervisorStepResult['function'],
  { tool: 'status_change' }
>;
export type CompleteRoutingTool = Extract<
  SupervisorStepResult['function'],
  { tool: 'complete_routing' }
>;

/**
 * Union type for all supervisor tool functions
 */
export type SupervisorToolFunction = SupervisorStepResult['function'];

/**
 * Type guard to check if tool is a completion tool
 */
export function isCompletionTool(
  tool: SupervisorToolFunction,
): tool is CompleteRoutingTool {
  return tool.tool === 'complete_routing';
}

/**
 * Type guard to check if tool is a routing tool
 */
export function isRoutingTool(
  tool: SupervisorToolFunction,
): tool is RouteToSpecializedAgentTool {
  return tool.tool === 'route_to_specialized_agent';
}

/**
 * Type guard to check if tool is a status change tool
 */
export function isStatusChangeTool(
  tool: SupervisorToolFunction,
): tool is StatusChangeTool {
  return tool.tool === 'status_change';
}

/**
 * Supervisor execution context for streaming
 */
export interface SupervisorExecutionContext {
  userId: string;
  workspaceId: string;
  threadId: string;
  stepNumber: number;
}

/**
 * Supervisor streaming context extends execution context
 */
export interface SupervisorStreamingContext extends SupervisorExecutionContext {
  userMessage: string;
  maxSteps?: number;
}

/**
 * Supervisor execution parameters
 */
export interface SupervisorExecutionParams {
  task: string;
  userId: string;
  workspaceId: string;
  threadId: string;
  maxSteps?: number;
}

/**
 * Business setup progress information
 */
export interface BusinessSetupProgress {
  status: BusinessSetupStatus;
  lastUpdated: Date;
  isComplete: boolean;
  stepsCompleted: BusinessSetupStatus[];
  currentStepProgress?: number; // 0-100 percentage
}

/**
 * Supervisor execution result
 */
export interface SupervisorExecutionResult {
  success: boolean;
  routedTo?: string;
  finalMessage: string;
  steps_executed: string[];
  error?: string;
  timestamp: Date;
}
