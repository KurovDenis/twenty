import { useCreateNewAIChatThread } from '@/ai/hooks/useCreateNewAIChatThread';
import { currentWorkspaceState } from '@/auth/states/currentWorkspaceState';
import { useBusinessSetupAIChat } from '@/business-setup/hooks/useBusinessSetupAIChat';
import { useBusinessSetupStatus } from '@/business-setup/hooks/useBusinessSetupStatus';
import { useOpenAskAIPageInCommandMenu } from '@/command-menu/hooks/useOpenAskAIPageInCommandMenu';
import { commandMenuPageState } from '@/command-menu/states/commandMenuPageState';
import { CommandMenuPages } from '@/command-menu/types/CommandMenuPages';
import styled from '@emotion/styled';
import { useCallback, useState } from 'react';
import { useRecoilValue } from 'recoil';
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
  const businessSetupStatus = useBusinessSetupStatus();

  // ✅ Состояние для управления чатами
  const [chats, setChats] = useState<
    Array<{
      id: string;
      title: string;
      isActive: boolean;
      isBusinessSetup: boolean;
    }>
  >([
    {
      id: 'business-setup',
      title: 'Настройка системы',
      isActive: true,
      isBusinessSetup: true,
    },
  ]);

  const agentId = currentWorkspace?.defaultAgent?.id;
  const { createAgentChatThread } = useCreateNewAIChatThread({
    agentId: agentId || '',
    onCompleted: (chatId: string) => {
      // ✅ Сохраняем ID нового чата в Business Setup состоянии
      // Это позволит восстановить чат при возврате на "Настройка системы"
    },
  });
  const { openAskAIPage } = useOpenAskAIPageInCommandMenu();
  const { openBusinessSetupChat, createBusinessSetupAgentChatThread } =
    useBusinessSetupAIChat();

  // Проверяем, активен ли Business Setup (не в WELCOME состоянии)
  const isBusinessSetupActive = businessSetupStatus !== 'WELCOME';

  // ✅ Показываем табы только для AI чатов
  if (
    commandMenuPage !== CommandMenuPages.AskAI &&
    commandMenuPage !== CommandMenuPages.ViewPreviousAIChats
  ) {
    return null;
  }

    // ✅ Добавляем новый чат
  const handleAddNewChat = useCallback(() => {
    const newChatId = `chat-${Date.now()}`;
    const newChat = {
      id: newChatId,
      title: `Новый чат ${chats.length}`,
      isActive: false,
      isBusinessSetup: false,
    };
    
    setChats((prev) => [...prev, newChat]);
    
    // ✅ Создаем новый чат через API
    if (agentId !== undefined && createAgentChatThread !== undefined) {
      createAgentChatThread();
    } else {
      openAskAIPage();
    }
  }, [agentId, createAgentChatThread, openAskAIPage, chats.length]);

  // ✅ Показываем максимум 4 вкладки + кнопка истории
  const visibleChats = chats.slice(0, 4);
  const hasMoreChats = chats.length > 4;

  return (
    <StyledTabsContainer>
      {/* Показываем максимум 4 вкладки */}
      {visibleChats.map((chat) => (
        <TabButton
          key={chat.id}
          id={chat.id}
          title={chat.title}
          active={chat.isActive}
          LeftIcon={chat.isBusinessSetup ? IconSparkles : undefined}
          onClick={() => {
            if (chat.isBusinessSetup) {
              openBusinessSetupChat();
            } else {
              // ✅ Переключаемся на чат
              setChats((prev) =>
                prev.map((c) => ({
                  ...c,
                  isActive: c.id === chat.id,
                })),
              );
            }
          }}
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
      {hasMoreChats && (
        <TabButton
          id="history"
          title="История чатов"
          LeftIcon={IconHistory}
          onClick={() => {
            // TODO: Перейти на страницу истории чатов
          }}
          contentSize="sm"
        />
      )}
    </StyledTabsContainer>
  );
};
