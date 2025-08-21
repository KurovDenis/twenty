import { currentWorkspaceState } from '@/auth/states/currentWorkspaceState';
import { useCallback } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';
import { aiChatsState, createAIChat, currentChatIdState } from '../states/aiChatState';

/**
 * Хук для управления AI чатами
 * ✅ ЕДИНОЕ состояние для всех чатов
 * ✅ Централизованное управление
 * ✅ Правильная логика переключения
 */
export const useAIChats = () => {
  const currentWorkspace = useRecoilValue(currentWorkspaceState);
  const agentId = currentWorkspace?.defaultAgent?.id || '';
  
  // ✅ Единое состояние чатов
  const [chats, setChats] = useRecoilState(aiChatsState);
  const [currentChatId, setCurrentChatId] = useRecoilState(currentChatIdState);

  // ✅ Получить все чаты
  const getAllChats = useCallback(() => {
    return Object.values(chats);
  }, [chats]);

  // ✅ Получить текущий активный чат
  const getCurrentChat = useCallback(() => {
    return currentChatId ? chats[currentChatId] : null;
  }, [chats, currentChatId]);

  // ✅ Переключиться на чат
  const switchToChat = useCallback((chatId: string) => {
    console.log('🔧 Переключаемся на чат:', chatId);
    
    if (chats[chatId]) {
      setCurrentChatId(chatId);
      // ✅ Обновляем активность вкладки
      setChats(prev => Object.keys(prev).reduce((acc, id) => ({
        ...acc,
        [id]: { 
          ...prev[id], 
          isActive: id === chatId,
          lastAccessed: id === chatId ? new Date() : prev[id].lastAccessed
        }
      }), {}));
      return true;
    }
    
    console.error('❌ Чат не найден:', chatId);
    return false;
  }, [chats, setChats, setCurrentChatId]);

  // ✅ Создать новый чат
  const createNewChat = useCallback((title: string, context: 'general' | 'business-setup' = 'general') => {
    console.log('🔧 Создаем новый чат:', title, context);
    
    const newChat = context === 'business-setup' 
      ? createAIChat.businessSetup(title)
      : createAIChat.general(title);
    
    setChats(prev => ({
      ...prev,
      [newChat.id]: newChat
    }));
    
    setCurrentChatId(newChat.id);
    return newChat;
  }, [setChats, setCurrentChatId]);

  // ✅ Создать Business Setup чат
  const createBusinessSetupChat = useCallback((title: string = 'Настройка системы') => {
    return createNewChat(title, 'business-setup');
  }, [createNewChat]);

  // ✅ Создать обычный чат
  const createGeneralChat = useCallback((title: string = 'Новый чат') => {
    return createNewChat(title, 'general');
  }, [createNewChat]);

  // ✅ Восстановить чат (для совместимости)
  const restoreChat = useCallback((chatId: string) => {
    return switchToChat(chatId);
  }, [switchToChat]);

  // ✅ Закрыть чат
  const closeChat = useCallback((chatId: string) => {
    if (chats[chatId]?.isClosable) {
      setChats(prev => {
        const { [chatId]: removed, ...rest } = prev;
        return rest;
      });
      
      // ✅ Если закрываем текущий чат, переключаемся на Business Setup
      if (currentChatId === chatId) {
        const businessSetupChat = Object.values(chats).find(chat => chat.isBusinessSetup);
        if (businessSetupChat) {
          setCurrentChatId(businessSetupChat.id);
        } else {
          setCurrentChatId(null);
        }
      }
      
      return true;
    }
    return false;
  }, [chats, currentChatId, setChats, setCurrentChatId]);

  // ✅ Получить активный чат
  const getActiveChat = useCallback(() => {
    return getCurrentChat();
  }, [getCurrentChat]);

  // ✅ Получить Business Setup чат
  const getBusinessSetupChat = useCallback(() => {
    return Object.values(chats).find(chat => chat.isBusinessSetup);
  }, [chats]);

  // ✅ Обновить GraphQL Thread ID
  const updateGraphQLThreadId = useCallback((chatId: string, graphqlThreadId: string, agentId: string) => {
    console.log('🔧 Синхронизируем с GraphQL:', chatId, graphqlThreadId);
    
    setChats(prev => ({
      ...prev,
      [chatId]: {
        ...prev[chatId],
        graphqlThreadId,
        agentId,
      }
    }));
  }, [setChats]);

  // ✅ Синхронизация с GraphQL (новый метод)
  const syncWithGraphQL = useCallback((chatId: string, graphqlThreadId: string, agentId: string) => {
    updateGraphQLThreadId(chatId, graphqlThreadId, agentId);
  }, [updateGraphQLThreadId]);

  // ✅ Для совместимости с существующим кодом
  const switchToExistingThread = useCallback((threadId: string) => {
    // ✅ Ищем чат по graphqlThreadId
    const chat = Object.values(chats).find(c => c.graphqlThreadId === threadId);
    if (chat) {
      return switchToChat(chat.id);
    }
    
    // ✅ Если не найден, создаем новый
    const newChat = createAIChat.fromGraphQL(threadId, `Чат ${threadId.slice(0, 8)}`, agentId);
    setChats(prev => ({
      ...prev,
      [newChat.id]: newChat
    }));
    
    setCurrentChatId(newChat.id);
    return true;
  }, [chats, agentId, setChats, setCurrentChatId]);

  return {
    // ✅ Состояние
    chats,
    currentChatId,
    
    // ✅ Основные методы
    getAllChats,
    getCurrentChat,
    switchToChat,
    createNewChat,
    
    // ✅ Специализированные методы
    createBusinessSetupChat,
    createGeneralChat,
    restoreChat,
    closeChat,
    getActiveChat,
    getBusinessSetupChat,
    
    // ✅ Синхронизация с GraphQL
    updateGraphQLThreadId,
    syncWithGraphQL,
    switchToExistingThread,
    
    // ✅ Для совместимости (убираем позже)
    aiChats: chats,
    switchToGraphQLThread: switchToExistingThread,
  };
};
