import { useOpenAskAIPageInCommandMenu } from '@/command-menu/hooks/useOpenAskAIPageInCommandMenu';
import { commandMenuPageState } from '@/command-menu/states/commandMenuPageState';
import { isCommandMenuOpenedState } from '@/command-menu/states/isCommandMenuOpenedState';
import { CommandMenuPages } from '@/command-menu/types/CommandMenuPages';
import { useIsFeatureEnabled } from '@/workspace/hooks/useIsFeatureEnabled';
import { useRecoilValue } from 'recoil';
import { FeatureFlagKey } from '~/generated/graphql';

import { useBusinessSetupStatus } from '@/business-setup/hooks/useBusinessSetupStatus';

export const useFloatingAIChatButton = () => {
  const isAiEnabled = useIsFeatureEnabled(FeatureFlagKey.IS_AI_ENABLED);

  const isCommandMenuOpened = useRecoilValue(isCommandMenuOpenedState);
  const commandMenuPage = useRecoilValue(commandMenuPageState);
  const businessSetupStatus = useBusinessSetupStatus();
  const { openAskAIPage } = useOpenAskAIPageInCommandMenu();

  // Проверяем, открыт ли AI чат
  const isAIChatOpen =
    isCommandMenuOpened &&
    (commandMenuPage === CommandMenuPages.AskAI ||
      commandMenuPage === CommandMenuPages.ViewPreviousAIChats);

  const handleClick = () => {
    // Если мы в Business Setup режиме, открываем специальный чат
    if (businessSetupStatus === 'WELCOME') {
      openAskAIPage("Let's set up your business automation!");
    } else {
      openAskAIPage();
    }
  };

  return {
    isVisible: isVisible && isAiEnabled && !isAIChatOpen,
    handleClick,
    businessSetupStatus,
  };
};
