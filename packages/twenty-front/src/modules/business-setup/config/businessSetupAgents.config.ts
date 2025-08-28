/**
 * Business Setup Agent Configuration
 * 
 * Defines specialized agents for different business setup stages
 * with their capabilities, SGR settings, and behavior overrides.
 */

import { BusinessSetupStatus } from '../hooks/useSetNextBusinessSetupStatus';

export interface BusinessSetupAgentConfig {
  step: BusinessSetupStatus;
  agentId: string;
  displayName: string;
  capabilities: string[];
  sgrEnabled: boolean;
  autoInit: boolean;
  forceAgent?: boolean; // Always use this agent during this stage
  autoGreeting?: boolean; // Automatically send greeting message
  greetingMessage?: string; // Custom greeting message
}

/**
 * SGR Avito Agent - Specialized for WELCOME stage
 * This agent MUST always be used during WELCOME stage regardless of other preferences
 */
export const SGR_AVITO_AGENT_ID = '2f851163-c7ea-4eae-b960-13f019b256e3';

/**
 * Agent configurations for each business setup stage
 */
export const BUSINESS_SETUP_AGENTS: Record<BusinessSetupStatus, BusinessSetupAgentConfig> = {
  WELCOME: {
    step: 'WELCOME',
    agentId: SGR_AVITO_AGENT_ID,
    displayName: 'SGR Avito Integration Assistant',
    capabilities: [
      'credential_extraction',
      'api_validation', 
      'setup_guidance',
      'auto_greeting',
      'sgr_processing'
    ],
    sgrEnabled: true,
    autoInit: true,
    forceAgent: true, // ALWAYS use this agent during WELCOME
    autoGreeting: true, // ALWAYS send greeting message
    greetingMessage: `🤖 **Привет! Я SGR Avito Integration Assistant**

**Моя задача:** Помочь вам настроить интеграцию с Avito для автоматизации вашего бизнеса.

**Мои инструменты и возможности:**
🔧 **Извлечение учетных данных** - безопасно извлекаю CLIENT_ID и CLIENT_SECRET из ваших сообщений
🔐 **Валидация API** - проверяю подлинность ваших Avito API ключей
📋 **Пошаговая настройка** - веду вас через весь процесс интеграции
🔄 **SGR Processing** - использую Schema-Guided Reasoning для точной обработки
📊 **Анализ данных** - помогаю понять структуру ваших Avito данных

**Что мне нужно от вас:**
Предоставьте ваши Avito API учетные данные:
- CLIENT_ID (идентификатор клиента)
- CLIENT_SECRET (секретный ключ)

Я обработаю их безопасно и настрою интеграцию для вашего CRM.

**Готовы начать? Отправьте мне ваши учетные данные Avito API!** 🚀`
  },
  
  BUSINESS_ANALYSIS: {
    step: 'BUSINESS_ANALYSIS',
    agentId: 'business-analysis-agent',
    displayName: 'Business Analysis Agent',
    capabilities: [
      'business_analysis',
      'process_mapping',
      'opportunity_identification'
    ],
    sgrEnabled: false,
    autoInit: false,
    autoGreeting: false
  },
  
  SALES_FUNNEL_DESIGN: {
    step: 'SALES_FUNNEL_DESIGN', 
    agentId: 'sales-funnel-agent',
    displayName: 'Sales Funnel Design Agent',
    capabilities: [
      'funnel_design',
      'conversion_optimization',
      'customer_journey_mapping'
    ],
    sgrEnabled: false,
    autoInit: false,
    autoGreeting: false
  },
  
  AGENT_SETUP: {
    step: 'AGENT_SETUP',
    agentId: 'agent-setup-assistant',
    displayName: 'Agent Setup Assistant', 
    capabilities: [
      'agent_configuration',
      'automation_setup',
      'workflow_design'
    ],
    sgrEnabled: false,
    autoInit: false,
    autoGreeting: false
  },
  
  WORKFLOW_CREATION: {
    step: 'WORKFLOW_CREATION',
    agentId: 'workflow-design-agent',
    displayName: 'Workflow Design Agent',
    capabilities: [
      'workflow_automation',
      'process_optimization',
      'integration_setup'
    ],
    sgrEnabled: false,
    autoInit: false,
    autoGreeting: false
  },
  
  TEAM_ASSIGNMENT: {
    step: 'TEAM_ASSIGNMENT',
    agentId: 'team-management-agent',
    displayName: 'Team Management Agent',
    capabilities: [
      'team_organization',
      'role_assignment',
      'collaboration_setup'
    ],
    sgrEnabled: false,
    autoInit: false,
    autoGreeting: false
  },
  
  TESTING_OPTIMIZATION: {
    step: 'TESTING_OPTIMIZATION',
    agentId: 'testing-optimization-agent',
    displayName: 'Testing & Optimization Agent',
    capabilities: [
      'system_testing',
      'performance_optimization',
      'quality_assurance'
    ],
    sgrEnabled: false,
    autoInit: false,
    autoGreeting: false
  },
  
  COMPLETED: {
    step: 'COMPLETED',
    agentId: 'general-ai-agent',
    displayName: 'General AI Assistant',
    capabilities: [
      'general_assistance',
      'ongoing_support',
      'maintenance_help'
    ],
    sgrEnabled: false,
    autoInit: false,
    autoGreeting: false
  }
};

/**
 * Get agent configuration for current business setup status
 */
export const getAgentConfigForStatus = (status: BusinessSetupStatus | null | undefined): BusinessSetupAgentConfig | null => {
  if (!status) return null;
  return BUSINESS_SETUP_AGENTS[status] || null;
};

/**
 * Check if agent should be forced for given status
 */
export const shouldForceAgent = (status: BusinessSetupStatus | null | undefined): boolean => {
  if (!status) return false;
  const config = getAgentConfigForStatus(status);
  return config?.forceAgent === true;
};

/**
 * Check if auto-greeting should be sent for given status
 */
export const shouldAutoGreet = (status: BusinessSetupStatus | null | undefined): boolean => {
  if (!status) return false;
  const config = getAgentConfigForStatus(status);
  return config?.autoGreeting === true;
};

/**
 * Get greeting message for status
 */
export const getGreetingMessage = (status: BusinessSetupStatus | null | undefined): string | null => {
  if (!status) return null;
  const config = getAgentConfigForStatus(status);
  return config?.greetingMessage || null;
};