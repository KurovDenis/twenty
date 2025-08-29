import { Test, type TestingModule } from '@nestjs/testing';

import { BusinessSetupResolver } from './business-setup.resolver';
import { BusinessSetupService } from './business-setup.service';

import { BusinessSetupStatus } from './enums/business-setup-status.enum';

describe('BusinessSetupResolver', () => {
  let resolver: BusinessSetupResolver;
  let mockBusinessSetupService: jest.Mocked<BusinessSetupService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BusinessSetupResolver,
        {
          provide: BusinessSetupService,
          useValue: {
            getBusinessSetupStatus: jest.fn(),
            setBusinessSetupStatus: jest.fn(),
          },
        },
      ],
    }).compile();

    resolver = module.get<BusinessSetupResolver>(BusinessSetupResolver);
    mockBusinessSetupService = module.get(BusinessSetupService);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });

  describe('getBusinessSetupStatus', () => {
    it('should return business setup status', async () => {
      const user = { id: 'user-1' } as any;
      const workspace = { id: 'workspace-1' } as any;
      const expectedStatus = BusinessSetupStatus.WELCOME;

      mockBusinessSetupService.getBusinessSetupStatus.mockResolvedValue(
        expectedStatus,
      );

      const result = await resolver.getBusinessSetupStatus(user, workspace);

      expect(result).toBe(expectedStatus);
      expect(
        mockBusinessSetupService.getBusinessSetupStatus,
      ).toHaveBeenCalledWith(user, workspace);
    });
  });

  describe('setBusinessSetupStatus', () => {
    it('should set business setup status and return true', async () => {
      const user = { id: 'user-1' } as any;
      const workspace = { id: 'workspace-1' } as any;
      const status = BusinessSetupStatus.BUSINESS_ANALYSIS;

      mockBusinessSetupService.setBusinessSetupStatus.mockResolvedValue(
        undefined,
      );

      const result = await resolver.setBusinessSetupStatus(
        user,
        workspace,
        status,
      );

      expect(result).toBe(true);
      expect(
        mockBusinessSetupService.setBusinessSetupStatus,
      ).toHaveBeenCalledWith(user.id, workspace.id, status);
    });
  });
});
