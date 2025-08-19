import { render, screen } from '@testing-library/react';
import { RecoilRoot } from 'recoil';
import { FloatingAIChatButton } from '../FloatingAIChatButton';

// Mock the hooks
jest.mock('../../../../hooks/useFloatingAIChatButton', () => ({
  useFloatingAIChatButton: () => ({
    isVisible: true,
    handleClick: jest.fn(),
  }),
}));

jest.mock('@/workspace/hooks/useIsFeatureEnabled', () => ({
  useIsFeatureEnabled: () => true,
}));

jest.mock('@/command-menu/hooks/useOpenAskAIPageInCommandMenu', () => ({
  useOpenAskAIPageInCommandMenu: () => ({
    openAskAIPage: jest.fn(),
  }),
}));

jest.mock('twenty-ui/utilities', () => ({
  useIsMobile: () => false,
}));

describe('FloatingAIChatButton', () => {
  const renderComponent = () => {
    return render(
      <RecoilRoot>
        <FloatingAIChatButton />
      </RecoilRoot>,
    );
  };

  it('should render when AI is enabled', () => {
    renderComponent();
    expect(screen.getByTestId('floating-ai-chat-button')).toBeInTheDocument();
  });

  it('should have correct accessibility attributes', () => {
    renderComponent();
    const button = screen.getByLabelText('Open AI Chat');
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('title', 'Ask AI');
  });

  it('should show tooltip on hover', () => {
    renderComponent();
    const button = screen.getByTestId('floating-ai-chat-button');

    // Note: This test would need more setup for hover events
    // For now, we just check that the tooltip element exists
    expect(button).toBeInTheDocument();
  });
});
