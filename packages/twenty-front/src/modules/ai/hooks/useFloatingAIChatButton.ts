import { useOpenAskAIPageInCommandMenu } from '@/command-menu/hooks/useOpenAskAIPageInCommandMenu';
import { commandMenuPageState } from '@/command-menu/states/commandMenuPageState';
import { isCommandMenuOpenedState } from '@/command-menu/states/isCommandMenuOpenedState';
import { CommandMenuPages } from '@/command-menu/types/CommandMenuPages';
import { useIsFeatureEnabled } from '@/workspace/hooks/useIsFeatureEnabled';
import { useRecoilValue } from 'recoil';
import { FeatureFlagKey } from '~/generated/graphql';
import { useCallback, useState } from 'react';

// Import Supervisor hooks instead of direct business setup status
import { useSupervisorGuidance } from './useSupervisorGuidance';
import { useBusinessSetupAgentChat } from '@/business-setup/hooks/useBusinessSetupAgentChat';
import { useRecoilComponentValue } from '@/ui/utilities/state/component-state/hooks/useRecoilComponentValue';
import { currentAIChatThreadComponentState } from '../states/currentAIChatThreadComponentState';
import { isFloatingAIChatButtonVisibleState } from '../states/isFloatingAIChatButtonVisibleState';

export const useFloatingAIChatButton = () => {
  const isAiEnabled = useIsFeatureEnabled(FeatureFlagKey.IS_AI_ENABLED);
  const baseVisibility = useRecoilValue(isFloatingAIChatButtonVisibleState);
  
  // State management for preventing multiple clicks
  const [isCreatingThread, setIsCreatingThread] = useState(false);
  const [lastClickTime, setLastClickTime] = useState<Date | null>(null);
  
  const isCommandMenuOpened = useRecoilValue(isCommandMenuOpenedState);
  const commandMenuPage = useRecoilValue(commandMenuPageState);
  
  // Use Supervisor guidance instead of direct business setup status
  const { 
    guidance, 
    isLoading: isSupervisorLoading, 
    error: supervisorError, 
    executeAction, 
    clearError,
    isVisible: supervisorVisible 
  } = useSupervisorGuidance();
  
  const activeThreadId = useRecoilComponentValue(currentAIChatThreadComponentState, 'floating-chat-button');
  const { openAskAIPage } = useOpenAskAIPageInCommandMenu();
  const { createBusinessSetupChat, lastError: businessSetupError, clearError: clearBusinessSetupError } = useBusinessSetupAgentChat();

  // Проверяем, открыт ли AI чат
  const isAIChatOpen =
    isCommandMenuOpened &&
    (commandMenuPage === CommandMenuPages.AskAI ||
      commandMenuPage === CommandMenuPages.ViewPreviousAIChats);

  // Combine all error sources
  const combinedError = supervisorError || businessSetupError;
  const combinedClearError = useCallback(() => {
    clearError();
    clearBusinessSetupError();
  }, [clearError, clearBusinessSetupError]);

  const handleClick = useCallback(async () => {
    console.log('Floating AI chat button clicked via Supervisor guidance');
    
    // Clear any previous errors
    if (combinedError) {
      combinedClearError();
    }
    
    // Prevent rapid clicks - debounce with 1 second interval
    const now = new Date();
    if (lastClickTime && now.getTime() - lastClickTime.getTime() < 1000) {
      console.log('Ignoring rapid click - debouncing');
      return;
    }
    
    // Prevent multiple concurrent operations
    if (isCreatingThread || isSupervisorLoading) {
      console.log('Already creating thread or loading, ignoring click');
      return;
    }
    
    setLastClickTime(now);
    setIsCreatingThread(true);
    
    try {
      // Delegate action to Supervisor Agent instead of direct logic
      await executeAction('chat_button_clicked', {
        actionType: guidance?.actionType || 'standard',
        providerInfo: guidance?.providerInfo,
        context: {
          isAIChatOpen,
          activeThreadId,
          timestamp: now.toISOString()
        }
      });
    } catch (error) {
      console.error('Failed to handle chat button click via Supervisor:', error);
      
      // Fallback to legacy business setup logic only if Supervisor fails
      try {
        console.log('Attempting legacy fallback...');
        if (guidance?.fallbackAction === 'business_setup') {
          await createBusinessSetupChat();
        } else {
          openAskAIPage();
        }
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError);
      }
    } finally {
      setIsCreatingThread(false);
    }
  }, [    guidance?.actionType,
    guidance?.providerInfo,
    guidance?.fallbackAction,
    lastClickTime, 
    isCreatingThread, 
    isSupervisorLoading,
    executeAction,
    createBusinessSetupChat, 
    openAskAIPage, 
    combinedError, 
    combinedClearError,
    isAIChatOpen,
    activeThreadId
  ]);

  // Final visibility calculation using Supervisor guidance
  const finalVisibility = supervisorVisible && baseVisibility && isAiEnabled && !isAIChatOpen;

  return {
    isVisible: finalVisibility,
    handleClick,
    isCreatingThread: isCreatingThread || isSupervisorLoading,
    // Return Supervisor guidance data instead of raw business status
    guidance,
    activeThreadId,
    lastError: combinedError,
    clearError: combinedClearError,
    // Computed properties from guidance
    buttonText: guidance?.buttonText || 'AI Assistant',
    buttonIcon: guidance?.buttonIcon || 'IconSparkles',
    tooltipText: guidance?.tooltipText || 'Ask AI (Press @)',
    actionType: guidance?.actionType || 'standard',
    providerInfo: guidance?.providerInfo,
  };
};
