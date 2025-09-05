import { useOpenAskAIPageInCommandMenu } from '@/command-menu/hooks/useOpenAskAIPageInCommandMenu';
import { commandMenuPageState } from '@/command-menu/states/commandMenuPageState';
import { isCommandMenuOpenedState } from '@/command-menu/states/isCommandMenuOpenedState';
import { CommandMenuPages } from '@/command-menu/types/CommandMenuPages';
import { useIsFeatureEnabled } from '@/workspace/hooks/useIsFeatureEnabled';
import { useCallback, useState } from 'react';
import { useRecoilValue } from 'recoil';
import { FeatureFlagKey } from '~/generated/graphql';

// Import Supervisor hooks instead of direct business setup status
import { useBusinessSetupAgentChat } from '@/business-setup/hooks/useBusinessSetupAgentChat';
import { useRecoilComponentValue } from '@/ui/utilities/state/component-state/hooks/useRecoilComponentValue';
import { currentAIChatThreadComponentState } from '../states/currentAIChatThreadComponentState';
import { isFloatingAIChatButtonVisibleState } from '../states/isFloatingAIChatButtonVisibleState';
import { useSupervisorGuidance } from './useSupervisorGuidance';

export const useFloatingAIChatButton = () => {
  const isAiEnabled = useIsFeatureEnabled(FeatureFlagKey.IS_AI_ENABLED);
  const isFloatingAIChatButtonVisible = useRecoilValue(
    isFloatingAIChatButtonVisibleState,
  );

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
    isVisible: supervisorVisible,
  } = useSupervisorGuidance();

  const activeThreadId = useRecoilComponentValue(
    currentAIChatThreadComponentState,
    'floating-chat-button',
  );
  const { openAskAIPage } = useOpenAskAIPageInCommandMenu();
  const {
    createBusinessSetupChat,
    lastError: businessSetupError,
    clearError: clearBusinessSetupError,
  } = useBusinessSetupAgentChat();

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
    console.log('=== Floating AI Chat Button Click START ===');
    console.log('Guidance:', guidance);
    console.log('Is AI Chat Open:', isAIChatOpen);
    console.log('Is Creating Thread:', isCreatingThread);
    console.log('Is Supervisor Loading:', isSupervisorLoading);
    console.log('ExecuteAction function:', executeAction);

    // Clear any previous errors
    if (combinedError) {
      console.log('Clearing previous error:', combinedError);
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
        console.log('Calling executeAction with chat_button_clicked...');
        
        // Delegate action to Supervisor Agent instead of direct logic
        const response = await executeAction('chat_button_clicked', {
          actionType: guidance?.actionType || 'standard',
          providerInfo: guidance?.providerInfo,
          context: {
            isAIChatOpen,
            activeThreadId,
            timestamp: now.toISOString(),
          },
        });

        console.log('ExecuteAction response received:', response);
        console.log('Response success:', response?.success);
        console.log('Response redirectTo:', response?.redirectTo);

      // Handle successful response from Supervisor
      if (response && response.success) {
        console.log('Supervisor action completed successfully:', response.message);
        
        // Check if Supervisor provided a specific redirect URL
        if (response.redirectTo) {
          console.log('Supervisor provided redirect URL:', response.redirectTo);
          
          // Parse the URL to extract agent information
          try {
            const url = new URL(response.redirectTo, window.location.origin);
            const agentId = url.searchParams.get('agentId');
            const businessSetupStep = url.searchParams.get('businessSetupStep');
            
            console.log('Parsed agent info:', { agentId, businessSetupStep });
            
            // Open AI chat through command menu with agent context
            if (!isAIChatOpen) {
              console.log('Opening AI chat with agent context via command menu');
              // Pass agentId as pageId to the command menu
              openAskAIPage(`AI Assistant${agentId ? ` - ${agentId}` : ''}`, agentId);
            } else {
              console.log('AI chat already open, not opening again');
            }
          } catch (error) {
            console.error('Failed to parse redirect URL:', error);
            // Fallback to standard AI chat opening
            if (!isAIChatOpen) {
              console.log('Fallback: Opening AI chat via openAskAIPage');
              openAskAIPage();
            }
          }
        } else {
          // Fallback to standard AI chat opening
          if (!isAIChatOpen) {
            console.log('Opening AI chat after successful Supervisor action');
            openAskAIPage();
          } else {
            console.log('AI chat already open, not opening again');
          }
        }
      } else {
        console.warn('Supervisor action completed but not successful:', response);
        // Fallback to opening AI chat anyway
        if (!isAIChatOpen) {
          console.log('Fallback: Opening AI chat despite unsuccessful response');
          openAskAIPage();
        }
      }
    } catch (error) {
      console.error('Failed to handle chat button click via Supervisor:', error);

      // Fallback to legacy business setup logic only if Supervisor fails
      try {
        console.log('Attempting legacy fallback...');
        if (guidance?.fallbackAction === 'business_setup') {
          await createBusinessSetupChat();
        } else {
          console.log('Fallback: Opening AI chat via openAskAIPage');
          openAskAIPage();
        }
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError);
      }
         } finally {
       console.log('Setting isCreatingThread to false');
       setIsCreatingThread(false);
       console.log('=== Floating AI Chat Button Click END ===');
     }
  }, [
    guidance?.actionType,
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
    activeThreadId,
  ]);

  // Final visibility calculation using Supervisor guidance
  const finalVisibility =
    supervisorVisible && isFloatingAIChatButtonVisible && isAiEnabled && !isAIChatOpen;

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
