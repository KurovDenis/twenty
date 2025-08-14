import { useTheme } from '@emotion/react';
import { useState } from 'react';
import { t } from '@lingui/core/macro';
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
  const { isVisible, handleClick } = useFloatingAIChatButton();
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);

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
          {t`Ask AI (Press @)`}
        </StyledTooltip>
      </StyledFloatingAIChatButton>
    </StyledFloatingAIChatButtonContainer>
  );
};
