import { BusinessSetupStatus } from '@/business-setup/hooks/useSetNextBusinessSetupStatus';
import { createState } from 'twenty-ui/utilities';
import { User } from '~/generated/graphql';

export type CurrentUser = Pick<
  User,
  | 'id'
  | 'email'
  | 'supportUserHash'
  | 'canAccessFullAdminPanel'
  | 'canImpersonate'
  | 'onboardingStatus'
  | 'userVars'
  | 'firstName'
  | 'lastName'
> & {
  businessSetupStatus?: BusinessSetupStatus | null;
};

export const currentUserState = createState<CurrentUser | null>({
  key: 'currentUserState',
  defaultValue: null,
});
