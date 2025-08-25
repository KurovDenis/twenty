import { useOpenAskAIPageInCommandMenu } from '@/command-menu/hooks/useOpenAskAIPageInCommandMenu';
import { commandMenuPageState } from '@/command-menu/states/commandMenuPageState';
import { isCommandMenuOpenedState } from '@/command-menu/states/isCommandMenuOpenedState';
import { CommandMenuPages } from '@/command-menu/types/CommandMenuPages';
import { useIsFeatureEnabled } from '@/workspace/hooks/useIsFeatureEnabled';
import { useRecoilValue } from 'recoil';
import { FeatureFlagKey } from '~/generated/graphql';

import { useBusinessSetupStatus } from '@/business-setup/hooks/useBusinessSetupStatus';
import { useBusinessSetupAgentChat } from '@/business-setup/hooks/useBusinessSetupAgentChat';
import { isFloatingAIChatButtonVisibleState } from '../states/isFloatingAIChatButtonVisibleState';

export const useFloatingAIChatButton = () => {
  const isAiEnabled = useIsFeatureEnabled(FeatureFlagKey.IS_AI_ENABLED);
  const isVisible = useRecoilValue(isFloatingAIChatButtonVisibleState);

  const isCommandMenuOpened = useRecoilValue(isCommandMenuOpenedState);
  const commandMenuPage = useRecoilValue(commandMenuPageState);
  const businessSetupStatus = useBusinessSetupStatus();
  const { openAskAIPage } = useOpenAskAIPageInCommandMenu();
  const { createBusinessSetupChat } = useBusinessSetupAgentChat();

  // Проверяем, открыт ли AI чат
  const isAIChatOpen =
    isCommandMenuOpened &&
    (commandMenuPage === CommandMenuPages.AskAI ||
      commandMenuPage === CommandMenuPages.ViewPreviousAIChats);

  const handleClick = () => {
    console.log('Floating AI chat button clicked with businessSetupStatus:', businessSetupStatus);
    
    // Если мы в Business Setup режиме, используем специальный чат
    if (businessSetupStatus === 'WELCOME') {
      console.log('Creating business setup chat for WELCOME status');
      createBusinessSetupChat();
    } else {
      console.log('Opening standard AI page');
      openAskAIPage();
    }
  };

  return {
    isVisible: isVisible && isAiEnabled && !isAIChatOpen,
    handleClick,
    businessSetupStatus,
  };
};
