import { renderHook } from '@testing-library/react';
import { useBusinessSetupAgentChat } from '../useBusinessSetupAgentChat';

// Mock the dependencies
jest.mock('@/command-menu/hooks/useOpenAskAIPageInCommandMenu');
jest.mock('../useBusinessSetupStatus');

const mockOpenAskAIPage = jest.fn();
const mockUseBusinessSetupStatus = jest.fn();

// Setup mocks
beforeEach(() => {
  jest.clearAllMocks();
  
  require('@/command-menu/hooks/useOpenAskAIPageInCommandMenu').useOpenAskAIPageInCommandMenu = jest
    .fn()
    .mockReturnValue({
      openAskAIPage: mockOpenAskAIPage,
    });
  
  require('../useBusinessSetupStatus').useBusinessSetupStatus = mockUseBusinessSetupStatus;
});

describe('useBusinessSetupAgentChat', () => {
  describe('createBusinessSetupChat', () => {
    it('should create business setup chat with welcome message for WELCOME status', () => {
      mockUseBusinessSetupStatus.mockReturnValue('WELCOME');
      
      const { result } = renderHook(() => useBusinessSetupAgentChat());
      
      result.current.createBusinessSetupChat();
      
      expect(mockOpenAskAIPage).toHaveBeenCalledWith(
        expect.stringContaining('Welcome to Business Setup'),
      );
    });

    it('should create business setup chat with analysis message for BUSINESS_ANALYSIS status', () => {
      mockUseBusinessSetupStatus.mockReturnValue('BUSINESS_ANALYSIS');
      
      const { result } = renderHook(() => useBusinessSetupAgentChat());
      
      result.current.createBusinessSetupChat();
      
      expect(mockOpenAskAIPage).toHaveBeenCalledWith(
        expect.stringContaining('analyze your business'),
      );
    });

    it('should fallback to welcome message when status is null', () => {
      mockUseBusinessSetupStatus.mockReturnValue(null);
      
      const { result } = renderHook(() => useBusinessSetupAgentChat());
      
      result.current.createBusinessSetupChat();
      
      expect(mockOpenAskAIPage).toHaveBeenCalledWith(
        expect.stringContaining('Welcome to Business Setup'),
      );
    });

    it('should handle all business setup statuses correctly', () => {
      const testCases = [
        {
          status: 'WELCOME',
          expectedMessage: 'Welcome to Business Setup',
        },
        {
          status: 'BUSINESS_ANALYSIS',
          expectedMessage: 'analyze your business',
        },
        {
          status: 'SALES_FUNNEL_DESIGN',
          expectedMessage: 'design your sales funnel',
        },
        {
          status: 'AGENT_SETUP',
          expectedMessage: 'set up your AI agents',
        },
        {
          status: 'WORKFLOW_CREATION',
          expectedMessage: 'create workflows',
        },
        {
          status: 'TEAM_ASSIGNMENT',
          expectedMessage: 'assign your team',
        },
        {
          status: 'TESTING_OPTIMIZATION',
          expectedMessage: 'test and optimize',
        },
        {
          status: 'COMPLETED',
          expectedMessage: 'Congratulations',
        },
      ];

      testCases.forEach(({ status, expectedMessage }) => {
        mockUseBusinessSetupStatus.mockReturnValue(status);
        
        const { result } = renderHook(() => useBusinessSetupAgentChat());
        
        result.current.createBusinessSetupChat();
        
        expect(mockOpenAskAIPage).toHaveBeenCalledWith(
          expect.stringContaining(expectedMessage),
        );
        
        jest.clearAllMocks();
      });
    });
  });

  describe('getWelcomeMessageForStep', () => {
    it('should return correct welcome message for each step', () => {
      const { result } = renderHook(() => useBusinessSetupAgentChat());
      
      const welcomeMessage = result.current.getWelcomeMessageForStep('WELCOME');
      const analysisMessage = result.current.getWelcomeMessageForStep('BUSINESS_ANALYSIS');
      const funnelMessage = result.current.getWelcomeMessageForStep('SALES_FUNNEL_DESIGN');
      const agentMessage = result.current.getWelcomeMessageForStep('AGENT_SETUP');
      const workflowMessage = result.current.getWelcomeMessageForStep('WORKFLOW_CREATION');
      const teamMessage = result.current.getWelcomeMessageForStep('TEAM_ASSIGNMENT');
      const testingMessage = result.current.getWelcomeMessageForStep('TESTING_OPTIMIZATION');
      const completedMessage = result.current.getWelcomeMessageForStep('COMPLETED');
      
      expect(welcomeMessage).toContain('Welcome to Business Setup');
      expect(analysisMessage).toContain('analyze your business');
      expect(funnelMessage).toContain('design your sales funnel');
      expect(agentMessage).toContain('set up your AI agents');
      expect(workflowMessage).toContain('create workflows');
      expect(teamMessage).toContain('assign your team');
      expect(testingMessage).toContain('test and optimize');
      expect(completedMessage).toContain('Congratulations');
    });

    it('should return welcome message for unknown step', () => {
      const { result } = renderHook(() => useBusinessSetupAgentChat());
      
      const unknownMessage = result.current.getWelcomeMessageForStep('UNKNOWN_STEP' as any);
      
      expect(unknownMessage).toContain('Welcome to Business Setup');
    });

    it('should include appropriate emojis in messages', () => {
      const { result } = renderHook(() => useBusinessSetupAgentChat());
      
      const welcomeMessage = result.current.getWelcomeMessageForStep('WELCOME');
      const analysisMessage = result.current.getWelcomeMessageForStep('BUSINESS_ANALYSIS');
      const funnelMessage = result.current.getWelcomeMessageForStep('SALES_FUNNEL_DESIGN');
      
      expect(welcomeMessage).toContain('🎉');
      expect(analysisMessage).toContain('🚀');
      expect(funnelMessage).toContain('🎯');
    });
  });

  describe('hook integration', () => {
    it('should properly integrate with useBusinessSetupStatus hook', () => {
      mockUseBusinessSetupStatus.mockReturnValue('BUSINESS_ANALYSIS');
      
      renderHook(() => useBusinessSetupAgentChat());
      
      expect(mockUseBusinessSetupStatus).toHaveBeenCalled();
    });

    it('should properly integrate with useOpenAskAIPageInCommandMenu hook', () => {
      mockUseBusinessSetupStatus.mockReturnValue('WELCOME');
      
      const { result } = renderHook(() => useBusinessSetupAgentChat());
      
      result.current.createBusinessSetupChat();
      
      expect(mockOpenAskAIPage).toHaveBeenCalled();
    });
  });
});