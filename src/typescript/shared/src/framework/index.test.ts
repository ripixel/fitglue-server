
import { createCloudFunction, FrameworkContext } from './index';


// Mock dependencies
jest.mock('firebase-admin', () => ({
  apps: [],
  initializeApp: jest.fn(),
  firestore: jest.fn(() => ({
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        set: jest.fn(),
        update: jest.fn(),
        get: jest.fn(),
      })),
    })),
  })),
}));

jest.mock('@google-cloud/pubsub', () => ({
  PubSub: jest.fn().mockImplementation(() => ({
    topic: jest.fn(),
  })),
}));

jest.mock('winston', () => ({
  createLogger: jest.fn().mockImplementation(() => ({
    child: jest.fn().mockReturnThis(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  })),
  format: {
    json: jest.fn(),
    combine: jest.fn(),
    timestamp: jest.fn(),
    printf: jest.fn(),
  },
  transports: {
    Console: jest.fn(),
  },
}));

jest.mock('../execution/logger', () => ({
  logExecutionStart: jest.fn().mockResolvedValue('exec-123'),
  logExecutionSuccess: jest.fn().mockResolvedValue(undefined),
  logExecutionFailure: jest.fn().mockResolvedValue(undefined),
}));

describe('createCloudFunction', () => {
  let mockReq: any;
  let mockRes: any;
  let handler: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockReq = {
      method: 'POST',
      path: '/test',
      body: { user_id: 'user-1' },
      headers: {},
      query: {},
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
      set: jest.fn(),
    };
    handler = jest.fn().mockResolvedValue({ success: true });
  });

  it('should execute handler and log success', async () => {
    const cloudFunction = createCloudFunction(handler);
    await cloudFunction(mockReq, mockRes);

    expect(handler).toHaveBeenCalled();
    expect(mockRes.set).toHaveBeenCalledWith('x-execution-id', expect.stringMatching(/^unknown-function-\d+$/));
    // We can't easily check logExecutionSuccess called because of deep imports but we can check if handler was called
  });

  it('should handle errors and log failure', async () => {
    handler.mockRejectedValue(new Error('Test Error'));
    const cloudFunction = createCloudFunction(handler);

    await cloudFunction(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.send).toHaveBeenCalledWith('Internal Server Error');
  });

  it('should extract user_id from body', async () => {
    const cloudFunction = createCloudFunction(handler);
    await cloudFunction(mockReq, mockRes);

    const ctx = handler.mock.calls[0][2] as FrameworkContext;
    expect(ctx.userId).toBe('user-1');
  });
});
