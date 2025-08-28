import { useOpenAskAIPageInCommandMenu } from '@/command-menu/hooks/useOpenAskAIPageInCommandMenu';
import { commandMenuPageState } from '@/command-menu/states/commandMenuPageState';
import { isCommandMenuOpenedState } from '@/command-menu/states/isCommandMenuOpenedState';
import { CommandMenuPages } from '@/command-menu/types/CommandMenuPages';
import { useIsFeatureEnabled } from '@/workspace/hooks/useIsFeatureEnabled';
import { useRecoilValue } from 'recoil';
import { FeatureFlagKey } from '~/generated/graphql';
import { useCallback, useState } from 'react';

import { useBusinessSetupStatus } from '@/business-setup/hooks/useBusinessSetupStatus';
import { useBusinessSetupAgentChat } from '@/business-setup/hooks/useBusinessSetupAgentChat';
import { useRecoilComponentValue } from '@/ui/utilities/state/component-state/hooks/useRecoilComponentValue';
import { currentAIChatThreadComponentState } from '../states/currentAIChatThreadComponentState';
import { isFloatingAIChatButtonVisibleState } from '../states/isFloatingAIChatButtonVisibleState';

export const useFloatingAIChatButton = () => {
  const isAiEnabled = useIsFeatureEnabled(FeatureFlagKey.IS_AI_ENABLED);
  const isVisible = useRecoilValue(isFloatingAIChatButtonVisibleState);
  
  // State management for preventing multiple clicks
  const [isCreatingThread, setIsCreatingThread] = useState(false);
  const [lastClickTime, setLastClickTime] = useState<Date | null>(null);
  
  const isCommandMenuOpened = useRecoilValue(isCommandMenuOpenedState);
  const commandMenuPage = useRecoilValue(commandMenuPageState);
  const businessSetupStatus = useBusinessSetupStatus();
  const activeThreadId = useRecoilComponentValue(currentAIChatThreadComponentState, 'floating-chat-button');
  const { openAskAIPage } = useOpenAskAIPageInCommandMenu();
  const { createBusinessSetupChat, lastError, clearError } = useBusinessSetupAgentChat();

  // Проверяем, открыт ли AI чат
  const isAIChatOpen =
    isCommandMenuOpened &&
    (commandMenuPage === CommandMenuPages.AskAI ||
      commandMenuPage === CommandMenuPages.ViewPreviousAIChats);

  const handleClick = useCallback(async () => {
    console.log('Floating AI chat button clicked with businessSetupStatus:', businessSetupStatus);
    
    // Clear any previous errors
    if (lastError) {
      clearError();
    }
    
    // Prevent rapid clicks - debounce with 1 second interval
    const now = new Date();
    if (lastClickTime && now.getTime() - lastClickTime.getTime() < 1000) {
      console.log('Ignoring rapid click - debouncing');
      return;
    }
    
    // Prevent multiple concurrent operations
    if (isCreatingThread) {
      console.log('Already creating thread, ignoring click');
      return;
    }
    
    setLastClickTime(now);
    setIsCreatingThread(true);
    
    try {
      if (businessSetupStatus === 'WELCOME') {
        // ALWAYS force SGR Avito Agent during WELCOME stage
        console.log('WELCOME stage detected - forcing SGR Avito Agent with auto-greeting');
        await createBusinessSetupChat();
      } else {
        console.log('Opening standard AI page');
        openAskAIPage();
      }
    } catch (error) {
      console.error('Failed to handle chat button click:', error);
      
      // For WELCOME stage, don't fallback - show error
      if (businessSetupStatus === 'WELCOME') {
        console.error('Cannot create SGR Avito Agent for WELCOME stage');
        // Error is already handled by useBusinessSetupAgentChat hook
      } else {
        // For other stages, fallback to opening standard AI page
        console.log('Attempting fallback to standard AI page');
        try {
          openAskAIPage();
        } catch (fallbackError) {
          console.error('Fallback to standard AI page also failed:', fallbackError);
        }
      }
    } finally {
      setIsCreatingThread(false);
    }
  }, [businessSetupStatus, lastClickTime, isCreatingThread, createBusinessSetupChat, openAskAIPage, lastError, clearError]);

  return {
    isVisible: isVisible && isAiEnabled && !isAIChatOpen,
    handleClick,
    isCreatingThread,
    businessSetupStatus,
    activeThreadId,
    lastError,
    clearError,
  };
};
