import { AIChatTab } from '@/ai/components/AIChatTab';
import { currentWorkspaceState } from '@/auth/states/currentWorkspaceState';
import { commandMenuPageInfoState } from '@/command-menu/states/commandMenuPageInfoState';
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
  const currentWorkspace = useRecoilValue(currentWorkspaceState);
  const commandMenuPageInfo = useRecoilValue(commandMenuPageInfoState);
  
  // Get agentId from command menu pageId first, then fall back to default agent
  const commandMenuAgentId = commandMenuPageInfo?.instanceId;
  const defaultAgentId = currentWorkspace?.defaultAgent?.id;
  const agentId = commandMenuAgentId || defaultAgentId;
  
  console.log('=== CommandMenuAskAIPage ===');
  console.log('Command menu pageId (agentId):', commandMenuAgentId);
  console.log('Default agentId:', defaultAgentId);
  console.log('Final agentId:', agentId);

  if (!agentId) {
    return (
      <StyledContainer>
        <StyledEmptyState>No AI Agent found.</StyledEmptyState>
      </StyledContainer>
    );
  }

  return (
    <StyledContainer>
      <AIChatTab agentId={agentId} />
    </StyledContainer>
  );
};
