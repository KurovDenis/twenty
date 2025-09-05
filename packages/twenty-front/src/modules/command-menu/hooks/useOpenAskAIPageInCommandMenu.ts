import { useCommandMenu } from '@/command-menu/hooks/useCommandMenu';
import { CommandMenuPages } from '@/command-menu/types/CommandMenuPages';
import { t } from '@lingui/core/macro';
import { IconSparkles } from 'twenty-ui/display';
import { v4 } from 'uuid';

export const useOpenAskAIPageInCommandMenu = () => {
  const { navigateCommandMenu } = useCommandMenu();

  const openAskAIPage = (pageTitle?: string | null, agentId?: string | null) => {
    console.log('openAskAIPage called with pageTitle:', pageTitle, 'agentId:', agentId);
    
    // Use agentId as pageId if provided, otherwise generate a new UUID
    const pageId = agentId || v4();
    
    navigateCommandMenu({
      page: CommandMenuPages.AskAI,
      pageTitle: pageTitle ?? t`Ask AI`,
      pageIcon: IconSparkles,
      pageId: pageId,
    });
    
    console.log('openAskAIPage: navigateCommandMenu called with pageId:', pageId);
  };

  return {
    openAskAIPage,
  };
};
