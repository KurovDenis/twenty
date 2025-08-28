import { t } from '@lingui/core/macro';
import { useCallback, useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { IconLoader, IconSparkles } from 'twenty-ui/display';
import { FloatingIconButton } from 'twenty-ui/input';
import { useIsMobile } from 'twenty-ui/utilities';
import { getAgentConfigForStatus } from '@/business-setup/config/businessSetupAgents.config';
import { useFloatingAIChatButton } from '../../hooks/useFloatingAIChatButton';
import { useWelcomeMessage } from '../../hooks/useWelcomeMessage';
import { AIErrorBoundary } from '../ErrorBoundary';
import {
  StyledFloatingAIChatButton,
  StyledFloatingAIChatButtonContainer,
  StyledPopupActions,
  StyledPopupContent,
  StyledPopupHeader,
  StyledTooltip,
  StyledWelcomePopup,
} from './FloatingAIChatButton.styles';

export const FloatingAIChatButton = () => {
  return (
    <AIErrorBoundary
      fallback={
        <div style={{ 
          position: 'fixed', 
          bottom: '20px', 
          right: '20px', 
          padding: '12px', 
          backgroundColor: '#ffebee', 
          border: '1px solid #ffcdd2', 
          borderRadius: '8px',
          fontSize: '12px',
          color: '#c62828'
        }}>
          AI Assistant temporarily unavailable
        </div>
      }
    >
      <FloatingAIChatButtonContent />
    </AIErrorBoundary>
  );
};

const FloatingAIChatButtonContent = () => {
  const isMobile = useIsMobile();
  const { 
    isVisible, 
    handleClick, 
    isCreatingThread, 
    businessSetupStatus, 
    activeThreadId,
    lastError,
    clearError 
  } = useFloatingAIChatButton();
  const { welcomeMessage, showPopup, setShowPopup, continueChat } = useWelcomeMessage();
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);
  const [showError, setShowError] = useState(false);
  
  // Get agent configuration for current business setup status
  const agentConfig = getAgentConfigForStatus(businessSetupStatus);
  
  // Show error message when lastError changes
  useEffect(() => {
    if (lastError) {
      setShowError(true);
      // Auto-hide error after 5 seconds
      const timer = setTimeout(() => {
        setShowError(false);
        clearError();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [lastError, clearError]);
  
  /**
   * Get tooltip text based on current state
   */
  const getTooltipText = useCallback(() => {
    if (isCreatingThread) {
      return t`Creating chat...`;
    }
    
    if (businessSetupStatus) {
      const statusMap = {
        'WELCOME': t`Setup Avito Integration`,
        'BUSINESS_ANALYSIS': t`Analyze Business`,
        'SALES_FUNNEL_DESIGN': t`Design Sales Funnel`,
        'AGENT_SETUP': t`Setup AI Agents`,
        'WORKFLOW_CREATION': t`Create Workflows`,
        'TEAM_ASSIGNMENT': t`Assign Team`,
        'TESTING_OPTIMIZATION': t`Test & Optimize`,
        'COMPLETED': t`Ask AI (Press @)`
      };
      return statusMap[businessSetupStatus] || t`Ask AI (Press @)`;
    }
    
    return t`Ask AI (Press @)`;
  }, [isCreatingThread, businessSetupStatus]);
  
  /**
   * Get button icon based on current state
   */
  const getButtonIcon = useCallback(() => {
    if (isCreatingThread) {
      return IconLoader;
    }
    return IconSparkles;
  }, [isCreatingThread]);
  
  /**
   * Get button variant based on business setup status
   */
  const getButtonVariant = useCallback(() => {
    if (businessSetupStatus === 'WELCOME') {
      return 'primary'; // Highlight for WELCOME stage
    }
    return 'secondary';
  }, [businessSetupStatus]);

  // Показываем всплывающее сообщение при получении welcome сообщения
  useEffect(() => {
    if (welcomeMessage && !showPopup) {
      setShowPopup(true);
      
      // Автоматически скрываем через 10 секунд
      const timer = setTimeout(() => {
        setShowPopup(false);
      }, 10000);

      return () => clearTimeout(timer);
    }
  }, [welcomeMessage, showPopup, setShowPopup]);

  return (
    <StyledFloatingAIChatButtonContainer
      data-testid="floating-ai-chat-button"
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'scale(1)' : 'scale(0.8)',
        pointerEvents: isVisible ? 'auto' : 'none',
      }}
    >
      <StyledFloatingAIChatButton
        onMouseEnter={() => setIsTooltipVisible(true)}
        onMouseLeave={() => setIsTooltipVisible(false)}
      >
        <div
          style={{
            transform: isCreatingThread ? 'none' : undefined,
            filter: businessSetupStatus === 'WELCOME' ? 'hue-rotate(200deg) brightness(1.2)' : undefined,
          }}
          className={isCreatingThread ? 'spin' : undefined}
        >
          <FloatingIconButton
            Icon={getButtonIcon()}
            size={isMobile ? 'small' : 'medium'}
            position="standalone"
            applyShadow={true}
            applyBlur={true}
            onClick={handleClick}
            disabled={isCreatingThread}
            data-testid="floating-ai-chat-button-icon"
          />
        </div>
        <StyledTooltip
          style={{
            opacity: isTooltipVisible ? 1 : 0,
            transform: isTooltipVisible ? 'translateY(0)' : 'translateY(4px)',
          }}
        >
          {getTooltipText()}
          {agentConfig && (
            <div style={{ fontSize: '0.75em', opacity: 0.8, marginTop: '2px' }}>
              {agentConfig.sgrEnabled ? '🤖 SGR Agent' : '💬 AI Assistant'}
            </div>
          )}
        </StyledTooltip>
      </StyledFloatingAIChatButton>

      {/* Business Setup Status Indicator */}
      {businessSetupStatus === 'WELCOME' && (
        <div 
          style={{
            position: 'absolute',
            top: '-8px',
            right: '-8px',
            width: '16px',
            height: '16px',
            backgroundColor: '#ff5722',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '8px',
            color: 'white',
            fontWeight: 'bold',
            animation: 'pulse 2s infinite'
          }}
          title="Setup Required"
        >
          !
        </div>
      )}

      {/* Loading Indicator */}
      {isCreatingThread && (
        <div
          style={{
            position: 'absolute',
            bottom: '-4px',
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: '10px',
            color: '#666',
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            padding: '2px 6px',
            borderRadius: '4px',
            whiteSpace: 'nowrap'
          }}
        >
          Creating chat...
        </div>
      )}

      {/* Error Message Display */}
      {showError && lastError && (
        <div
          style={{
            position: 'absolute',
            bottom: '80px',
            right: '0',
            width: '320px',
            backgroundColor: '#ffebee',
            border: '1px solid #ffcdd2',
            borderRadius: '8px',
            padding: '12px',
            fontSize: '14px',
            color: '#c62828',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: 1000,
            animation: 'slideInUp 0.3s ease-out'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
            <span style={{ fontSize: '16px' }}>⚠️</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Chat Creation Failed</div>
              <div>{lastError}</div>
            </div>
            <button
              onClick={() => {
                setShowError(false);
                clearError();
              }}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '16px',
                cursor: 'pointer',
                padding: '0 4px',
                color: '#c62828'
              }}
            >
              ×
            </button>
          </div>
          {businessSetupStatus === 'WELCOME' && (
            <div style={{
              marginTop: '8px',
              fontSize: '12px',
              opacity: 0.8
            }}>
              💡 SGR Avito Agent is required for the welcome setup process.
            </div>
          )}
        </div>
      )}

      {/* Welcome Message Popup */}
      {showPopup && welcomeMessage && (
        <StyledWelcomePopup>
          <StyledPopupHeader>
            <span>
              {agentConfig?.sgrEnabled ? '🤖 SGR Assistant' : '💬 AI Assistant'}
              {businessSetupStatus === 'WELCOME' && ' - Avito Integration'}
            </span>
            <button 
              onClick={() => setShowPopup(false)}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '18px',
                cursor: 'pointer',
                padding: '0 4px'
              }}
            >
              ×
            </button>
          </StyledPopupHeader>
          <StyledPopupContent>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {welcomeMessage}
            </ReactMarkdown>
            {businessSetupStatus === 'WELCOME' && (
              <div 
                style={{
                  marginTop: '12px',
                  padding: '8px',
                  backgroundColor: '#e3f2fd',
                  borderRadius: '4px',
                  fontSize: '12px',
                  color: '#1976d2'
                }}
              >
                💡 This is a specialized SGR (Schema-Guided Reasoning) agent for Avito API integration.
              </div>
            )}
          </StyledPopupContent>
          <StyledPopupActions>
            <button 
              onClick={continueChat}
              style={{
                backgroundColor: '#1976d2',
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Continue Chat
            </button>
            <button 
              onClick={() => setShowPopup(false)}
              style={{
                backgroundColor: 'transparent',
                color: '#666',
                border: '1px solid #ddd',
                padding: '8px 16px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Dismiss
            </button>
          </StyledPopupActions>
        </StyledWelcomePopup>
      )}
    </StyledFloatingAIChatButtonContainer>
  );
};
