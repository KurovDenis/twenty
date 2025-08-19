import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { RecoilRoot } from 'recoil';
import { BusinessSetupWelcome } from '../BusinessSetupWelcome';
import { useSetNextBusinessSetupStatus } from '@/business-setup/hooks/useSetNextBusinessSetupStatus';
import { useOpenAskAIPageInCommandMenu } from '@/command-menu/hooks/useOpenAskAIPageInCommandMenu';

// Mock hooks
jest.mock('@/business-setup/hooks/useSetNextBusinessSetupStatus');
jest.mock('@/command-menu/hooks/useOpenAskAIPageInCommandMenu');

const mockUseSetNextBusinessSetupStatus =
  useSetNextBusinessSetupStatus as jest.MockedFunction<
    typeof useSetNextBusinessSetupStatus
  >;
const mockUseOpenAskAIPageInCommandMenu =
  useOpenAskAIPageInCommandMenu as jest.MockedFunction<
    typeof useOpenAskAIPageInCommandMenu
  >;

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

const renderComponent = () => {
  return render(
    <RecoilRoot>
      <BrowserRouter>
        <BusinessSetupWelcome />
      </BrowserRouter>
    </RecoilRoot>,
  );
};

describe('BusinessSetupWelcome', () => {
  beforeEach(() => {
    mockUseSetNextBusinessSetupStatus.mockReturnValue({
      setNextBusinessSetupStatus: jest.fn(),
    });
    mockUseOpenAskAIPageInCommandMenu.mockReturnValue({
      openAskAIPage: jest.fn(),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders welcome message', () => {
    renderComponent();

    expect(
      screen.getByText('Welcome to Business Setup Wizard!'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Let's create your fully automated business system together/,
      ),
    ).toBeInTheDocument();
  });

  it('renders feature list', () => {
    renderComponent();

    expect(screen.getByText(/🚀 Business Analysis/)).toBeInTheDocument();
    expect(screen.getByText(/🎯 Sales Funnel Design/)).toBeInTheDocument();
    expect(screen.getByText(/🤖 AI Agent Setup/)).toBeInTheDocument();
    expect(screen.getByText(/⚡ Workflow Automation/)).toBeInTheDocument();
    expect(screen.getByText(/👥 Team Assignment/)).toBeInTheDocument();
    expect(screen.getByText(/🧪 Testing & Optimization/)).toBeInTheDocument();
  });

  it('renders start with AI button', () => {
    renderComponent();

    expect(
      screen.getByRole('button', { name: /Start with AI Assistant/i }),
    ).toBeInTheDocument();
  });

  it('renders skip welcome button', () => {
    renderComponent();

    expect(
      screen.getByRole('button', { name: /Skip Welcome/i }),
    ).toBeInTheDocument();
  });

  it('calls openAskAIPage when start with AI button is clicked', () => {
    const mockOpenAskAIPage = jest.fn();
    mockUseOpenAskAIPageInCommandMenu.mockReturnValue({
      openAskAIPage: mockOpenAskAIPage,
    });

    renderComponent();

    const startButton = screen.getByRole('button', {
      name: /Start with AI Assistant/i,
    });
    fireEvent.click(startButton);

    expect(mockOpenAskAIPage).toHaveBeenCalledWith(
      "Let's set up your business automation!",
    );
  });

  it('calls setNextBusinessSetupStatus and navigates when skip button is clicked', async () => {
    const mockSetNextBusinessSetupStatus = jest.fn();
    mockUseSetNextBusinessSetupStatus.mockReturnValue({
      setNextBusinessSetupStatus: mockSetNextBusinessSetupStatus,
    });

    renderComponent();

    const skipButton = screen.getByRole('button', { name: /Skip Welcome/i });
    fireEvent.click(skipButton);

    expect(mockSetNextBusinessSetupStatus).toHaveBeenCalled();
  });
});
