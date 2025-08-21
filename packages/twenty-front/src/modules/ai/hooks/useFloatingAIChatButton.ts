import { useBusinessSetupAIChat } from '@/business-setup/hooks/useBusinessSetupAIChat';
import { useBusinessSetupStatus } from '@/business-setup/hooks/useBusinessSetupStatus';
import { useOpenAskAIPageInCommandMenu } from '@/command-menu/hooks/useOpenAskAIPageInCommandMenu';
import { commandMenuPageState } from '@/command-menu/states/commandMenuPageState';
import { isCommandMenuOpenedState } from '@/command-menu/states/isCommandMenuOpenedState';
import { CommandMenuPages } from '@/command-menu/types/CommandMenuPages';
import { useIsFeatureEnabled } from '@/workspace/hooks/useIsFeatureEnabled';
import { useCallback } from 'react';
import { useRecoilValue } from 'recoil';
import { FeatureFlagKey } from '~/generated/graphql';
import { isFloatingAIChatButtonVisibleState } from '../states/isFloatingAIChatButtonVisibleState';

export const useFloatingAIChatButton = () => {
  const isAiEnabled = useIsFeatureEnabled(FeatureFlagKey.IS_AI_ENABLED);
  const isFloatingAIChatButtonVisible = useRecoilValue(
    isFloatingAIChatButtonVisibleState,
  );
  const isCommandMenuOpened = useRecoilValue(isCommandMenuOpenedState);
  const commandMenuPage = useRecoilValue(commandMenuPageState);
  const businessSetupStatus = useBusinessSetupStatus();
  const { openAskAIPage } = useOpenAskAIPageInCommandMenu();
  const { openBusinessSetupChat } = useBusinessSetupAIChat();

  // Check if AI chat is open
  const isAIChatOpen =
    isCommandMenuOpened &&
    (commandMenuPage === CommandMenuPages.AskAI ||
      commandMenuPage === CommandMenuPages.ViewPreviousAIChats);

  const handleClick = useCallback(() => {
    try {
      // ✅ Floating Button открывает Command Menu с вкладками (БЕЗ создания нового чата)
      if (businessSetupStatus === 'WELCOME') {
        // Business Setup режим - открываем Business Setup чат
        openBusinessSetupChat();
      } else {
        // Обычный режим - открываем Command Menu с вкладками
        openAskAIPage();
      }
    } catch {
      // Fallback - открываем обычный AI чат
      try {
        openAskAIPage();
      } catch {
        // Silent fallback - уже пытаемся открыть AI чат
      }
    }
  }, [
    businessSetupStatus,
    openBusinessSetupChat,
    openAskAIPage,
  ]);

  return {
    isVisible: isFloatingAIChatButtonVisible && isAiEnabled && !isAIChatOpen,
    handleClick,
    businessSetupStatus,
  };
};
