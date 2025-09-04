import React, { createContext, useContext, useState, ReactNode } from 'react';

interface ChatContinuationContextType {
  threadId: string | null;
  setThreadId: (id: string | null) => void;
  isChatActive: boolean;
  setIsChatActive: (active: boolean) => void;
  chatHistory: Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }>;
  addMessage: (role: 'user' | 'assistant', content: string) => void;
  clearChatHistory: () => void;
}

const ChatContinuationContext = createContext<
  ChatContinuationContextType | undefined
>(undefined);

interface ChatContinuationProviderProps {
  children: ReactNode;
}

export const ChatContinuationProvider: React.FC<
  ChatContinuationProviderProps
> = ({ children }) => {
  const [threadId, setThreadId] = useState<string | null>(null);
  const [isChatActive, setIsChatActive] = useState(false);
  const [chatHistory, setChatHistory] = useState<
    Array<{
      id: string;
      role: 'user' | 'assistant';
      content: string;
      timestamp: Date;
    }>
  >([]);

  const addMessage = (role: 'user' | 'assistant', content: string) => {
    const newMessage = {
      id: Date.now().toString(),
      role,
      content,
      timestamp: new Date(),
    };

    setChatHistory((prev) => [...prev, newMessage]);
  };

  const clearChatHistory = () => {
    setChatHistory([]);
  };

  const value: ChatContinuationContextType = {
    threadId,
    setThreadId,
    isChatActive,
    setIsChatActive,
    chatHistory,
    addMessage,
    clearChatHistory,
  };

  return (
    <ChatContinuationContext.Provider value={value}>
      {children}
    </ChatContinuationContext.Provider>
  );
};

export const useChatContinuationContext = (): ChatContinuationContextType => {
  const context = useContext(ChatContinuationContext);

  if (context === undefined) {
    throw new Error(
      'useChatContinuationContext must be used within a ChatContinuationProvider',
    );
  }

  return context;
};
