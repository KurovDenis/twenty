import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { useRecoilComponentState } from '@/ui/utilities/state/component-state/hooks/useRecoilComponentState';
import { useState } from 'react';
import { useRecoilState } from 'recoil';
import { Key } from 'ts-key-enum';

import { AgentChatMessageRole } from '@/ai/constants/agent-chat-message-role';
import { STREAM_CHAT_QUERY } from '@/ai/rest-api/agent-chat-apollo.api';
import {
    AIChatObjectMetadataAndRecordContext,
    agentChatObjectMetadataAndRecordContextState,
} from '@/ai/states/agentChatObjectMetadataAndRecordContextState';
import { agentChatSelectedFilesComponentState } from '@/ai/states/agentChatSelectedFilesComponentState';
import { agentChatUploadedFilesComponentState } from '@/ai/states/agentChatUploadedFilesComponentState';
import { currentAIChatThreadComponentState } from '@/ai/states/currentAIChatThreadComponentState';
import { isAgentChatCurrentContextActiveState } from '@/ai/states/isAgentChatCurrentContextActiveState';
import { contextStoreCurrentObjectMetadataItemIdComponentState } from '@/context-store/states/contextStoreCurrentObjectMetadataItemIdComponentState';
import { useGetObjectMetadataItemById } from '@/object-metadata/hooks/useGetObjectMetadataItemById';
import { ObjectRecord } from '@/object-record/types/ObjectRecord';
import { useHotkeysOnFocusedElement } from '@/ui/utilities/hotkey/hooks/useHotkeysOnFocusedElement';
import { useScrollWrapperElement } from '@/ui/utilities/scroll/hooks/useScrollWrapperElement';
import { useRecoilComponentValue } from '@/ui/utilities/state/component-state/hooks/useRecoilComponentValue';
import { useApolloClient } from '@apollo/client';
import { v4 } from 'uuid';
import {
    useGetAgentChatMessagesQuery,
    useGetAgentChatThreadsQuery,
} from '~/generated-metadata/graphql';
import { AgentChatMessage } from '~/generated/graphql';
import { agentChatInputState } from '../states/agentChatInputState';
import { agentChatMessagesComponentState } from '../states/agentChatMessagesComponentState';
import { agentStreamingMessageState } from '../states/agentStreamingMessageState';
import { parseAgentStreamingChunk } from '../utils/parseAgentStreamingChunk';

type OptimisticMessage = AgentChatMessage & {
  isPending: boolean;
};

export const useAgentChat = (agentId: string, records?: ObjectRecord[]) => {
  const apolloClient = useApolloClient();
  const { enqueueErrorSnackBar } = useSnackBar();
  const { getObjectMetadataItemById } = useGetObjectMetadataItemById();

  const contextStoreCurrentObjectMetadataItemId = useRecoilComponentValue(
    contextStoreCurrentObjectMetadataItemIdComponentState,
  );

  const isAgentChatCurrentContextActive = useRecoilComponentValue(
    isAgentChatCurrentContextActiveState,
  );

  const agentChatSelectedFiles = useRecoilComponentValue(
    agentChatSelectedFilesComponentState,
    agentId,
  );

  const [agentChatContext, setAgentChatContext] = useRecoilComponentState(
    agentChatObjectMetadataAndRecordContextState,
    agentId,
  );

  const [currentThreadId, setCurrentThreadId] = useRecoilComponentState(
    currentAIChatThreadComponentState,
    agentId,
  );
  const [agentChatUploadedFiles, setAgentChatUploadedFiles] =
    useRecoilComponentState(agentChatUploadedFilesComponentState, agentId);

  const [agentChatMessages, setAgentChatMessages] = useRecoilComponentState(
    agentChatMessagesComponentState,
    agentId,
  );

  const [agentChatInput, setAgentChatInput] =
    useRecoilState(agentChatInputState);

  const [agentStreamingMessage, setAgentStreamingMessage] = useRecoilState(
    agentStreamingMessageState,
  );

  const [isStreaming, setIsStreaming] = useState(false);

  // SGR Streaming Support - Updated to use new system
  const [isStreamingSGR, setIsStreamingSGR] = useState(false);

  const scrollWrapperId = `scroll-wrapper-ai-chat-${agentId}`;

  const { scrollWrapperHTMLElement } = useScrollWrapperElement(scrollWrapperId);

  const scrollToBottom = () => {
    scrollWrapperHTMLElement?.scroll({
      top: scrollWrapperHTMLElement.scrollHeight,
      behavior: 'smooth',
    });
  };

  const { data: threads, refetch: refetchThreads } =
    useGetAgentChatThreadsQuery({
      variables: {
        agentId,
      },
    });

  const { data: messages, refetch: refetchMessages } =
    useGetAgentChatMessagesQuery({
      variables: {
        threadId: currentThreadId ?? '',
      },
      skip: !currentThreadId,
    });

  const isLoading = !threads || !messages;
  
  console.log('=== useAgentChat Hook State ===');
  console.log('agentId:', agentId);
  console.log('currentThreadId:', currentThreadId);
  console.log('threads:', threads);
  console.log('messages:', messages);
  console.log('isLoading:', isLoading);

  const createOptimisticMessages = (content: string): OptimisticMessage[] => {
    const optimisticMessage: OptimisticMessage = {
      id: v4(),
      role: AgentChatMessageRole.USER,
      content,
      createdAt: new Date().toISOString(),
      threadId: (currentThreadId ?? '') as any,
      files: [],
      isPending: true,
    };

    return [optimisticMessage];
  };

  const streamAgentResponse = async (content: string) => {
    setIsStreaming(true);
    setIsStreamingSGR(true);

    try {
      await apolloClient.mutate({
        mutation: STREAM_CHAT_QUERY,
        variables: {
          agentId,
          message: content,
          threadId: currentThreadId,
          context: agentChatContext,
          files: agentChatSelectedFiles,
        },
        context: {
          onChunk: (chunk: string) => {
            parseAgentStreamingChunk(chunk, {
              onTextDelta: (message: string) => {
                setAgentStreamingMessage((prev) => ({
                  ...prev,
                  streamingText: prev.streamingText + message,
                }));
                scrollToBottom();
              },
              onToolCall: (message: string) => {
                setAgentStreamingMessage((prev) => ({
                  ...prev,
                  toolCall: message,
                }));
                scrollToBottom();
              },
              onError: (message: string) => {
                enqueueErrorSnackBar({
                  message,
                });
              },
            });
          },
        },
      });
    } finally {
      setIsStreaming(false);
      setIsStreamingSGR(false);
    }
  };

  const sendChatMessage = async (content: string) => {
    const optimisticMessages = createOptimisticMessages(content);

    setAgentChatMessages((prevMessages: AgentChatMessage[]) => [
      ...prevMessages,
      ...optimisticMessages,
    ]);

    setAgentChatUploadedFiles([]);

    setTimeout(scrollToBottom, 100);

    await streamAgentResponse(content);

    const { data } = await refetchMessages();

    setAgentChatMessages(data?.agentChatMessages);
    setAgentStreamingMessage({
      toolCall: '',
      streamingText: '',
    });
    scrollToBottom();
  };

  const handleSendMessage = async () => {
    if (agentChatInput.trim() === '' || isLoading === true) {
      return;
    }
    const content = agentChatInput.trim();
    setAgentChatInput('');
    await sendChatMessage(content);
  };

  const handleSetContext = async (
    items: Array<AIChatObjectMetadataAndRecordContext>,
  ) => {
    setAgentChatContext(items);
  };

  useHotkeysOnFocusedElement({
    keys: [Key.Enter],
    callback: (event: KeyboardEvent) => {
      if (!event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        handleSendMessage();
      }
    },
    focusId: `${agentId}-chat-input`,
    dependencies: [agentChatInput, isLoading],
    options: {
      enableOnFormTags: true,
    },
  });

  return {
    handleInputChange: (value: string) => setAgentChatInput(value),
    messages: agentChatMessages,
    input: agentChatInput,
    context: agentChatContext,
    handleSetContext,
    handleSendMessage,
    isLoading,
    agentStreamingMessage,
    scrollWrapperId,
    currentThreadId,
    isStreamingSGR,
  };
};
