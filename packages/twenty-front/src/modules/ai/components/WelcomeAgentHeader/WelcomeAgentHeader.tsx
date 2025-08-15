import React from 'react';
import styled from '@emotion/styled';
import { IconSparkles } from 'twenty-ui/display';
import { Button } from 'twenty-ui/input';
import { t } from '@lingui/core/macro';

const StyledWelcomeHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${({ theme }) => theme.spacing(3)};
  background: ${({ theme }) => theme.background.secondary};
  border-bottom: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.md} ${({ theme }) => theme.border.radius.md} 0 0;
`;

const StyledWelcomeContent = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledWelcomeTitle = styled.div`
  font-weight: 600;
  font-size: ${({ theme }) => theme.font.size.md};
  color: ${({ theme }) => theme.font.color.primary};
  margin-bottom: ${({ theme }) => theme.spacing(1)};
`;

const StyledWelcomeSubtitle = styled.div`
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.secondary};
`;

interface WelcomeAgentHeaderProps {
  onSkip: () => void;
}

export const WelcomeAgentHeader: React.FC<WelcomeAgentHeaderProps> = ({ onSkip }) => {
  return (
    <StyledWelcomeHeader>
      <StyledWelcomeContent>
        <IconSparkles size={24} />
        <div>
          <StyledWelcomeTitle>
            {t`Добро пожаловать в Twenty!`}
          </StyledWelcomeTitle>
          <StyledWelcomeSubtitle>
            {t`Я ваш персональный помощник для освоения CRM`}
          </StyledWelcomeSubtitle>
        </div>
      </StyledWelcomeContent>
      <Button 
        variant="secondary" 
        size="small" 
        onClick={onSkip}
        title={t`Пропустить Welcome Agent`}
      >
        {t`Пропустить`}
      </Button>
    </StyledWelcomeHeader>
  );
};
