import { useMutation } from '@apollo/client';
import { RESET_ONBOARDING_STATUS } from '../graphql/mutations';

export const useResetOnboarding = () => {
  const [resetOnboarding, { loading, error }] = useMutation(
    RESET_ONBOARDING_STATUS,
  );

  const resetToProfileCreation = async () => {
    try {
      const result = await resetOnboarding();
      console.log('Onboarding reset to PROFILE_CREATION:', result);
      return result.data?.resetOnboardingStatus?.success;
    } catch (err) {
      console.error('Failed to reset onboarding:', err);
      throw err;
    }
  };

  return {
    resetToProfileCreation,
    loading,
    error,
  };
};
