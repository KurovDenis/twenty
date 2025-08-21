import { SubTitle } from '@/auth/components/SubTitle';
import { Title } from '@/auth/components/Title';
import { useBusinessSetupAIChat } from '@/business-setup/hooks/useBusinessSetupAIChat';
import { useSetNextBusinessSetupStatus } from '@/business-setup/hooks/useSetNextBusinessSetupStatus';
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
  align-items: center;
  color: ${({ theme }) => theme.font.color.secondary};
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
`;

export const BusinessSetupWelcome = () => {
  const { t } = useLingui();
  const navigate = useNavigate();
  const { setNextBusinessSetupStatus } = useSetNextBusinessSetupStatus();
  const { openBusinessSetupChat } = useBusinessSetupAIChat();

  const handleStartWithAI = () => {
    console.log('🎯 [Welcome] Starting Business Setup with AI...');
    console.log('🔍 [Welcome] openBusinessSetupChat function type:', typeof openBusinessSetupChat);
    
    try {
      openBusinessSetupChat();
      console.log('✅ [Welcome] AI chat function called successfully');
    } catch (error) {
      console.error('❌ [Welcome] Error starting AI chat:', error);
    }
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
            <span><span role="img" aria-label="rocket">🚀</span> Business Analysis - Analyze your industry and processes</span>
          </StyledFeatureItem>
          <StyledFeatureItem>
            <IconSparkles size={16} />
            <span><span role="img" aria-label="target">🎯</span> Sales Funnel Design - Create perfect conversion funnels</span>
          </StyledFeatureItem>
          <StyledFeatureItem>
            <IconSparkles size={16} />
            <span><span role="img" aria-label="robot">🤖</span> AI Agent Setup - Build specialized AI agents</span>
          </StyledFeatureItem>
          <StyledFeatureItem>
            <IconSparkles size={16} />
            <span><span role="img" aria-label="lightning">⚡</span> Workflow Automation - Design automated workflows</span>
          </StyledFeatureItem>
          <StyledFeatureItem>
            <IconSparkles size={16} />
            <span><span role="img" aria-label="team">👥</span> Team Assignment - Set up roles and permissions</span>
          </StyledFeatureItem>
          <StyledFeatureItem>
            <IconSparkles size={16} />
            <span><span role="img" aria-label="test tube">🧪</span> Testing & Optimization - Ensure everything works perfectly</span>
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
