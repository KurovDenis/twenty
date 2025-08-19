import { useIsLogged } from '@/auth/hooks/useIsLogged';
import { currentUserState } from '@/auth/states/currentUserState';
import { useRecoilValue } from 'recoil';
import { BUSINESS_SETUP_STATUS, type BusinessSetupStatus } from './useSetNextBusinessSetupStatus';

export const useBusinessSetupStatus = (): BusinessSetupStatus | null | undefined => {
  const currentUser = useRecoilValue(currentUserState);
  const isLoggedIn = useIsLogged();
  // Временно возвращаем WELCOME для тестирования
  return isLoggedIn ? BUSINESS_SETUP_STATUS.WELCOME : undefined;
};
