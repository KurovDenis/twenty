import { useTheme } from '@emotion/react';
import { t } from '@lingui/core/macro';
import { useCallback, useMemo, useState } from 'react';
import { IconSparkles } from 'twenty-ui/display';
import { FloatingIconButton } from 'twenty-ui/input';
import { useIsMobile } from 'twenty-ui/utilities';
import { useFloatingAIChatButton } from '../../hooks/useFloatingAIChatButton';
import {
  StyledFloatingAIChatButton,
  StyledFloatingAIChatButtonContainer,
  StyledTooltip,
} from './FloatingAIChatButton.styles';

export const FloatingAIChatButton = () => {
  const theme = useTheme();
  const isMobile = useIsMobile();
  const { isVisible, handleClick, businessSetupStatus } =
    useFloatingAIChatButton();
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);

  const isBusinessSetupWelcome = useMemo(
    () => businessSetupStatus === 'WELCOME',
    [businessSetupStatus],
  );

  const handleMouseEnter = useCallback(() => {
    setIsTooltipVisible(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsTooltipVisible(false);
  }, []);

  return (
    <StyledFloatingAIChatButtonContainer
      data-testid="floating-ai-chat-button"
      className={isBusinessSetupWelcome ? 'business-setup-welcome-mode' : ''}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'scale(1)' : 'scale(0.8)',
        pointerEvents: isVisible ? 'auto' : 'none',
      }}
    >
      <StyledFloatingAIChatButton
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <FloatingIconButton
          Icon={IconSparkles}
          size={isMobile ? 'small' : 'medium'}
          position="standalone"
          applyShadow={true}
          applyBlur={true}
          onClick={handleClick}
          className={
            isBusinessSetupWelcome ? 'business-setup-welcome-pulse' : ''
          }
        />
        <StyledTooltip
          style={{
            opacity: isTooltipVisible ? 1 : 0,
            transform: isTooltipVisible ? 'translateY(0)' : 'translateY(4px)',
          }}
        >
          {isBusinessSetupWelcome
            ? t`Start Business Setup with AI`
            : t`Ask AI (Press @)`}
        </StyledTooltip>
      </StyledFloatingAIChatButton>
    </StyledFloatingAIChatButtonContainer>
  );
};
