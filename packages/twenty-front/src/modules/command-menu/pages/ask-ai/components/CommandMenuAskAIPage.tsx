import { currentWorkspaceState } from '@/auth/states/currentWorkspaceState';
import { AIChatTab } from '@/ai/components/AIChatTab';
import { useSmartAgentSelection } from '@/ai/hooks/useSmartAgentSelection';
import styled from '@emotion/styled';
import { useRecoilValue } from 'recoil';

const StyledContainer = styled.div`
  height: 100%;
  width: 100%;
`;

const StyledEmptyState = styled.div`
  align-items: center;
  color: ${({ theme }) => theme.font.color.secondary};
  display: flex;
  font-size: ${({ theme }) => theme.font.size.md};
  height: 100%;
  justify-content: center;
`;

export const CommandMenuAskAIPage = () => {
  const { getOptimalAgentId, isWelcomeAgent } = useSmartAgentSelection();
  const agentId = getOptimalAgentId();

  if (!agentId) {
    return (
      <StyledContainer>
        <StyledEmptyState>No AI Agent found.</StyledEmptyState>
      </StyledContainer>
    );
  }

  return (
    <StyledContainer>
      <AIChatTab 
        agentId={agentId}
        showWelcomeAgentUI={isWelcomeAgent}
      />
    </StyledContainer>
  );
};
