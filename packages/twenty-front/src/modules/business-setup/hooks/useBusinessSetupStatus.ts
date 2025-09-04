import { currentUserState } from '@/auth/states/currentUserState';
import { useRecoilValue } from 'recoil';
import {
  BUSINESS_SETUP_STATUS,
  type BusinessSetupStatus,
} from './useSetNextBusinessSetupStatus';

export const useBusinessSetupStatus = ():
  | BusinessSetupStatus
  | null
  | undefined => {
  const currentUser = useRecoilValue(currentUserState);
  // Return businessSetupStatus from currentUser or default to WELCOME for new users
  return (
    currentUser?.businessSetupStatus ??
    (currentUser ? BUSINESS_SETUP_STATUS.WELCOME : undefined)
  );
};
