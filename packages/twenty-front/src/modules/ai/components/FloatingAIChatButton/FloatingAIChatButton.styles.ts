import styled from '@emotion/styled';

export const StyledFloatingAIChatButtonContainer = styled.div`
  position: fixed;
  bottom: ${({ theme }) => theme.spacing(4)};
  right: ${({ theme }) => theme.spacing(4)};
  z-index: 1000;
  pointer-events: auto;
  animation: fadeInScale 0.3s ease-out;
  transition:
    opacity 0.3s ease,
    transform 0.3s ease;

  @keyframes fadeInScale {
    from {
      opacity: 0;
      transform: scale(0.8);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  @media (max-width: 768px) {
    bottom: ${({ theme }) => theme.spacing(2)};
    right: ${({ theme }) => theme.spacing(2)};
  }

  @media (max-width: 480px) {
    bottom: ${({ theme }) => theme.spacing(1.5)};
    right: ${({ theme }) => theme.spacing(1.5)};
  }
`;

export const StyledFloatingAIChatButton = styled.div`
  position: relative;

  &::before {
    content: '';
    position: absolute;
    top: -4px;
    right: -4px;
    width: 8px;
    height: 8px;
    background: ${({ theme }) => theme.color.blue};
    border-radius: 50%;
    opacity: 0;
    transition: opacity 0.2s ease;
  }

  &:hover::before {
    opacity: 1;
  }
`;

export const StyledTooltip = styled.div`
  position: absolute;
  bottom: 100%;
  right: 0;
  margin-bottom: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(1, 2)};
  background: ${({ theme }) => theme.background.primary};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.secondary};
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease;
  transform: translateY(4px);
`;

// Business Setup анимация
export const StyledBusinessSetupWelcomeMode = styled.div`
  &.business-setup-welcome-mode {
    animation: businessSetupWelcomePulse 2s ease-in-out infinite;
  }

  @keyframes businessSetupWelcomePulse {
    0%,
    100% {
      transform: scale(1);
      box-shadow: 0 4px 12px ${({ theme }) => theme.color.green}30;
    }
    50% {
      transform: scale(1.05);
      box-shadow: 0 6px 20px ${({ theme }) => theme.color.green}50;
    }
  }

  .business-setup-welcome-pulse {
    background-color: ${({ theme }) => theme.color.green} !important;
    color: ${({ theme }) => theme.font.color.inverted} !important;
  }
`;
