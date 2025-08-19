import { currentUserState } from '@/auth/states/currentUserState';
import { useCallback } from 'react';
import { useRecoilValue, useSetRecoilState } from 'recoil';

// Business setup status constants
export const BUSINESS_SETUP_STATUS = {
  WELCOME: 'WELCOME',
  BUSINESS_ANALYSIS: 'BUSINESS_ANALYSIS',
  SALES_FUNNEL_DESIGN: 'SALES_FUNNEL_DESIGN',
  AGENT_SETUP: 'AGENT_SETUP',
  WORKFLOW_CREATION: 'WORKFLOW_CREATION',
  TEAM_ASSIGNMENT: 'TEAM_ASSIGNMENT',
  TESTING_OPTIMIZATION: 'TESTING_OPTIMIZATION',
  COMPLETED: 'COMPLETED',
} as const;

// Business setup status type
export type BusinessSetupStatus =
  (typeof BUSINESS_SETUP_STATUS)[keyof typeof BUSINESS_SETUP_STATUS];

export const useSetNextBusinessSetupStatus = () => {
  const setCurrentUser = useSetRecoilState(currentUserState);
  const currentUser = useRecoilValue(currentUserState);

  const setNextBusinessSetupStatus = useCallback(async () => {
    if (!currentUser) return;

    const nextStatus = getNextBusinessSetupStatus(
      BUSINESS_SETUP_STATUS.WELCOME,
    ); // Временно используем WELCOME

    if (nextStatus !== null) {
      try {
        // Временно просто обновляем локальное состояние
        setCurrentUser((prev) =>
          prev ? { ...prev, businessSetupStatus: nextStatus } : null,
        );
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to set next business setup status:', error);
      }
    }
  }, [currentUser, setCurrentUser]);

  return { setNextBusinessSetupStatus };
};

const getNextBusinessSetupStatus = (
  currentStatus: BusinessSetupStatus | null | undefined,
): BusinessSetupStatus | null => {
  if (!currentStatus) return null;

  switch (currentStatus) {
    case BUSINESS_SETUP_STATUS.WELCOME:
      return BUSINESS_SETUP_STATUS.BUSINESS_ANALYSIS;
    case BUSINESS_SETUP_STATUS.BUSINESS_ANALYSIS:
      return BUSINESS_SETUP_STATUS.SALES_FUNNEL_DESIGN;
    case BUSINESS_SETUP_STATUS.SALES_FUNNEL_DESIGN:
      return BUSINESS_SETUP_STATUS.AGENT_SETUP;
    case BUSINESS_SETUP_STATUS.AGENT_SETUP:
      return BUSINESS_SETUP_STATUS.WORKFLOW_CREATION;
    case BUSINESS_SETUP_STATUS.WORKFLOW_CREATION:
      return BUSINESS_SETUP_STATUS.TEAM_ASSIGNMENT;
    case BUSINESS_SETUP_STATUS.TEAM_ASSIGNMENT:
      return BUSINESS_SETUP_STATUS.TESTING_OPTIMIZATION;
    case BUSINESS_SETUP_STATUS.TESTING_OPTIMIZATION:
      return BUSINESS_SETUP_STATUS.COMPLETED;
    default:
      return null;
  }
};
