import { useRecoilValue } from 'recoil';
import { useFindManyAgentsQuery } from '@/modules/ai/graphql/queries/findManyAgents';
import { currentWorkspaceState } from '@/auth/states/currentWorkspaceState';
import { useShouldShowWelcomeAgent } from './useShouldShowWelcomeAgent';

export const useSmartAgentSelection = () => {
  const currentWorkspace = useRecoilValue(currentWorkspaceState);
  const { shouldShowWelcomeAgent } = useShouldShowWelcomeAgent();
  
  // Находим Welcome Agent
  const { data: welcomeAgent } = useFindManyAgentsQuery({
    variables: { 
      filter: { 
        agentType: { eq: 'langgraph' },
        name: { eq: 'Welcome Agent' }
      } 
    },
  });
  
  // Умный выбор оптимального агента
  const getOptimalAgentId = () => {
    // Если нужно показать Welcome Agent и он найден
    if (shouldShowWelcomeAgent && welcomeAgent?.length) {
      return welcomeAgent[0].id;
    }
    
    // Иначе возвращаем стандартный агент workspace
    return currentWorkspace?.defaultAgent?.id;
  };
  
  // Определяем, является ли текущий агент Welcome Agent
  const isWelcomeAgent = shouldShowWelcomeAgent && welcomeAgent?.length;
  
  // Получаем текущий agentId
  const currentAgentId = getOptimalAgentId();
  
  return { 
    getOptimalAgentId,
    isWelcomeAgent,
    currentAgentId,
    welcomeAgent: welcomeAgent?.[0],
    defaultAgent: currentWorkspace?.defaultAgent,
    debug: {
      shouldShowWelcomeAgent,
      welcomeAgentFound: !!welcomeAgent?.length,
      defaultAgentId: currentWorkspace?.defaultAgent?.id,
    }
  };
};
