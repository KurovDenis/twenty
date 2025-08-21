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
      // If we're in Business Setup mode, use the special hook
      if (businessSetupStatus === 'WELCOME') {
        openBusinessSetupChat();
      } else {
        openAskAIPage();
      }
    } catch (error) {
      console.error('Error opening AI chat:', error);
      // Fallback - open regular AI chat
      try {
        openAskAIPage();
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError);
      }
    }
  }, [businessSetupStatus, openBusinessSetupChat, openAskAIPage]);

  return {
    isVisible: isFloatingAIChatButtonVisible && isAiEnabled && !isAIChatOpen,
    handleClick,
    businessSetupStatus,
  };
};
