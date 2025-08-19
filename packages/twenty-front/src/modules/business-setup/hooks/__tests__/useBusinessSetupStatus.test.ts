import { renderHook } from '@testing-library/react';
import { RecoilRoot, useRecoilValue } from 'recoil';
import { useBusinessSetupStatus } from '../useBusinessSetupStatus';
import { currentUserState } from '@/auth/states/currentUserState';
import { useIsLogged } from '@/auth/hooks/useIsLogged';

// Mock hooks
jest.mock('@/auth/hooks/useIsLogged');
jest.mock('recoil', () => ({
  ...jest.requireActual('recoil'),
  useRecoilValue: jest.fn(),
}));

const mockUseIsLogged = useIsLogged as jest.MockedFunction<typeof useIsLogged>;
const mockUseRecoilValue = useRecoilValue as jest.MockedFunction<typeof useRecoilValue>;

describe('useBusinessSetupStatus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return undefined when user is not logged in', () => {
    mockUseIsLogged.mockReturnValue(false);
    mockUseRecoilValue.mockReturnValue(null);

    const { result } = renderHook(() => useBusinessSetupStatus(), {
      wrapper: RecoilRoot,
    });

    expect(result.current).toBeUndefined();
  });

  it('should return business setup status when user is logged in', () => {
    mockUseIsLogged.mockReturnValue(true);
    mockUseRecoilValue.mockReturnValue({
      id: 'user-1',
      businessSetupStatus: 'WELCOME',
    } as any);

    const { result } = renderHook(() => useBusinessSetupStatus(), {
      wrapper: RecoilRoot,
    });

    expect(result.current).toBe('WELCOME');
  });

  it('should return null when user has no business setup status', () => {
    mockUseIsLogged.mockReturnValue(true);
    mockUseRecoilValue.mockReturnValue({
      id: 'user-1',
      businessSetupStatus: null,
    } as any);

    const { result } = renderHook(() => useBusinessSetupStatus(), {
      wrapper: RecoilRoot,
    });

    expect(result.current).toBeNull();
  });
});
