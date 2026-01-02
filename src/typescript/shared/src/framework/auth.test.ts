
import * as crypto from 'crypto';
import { ApiKeyStrategy } from './auth-strategies/api-key';
import { FrameworkContext } from './index';

// Mock Dependencies
const mockValidate = jest.fn();

const mockApiKeyService = {
  validate: mockValidate
} as any;

const mockLogger = {
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
} as any;

const mockCtx: FrameworkContext = {
  services: {
    apiKey: mockApiKeyService
  } as any,
  pubsub: {} as any,
  secrets: {} as any,
  logger: mockLogger,
  executionId: 'test-exec-id'
} as any;

describe('ApiKeyStrategy', () => {
  let strategy: ApiKeyStrategy;
  const testKey = 'fg_sk_test_key_123';
  const testHash = crypto.createHash('sha256').update(testKey).digest('hex');

  beforeEach(() => {
    strategy = new ApiKeyStrategy();
    jest.clearAllMocks();
  });

  it('should authenticate with Bearer token', async () => {
    const req = {
      headers: {
        'authorization': `Bearer ${testKey}`
      }
    };

    mockValidate.mockResolvedValueOnce({ valid: true, userId: 'user1', scopes: ['read'] });

    const result = await strategy.authenticate(req, mockCtx);

    expect(result).toEqual({ userId: 'user1', scopes: ['read'] });
    expect(mockValidate).toHaveBeenCalledWith(testHash);
  });

  it('should authenticate with Raw Authorization token (Hevy style)', async () => {
    const req = {
      headers: {
        'authorization': testKey // No "Bearer " prefix
      }
    };

    mockValidate.mockResolvedValueOnce({ valid: true, userId: 'user1', scopes: ['read'] });

    const result = await strategy.authenticate(req, mockCtx);

    expect(result).toEqual({ userId: 'user1', scopes: ['read'] });
    expect(mockValidate).toHaveBeenCalledWith(testHash);
  });

  it('should authenticate with X-Api-Key header', async () => {
    const req = {
      headers: {
        'x-api-key': testKey
      }
    };

    mockValidate.mockResolvedValueOnce({ valid: true, userId: 'user1', scopes: ['read'] });

    const result = await strategy.authenticate(req, mockCtx);
    expect(result).toEqual({ userId: 'user1', scopes: ['read'] });
  });

  it('should authenticate with query parameter', async () => {
    const req = {
      headers: {},
      query: {
        key: testKey
      }
    };

    mockValidate.mockResolvedValueOnce({ valid: true, userId: 'user1', scopes: ['read'] });

    const result = await strategy.authenticate(req, mockCtx);
    expect(result).toEqual({ userId: 'user1', scopes: ['read'] });
  });

  it('should return null if no token provided', async () => {
    const req = {
      headers: {},
      query: {}
    };

    const result = await strategy.authenticate(req, mockCtx);
    expect(result).toBeNull();
    expect(mockValidate).not.toHaveBeenCalled();
  });

  it('should return null if key not found (validate returns invalid)', async () => {
    const req = {
      headers: {
        'authorization': `Bearer ${testKey}`
      }
    };

    mockValidate.mockResolvedValueOnce({ valid: false });

    const result = await strategy.authenticate(req, mockCtx);
    expect(result).toBeNull();
    expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('API key not found'));
  });
});
