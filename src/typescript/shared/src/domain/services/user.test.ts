
import { UserService } from './user';
import { UserStore, ActivityStore } from '../../storage/firestore';

// Mock Stores
const mockUserStore = {
  get: jest.fn(),
  update: jest.fn(),
  findByFitbitId: jest.fn(),
  collection: jest.fn()
} as unknown as UserStore;

const mockActivityStore = {
  isProcessed: jest.fn(),
  markProcessed: jest.fn()
} as unknown as ActivityStore;

describe('UserService', () => {
  let userService: UserService;

  beforeEach(() => {
    jest.clearAllMocks();
    userService = new UserService(mockUserStore, mockActivityStore);
  });

  describe('getValidToken', () => {
    it('should return token if valid', async () => {
      const userId = 'user-1';
      (mockUserStore.get as jest.Mock).mockResolvedValue({
        integrations: {
          fitbit: {
            enabled: true,
            accessToken: 'valid-token',
            expiresAt: new Date(Date.now() + 10000)
          }
        }
      });

      const token = await userService.getValidToken(userId, 'fitbit');
      expect(token).toBe('valid-token');
    });

    it('should throw if token expired', async () => {
      const userId = 'user-1';
      (mockUserStore.get as jest.Mock).mockResolvedValue({
        integrations: {
          fitbit: {
            enabled: true,
            accessToken: 'expired-token',
            expiresAt: new Date(Date.now() - 10000)
          }
        }
      });

      await expect(userService.getValidToken(userId, 'fitbit'))
        .rejects.toThrow(/Token expired/);
    });
  });

  describe('Activity Processing', () => {
    it('should check if activity is processed', async () => {
      await userService.hasProcessedActivity('u1', 'fitbit', 'a1');
      expect(mockActivityStore.isProcessed).toHaveBeenCalledWith('u1', 'fitbit_a1');
    });

    it('should mark activity as processed', async () => {
      const now = new Date();

      await userService.markActivityAsProcessed('u1', 'fitbit', 'a1', { processedAt: now, source: 'fitbit', externalId: 'ext-1' });
      expect(mockActivityStore.markProcessed).toHaveBeenCalledWith('u1', 'fitbit_a1', { processedAt: now, source: 'fitbit', externalId: 'ext-1' });
    });
  });
});
