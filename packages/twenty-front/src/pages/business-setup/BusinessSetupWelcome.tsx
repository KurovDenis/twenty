import { SubTitle } from '@/auth/components/SubTitle';
import { Title } from '@/auth/components/Title';
import { useSetNextBusinessSetupStatus } from '@/business-setup/hooks/useSetNextBusinessSetupStatus';
import { useOpenAskAIPageInCommandMenu } from '@/command-menu/hooks/useOpenAskAIPageInCommandMenu';
import { AppPath } from '@/types/AppPath';
import { Modal } from '@/ui/layout/modal/components/Modal';
import styled from '@emotion/styled';
import { Trans, useLingui } from '@lingui/react/macro';
import { useNavigate } from 'react-router-dom';
import { IconSparkles } from 'twenty-ui/display';
import { LightButton, MainButton } from 'twenty-ui/input';

const StyledModalContent = styled(Modal.Content)`
  gap: ${({ theme }) => theme.spacing(8)};
`;

const StyledTitleContainer = styled.div`
  align-items: center;
  display: flex;
  flex-direction: column;
  justify-content: center;
  text-align: center;
`;

const StyledButtonContainer = styled.div`
  align-items: center;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(4)};
  width: 100%;
`;

const StyledIconContainer = styled.div`
  display: flex;
  justify-content: center;
  margin-bottom: ${({ theme }) => theme.spacing(4)};
`;

const StyledFeaturesList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(2)};
  margin: ${({ theme }) => theme.spacing(4)} 0;
  text-align: left;
`;

const StyledFeatureItem = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(2)};
  color: ${({ theme }) => theme.font.color.secondary};
`;

export const BusinessSetupWelcome = () => {
  const { t } = useLingui();
  const navigate = useNavigate();
  const { setNextBusinessSetupStatus } = useSetNextBusinessSetupStatus();
  const { openAskAIPage } = useOpenAskAIPageInCommandMenu();

  const handleStartWithAI = () => {
    openAskAIPage("I'm ready to help you set up your business automation! Let's get started.");
  };

  const handleSkipWelcome = async () => {
    await setNextBusinessSetupStatus();
    navigate(AppPath.BusinessAnalysis);
  };

  return (
    <StyledModalContent isVerticalCentered isHorizontalCentered>
      <StyledTitleContainer>
        <StyledIconContainer>
          <IconSparkles size={48} />
        </StyledIconContainer>
        <Title noMarginTop>
          <Trans>Welcome to Business Setup Wizard!</Trans>
        </Title>
        <SubTitle>
          <Trans>
            Let's create your fully automated business system together. 
            I'll help you analyze your business, design sales funnels, 
            set up AI agents, and create automated workflows.
          </Trans>
        </SubTitle>
        
        <StyledFeaturesList>
          <StyledFeatureItem>
            <IconSparkles size={16} />
            <span>🚀 Business Analysis - Analyze your industry and processes</span>
          </StyledFeatureItem>
          <StyledFeatureItem>
            <IconSparkles size={16} />
            <span>🎯 Sales Funnel Design - Create perfect conversion funnels</span>
          </StyledFeatureItem>
          <StyledFeatureItem>
            <IconSparkles size={16} />
            <span>🤖 AI Agent Setup - Build specialized AI agents</span>
          </StyledFeatureItem>
          <StyledFeatureItem>
            <IconSparkles size={16} />
            <span>⚡ Workflow Automation - Design automated workflows</span>
          </StyledFeatureItem>
          <StyledFeatureItem>
            <IconSparkles size={16} />
            <span>👥 Team Assignment - Set up roles and permissions</span>
          </StyledFeatureItem>
          <StyledFeatureItem>
            <IconSparkles size={16} />
            <span>🧪 Testing & Optimization - Ensure everything works perfectly</span>
          </StyledFeatureItem>
        </StyledFeaturesList>
      </StyledTitleContainer>
      
      <StyledButtonContainer>
        <MainButton 
          title={t`Start with AI Assistant`} 
          onClick={handleStartWithAI}
          Icon={IconSparkles}
          width={250}
        />
        <LightButton 
          title={t`Skip Welcome`} 
          onClick={handleSkipWelcome}
        />
      </StyledButtonContainer>
    </StyledModalContent>
  );
};
