import { useCallback } from 'react';
import { useRecoilValue, useRecoilState, atom } from 'recoil';
import { useIsFeatureEnabled } from '@/workspace/hooks/useIsFeatureEnabled';
import { currentWorkspaceState } from '@/auth/states/currentWorkspaceState';
import { FeatureFlagKey } from '~/generated/graphql';

// Recoil состояние для отслеживания сессий Welcome Agent
export const welcomeAgentSessionState = atom<{
  hasActiveSession: boolean;
  sessionStartTime?: Date;
  sessionEndTime?: Date;
  skipCount: number;
}>({
  key: 'welcomeAgentSessionState',
  default: {
    hasActiveSession: false,
    skipCount: 0,
  },
});

export const useShouldShowWelcomeAgent = () => {
  const currentWorkspace = useRecoilValue(currentWorkspaceState);
  const isAiEnabled = useIsFeatureEnabled(FeatureFlagKey.IS_AI_ENABLED);
  const [welcomeAgentSession, setWelcomeAgentSession] = useRecoilState(
    welcomeAgentSessionState
  );
  
  // Проверяем, является ли пользователь новым (менее 24 часов)
  const isNewUser = currentWorkspace?.createdAt 
    ? new Date().getTime() - new Date(currentWorkspace.createdAt).getTime() < 24 * 60 * 60 * 1000
    : false;

  // Проверяем активные сессии Welcome Agent
  const hasActiveWelcomeSession = welcomeAgentSession.hasActiveSession;

  // Основная логика: показывать Welcome Agent только если:
  // - AI включен
  // - Пользователь новый (менее 24 часов)
  // - Нет активных сессий Welcome Agent
  const shouldShowWelcomeAgent = isAiEnabled && isNewUser && !hasActiveWelcomeSession;

  // Функции для управления сессиями
  const startWelcomeAgentSession = useCallback(() => {
    setWelcomeAgentSession(prev => ({
      ...prev,
      hasActiveSession: true,
      sessionStartTime: new Date(),
    }));
  }, [setWelcomeAgentSession]);

  const endWelcomeAgentSession = useCallback(() => {
    setWelcomeAgentSession(prev => ({
      ...prev,
      hasActiveSession: false,
      sessionEndTime: new Date(),
      skipCount: prev.skipCount + 1,
    }));
  }, [setWelcomeAgentSession]);

  return {
    shouldShowWelcomeAgent,
    isNewUser,
    hasActiveWelcomeSession,
    startWelcomeAgentSession,
    endWelcomeAgentSession,
    sessionInfo: welcomeAgentSession,
    debug: {
      workspaceCreatedAt: currentWorkspace?.createdAt,
      timeSinceCreation: currentWorkspace?.createdAt 
        ? new Date().getTime() - new Date(currentWorkspace.createdAt).getTime()
        : null,
      isAiEnabled,
    }
  };
};
