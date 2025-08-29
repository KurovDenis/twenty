import { Test, type TestingModule } from '@nestjs/testing';

import { UserVarsService } from '../user/user-vars/services/user-vars.service';
import { OnboardingService } from '../onboarding/onboarding.service';
import { OnboardingStatus } from '../onboarding/enums/onboarding-status.enum';

import { BusinessSetupService } from './business-setup.service';

import { BusinessSetupStatus } from './enums/business-setup-status.enum';

describe('BusinessSetupService', () => {
  let service: BusinessSetupService;
  let mockUserVarsService: jest.Mocked<UserVarsService>;
  let mockOnboardingService: jest.Mocked<OnboardingService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BusinessSetupService,
        {
          provide: UserVarsService,
          useValue: {
            getAll: jest.fn(),
            set: jest.fn(),
          },
        },
        {
          provide: OnboardingService,
          useValue: {
            getOnboardingStatus: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<BusinessSetupService>(BusinessSetupService);
    mockUserVarsService = module.get(UserVarsService);
    mockOnboardingService = module.get(OnboardingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getBusinessSetupStatus', () => {
    it('should return WELCOME when onboarding is not completed', async () => {
      const user = { id: 'user-1' } as any;
      const workspace = { id: 'workspace-1' } as any;

      mockOnboardingService.getOnboardingStatus.mockResolvedValue(
        OnboardingStatus.PROFILE_CREATION,
      );

      const result = await service.getBusinessSetupStatus(user, workspace);

      expect(result).toBe(BusinessSetupStatus.WELCOME);
    });

    it('should return WELCOME when welcome is pending', async () => {
      const user = { id: 'user-1' } as any;
      const workspace = { id: 'workspace-1' } as any;

      mockOnboardingService.getOnboardingStatus.mockResolvedValue(
        OnboardingStatus.COMPLETED,
      );
      mockUserVarsService.getAll.mockResolvedValue(
        new Map([['BUSINESS_SETUP_WELCOME_PENDING', true]]),
      );

      const result = await service.getBusinessSetupStatus(user, workspace);

      expect(result).toBe(BusinessSetupStatus.WELCOME);
    });

    it('should return BUSINESS_ANALYSIS when business analysis is pending', async () => {
      const user = { id: 'user-1' } as any;
      const workspace = { id: 'workspace-1' } as any;

      mockOnboardingService.getOnboardingStatus.mockResolvedValue(
        OnboardingStatus.COMPLETED,
      );
      mockUserVarsService.getAll.mockResolvedValue(
        new Map([['BUSINESS_SETUP_BUSINESS_ANALYSIS_PENDING', true]]),
      );

      const result = await service.getBusinessSetupStatus(user, workspace);

      expect(result).toBe(BusinessSetupStatus.BUSINESS_ANALYSIS);
    });

    it('should return COMPLETED when no steps are pending', async () => {
      const user = { id: 'user-1' } as any;
      const workspace = { id: 'workspace-1' } as any;

      mockOnboardingService.getOnboardingStatus.mockResolvedValue(
        OnboardingStatus.COMPLETED,
      );
      mockUserVarsService.getAll.mockResolvedValue(new Map());

      const result = await service.getBusinessSetupStatus(user, workspace);

      expect(result).toBe(BusinessSetupStatus.COMPLETED);
    });
  });

  describe('setBusinessSetupStatus', () => {
    it('should set welcome status correctly', async () => {
      const userId = 'user-1';
      const workspaceId = 'workspace-1';

      mockUserVarsService.set.mockResolvedValue(undefined);

      await service.setBusinessSetupStatus(
        userId,
        workspaceId,
        BusinessSetupStatus.WELCOME,
      );

      expect(mockUserVarsService.set).toHaveBeenCalledWith({
        userId,
        workspaceId,
        key: 'BUSINESS_SETUP_WELCOME_PENDING',
        value: true,
      });
    });

    it('should set business analysis status correctly', async () => {
      const userId = 'user-1';
      const workspaceId = 'workspace-1';

      mockUserVarsService.set.mockResolvedValue(undefined);

      await service.setBusinessSetupStatus(
        userId,
        workspaceId,
        BusinessSetupStatus.BUSINESS_ANALYSIS,
      );

      expect(mockUserVarsService.set).toHaveBeenCalledWith({
        userId,
        workspaceId,
        key: 'BUSINESS_SETUP_BUSINESS_ANALYSIS_PENDING',
        value: true,
      });
    });
  });
});
