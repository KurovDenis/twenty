import { currentWorkspaceState } from '@/auth/states/currentWorkspaceState';
import { useBusinessSetupAIChat } from '@/business-setup/hooks/useBusinessSetupAIChat';
import { useBusinessSetupStatus } from '@/business-setup/hooks/useBusinessSetupStatus';

import { useCreateNewAIChatThread } from '@/ai/hooks/useCreateNewAIChatThread';
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
  const currentWorkspace = useRecoilValue(currentWorkspaceState);
  const { openAskAIPage } = useOpenAskAIPageInCommandMenu();
  const { openBusinessSetupChat } = useBusinessSetupAIChat();

  // ✅ Hook for creating new AI chat threads (tabs)
  const agentId = currentWorkspace?.defaultAgent?.id;
  const { createAgentChatThread } = useCreateNewAIChatThread({
    agentId: agentId || '',
  });

  // Check if AI chat is open
  const isAIChatOpen =
    isCommandMenuOpened &&
    (commandMenuPage === CommandMenuPages.AskAI ||
      commandMenuPage === CommandMenuPages.ViewPreviousAIChats);

  const handleClick = useCallback(() => {
    try {
      // ✅ Always create a new chat thread (tab) instead of restoring existing
      if (agentId !== undefined && createAgentChatThread !== undefined) {
        // Create new tab with AI agent
        createAgentChatThread();
      } else if (businessSetupStatus === 'WELCOME') {
        // Fallback for Business Setup mode
        openBusinessSetupChat();
      } else {
        // Fallback for regular mode
        openAskAIPage();
      }
    } catch {
      // Fallback - open regular AI chat
      try {
        openAskAIPage();
      } catch {
        // Silent fallback - already trying to open AI chat
      }
    }
  }, [
    agentId,
    createAgentChatThread,
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
