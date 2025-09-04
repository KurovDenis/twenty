import { currentUserState } from '@/auth/states/currentUserState';
import { currentWorkspaceState } from '@/auth/states/currentWorkspaceState';
import { useLingui } from '@lingui/react/macro';
import { useCallback, useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useRecoilValue } from 'recoil';
import remarkGfm from 'remark-gfm';
import { IconLoader, IconSettings, IconSparkles } from 'twenty-ui/display';
import { FloatingIconButton } from 'twenty-ui/input';
import { useIsMobile } from 'twenty-ui/utilities';
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
        <div
          style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            padding: '12px',
            backgroundColor: '#ffebee',
            border: '1px solid #ffcdd2',
            borderRadius: '8px',
            fontSize: '12px',
            color: '#c62828',
          }}
        >
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
  const { t } = useLingui();
  const currentUser = useRecoilValue(currentUserState);
  const currentWorkspace = useRecoilValue(currentWorkspaceState);
  const {
    guidance,
    isCreatingThread,
    handleClick,
    lastError,
    clearError,
    isVisible,
  } = useFloatingAIChatButton();
  const { welcomeMessage, showPopup, setShowPopup, continueChat } =
    useWelcomeMessage();
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);
  const [showError, setShowError] = useState(false);

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
   * Get tooltip text from Supervisor guidance
   */
  const getTooltipText = useCallback(() => {
    if (isCreatingThread) {
      return guidance?.loadingText || t`Creating chat...`;
    }

    // Use Supervisor guidance instead of direct status checking
    return guidance?.tooltipText || t`Ask AI (Press @)`;
  }, [isCreatingThread, guidance?.tooltipText, guidance?.loadingText, t]);

  /**
   * Get button icon from Supervisor guidance
   */
  const getButtonIcon = useCallback(() => {
    if (isCreatingThread) {
      return IconLoader;
    }

    // Use Supervisor guidance for icon selection
    switch (guidance?.buttonIcon) {
      case 'IconSettings':
        return IconSettings;
      case 'IconSparkles':
        return IconSparkles;
      default:
        return IconSparkles;
    }
  }, [isCreatingThread, guidance?.buttonIcon]);

  /**
   * Get button variant from Supervisor guidance
   */
  const getButtonVariant = useCallback(() => {
    // Use Supervisor guidance for button styling
    return guidance?.buttonVariant || 'secondary';
  }, [guidance?.buttonVariant]);

  // Check if user needs action based on Supervisor guidance
  const needsUserAction = guidance?.requiresUserAction || false;

  // Show popup for welcome message only (not for business setup)
  useEffect(() => {
    // Only show popup for welcome messages, not for business setup warnings
    if (welcomeMessage && !showPopup && !needsUserAction) {
      setShowPopup(true);

      // Auto-hide after 10 seconds for regular welcome messages
      const timer = setTimeout(() => {
        setShowPopup(false);
      }, 10000);

      return () => clearTimeout(timer);
    }
  }, [welcomeMessage, showPopup, setShowPopup, needsUserAction]);

  if (!isVisible) {
    return null;
  }

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
            filter: needsUserAction
              ? 'hue-rotate(30deg) brightness(1.1)'
              : undefined,
          }}
          className={
            isCreatingThread ? 'spin' : needsUserAction ? 'pulse' : undefined
          }
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
          {guidance?.providerInfo && (
            <div style={{ fontSize: '0.75em', opacity: 0.8, marginTop: '2px' }}>
              🤖 {guidance.providerInfo.displayName}
            </div>
          )}
        </StyledTooltip>
      </StyledFloatingAIChatButton>

      {/* Action Required Indicator */}
      {needsUserAction && (
        <div
          style={{
            position: 'absolute',
            top: '-8px',
            right: '-8px',
            width: '16px',
            height: '16px',
            backgroundColor: '#ff9800',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '8px',
            color: 'white',
            fontWeight: 'bold',
            animation: 'pulse 2s infinite',
          }}
          title={guidance?.tooltipText || 'Action Required'}
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
            whiteSpace: 'nowrap',
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
            animation: 'slideInUp 0.3s ease-out',
          }}
        >
          <div
            style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}
          >
            <span style={{ fontSize: '16px' }}>⚠️</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                Chat Creation Failed
              </div>
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
                color: '#c62828',
              }}
            >
              ×
            </button>
          </div>
          {guidance?.providerInfo && (
            <div
              style={{
                marginTop: '8px',
                fontSize: '12px',
                opacity: 0.8,
              }}
            >
              💡 {guidance.providerInfo.displayName} integration required for
              setup.
            </div>
          )}
        </div>
      )}

      {/* Welcome Message Popup Only (Business Setup Popup Removed) */}
      {showPopup && welcomeMessage && !needsUserAction && (
        <StyledWelcomePopup>
          <StyledPopupHeader>
            <span>
              {guidance?.providerInfo
                ? `🤖 ${guidance.providerInfo.displayName}`
                : '💬 AI Assistant'}
            </span>
            <button
              onClick={() => setShowPopup(false)}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '18px',
                cursor: 'pointer',
                padding: '0 4px',
              }}
            >
              ×
            </button>
          </StyledPopupHeader>
          <StyledPopupContent>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {welcomeMessage}
            </ReactMarkdown>
            {guidance?.providerInfo && (
              <div
                style={{
                  marginTop: '12px',
                  padding: '8px',
                  backgroundColor: '#e3f2fd',
                  borderRadius: '4px',
                  fontSize: '12px',
                  color: '#1976d2',
                }}
              >
                💡 This is a specialized assistant for{' '}
                {guidance.providerInfo.displayName} integration.
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
                fontSize: '14px',
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
                fontSize: '14px',
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
