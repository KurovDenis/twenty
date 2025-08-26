import { z } from 'zod';

/**
 * Core SGR (Schema-Guided Reasoning) schemas for Avito Welcome Agent
 * 
 * This module defines the structured reasoning patterns that guide the AI agent
 * through the credential collection and validation process for Avito API integration.
 */

// ================================
// CORE SGR CONTROL SCHEMA
// ================================

/**
 * Main reasoning control schema that guides the agent's step-by-step thinking
 */
export const AvitoWelcomeStepSchema = z.object({
  current_state: z.string()
    .describe('Current understanding of the credential collection and validation task'),
  
  plan_remaining_steps: z.array(z.string())
    .min(1).max(3)
    .describe('Next 1-3 planned steps to complete the credential collection task'),
  
  task_completed: z.boolean()
    .describe('Whether the credential collection and validation process is complete'),
  
  function: z.discriminatedUnion('tool', [
    z.object({
      tool: z.literal('extract_credentials'),
      message: z.string().describe('User message to analyze for credentials'),
      extraction_method: z.enum(['regex', 'nlp', 'guided']).optional()
        .describe('Method to use for credential extraction')
    }),
    
    z.object({
      tool: z.literal('request_credentials'),
      reason: z.enum([
        'no_credentials_found',
        'invalid_format',
        'missing_client_id',
        'missing_client_secret'
      ]).describe('Reason for requesting credentials from user'),
      user_friendly_message: z.string()
        .describe('Russian language instructions for user on how to provide credentials')
    }),
    
    z.object({
      tool: z.literal('validate_avito_token'),
      client_id: z.string().min(1, 'CLIENT_ID is required for validation'),
      client_secret: z.string().min(1, 'CLIENT_SECRET is required for validation'),
      api_url: z.string().url().default('https://api.avito.ru/token')
        .describe('Avito API endpoint for token validation')
    }),
    
    z.object({
      tool: z.literal('store_credentials'),
      client_id: z.string(),
      client_secret: z.string(),
      access_token: z.string().optional(),
      expires_in: z.number().optional(),
      token_type: z.string().optional()
    }),
    
    z.object({
      tool: z.literal('report_welcome_completion'),
      success: z.boolean(),
      credentials_stored: z.boolean(),
      next_stage: z.enum(['business_analysis', 'error_retry']),
      summary_message: z.string()
        .describe('Final Russian message to user summarizing the outcome')
    })
  ]).describe('Tool to execute for the next step in the reasoning process')
});

// ================================
// TOOL-SPECIFIC SCHEMAS
// ================================

export const ExtractCredentialsSchema = z.object({
  tool: z.literal('extract_credentials'),
  message: z.string().describe('User message to analyze'),
  extraction_method: z.enum(['regex', 'nlp', 'guided']).optional()
});

export const RequestCredentialsSchema = z.object({
  tool: z.literal('request_credentials'),
  reason: z.enum([
    'no_credentials_found',
    'invalid_format',
    'missing_client_id',
    'missing_client_secret'
  ]),
  user_friendly_message: z.string()
    .describe('Russian language instructions for user')
});

export const ValidateAvitoTokenSchema = z.object({
  tool: z.literal('validate_avito_token'),
  client_id: z.string().min(1, 'CLIENT_ID required'),
  client_secret: z.string().min(1, 'CLIENT_SECRET required'),
  api_url: z.string().url().default('https://api.avito.ru/token')
});

export const StoreCredentialsSchema = z.object({
  tool: z.literal('store_credentials'),
  client_id: z.string(),
  client_secret: z.string(),
  access_token: z.string().optional(),
  expires_in: z.number().optional(),
  token_type: z.string().optional()
});

export const ReportWelcomeCompletionSchema = z.object({
  tool: z.literal('report_welcome_completion'),
  success: z.boolean(),
  credentials_stored: z.boolean(),
  next_stage: z.enum(['business_analysis', 'error_retry']),
  summary_message: z.string()
    .describe('Final Russian message to user')
});

// ================================
// TYPE DEFINITIONS
// ================================

export type AvitoWelcomeStepType = z.infer<typeof AvitoWelcomeStepSchema>;

export type ExtractCredentialsType = z.infer<typeof ExtractCredentialsSchema>;
export type RequestCredentialsType = z.infer<typeof RequestCredentialsSchema>;
export type ValidateAvitoTokenType = z.infer<typeof ValidateAvitoTokenSchema>;
export type StoreCredentialsType = z.infer<typeof StoreCredentialsSchema>;
export type ReportWelcomeCompletionType = z.infer<typeof ReportWelcomeCompletionSchema>;

export type WelcomeToolUnion = 
  | ExtractCredentialsType
  | RequestCredentialsType
  | ValidateAvitoTokenType
  | StoreCredentialsType
  | ReportWelcomeCompletionType;

// ================================
// SGR EXECUTION INTERFACES
// ================================

export interface SGRExecutionParams {
  task: string;
  userId: string;
  workspaceId: string;
  threadId: string;
  maxSteps?: number;
}

export interface SGRExecutionResult {
  success: boolean;
  credentials_stored: boolean;
  next_stage: 'business_analysis' | 'error_retry';
  summary: string;
  steps_executed?: string[];
  error?: string;
}

export interface SGRStepResult {
  current_state: string;
  plan_remaining_steps: string[];
  task_completed: boolean;
  function: WelcomeToolUnion;
}

export interface ToolExecutionResult {
  success: boolean;
  message?: string;
  error?: string;
  data?: any;
}

// ================================
// EXECUTION CONTEXT
// ================================

export interface WelcomeExecutionContext {
  userId: string;
  workspaceId: string;
  threadId: string;
  stepNumber: number;
}

// ================================
// VALIDATION HELPERS
// ================================

/**
 * Validates if a tool response indicates successful completion
 */
export const isCompletionTool = (tool: WelcomeToolUnion): tool is ReportWelcomeCompletionType => {
  return tool.tool === 'report_welcome_completion';
};

/**
 * Validates if credentials are properly formatted
 */
export const validateCredentialFormat = (clientId: string, clientSecret: string): boolean => {
  const idPattern = /^[A-Za-z0-9_-]+$/;
  const secretPattern = /^[A-Za-z0-9_-]+$/;
  
  return idPattern.test(clientId) && secretPattern.test(clientSecret) &&
         clientId.length >= 10 && clientSecret.length >= 20;
};

/**
 * System prompt constants for SGR reasoning
 */
export const SGR_SYSTEM_PROMPTS = {
  WELCOME_AGENT: `
Ты - специализированный ассистент для настройки интеграции с Avito API на этапе Welcome.

ТВОЯ ЕДИНСТВЕННАЯ ЗАДАЧА:
1. Получить от пользователя CLIENT_ID и CLIENT_SECRET для Avito API
2. Проверить их валидность через https://api.avito.ru/token  
3. Сохранить учетные данные для дальнейшего использования

ДОСТУПНЫЕ ИНСТРУМЕНТЫ:
- extract_credentials: Извлечь CLIENT_ID и CLIENT_SECRET из сообщения
- request_credentials: Запросить учетные данные у пользователя
- validate_avito_token: Проверить credentials через Avito API
- store_credentials: Сохранить проверенные учетные данные
- report_welcome_completion: Завершить welcome stage

ПРАВИЛА SGR:
- Анализируй текущее состояние задачи
- Планируй максимум 3 шага вперед
- Выполняй только один инструмент за раз
- Используй дружелюбный тон на русском языке
- Переходи к business_analysis только после успешного сохранения

ФОРМАТЫ ВХОДНЫХ ДАННЫХ:
CLIENT_ID = 'R3cTDMk9rEJ2lh5A9_QF'
CLIENT_SECRET = 'ehAWb-RBQrLmgoJWfgtst737eQV6KIBHzmV1NmIc'

Или JSON:
{
  "client_id": "R3cTDMk9rEJ2lh5A9_QF",
  "client_secret": "ehAWb-RBQrLmgoJWfgtst737eQV6KIBHzmV1NmIc"
}

AVITO API:
URL: https://api.avito.ru/token
Method: POST
Body: grant_type=client_credentials&client_id=XXX&client_secret=XXX

Успешный ответ:
{
  "access_token": "токен",
  "expires_in": 86400,
  "token_type": "Bearer"
}

Мыслите пошагово и используйте схему рассуждений для структурированного решения задач.
`,

  TASK_INSTRUCTIONS: `
Используй Schema-Guided Reasoning для обработки запроса пользователя:

1. АНАЛИЗИРУЙ текущее состояние и понимание задачи
2. ПЛАНИРУЙ следующие 1-3 шага для достижения цели
3. ВЫБИРАЙ подходящий инструмент для выполнения
4. ОПРЕДЕЛЯЙ завершена ли задача

Обязательно отвечай в формате JSON со всеми требуемыми полями.
`
};