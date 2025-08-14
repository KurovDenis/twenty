import { useRecoilValue } from 'recoil';
import { useOpenAskAIPageInCommandMenu } from '@/command-menu/hooks/useOpenAskAIPageInCommandMenu';
import { useIsFeatureEnabled } from '@/workspace/hooks/useIsFeatureEnabled';
import { isCommandMenuOpenedState } from '@/command-menu/states/isCommandMenuOpenedState';
import { commandMenuPageState } from '@/command-menu/states/commandMenuPageState';
import { CommandMenuPages } from '@/command-menu/types/CommandMenuPages';
import { FeatureFlagKey } from '~/generated/graphql';
import { isFloatingAIChatButtonVisibleState } from '../states/isFloatingAIChatButtonVisibleState';

export const useFloatingAIChatButton = () => {
  const isAiEnabled = useIsFeatureEnabled(FeatureFlagKey.IS_AI_ENABLED);
  const isVisible = useRecoilValue(isFloatingAIChatButtonVisibleState);
  const isCommandMenuOpened = useRecoilValue(isCommandMenuOpenedState);
  const commandMenuPage = useRecoilValue(commandMenuPageState);
  const { openAskAIPage } = useOpenAskAIPageInCommandMenu();

  // Проверяем, открыт ли AI чат
  const isAIChatOpen = isCommandMenuOpened && 
    (commandMenuPage === CommandMenuPages.AskAI || 
     commandMenuPage === CommandMenuPages.ViewPreviousAIChats);

  const handleClick = () => {
    openAskAIPage();
  };

  return {
    isVisible: isVisible && isAiEnabled && !isAIChatOpen,
    handleClick,
  };
};
