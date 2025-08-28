import styled from '@emotion/styled';
import { keyframes } from '@emotion/react';

// CSS Animations
const fadeInScale = keyframes`
  from {
    opacity: 0;
    transform: scale(0.8);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
`;

const spin = keyframes`
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
`;

const pulse = keyframes`
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.1);
    opacity: 0.7;
  }
`;

const slideInUp = keyframes`
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const businessSetupWelcomePulse = keyframes`
  0%, 100% {
    transform: scale(1);
    box-shadow: 0 4px 12px rgba(25, 118, 210, 0.3);
  }
  50% {
    transform: scale(1.05);
    box-shadow: 0 6px 20px rgba(25, 118, 210, 0.5);
  }
`;

export const StyledFloatingAIChatButtonContainer = styled.div`
  position: fixed;
  bottom: ${({ theme }) => theme.spacing(4)};
  right: ${({ theme }) => theme.spacing(4)};
  z-index: 1000;
  pointer-events: auto;
  animation: ${fadeInScale} 0.3s ease-out;
  transition:
    opacity 0.3s ease,
    transform 0.3s ease;

  /* Global animation classes */
  .spin {
    animation: ${spin} 1s linear infinite;
  }
  
  .pulse {
    animation: ${pulse} 2s infinite;
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
    animation: ${businessSetupWelcomePulse} 2s ease-in-out infinite;
  }

  .business-setup-welcome-pulse {
    background-color: ${({ theme }) => theme.color.blue} !important;
    color: ${({ theme }) => theme.font.color.inverted} !important;
  }
`;

// Welcome Popup стили
export const StyledWelcomePopup = styled.div`
  position: absolute;
  bottom: 80px;
  right: 0;
  width: 320px;
  background: ${({ theme }) => theme.background.primary};
  border: 1px solid ${({ theme }) => theme.border.color.light};
  border-radius: ${({ theme }) => theme.border.radius.md};
  box-shadow: ${({ theme }) => theme.boxShadow.strong};
  z-index: 1000;
  animation: ${slideInUp} 0.3s ease-out;
  
  @media (max-width: 480px) {
    width: 280px;
    bottom: 60px;
  }
`;

export const StyledPopupHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: ${({ theme }) => theme.spacing(3)};
  border-bottom: 1px solid ${({ theme }) => theme.border.color.light};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  
  button {
    background: none;
    border: none;
    font-size: 18px;
    cursor: pointer;
    color: ${({ theme }) => theme.font.color.light};
    
    &:hover {
      color: ${({ theme }) => theme.font.color.primary};
    }
  }
`;

export const StyledPopupContent = styled.div`
  padding: ${({ theme }) => theme.spacing(3)};
  max-height: 200px;
  overflow-y: auto;
  line-height: 1.5;
`;

export const StyledPopupActions = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(3)};
  border-top: 1px solid ${({ theme }) => theme.border.color.light};
  
  button {
    flex: 1;
    padding: ${({ theme }) => theme.spacing(2)};
    border: 1px solid ${({ theme }) => theme.border.color.light};
    border-radius: ${({ theme }) => theme.border.radius.sm};
    background: ${({ theme }) => theme.background.primary};
    cursor: pointer;
    
    &:first-child {
      background: ${({ theme }) => theme.color.blue};
      color: white;
      border-color: ${({ theme }) => theme.color.blue};
    }
    
    &:hover {
      opacity: 0.8;
    }
  }
`;
