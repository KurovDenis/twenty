/**
 * Hook for handling SGR (Schema-Guided Reasoning) streaming messages
 * 
 * This hook manages real-time updates for SGR thinking steps and tool execution
 * during business setup credential processing.
 */

import { useCallback, useState } from 'react';
import { v4 } from 'uuid';

import { AgentChatMessageRole } from '@/ai/constants/agent-chat-message-role';
import { agentChatMessagesComponentState } from '@/ai/states/agentChatMessagesComponentState';
import { currentAIChatThreadComponentState } from '@/ai/states/currentAIChatThreadComponentState';
import {
  SGRMessageType,
  SGRThinkingStep,
  SGRToolExecutionStatus
} from '@/ai/types/sgr-message.types';
import { useRecoilComponentState } from '@/ui/utilities/state/component-state/hooks/useRecoilComponentState';
import { AgentChatMessage } from '~/generated/graphql';

/**
 * SGR streaming message structure
 */
interface SGRStreamingMessage {
  type: SGRMessageType;
  step?: SGRThinkingStep;
  content?: string;
  completed: boolean;
  timestamp: Date;
}

/**
 * Hook for managing SGR streaming messages
 */
export const useSGRStreaming = (agentId: string) => {
  const [currentThreadId] = useRecoilComponentState(currentAIChatThreadComponentState, agentId);
  const [agentChatMessages, setAgentChatMessages] = useRecoilComponentState(
    agentChatMessagesComponentState,
    agentId
  );
  
  const [isStreamingSGR, setIsStreamingSGR] = useState(false);
  const [currentSGRStep, setCurrentSGRStep] = useState<SGRThinkingStep | null>(null);
  const [sgrMessages, setSGRMessages] = useState<AgentChatMessage[]>([]);

  /**
   * Create an SGR thinking message
   */
  const createSGRThinkingMessage = useCallback((step: SGRThinkingStep): AgentChatMessage => {
    const content = `🤔 **Шаг ${step.stepNumber}: Анализ**
    
${step.currentState}

**План действий:**
${step.plannedSteps.map((s, i) => `${i + 1}. ${s}`).join('\n')}

**Выбранный инструмент:** ${step.selectedTool}`;
    
    return {
      __typename: 'AgentChatMessage',
      id: v4(),
      threadId: currentThreadId || '',
      role: AgentChatMessageRole.ASSISTANT,
      content,
      createdAt: step.timestamp.toISOString(),
      files: []
    };
  }, [currentThreadId]);

  /**
   * Create an SGR tool execution message
   */
  const createSGRToolExecutionMessage = useCallback((
    toolName: string, 
    status: SGRToolExecutionStatus, 
    error?: string
  ): AgentChatMessage => {
    let content = '';
    
    switch (status) {
      case SGRToolExecutionStatus.IN_PROGRESS:
        content = `🔧 **Выполняю: ${toolName}**\n\nОбрабатываю ваш запрос...`;
        break;
      case SGRToolExecutionStatus.COMPLETED:
        content = `✅ **Инструмент ${toolName} выполнен успешно**\n\nРезультат получен, перехожу к следующему шагу.`;
        break;
      case SGRToolExecutionStatus.FAILED:
        content = `❌ **Ошибка при выполнении ${toolName}**\n\n${error || 'Неизвестная ошибка'}\n\nПробую альтернативный подход...`;
        break;
      default:
        content = `🔧 **${toolName}**`;
    }
    
    return {
      __typename: 'AgentChatMessage',
      id: v4(),
      threadId: currentThreadId || '',
      role: AgentChatMessageRole.ASSISTANT,
      content,
      createdAt: new Date().toISOString(),
      files: []
    };
  }, [currentThreadId]);

  /**
   * Handle incoming SGR streaming message
   */
  const handleSGRStreamingMessage = useCallback((message: SGRStreamingMessage) => {
    setIsStreamingSGR(true);
    
    switch (message.type) {
      case SGRMessageType.THINKING:
        if (message.step) {
          setCurrentSGRStep(message.step);
          const thinkingMessage = createSGRThinkingMessage(message.step);
          setSGRMessages(prev => [...prev, thinkingMessage]);
          setAgentChatMessages((prev: AgentChatMessage[]) => [...prev, thinkingMessage]);
        }
        break;
        
      case SGRMessageType.TOOL_EXECUTION:
        if (message.step?.toolExecution) {
          const toolMessage = createSGRToolExecutionMessage(
            message.step.selectedTool,
            message.step.toolExecution.status,
            message.step.toolExecution.error
          );
          setSGRMessages(prev => [...prev, toolMessage]);
          setAgentChatMessages((prev: AgentChatMessage[]) => [...prev, toolMessage]);
        }
        break;
        
      case SGRMessageType.FINAL_RESPONSE:
        if (message.content) {
          const finalMessage: AgentChatMessage = {
            __typename: 'AgentChatMessage',
            id: v4(),
            threadId: currentThreadId || '',
            role: AgentChatMessageRole.ASSISTANT,
            content: message.content,
            createdAt: message.timestamp.toISOString(),
            files: []
          };
          setSGRMessages(prev => [...prev, finalMessage]);
          setAgentChatMessages((prev: AgentChatMessage[]) => [...prev, finalMessage]);
          setIsStreamingSGR(false);
          setCurrentSGRStep(null);
        }
        break;
    }
  }, [createSGRThinkingMessage, createSGRToolExecutionMessage, setAgentChatMessages, currentThreadId]);

  /**
   * Clear SGR messages (useful when starting new conversation)
   */
  const clearSGRMessages = useCallback(() => {
    setSGRMessages([]);
    setCurrentSGRStep(null);
    setIsStreamingSGR(false);
  }, []);

  /**
   * Get current SGR processing status
   */
  const getSgrStatus = useCallback(() => {
    return {
      isStreaming: isStreamingSGR,
      currentStep: currentSGRStep,
      messageCount: sgrMessages.length
    };
  }, [isStreamingSGR, currentSGRStep, sgrMessages.length]);

  return {
    // State
    isStreamingSGR,
    currentSGRStep,
    sgrMessages,
    sgrEvents: sgrMessages,
    
    // Actions
    handleSGRStreamingMessage,
    clearSGRMessages,
    getSgrStatus,
    
    // Helpers
    createSGRThinkingMessage,
    createSGRToolExecutionMessage
  };
};

/**
 * Hook for subscribing to SGR events from backend
 * This would connect to WebSocket or polling mechanism
 */
export const useSGREvents = (agentId: string) => {
  const { handleSGRStreamingMessage, clearSGRMessages } = useSGRStreaming(agentId);
  
  // In a real implementation, this would connect to WebSocket or use polling
  // For now, we'll provide a mock implementation
  
  /**
   * Simulate receiving SGR streaming messages
   * This would be replaced with actual WebSocket/polling logic
   */
  const simulateSGRStreaming = useCallback(async (userMessage: string) => {
    // Clear previous SGR messages
    clearSGRMessages();
    
    // Simulate SGR thinking steps
    const steps: SGRThinkingStep[] = [
      {
        stepNumber: 1,
        currentState: 'Анализирую ваше сообщение на наличие учетных данных Avito',
        plannedSteps: [
          'Проверить формат сообщения',
          'Извлечь CLIENT_ID и CLIENT_SECRET',
          'Подтвердить валидность учетных данных'
        ],
        selectedTool: 'credential_extraction',
        timestamp: new Date()
      },
      {
        stepNumber: 2,
        currentState: 'Извлекаю учетные данные из вашего сообщения',
        plannedSteps: [
          'Отправить запрос на валидацию в API Avito',
          'Проверить ответ сервера',
          'Сохранить учетные данные при успехе'
        ],
        selectedTool: 'http_request',
        toolExecution: {
          status: SGRToolExecutionStatus.IN_PROGRESS
        },
        timestamp: new Date(Date.now() + 1000)
      }
    ];
    
    // Send thinking steps
    for (const step of steps) {
      handleSGRStreamingMessage({
        type: SGRMessageType.THINKING,
        step,
        completed: false,
        timestamp: step.timestamp
      });
      
      // Simulate delay
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Simulate tool execution
    handleSGRStreamingMessage({
      type: SGRMessageType.TOOL_EXECUTION,
      step: {
        ...steps[1],
        toolExecution: {
          status: SGRToolExecutionStatus.COMPLETED
        }
      },
      completed: false,
      timestamp: new Date(Date.now() + 2000)
    });
    
    // Simulate delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Send final response
    handleSGRStreamingMessage({
      type: SGRMessageType.FINAL_RESPONSE,
      content: '✅ Учетные данные успешно проверены и сохранены! Теперь вы можете перейти к следующему этапу настройки бизнеса.',
      completed: true,
      timestamp: new Date(Date.now() + 3000)
    });
  }, [handleSGRStreamingMessage, clearSGRMessages]);
  
  return {
    simulateSGRStreaming
  };
};