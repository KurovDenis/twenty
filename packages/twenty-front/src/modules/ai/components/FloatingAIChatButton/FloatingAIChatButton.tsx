import { useTheme } from '@emotion/react';
import { useState } from 'react';
import { t } from '@lingui/core/macro';
import { IconSparkles } from 'twenty-ui/display';
import { FloatingIconButton } from 'twenty-ui/input';
import { useIsMobile } from 'twenty-ui/utilities';
import { useFloatingAIChatButton } from '../../hooks/useFloatingAIChatButton';
import { useShouldShowWelcomeAgent } from '../../hooks/useShouldShowWelcomeAgent';
import {
  StyledFloatingAIChatButton,
  StyledFloatingAIChatButtonContainer,
  StyledTooltip,
  StyledWelcomeBadge,
} from './FloatingAIChatButton.styles';

export const FloatingAIChatButton = () => {
  const theme = useTheme();
  const isMobile = useIsMobile();
  const { isVisible, handleClick } = useFloatingAIChatButton();
  const { shouldShowWelcomeAgent, startWelcomeAgentSession } = useShouldShowWelcomeAgent();
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);

  const handleButtonClick = () => {
    if (shouldShowWelcomeAgent) {
      startWelcomeAgentSession(); // Начинаем сессию Welcome Agent
    }
    handleClick();
  };

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
          onClick={handleButtonClick}
        />
        {shouldShowWelcomeAgent && (
          <StyledWelcomeBadge>Новый!</StyledWelcomeBadge>
        )}
        <StyledTooltip
          style={{
            opacity: isTooltipVisible ? 1 : 0,
            transform: isTooltipVisible ? 'translateY(0)' : 'translateY(4px)',
          }}
        >
          {shouldShowWelcomeAgent 
            ? t`Welcome Agent (Новый!)` 
            : t`Ask AI (Press @)`
          }
        </StyledTooltip>
      </StyledFloatingAIChatButton>
    </StyledFloatingAIChatButtonContainer>
  );
};
