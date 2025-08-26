/**
 * Enhanced AI Chat Message Component with SGR (Schema-Guided Reasoning) visualization
 * 
 * This component extends the standard AI chat message to support real-time
 * visualization of AI thinking processes during business setup credential processing.
 */

import { keyframes, useTheme } from '@emotion/react';
import styled from '@emotion/styled';
import {
  Avatar,
  IconBrain,
  IconCheck,
  IconDotsVertical,
  IconLoader,
  IconSparkles,
  IconTool,
  IconX
} from 'twenty-ui/display';

import { AgentChatFilePreview } from '@/ai/components/internal/AgentChatFilePreview';
import { LazyMarkdownRenderer } from '@/ai/components/LazyMarkdownRenderer';
import { AgentChatMessageRole } from '@/ai/constants/agent-chat-message-role';
import { LightCopyIconButton } from '@/object-record/record-field/components/LightCopyIconButton';

import {
  SGRThinkingStep,
  SGRToolExecutionStatus,
  extractSGRStepFromContent,
  extractToolExecutionFromContent
} from '@/ai/types/sgr-message.types';
import { AgentChatMessage } from '~/generated/graphql';
import { beautifyPastDateRelativeToNow } from '~/utils/date-utils';

// Styled components for SGR visualization
const StyledMessageBubble = styled.div<{ isUser?: boolean; isThinking?: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  position: relative;
  width: 100%;
  margin-bottom: ${({ theme }) => theme.spacing(2)};
  background: ${({ theme, isThinking }) => 
    isThinking ? theme.background.transparent.light : 'transparent'};
  border-radius: ${({ theme, isThinking }) => 
    isThinking ? theme.border.radius.sm : '0'};
  padding: ${({ theme, isThinking }) => 
    isThinking ? theme.spacing(2) : '0'};

  &:hover .message-footer {
    opacity: 1;
    pointer-events: auto;
  }
`;

const StyledMessageRow = styled.div<{ isShowingToolCall?: boolean }>`
  display: flex;
  flex-direction: row;
  align-items: ${({ isShowingToolCall }) =>
    isShowingToolCall ? 'center' : 'flex-start'};
  gap: ${({ theme }) => theme.spacing(3)};
  width: 100%;
`;

const StyledMessageText = styled.div<{ isUser?: boolean }>`
  background: ${({ theme, isUser }) =>
    isUser ? theme.background.secondary : theme.background.transparent};
  border-radius: ${({ theme }) => theme.border.radius.md};
  padding: ${({ theme, isUser }) => (isUser ? theme.spacing(1, 2) : 0)};
  border: ${({ isUser, theme }) =>
    !isUser ? 'none' : `1px solid ${theme.border.color.light}`};
  color: ${({ theme, isUser }) =>
    isUser ? theme.font.color.light : theme.font.color.primary};
  font-weight: ${({ isUser }) => (isUser ? 500 : 400)};
  width: fit-content;
  white-space: pre-line;
`;

const StyledMessageFooter = styled.div`
  align-items: center;
  color: ${({ theme }) => theme.font.color.secondary};
  display: flex;
  font-size: ${({ theme }) => theme.font.size.sm};
  justify-content: space-between;
  margin-top: ${({ theme }) => theme.spacing(1)};
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.3s ease-in-out;
  width: 100%;
`;

const StyledAvatarContainer = styled.div<{ isUser?: boolean }>`
  align-items: center;
  background: ${({ theme, isUser }) =>
    isUser
      ? theme.background.transparent.light
      : theme.background.transparent.blue};
  display: flex;
  justify-content: center;
  height: 24px;
  min-width: 24px;
  border-radius: ${({ theme }) => theme.border.radius.sm};
  padding: 1px;
`;

const StyledMessageContainer = styled.div`
  width: 100%;
`;

const StyledFilesContainer = styled.div`
  display: flex;
  flex-direction: row;
  gap: ${({ theme }) => theme.spacing(2)};
  flex-wrap: wrap;
  margin-top: ${({ theme }) => theme.spacing(2)};
`;

// SGR-specific styled components
const StyledSGRContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(2)};
  width: 100%;
`;

const StyledSGRHeader = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(2)};
  padding-bottom: ${({ theme }) => theme.spacing(1)};
  border-bottom: 1px solid ${({ theme }) => theme.border.color.medium};
`;

const StyledSGRTitle = styled.div`
  font-weight: 600;
  color: ${({ theme }) => theme.font.color.primary};
`;

const StyledSGRStepInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(1)};
`;

const StyledSGRCurrentState = styled.div`
  font-weight: 500;
  color: ${({ theme }) => theme.font.color.primary};
`;

const StyledSGRPlannedSteps = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(1)};
  margin-top: ${({ theme }) => theme.spacing(1)};
`;

const StyledSGRStepItem = styled.div<{ isCompleted?: boolean }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1)};
  color: ${({ theme, isCompleted }) => 
    isCompleted ? theme.font.color.success : theme.font.color.secondary};
  font-size: ${({ theme }) => theme.font.size.sm};
`;

const StyledSGRToolInfo = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1)};
  margin-top: ${({ theme }) => theme.spacing(1)};
  padding: ${({ theme }) => theme.spacing(1)};
  background: ${({ theme }) => theme.background.transparent.light};
  border-radius: ${({ theme }) => theme.border.radius.sm};
`;

const StyledSGRToolStatus = styled.div<{ status: SGRToolExecutionStatus }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1)};
  font-weight: 500;
  color: ${({ theme, status }) => {
    switch (status) {
      case SGRToolExecutionStatus.COMPLETED:
        return theme.font.color.success;
      case SGRToolExecutionStatus.FAILED:
        return theme.font.color.danger;
      case SGRToolExecutionStatus.IN_PROGRESS:
        return theme.font.color.warning;
      default:
        return theme.font.color.primary;
    }
  }};
`;

const dots = keyframes`
  0% { content: ''; }
  33% { content: '.'; }
  66% { content: '..'; }
  100% { content: '...'; }
`;

const StyledToolCallContainer = styled.div`
  &::after {
    display: inline-block;
    content: '';
    animation: ${dots} 750ms steps(3, end) infinite;
    width: 2ch;
    text-align: left;
  }
`;

const StyledDotsIconContainer = styled.div`
  align-items: center;
  border: ${({ theme }) => `1px solid ${theme.border.color.light}`};
  border-radius: ${({ theme }) => theme.border.radius.md};
  display: flex;
  justify-content: center;
  padding-inline: ${({ theme }) => theme.spacing(1)};
`;

const StyledDotsIcon = styled(IconDotsVertical)`
  color: ${({ theme }) => theme.font.color.light};
  transform: rotate(90deg);
`;

// SGR Thinking Visualization Component
const SGRThinkingVisualization = ({ step }: { step: SGRThinkingStep }) => {
  const theme = useTheme();
  
  return (
    <StyledSGRContainer>
      <StyledSGRHeader>
        <IconBrain size={theme.icon.size.md} color={theme.color.blue} />
        <StyledSGRTitle>Шаг {step.stepNumber}: Анализ</StyledSGRTitle>
      </StyledSGRHeader>
      
      <StyledSGRStepInfo>
        <StyledSGRCurrentState>
          {step.currentState}
        </StyledSGRCurrentState>
        
        <StyledSGRPlannedSteps>
          <div>План действий:</div>
          {step.plannedSteps.map((planStep, index) => (
            <StyledSGRStepItem key={index}>
              <IconCheck size={theme.icon.size.sm} color={theme.color.green} />
              <span>{planStep}</span>
            </StyledSGRStepItem>
          ))}
        </StyledSGRPlannedSteps>
        
        <StyledSGRToolInfo>
          <IconTool size={theme.icon.size.sm} />
          <span>Выбранный инструмент: {step.selectedTool}</span>
        </StyledSGRToolInfo>
      </StyledSGRStepInfo>
    </StyledSGRContainer>
  );
};

// SGR Tool Execution Visualization Component
const SGRToolExecutionVisualization = ({ 
  toolName,
  status,
  result,
  error
}: {
  toolName: string;
  status: SGRToolExecutionStatus;
  result?: any;
  error?: string;
}) => {
  const theme = useTheme();
  
  const getStatusIcon = () => {
    switch (status) {
      case SGRToolExecutionStatus.IN_PROGRESS:
        return <IconLoader size={theme.icon.size.sm} />;
      case SGRToolExecutionStatus.COMPLETED:
        return <IconCheck size={theme.icon.size.sm} color={theme.color.green} />;
      case SGRToolExecutionStatus.FAILED:
        return <IconX size={theme.icon.size.sm} color={theme.color.red} />;
      default:
        return <IconTool size={theme.icon.size.sm} />;
    }
  };
  
  const getStatusText = () => {
    switch (status) {
      case SGRToolExecutionStatus.STARTING:
        return 'Начинаю выполнение';
      case SGRToolExecutionStatus.IN_PROGRESS:
        return `Выполняю: ${toolName}`;
      case SGRToolExecutionStatus.COMPLETED:
        return `Инструмент ${toolName} выполнен успешно`;
      case SGRToolExecutionStatus.FAILED:
        return `Ошибка при выполнении ${toolName}`;
      default:
        return toolName;
    }
  };
  
  return (
    <StyledSGRContainer>
      <StyledSGRHeader>
        <IconTool size={theme.icon.size.md} color={theme.color.orange} />
        <StyledSGRTitle>Выполнение инструмента</StyledSGRTitle>
      </StyledSGRHeader>
      
      <StyledSGRToolStatus status={status}>
        {getStatusIcon()}
        <span>{getStatusText()}</span>
      </StyledSGRToolStatus>
      
      {error && (
        <div style={{ 
          color: theme.font.color.danger, 
          marginTop: theme.spacing(1),
          padding: theme.spacing(1),
          background: theme.background.transparent.danger,
          borderRadius: theme.border.radius.sm
        }}>
          {error}
        </div>
      )}
      
      {result && status === SGRToolExecutionStatus.COMPLETED && (
        <div style={{ 
          marginTop: theme.spacing(1),
          padding: theme.spacing(1),
          background: theme.background.transparent.success,
          borderRadius: theme.border.radius.sm
        }}>
          Результат получен, перехожу к следующему шагу.
        </div>
      )}
    </StyledSGRContainer>
  );
};

// Enhanced AI Chat Message Component
export const EnhancedAIChatMessage = ({
  message,
  agentStreamingMessage,
}: {
  message: AgentChatMessage;
  agentStreamingMessage: { streamingText: string; toolCall: string };
}) => {
  const theme = useTheme();

  const markdownRender = (text: string) => {
    return <LazyMarkdownRenderer text={text} />;
  };

  // Check if this is an SGR thinking message
  const sgrStep = extractSGRStepFromContent(message.content);
  const toolExecution = extractToolExecutionFromContent(message.content);
  
  const isSGRThinkingMessage = sgrStep !== null;
  const isSGRToolExecutionMessage = toolExecution !== null;

  const getAssistantMessageContent = (message: AgentChatMessage) => {
    // Handle SGR thinking messages
    if (isSGRThinkingMessage && sgrStep) {
      return <SGRThinkingVisualization step={sgrStep} />;
    }
    
    // Handle SGR tool execution messages
    if (isSGRToolExecutionMessage && toolExecution) {
      // Extract tool name from content
      const toolNameMatch = message.content.match(/\*\*(?:Выполняю|Инструмент .+? выполнен|Ошибка при выполнении) (.+?)\*\*/);
      const toolName = toolNameMatch ? toolNameMatch[1] : 'Неизвестный инструмент';
      
      return (
        <SGRToolExecutionVisualization 
          toolName={toolName}
          status={toolExecution.status}
          result={toolExecution.result}
          error={toolExecution.error}
        />
      );
    }

    // Handle standard messages
    if (message.content !== '') {
      return markdownRender(message.content);
    }

    if (agentStreamingMessage.streamingText !== '') {
      return markdownRender(agentStreamingMessage.streamingText);
    }

    if (agentStreamingMessage.toolCall !== '') {
      return (
        <StyledToolCallContainer>
          {agentStreamingMessage.toolCall}
        </StyledToolCallContainer>
      );
    }

    return (
      <StyledDotsIconContainer>
        <StyledDotsIcon size={theme.icon.size.xl} />
      </StyledDotsIconContainer>
    );
  };

  return (
    <StyledMessageBubble
      key={message.id}
      isUser={message.role === AgentChatMessageRole.USER}
      isThinking={isSGRThinkingMessage || isSGRToolExecutionMessage}
    >
      <StyledMessageRow
        isShowingToolCall={
          message.role === AgentChatMessageRole.ASSISTANT &&
          message.content === '' &&
          agentStreamingMessage.streamingText === '' &&
          agentStreamingMessage.toolCall !== ''
        }
      >
        {message.role === AgentChatMessageRole.ASSISTANT && (
          <StyledAvatarContainer>
            <Avatar
              size="sm"
              placeholder="AI"
              Icon={isSGRThinkingMessage || isSGRToolExecutionMessage ? IconBrain : IconSparkles}
              iconColor={isSGRThinkingMessage || isSGRToolExecutionMessage ? theme.color.orange : theme.color.blue}
            />
          </StyledAvatarContainer>
        )}
        {message.role === AgentChatMessageRole.USER && (
          <StyledAvatarContainer isUser>
            <Avatar size="sm" placeholder="U" type="rounded" />
          </StyledAvatarContainer>
        )}
        <StyledMessageContainer>
          <StyledMessageText
            isUser={message.role === AgentChatMessageRole.USER}
          >
            {message.role === AgentChatMessageRole.ASSISTANT
              ? getAssistantMessageContent(message)
              : message.content}
          </StyledMessageText>
          {message.files && message.files.length > 0 && (
            <StyledFilesContainer>
              {message.files.map((file) => (
                <AgentChatFilePreview key={file.id} file={file} />
              ))}
            </StyledFilesContainer>
          )}
          {message.content && (
            <StyledMessageFooter className="message-footer">
              <span>{beautifyPastDateRelativeToNow(message.createdAt)}</span>
              <LightCopyIconButton copyText={message.content} />
            </StyledMessageFooter>
          )}
        </StyledMessageContainer>
      </StyledMessageRow>
    </StyledMessageBubble>
  );
};