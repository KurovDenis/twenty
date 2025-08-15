import { useCreateWelcomeAgentThreadMutation } from '@/ai/graphql/mutations/createWelcomeAgentThread';
import { useSendWelcomeAgentMessageMutation } from '@/ai/graphql/mutations/sendWelcomeAgentMessage';
import { useFindManyAgentsQuery } from '@/ai/graphql/queries/findManyAgents';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { useCallback, useState } from 'react';

// Local type definition
interface AgentMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export const useWelcomeAgent = () => {
  const [isActive, setIsActive] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const { enqueueErrorSnackBar } = useSnackBar();

  // Find Welcome Agent
  const { data: welcomeAgent } = useFindManyAgentsQuery({
    variables: { 
      filter: { 
        agentType: { eq: 'langgraph' },
        name: { eq: 'Welcome Agent' }
      } 
    },
  });

  // Mutations
  const [createThread] = useCreateWelcomeAgentThreadMutation();
  const [sendMessage] = useSendWelcomeAgentMessageMutation();

  const startAgent = useCallback(async () => {
    if (!welcomeAgent?.length) {
      enqueueErrorSnackBar({ message: 'Welcome Agent not found' });
      return;
    }

    try {
      setIsLoading(true);
      
      const response = await createThread({
        variables: {
          input: { agentId: welcomeAgent[0].id }
        }
      });

      if (response.data?.createWelcomeAgentThread) {
        setThreadId(response.data.createWelcomeAgentThread.id);
        setIsActive(true);
        
        // Add initial message
        setMessages([{ 
          role: 'assistant', 
          content: 'Привет! Добро пожаловать в Twenty. Я ваш помощник. Как я могу помочь вам начать работу?' 
        }]);
      }
    } catch (error) {
      enqueueErrorSnackBar({ message: 'Failed to start welcome agent' });
      setIsActive(false);
    } finally {
      setIsLoading(false);
    }
  }, [welcomeAgent, createThread, enqueueErrorSnackBar]);

  const sendAgentMessage = useCallback(async (content: string) => {
    if (!threadId || !welcomeAgent?.length || !content.trim()) return;

    try {
      setIsLoading(true);
      
      // Add user message
      setMessages(prev => [...prev, { role: 'user', content }]);

      // Format message with proper role and ID
      const agentMessage: AgentMessage = {
        id: crypto.randomUUID(), // Generate unique ID
        role: 'user',
        content: content.trim(),
        timestamp: new Date().toISOString(),
      };

      const response = await sendMessage({
        variables: {
          input: {
            agentId: welcomeAgent[0].id,
            threadId,
            workspaceId: '', // TODO: get from context
            messages: [agentMessage], // Properly formatted message
          }
        }
      });

      if (response.data?.sendWelcomeAgentMessage) {
        // Add agent response
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: response.data!.sendWelcomeAgentMessage.content 
        }]);
      }
    } catch (error) {
      enqueueErrorSnackBar({ message: 'Failed to send message' });
    } finally {
      setIsLoading(false);
    }
  }, [threadId, welcomeAgent, sendMessage, enqueueErrorSnackBar]);

  return {
    isActive,
    threadId,
    messages,
    isLoading,
    welcomeAgent: welcomeAgent?.[0],
    startAgent,
    sendMessage: sendAgentMessage,
  };
};
