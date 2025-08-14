import { useRecoilValue } from 'recoil';
import { useOpenAskAIPageInCommandMenu } from '@/command-menu/hooks/useOpenAskAIPageInCommandMenu';
import { useIsFeatureEnabled } from '@/workspace/hooks/useIsFeatureEnabled';
import { FeatureFlagKey } from '~/generated/graphql';
import { isFloatingAIChatButtonVisibleState } from '../states/isFloatingAIChatButtonVisibleState';

export const useFloatingAIChatButton = () => {
  const isAiEnabled = useIsFeatureEnabled(FeatureFlagKey.IS_AI_ENABLED);
  const isVisible = useRecoilValue(isFloatingAIChatButtonVisibleState);
  const { openAskAIPage } = useOpenAskAIPageInCommandMenu();

  const handleClick = () => {
    openAskAIPage();
  };

  return {
    isVisible: isVisible && isAiEnabled,
    handleClick,
  };
};
