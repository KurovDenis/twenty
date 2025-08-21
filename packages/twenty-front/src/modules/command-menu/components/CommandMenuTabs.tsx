import { useAIChats } from '@/ai/hooks/useAIChats';
import { useCreateNewAIChatThread } from '@/ai/hooks/useCreateNewAIChatThread';
import { currentWorkspaceState } from '@/auth/states/currentWorkspaceState';
import { useBusinessSetupAIChat } from '@/business-setup/hooks/useBusinessSetupAIChat';
import { useOpenAskAIPageInCommandMenu } from '@/command-menu/hooks/useOpenAskAIPageInCommandMenu';
import { commandMenuPageState } from '@/command-menu/states/commandMenuPageState';
import { CommandMenuPages } from '@/command-menu/types/CommandMenuPages';
import styled from '@emotion/styled';
import { useCallback, useMemo } from 'react';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import { IconHistory, IconSparkles } from 'twenty-ui/display';
import { TabButton } from 'twenty-ui/input';

const StyledTabsContainer = styled.div`
  display: flex;
  align-items: center;
  background: ${({ theme }) => theme.background.secondary};
  border-bottom: 1px solid ${({ theme }) => theme.border.color.light};
  padding: ${({ theme }) => theme.spacing(1, 2)};
  gap: ${({ theme }) => theme.spacing(1)};
  overflow-x: auto;
  flex-shrink: 0;
  min-height: 48px;
`;

export const CommandMenuTabs = () => {
  const currentWorkspace = useRecoilValue(currentWorkspaceState);
  const commandMenuPage = useRecoilValue(commandMenuPageState);
  const setCommandMenuPage = useSetRecoilState(commandMenuPageState);

  // ✅ Используем единое состояние из useAIChats
  const { 
    chats, 
    currentChatId, 
    switchToChat, 
    createNewChat,
    getBusinessSetupChat,
    syncWithGraphQL
  } = useAIChats();
  
  const agentId = currentWorkspace?.defaultAgent?.id;

  // ✅ Callback для синхронизации с OpenRouter
  const handleOpenRouterCompleted = useCallback((chatId: string, graphqlThreadId: string) => {
    console.log('✅ Синхронизируем чат с OpenRouter:', chatId, graphqlThreadId);
    
    // ✅ Находим последний созданный чат и синхронизируем его
    const lastCreatedChat = Object.values(chats)
      .filter(chat => !chat.isBusinessSetup && !chat.graphqlThreadId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
    
    if (lastCreatedChat) {
      // ✅ Синхронизируем с OpenRouter
      syncWithGraphQL(lastCreatedChat.id, graphqlThreadId, agentId || '');
      console.log('✅ Чат синхронизирован:', lastCreatedChat.id, graphqlThreadId);
    }
  }, [chats, agentId, syncWithGraphQL]);

  const { createAgentChatThread } = useCreateNewAIChatThread({
    agentId: agentId || '',
    onCompleted: handleOpenRouterCompleted,
  });

  const { openBusinessSetupChat } = useBusinessSetupAIChat();
  const { openAskAIPage } = useOpenAskAIPageInCommandMenu();

  // ✅ ВЫЧИСЛЯЕМ вкладки из состояния чатов
  const tabs = useMemo(() => {
    const chatTabs = Object.values(chats).map(chat => ({
      id: chat.id,
      title: chat.title,
      isActive: chat.isActive,
      isBusinessSetup: chat.isBusinessSetup,
      threadId: chat.graphqlThreadId,
    }));
    
    // ✅ Сортируем: Business Setup всегда первый
    return chatTabs.sort((a, b) => {
      if (a.isBusinessSetup) return -1;
      if (b.isBusinessSetup) return 1;
      return 0;
    });
  }, [chats]);

  // ✅ Инициализация: создаем Business Setup чат если его нет
  useMemo(() => {
    if (Object.keys(chats).length === 0) {
      console.log('🔧 Инициализируем Business Setup чат');
      createNewChat('Настройка системы', 'business-setup');
    }
  }, [chats, createNewChat]);

  // ✅ Создание нового чата
  const handleAddNewChat = useCallback(async () => {
    console.log('🔧 Создаем новый чат');
    
    // ✅ 1. Создаем локальный чат
    const newChat = createNewChat('Новый чат', 'general');
    
    // ✅ 2. Создаем OpenRouter поток с правильным callback
    if (agentId && createAgentChatThread) {
      try {
        // ✅ Передаем ID локального чата для синхронизации
        const result = await createAgentChatThread();
        console.log('✅ Создан OpenRouter поток для чата:', newChat.id);
      } catch (error) {
        console.error('❌ Ошибка создания OpenRouter потока:', error);
      }
    }
    
    // ✅ 3. Открываем AI страницу
    openAskAIPage();
  }, [agentId, createAgentChatThread, createNewChat, openAskAIPage]);

  // ✅ Переключение на вкладку
  const handleTabClick = useCallback((chatId: string) => {
    console.log('🔧 Переключаемся на чат:', chatId);
    
    // ✅ Переключаемся на существующий чат
    if (switchToChat(chatId)) {
      // ✅ Открываем AI страницу
      openAskAIPage();
    } else {
      console.error('❌ Не удалось переключиться на чат:', chatId);
    }
  }, [switchToChat, openAskAIPage]);

  // ✅ Переключение на страницу истории чатов
  const handleHistoryClick = useCallback(() => {
    setCommandMenuPage(CommandMenuPages.ViewPreviousAIChats);
  }, [setCommandMenuPage]);

  // ✅ Показываем табы только для AI чатов
  if (
    commandMenuPage !== CommandMenuPages.AskAI &&
    commandMenuPage !== CommandMenuPages.ViewPreviousAIChats
  ) {
    return null;
  }

  // ✅ Показываем максимум 4 вкладки + кнопка истории
  const visibleTabs = tabs.slice(0, 4);
  const hasMoreTabs = tabs.length > 4;

  if (Object.keys(chats).length === 0) {
    return (
      <StyledTabsContainer>
        <div>Загрузка чатов...</div>
      </StyledTabsContainer>
    );
  }

  return (
    <StyledTabsContainer>
      {/* Показываем максимум 4 вкладки */}
      {visibleTabs.map((tab) => (
        <TabButton
          key={tab.id}
          id={tab.id}
          title={tab.title}
          active={tab.isActive}
          LeftIcon={tab.isBusinessSetup ? IconSparkles : undefined}
          onClick={() => handleTabClick(tab.id)}
          contentSize="sm"
        />
      ))}

      {/* Кнопка создания нового чата */}
      <TabButton
        id="new-chat"
        title="+ Новый чат"
        onClick={handleAddNewChat}
        contentSize="sm"
      />

      {/* Кнопка "История чатов" если есть больше 4 чатов */}
      {hasMoreTabs && (
        <TabButton
          id="history"
          title="История чатов"
          LeftIcon={IconHistory}
          onClick={handleHistoryClick}
          contentSize="sm"
        />
      )}
    </StyledTabsContainer>
  );
};
