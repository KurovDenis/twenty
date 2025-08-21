import { useIsLogged } from '@/auth/hooks/useIsLogged';
import {
  BUSINESS_SETUP_STATUS,
  type BusinessSetupStatus,
} from './useSetNextBusinessSetupStatus';

export const useBusinessSetupStatus = ():
  | BusinessSetupStatus
  | null
  | undefined => {
  const isLoggedIn = useIsLogged();
  // Временно возвращаем WELCOME для тестирования
  return isLoggedIn ? BUSINESS_SETUP_STATUS.WELCOME : undefined;
};
