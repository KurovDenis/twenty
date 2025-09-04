/**
 * Enhanced AI Chat Message Component with SGR (Schema-Guided Reasoning) visualization
 *
 * This component extends the standard AI chat message to support real-time
 * visualization of AI thinking processes during business setup credential processing.
 */

import { AnimatePresence } from 'framer-motion';
import { useMemo } from 'react';
import styled from 'styled-components';

import { AgentChatMessageRole } from '@/ai/constants/agent-chat-message-role';
import { LightCopyIconButton } from '@/object-record/record-field/components/LightCopyIconButton';
import { Avatar, IconBrain, IconSparkles } from 'twenty-ui/display';
import { AgentChatMessage } from '~/generated/graphql';
import { beautifyPastDateRelativeToNow } from '~/utils/date-utils';

import { useSGRStreamingBasic } from '../hooks/useSGRStreamingParser';
import {
  extractSGRStepFromContent,
  isSGRMessage,
} from '../types/sgr-message.types';
import { AgentChatFilePreview } from './internal/AgentChatFilePreview';
import { LazyMarkdownRenderer } from './LazyMarkdownRenderer';
import { SgrVisualizationDashboard } from './SgrVisualizationDashboard/SgrVisualizationDashboard';

// Styled components for SGR visualization
const StyledMessageBubble = styled.div<{
  isUser?: boolean;
  isThinking?: boolean;
}>`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(2)};
  margin-bottom: ${({ theme }) => theme.spacing(2)};
  background: ${({ theme, isThinking }) =>
    isThinking ? theme.background.transparent.light : 'transparent'};
  border-radius: ${({ theme, isThinking }) =>
    isThinking ? theme.border.radius.sm : '0'};
  padding: ${({ theme, isThinking }) => (isThinking ? theme.spacing(2) : '0')};

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

const StyledMarkdownContainer = styled.div`
  width: 100%;
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

// Enhanced AI Chat Message Component
export const EnhancedAIChatMessage = ({
  message,
  agentStreamingMessage,
}: {
  message: AgentChatMessage;
  agentStreamingMessage: { streamingText: string; toolCall: string };
}) => {
  const markdownRender = (text: string) => {
    return <LazyMarkdownRenderer text={text} />;
  };

  // Check if this is an SGR thinking message
  const sgrStep = useMemo(() => {
    if (isSGRMessage(message)) {
      return message.thinkingStep || extractSGRStepFromContent(message.content);
    }
    return null;
  }, [message]);

  // SGR стриминг для активных сообщений
  const { isStreaming, status } = useSGRStreamingBasic(message.threadId || '');

  // Показывать визуализацию только для SGR сообщений в процессе
  const shouldShowVisualization =
    sgrStep && (isStreaming || (status !== 'idle' && status !== 'completed'));

  const getAssistantMessageContent = (message: AgentChatMessage) => {
    // For non-SGR messages, just render the markdown content
    return (
      <StyledMarkdownContainer>
        <LazyMarkdownRenderer text={message.content} />
      </StyledMarkdownContainer>
    );
  };

  return (
    <StyledMessageBubble
      key={message.id}
      isUser={message.role === AgentChatMessageRole.USER}
      isThinking={shouldShowVisualization || false}
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
              Icon={shouldShowVisualization ? IconBrain : IconSparkles}
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
              {message.files.map(
                (file: {
                  id: string;
                  name: string;
                  fullPath: string;
                  size: number;
                  type: string;
                  createdAt: string;
                }) => (
                  <AgentChatFilePreview key={file.id} file={file} />
                ),
              )}
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

      {/* Визуализация SGR стриминга */}
      <AnimatePresence>
        {shouldShowVisualization && (
          <SgrVisualizationDashboard
            threadId={message.threadId || ''}
            showMetrics={true}
            autoHideOnComplete={true}
            autoHideDelayMs={2000}
          />
        )}
      </AnimatePresence>
    </StyledMessageBubble>
  );
};
