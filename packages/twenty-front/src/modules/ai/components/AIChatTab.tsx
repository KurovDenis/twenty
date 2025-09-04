import { TextArea } from '@/ui/input/components/TextArea';
import styled from '@emotion/styled';
import { IconHistory, IconMessageCirclePlus } from 'twenty-ui/display';

import { DropZone } from '@/activities/files/components/DropZone';
import { AgentChatFileUploadButton } from '@/ai/components/internal/AgentChatFileUploadButton';
import { useCreateNewAIChatThread } from '@/ai/hooks/useCreateNewAIChatThread';
import { AgentChatMessagesComponentInstanceContext } from '@/ai/states/agentChatMessagesComponentState';
import { IsAgentChatCurrentContextActiveInstanceContext } from '@/ai/states/isAgentChatCurrentContextActiveState';
import { useCommandMenu } from '@/command-menu/hooks/useCommandMenu';
import { CommandMenuPages } from '@/command-menu/types/CommandMenuPages';
import { ScrollWrapper } from '@/ui/utilities/scroll/components/ScrollWrapper';

import { AIChatEmptyState } from '@/ai/components/AIChatEmptyState';
import { AIChatMessage } from '@/ai/components/AIChatMessage';
import { AIChatSkeletonLoader } from '@/ai/components/internal/AIChatSkeletonLoader';
import { AgentChatContextPreview } from '@/ai/components/internal/AgentChatContextPreview';
import { SendMessageButton } from '@/ai/components/internal/SendMessageButton';
import { SendMessageWithRecordsContextButton } from '@/ai/components/internal/SendMessageWithRecordsContextButton';
import { useAIChatFileUpload } from '@/ai/hooks/useAIChatFileUpload';
import {
  isFinalResponseEvent,
  isThinkingEvent,
  isToolExecutionEvent,
  useSGREvents,
} from '@/ai/services/sgr-event-bridge.service';
import { contextStoreCurrentObjectMetadataItemIdComponentState } from '@/context-store/states/contextStoreCurrentObjectMetadataItemIdComponentState';
import { useRecoilComponentValue } from '@/ui/utilities/state/component-state/hooks/useRecoilComponentValue';
import { t } from '@lingui/core/macro';
import { useEffect, useState } from 'react';
import { Button } from 'twenty-ui/input';
import { AgentChatMessage } from '~/generated-metadata/graphql';
import { useAgentChat } from '../hooks/useAgentChat';

const StyledContainer = styled.div<{ isDraggingFile: boolean }>`
  background: ${({ theme }) => theme.background.primary};
  height: ${({ isDraggingFile }) =>
    isDraggingFile ? `calc(100% - 24px)` : '100%'};
  padding: ${({ isDraggingFile, theme }) =>
    isDraggingFile ? theme.spacing(3) : '0'};
  display: flex;
  flex-direction: column;
`;

const StyledInputArea = styled.div`
  align-items: flex-end;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(3)};
  background: ${({ theme }) => theme.background.primary};
`;

const StyledScrollWrapper = styled(ScrollWrapper)`
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(5)};
  overflow-y: auto;
  padding: ${({ theme }) => theme.spacing(3)};
  width: calc(100% - 24px);
`;

const StyledButtonsContainer = styled.div`
  display: flex;
  flex-direction: row;
  gap: ${({ theme }) => theme.spacing(2)};
`;

// SGR Progress Indicator Component
const StyledSGRProgressIndicator = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(2)};
  background: ${({ theme }) => theme.background.transparent.light};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  margin-bottom: ${({ theme }) => theme.spacing(2)};
  font-size: ${({ theme }) => theme.font.size.sm};
`;

const StyledProgressSpinner = styled.div`
  width: 16px;
  height: 16px;
  border: 2px solid ${({ theme }) => theme.border.color.light};
  border-top: 2px solid ${({ theme }) => theme.color.blue};
  border-radius: 50%;
  animation: spin 1s linear infinite;

  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }
`;

export const AIChatTab = ({
  agentId,
  isWorkflowAgentNodeChat,
}: {
  agentId: string;
  isWorkflowAgentNodeChat?: boolean;
}) => {
  return (
    <AgentChatMessagesComponentInstanceContext.Provider
      value={{ instanceId: agentId }}
    >
      <IsAgentChatCurrentContextActiveInstanceContext.Provider
        value={{ instanceId: agentId }}
      >
        <AIChatTabInternal
          agentId={agentId}
          isWorkflowAgentNodeChat={isWorkflowAgentNodeChat}
        />
      </IsAgentChatCurrentContextActiveInstanceContext.Provider>
    </AgentChatMessagesComponentInstanceContext.Provider>
  );
};

const AIChatTabInternal = ({
  agentId,
  isWorkflowAgentNodeChat,
}: {
  agentId: string;
  isWorkflowAgentNodeChat?: boolean;
}) => {
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  const contextStoreCurrentObjectMetadataItemId = useRecoilComponentValue(
    contextStoreCurrentObjectMetadataItemIdComponentState,
  );

  const {
    messages,
    isLoading,
    input,
    handleInputChange,
    agentStreamingMessage,
    scrollWrapperId,
    currentThreadId,
  } = useAgentChat(agentId);
  const { uploadFiles } = useAIChatFileUpload({ agentId });

  const { createAgentChatThread } = useCreateNewAIChatThread({ agentId });
  const { navigateCommandMenu } = useCommandMenu();

  // SGR Event Handling
  const { events: sgrEvents, isConnected: isSGRConnected } = useSGREvents(
    agentId,
    currentThreadId,
  );
  const [isProcessingSGR, setIsProcessingSGR] = useState(false);
  const [currentSGRStep, setCurrentSGRStep] = useState<string | null>(null);

  // Handle SGR events
  useEffect(() => {
    try {
      if (sgrEvents.length > 0) {
        const latestEvent = sgrEvents[sgrEvents.length - 1];

        // Validate event structure
        if (!latestEvent || typeof latestEvent.type !== 'string') {
          console.warn('Invalid SGR event received:', latestEvent);
          return;
        }

        if (isThinkingEvent(latestEvent)) {
          // TypeScript now knows latestEvent.step exists
          if (
            latestEvent.step &&
            typeof latestEvent.step.stepNumber === 'number'
          ) {
            setIsProcessingSGR(true);
            setCurrentSGRStep(
              `🤔 Анализирую шаг ${latestEvent.step.stepNumber}: ${latestEvent.step.currentState}`,
            );
          } else {
            console.warn('Invalid thinking event step data:', latestEvent);
            setIsProcessingSGR(true);
            setCurrentSGRStep('🤔 Анализирую...');
          }
        } else if (isToolExecutionEvent(latestEvent)) {
          // TypeScript now knows latestEvent.toolName exists
          if (latestEvent.toolName && latestEvent.status) {
            setIsProcessingSGR(true);
            const statusEmoji =
              {
                starting: '🚀',
                in_progress: '⚙️',
                completed: '✅',
                failed: '❌',
              }[latestEvent.status] || '🔧';
            setCurrentSGRStep(
              `${statusEmoji} ${latestEvent.toolName}: ${latestEvent.status}`,
            );
          } else {
            console.warn('Invalid tool execution event data:', latestEvent);
            setIsProcessingSGR(true);
            setCurrentSGRStep('🔧 Выполняю инструмент...');
          }
        } else if (isFinalResponseEvent(latestEvent)) {
          setIsProcessingSGR(false);
          setCurrentSGRStep(null);
        } else {
          // Unknown event type - graceful degradation
          console.warn(
            'Unknown SGR event type:',
            (latestEvent as any)?.type || 'undefined',
          );
        }
      } else {
        // No events yet, make sure processing state is cleared
        setIsProcessingSGR(false);
        setCurrentSGRStep(null);
      }
    } catch (error) {
      console.error('Error processing SGR events:', error);
      // Graceful degradation - clear processing state on error
      setIsProcessingSGR(false);
      setCurrentSGRStep(null);
    }
  }, [sgrEvents]);

  return (
    <StyledContainer
      isDraggingFile={isDraggingFile}
      onDragEnter={() => setIsDraggingFile(true)}
    >
      {isDraggingFile && (
        <DropZone
          setIsDraggingFile={setIsDraggingFile}
          onUploadFiles={uploadFiles}
        />
      )}
      {!isDraggingFile && (
        <>
          {/* SGR Progress Indicator */}
          {isProcessingSGR && currentSGRStep && (
            <StyledSGRProgressIndicator>
              <StyledProgressSpinner />
              <span>{currentSGRStep}</span>
            </StyledSGRProgressIndicator>
          )}

          {(messages as AgentChatMessage[]).length !== 0 && (
            <StyledScrollWrapper componentInstanceId={scrollWrapperId}>
              {(messages as AgentChatMessage[]).map(
                (message: AgentChatMessage) => (
                  <AIChatMessage
                    agentStreamingMessage={agentStreamingMessage}
                    message={message}
                    key={message.id}
                  />
                ),
              )}
            </StyledScrollWrapper>
          )}
          {(messages as AgentChatMessage[]).length === 0 && !isLoading && (
            <AIChatEmptyState />
          )}
          {isLoading && (messages as AgentChatMessage[]).length === 0 && (
            <AIChatSkeletonLoader />
          )}

          <StyledInputArea>
            <AgentChatContextPreview agentId={agentId} />
            <TextArea
              textAreaId={`${agentId}-chat-input`}
              placeholder={t`Enter a question...`}
              value={input}
              onChange={handleInputChange}
            />
            <StyledButtonsContainer>
              {!isWorkflowAgentNodeChat && (
                <>
                  <Button
                    variant="secondary"
                    size="small"
                    Icon={IconHistory}
                    onClick={() =>
                      navigateCommandMenu({
                        page: CommandMenuPages.ViewPreviousAIChats,
                        pageTitle: t`View Previous AI Chats`,
                        pageIcon: IconHistory,
                      })
                    }
                  />
                  <Button
                    variant="secondary"
                    size="small"
                    Icon={IconMessageCirclePlus}
                    onClick={() => createAgentChatThread()}
                  />
                </>
              )}
              <AgentChatFileUploadButton agentId={agentId} />
              {contextStoreCurrentObjectMetadataItemId ? (
                <SendMessageWithRecordsContextButton agentId={agentId} />
              ) : (
                <SendMessageButton agentId={agentId} />
              )}
            </StyledButtonsContainer>
          </StyledInputArea>
        </>
      )}
    </StyledContainer>
  );
};
