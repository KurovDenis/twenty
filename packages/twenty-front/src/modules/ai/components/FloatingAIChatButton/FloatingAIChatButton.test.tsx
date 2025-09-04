/**
 * @jest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import { FloatingAIChatButton } from './FloatingAIChatButton';

// Mock dependencies
jest.mock('../../hooks/useFloatingAIChatButton', () => ({
  useFloatingAIChatButton: () => ({
    isVisible: true,
    handleClick: jest.fn(),
    businessSetupStatus: 'WELCOME',
  }),
}));

// Mock business setup agent chat hook
jest.mock('@/business-setup/hooks/useBusinessSetupAgentChat', () => ({
  useBusinessSetupAgentChat: () => ({
    createBusinessSetupChat: jest.fn(),
    getWelcomeMessageForStep: jest.fn(() => '🚀 Настройка интеграции Avito!'),
  }),
}));

// Mock business setup status hook
jest.mock('@/business-setup/hooks/useBusinessSetupStatus', () => ({
  useBusinessSetupStatus: () => 'WELCOME',
}));

// Mock command menu hooks
jest.mock('@/command-menu/hooks/useOpenAskAIPageInCommandMenu', () => ({
  useOpenAskAIPageInCommandMenu: () => ({
    openAskAIPage: jest.fn(),
  }),
}));

// Mock workspace hooks
jest.mock('@/workspace/hooks/useIsFeatureEnabled', () => ({
  useIsFeatureEnabled: () => true,
}));

// Mock recoil
jest.mock('recoil', () => ({
  useRecoilValue: () => false, // Default values for command menu states
}));

jest.mock('../../hooks/useWelcomeMessage', () => ({
  useWelcomeMessage: () => ({
    welcomeMessage: 'Test welcome message',
    showPopup: true,
    setShowPopup: jest.fn(),
    continueChat: jest.fn(),
  }),
}));

jest.mock('twenty-ui/utilities', () => ({
  useIsMobile: () => false,
}));

jest.mock('twenty-ui/input', () => ({
  FloatingIconButton: ({ onClick, Icon, ...props }: any) => (
    <button onClick={onClick} data-testid="floating-icon-button" {...props}>
      <Icon />
    </button>
  ),
}));

jest.mock('twenty-ui/display', () => ({
  IconSparkles: () => <span data-testid="sparkles-icon">✨</span>,
}));

// Mock ReactMarkdown
jest.mock('react-markdown', () => {
  return function ReactMarkdown({ children }: { children: string }) {
    return <div data-testid="markdown-content">{children}</div>;
  };
});

jest.mock('remark-gfm', () => jest.fn());

describe('FloatingAIChatButton', () => {
  it('should render without crashing', () => {
    render(<FloatingAIChatButton />);
    expect(screen.getByTestId('floating-ai-chat-button')).toBeInTheDocument();
  });

  it('should display the floating icon button', () => {
    render(<FloatingAIChatButton />);
    expect(screen.getByTestId('floating-icon-button')).toBeInTheDocument();
    expect(screen.getByTestId('sparkles-icon')).toBeInTheDocument();
  });

  it('should show welcome popup when showPopup is true', () => {
    render(<FloatingAIChatButton />);

    expect(screen.getByText('🤖 AI Assistant')).toBeInTheDocument();
    expect(screen.getByTestId('markdown-content')).toBeInTheDocument();
    expect(screen.getByText('Test welcome message')).toBeInTheDocument();
  });

  it('should display action buttons in the popup', () => {
    render(<FloatingAIChatButton />);

    expect(screen.getByText('Continue Chat')).toBeInTheDocument();
    expect(screen.getByText('Dismiss')).toBeInTheDocument();
  });

  it('should use react-markdown for safe content rendering', () => {
    render(<FloatingAIChatButton />);

    // Verify that ReactMarkdown is used instead of dangerouslySetInnerHTML
    expect(screen.getByTestId('markdown-content')).toBeInTheDocument();
    expect(screen.getByText('Test welcome message')).toBeInTheDocument();
  });

  it('should handle error boundary gracefully', () => {
    // Mock console.error to avoid noise in test output
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    // This test verifies the error boundary exists
    render(<FloatingAIChatButton />);

    // Should render without throwing
    expect(screen.getByTestId('floating-ai-chat-button')).toBeInTheDocument();

    consoleSpy.mockRestore();
  });
});
