/**
 * Business Setup Agent Configuration
 *
 * Defines specialized agents for different business setup stages
 * with their capabilities, SGR settings, and behavior overrides.
 * This configuration is now provider-agnostic and delegates to
 * the Supervisor Agent for routing decisions.
 */

import { BusinessSetupStatus } from '../hooks/useSetNextBusinessSetupStatus';

export interface BusinessSetupAgentConfig {
  agentId: string;
  step: BusinessSetupStatus;
  agentType: 'supervisor' | 'specialized' | 'general'; // Provider-agnostic types
  displayName: string;
  capabilities: string[];
  sgrEnabled: boolean;
  autoInit: boolean;
  delegateToSupervisor?: boolean; // New: Delegate routing to Supervisor
  autoGreeting?: boolean; // Automatically send greeting message
  greetingMessage?: string; // Custom greeting message
  metadata?: {
    complexity: 'simple' | 'complex';
    expectedProviders?: string[]; // Hint for which providers might handle this
    fallbackAction?: string;
  };
}

/**
 * Default Supervisor Agent ID - provider-agnostic
 */
export const DEFAULT_SUPERVISOR_AGENT_ID = 'supervisor-agent';

/**
 * SGR Avito Agent ID - specific for legacy Avito integration
 */
export const SGR_AVITO_AGENT_ID = '2f851163-c7ea-4eae-b960-13f019b256e3';

/**
 * Provider-agnostic agent configurations for each business setup stage
 * Routing decisions are now delegated to the Supervisor Agent
 */
export const BUSINESS_SETUP_AGENTS: Record<
  BusinessSetupStatus,
  BusinessSetupAgentConfig
> = {
  WELCOME: {
    agentId: SGR_AVITO_AGENT_ID,
    step: 'WELCOME',
    agentType: 'supervisor', // Always delegate to Supervisor for provider selection
    displayName: 'Business Setup Supervisor',
    capabilities: [
      'provider_detection',
      'credential_extraction',
      'setup_guidance',
      'routing_decision',
      'sgr_processing',
    ],
    sgrEnabled: true,
    autoInit: true,
    delegateToSupervisor: true, // Supervisor chooses appropriate provider
    autoGreeting: true,
    greetingMessage: `🤖 **Welcome to Business Setup Assistant**

**I'm your Business Setup Supervisor**

**My capabilities:**
🔧 **Smart Provider Detection** - I automatically detect which integration you need
🔐 **Secure Credential Handling** - I safely process your API credentials
📋 **Guided Setup Process** - I walk you through integration step-by-step
🤖 **Intelligent Routing** - I connect you with the right specialized agent
📊 **Data Analysis** - I help analyze your business integration needs

**How I work:**
1. **Share your integration details** (API keys, platform info, etc.)
2. **I detect the best provider** (Avito, eBay, Amazon, etc.)
3. **Route to specialized agent** for your specific platform
4. **Guide through setup** with real-time assistance

**Ready to start? Tell me about your integration needs!** 🚀`,
    metadata: {
      complexity: 'complex',
      expectedProviders: ['avito', 'ebay', 'amazon', 'wildberries'],
      fallbackAction: 'general_business_setup',
    },
  },

  BUSINESS_ANALYSIS: {
    agentId: 'business-analysis-agent',
    step: 'BUSINESS_ANALYSIS',
    agentType: 'specialized',
    displayName: 'Business Analysis Specialist',
    capabilities: [
      'business_analysis',
      'process_mapping',
      'opportunity_identification',
    ],
    sgrEnabled: false,
    autoInit: false,
    delegateToSupervisor: true,
    autoGreeting: false,
    metadata: {
      complexity: 'complex',
      expectedProviders: ['analytics', 'reporting'],
      fallbackAction: 'manual_analysis',
    },
  },

  SALES_FUNNEL_DESIGN: {
    agentId: 'sales-funnel-agent',
    step: 'SALES_FUNNEL_DESIGN',
    agentType: 'specialized',
    displayName: 'Sales Funnel Designer',
    capabilities: [
      'funnel_design',
      'conversion_optimization',
      'customer_journey_mapping',
    ],
    sgrEnabled: false,
    autoInit: false,
    delegateToSupervisor: true,
    autoGreeting: false,
    metadata: {
      complexity: 'complex',
      expectedProviders: ['crm', 'automation'],
      fallbackAction: 'template_funnel',
    },
  },

  AGENT_SETUP: {
    agentId: 'agent-setup-specialist',
    step: 'AGENT_SETUP',
    agentType: 'specialized',
    displayName: 'Agent Configuration Specialist',
    capabilities: [
      'agent_configuration',
      'automation_setup',
      'workflow_design',
    ],
    sgrEnabled: false,
    autoInit: false,
    delegateToSupervisor: true,
    autoGreeting: false,
    metadata: {
      complexity: 'simple',
      expectedProviders: ['agent_management'],
      fallbackAction: 'default_agent_config',
    },
  },

  WORKFLOW_CREATION: {
    agentId: 'workflow-automation-designer',
    step: 'WORKFLOW_CREATION',
    agentType: 'specialized',
    displayName: 'Workflow Automation Designer',
    capabilities: [
      'workflow_automation',
      'process_optimization',
      'integration_setup',
    ],
    sgrEnabled: false,
    autoInit: false,
    delegateToSupervisor: true,
    autoGreeting: false,
    metadata: {
      complexity: 'complex',
      expectedProviders: ['workflow_engine', 'automation'],
      fallbackAction: 'basic_workflow',
    },
  },

  TEAM_ASSIGNMENT: {
    agentId: 'team-organization-specialist',
    step: 'TEAM_ASSIGNMENT',
    agentType: 'specialized',
    displayName: 'Team Organization Specialist',
    capabilities: [
      'team_organization',
      'role_assignment',
      'collaboration_setup',
    ],
    sgrEnabled: false,
    autoInit: false,
    delegateToSupervisor: true,
    autoGreeting: false,
    metadata: {
      complexity: 'simple',
      expectedProviders: ['user_management'],
      fallbackAction: 'default_team_structure',
    },
  },

  TESTING_OPTIMIZATION: {
    agentId: 'quality-assurance-specialist',
    step: 'TESTING_OPTIMIZATION',
    agentType: 'specialized',
    displayName: 'Quality Assurance Specialist',
    capabilities: [
      'system_testing',
      'performance_optimization',
      'quality_assurance',
    ],
    sgrEnabled: false,
    autoInit: false,
    delegateToSupervisor: true,
    autoGreeting: false,
    metadata: {
      complexity: 'complex',
      expectedProviders: ['testing', 'monitoring'],
      fallbackAction: 'basic_testing',
    },
  },

  COMPLETED: {
    agentId: 'general-business-assistant',
    step: 'COMPLETED',
    agentType: 'general',
    displayName: 'General Business Assistant',
    capabilities: ['general_assistance', 'ongoing_support', 'maintenance_help'],
    sgrEnabled: false,
    autoInit: false,
    delegateToSupervisor: false, // No delegation needed for general assistance
    autoGreeting: false,
    metadata: {
      complexity: 'simple',
      expectedProviders: [],
      fallbackAction: 'general_ai_chat',
    },
  },
};

/**
 * Get agent configuration for current business setup status
 */
export const getAgentConfigForStatus = (
  status: BusinessSetupStatus | null | undefined,
): BusinessSetupAgentConfig | null => {
  if (!status) return null;
  return BUSINESS_SETUP_AGENTS[status] || null;
};

/**
 * Check if Supervisor should handle routing for given status
 */
export const shouldDelegateToSupervisor = (
  status: BusinessSetupStatus | null | undefined,
): boolean => {
  if (!status) return false;
  const config = getAgentConfigForStatus(status);
  return config?.delegateToSupervisor === true;
};

/**
 * Check if auto-greeting should be sent for given status
 */
export const shouldAutoGreet = (
  status: BusinessSetupStatus | null | undefined,
): boolean => {
  if (!status) return false;
  const config = getAgentConfigForStatus(status);
  return config?.autoGreeting === true;
};

/**
 * Get greeting message for status
 */
export const getGreetingMessage = (
  status: BusinessSetupStatus | null | undefined,
): string | null => {
  if (!status) return null;
  const config = getAgentConfigForStatus(status);
  return config?.greetingMessage || null;
};

/**
 * Get expected providers for a given status (for Supervisor routing hints)
 */
export const getExpectedProviders = (
  status: BusinessSetupStatus | null | undefined,
): string[] => {
  if (!status) return [];
  const config = getAgentConfigForStatus(status);
  return config?.metadata?.expectedProviders || [];
};

/**
 * Get fallback action for a given status
 */
export const getFallbackAction = (
  status: BusinessSetupStatus | null | undefined,
): string | null => {
  if (!status) return null;
  const config = getAgentConfigForStatus(status);
  return config?.metadata?.fallbackAction || null;
};

/**
 * Get complexity level for a given status (helps Supervisor choose configuration)
 */
export const getComplexityLevel = (
  status: BusinessSetupStatus | null | undefined,
): 'simple' | 'complex' | null => {
  if (!status) return null;
  const config = getAgentConfigForStatus(status);
  return config?.metadata?.complexity || null;
};
