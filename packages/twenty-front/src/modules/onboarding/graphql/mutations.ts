import { gql } from '@apollo/client';

export const RESET_ONBOARDING_STATUS = gql`
  mutation ResetOnboardingStatus {
    resetOnboardingStatus {
      success
    }
  }
`;
