import { t } from '@lingui/core/macro';
import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { IconSparkles } from 'twenty-ui/display';
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
  const { isVisible, handleClick, businessSetupStatus } = useFloatingAIChatButton();
  const { welcomeMessage, showPopup, setShowPopup, continueChat } = useWelcomeMessage();
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);

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
        <FloatingIconButton
          Icon={IconSparkles}
          size={isMobile ? 'small' : 'medium'}
          position="standalone"
          applyShadow={true}
          applyBlur={true}
          onClick={handleClick}
        />
        <StyledTooltip
          style={{
            opacity: isTooltipVisible ? 1 : 0,
            transform: isTooltipVisible ? 'translateY(0)' : 'translateY(4px)',
          }}
        >
          {businessSetupStatus === 'WELCOME' ? t`Continue Business Setup` : t`Ask AI (Press @)`}
        </StyledTooltip>
      </StyledFloatingAIChatButton>

      {/* Всплывающее сообщение с ответом LLM */}
      {showPopup && welcomeMessage && (
        <StyledWelcomePopup>
          <StyledPopupHeader>
            <span>🤖 AI Assistant</span>
            <button onClick={() => setShowPopup(false)}>×</button>
          </StyledPopupHeader>
          <StyledPopupContent>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {welcomeMessage}
            </ReactMarkdown>
          </StyledPopupContent>
          <StyledPopupActions>
            <button onClick={continueChat}>Continue Chat</button>
            <button onClick={() => setShowPopup(false)}>Dismiss</button>
          </StyledPopupActions>
        </StyledWelcomePopup>
      )}
    </StyledFloatingAIChatButtonContainer>
  );
};
