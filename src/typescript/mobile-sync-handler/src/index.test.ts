import { handler } from './index';
import { db } from '@fitglue/shared';

// Mock shared dependencies
jest.mock('@fitglue/shared', () => {
  const original = jest.requireActual('@fitglue/shared');
  return {
    ...original,
    db: {
      collection: jest.fn(),
    },
  };
});

describe('mobile-sync-handler', () => {
  let res: any;
  let ctx: any;
  let mockMobileActivitiesCollection: any;
  let mockDocRef: any;

  beforeEach(() => {
    mockDocRef = {
      set: jest.fn().mockResolvedValue(undefined),
    };
    mockMobileActivitiesCollection = {
      doc: jest.fn().mockReturnValue(mockDocRef),
    };

    (db.collection as jest.Mock).mockReturnValue(mockMobileActivitiesCollection);

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      send: jest.fn(),
    };

    ctx = {
      userId: 'user-1',
      logger: {
        info: jest.fn(),
        error: jest.fn(),
      },
      stores: {
        users: {
          get: jest.fn().mockResolvedValue({ id: 'user-1' }),
        },
      },
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 if no user', async () => {
    ctx.userId = undefined;
    await handler(({
      method: 'POST',
      body: { activities: [] },
    } as any), res, ctx);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 405 if not POST', async () => {
    await handler(({
      method: 'GET',
    } as any), res, ctx);
    expect(res.status).toHaveBeenCalledWith(405);
  });

  it('returns 400 if activities missing', async () => {
    await handler(({
      method: 'POST',
      body: {},
    } as any), res, ctx);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 404 if user not found', async () => {
    ctx.stores.users.get.mockResolvedValue(null);
    await handler(({
      method: 'POST',
      body: { activities: [] },
    } as any), res, ctx);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('processes activities successfully', async () => {
    const activities = [
      {
        externalId: 'ext-1',
        source: 'healthkit',
        activityName: 'Running',
        startTime: '2026-01-01T12:00:00Z',
        endTime: '2026-01-01T12:30:00Z',
        duration: 1800,
        calories: 300,
        distance: 5000,
      },
      {
        source: 'health_connect',
        activityName: 'WeightTraining',
        startTime: '2026-01-01T13:00:00Z',
        endTime: '2026-01-01T14:00:00Z',
        duration: 3600,
      }
    ];

    await handler(({
      method: 'POST',
      body: { activities, device: { platform: 'ios' } },
    } as any), res, ctx);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      processedCount: 2,
      skippedCount: 0,
    }));

    expect(mockMobileActivitiesCollection.doc).toHaveBeenCalledWith('ext-1');
    expect(mockMobileActivitiesCollection.doc).toHaveBeenCalledWith(expect.stringContaining('health_connect-'));
    expect(mockDocRef.set).toHaveBeenCalledTimes(2);

    // Verify mapping
    const firstCallData = mockDocRef.set.mock.calls[0][0];
    expect(firstCallData.source).toBe('SOURCE_APPLE_HEALTH');
    expect(firstCallData.activityType).toBe('Run');

    const secondCallData = mockDocRef.set.mock.calls[1][0];
    expect(secondCallData.source).toBe('SOURCE_HEALTH_CONNECT');
    expect(secondCallData.activityType).toBe('WeightTraining');
  });

  it('handles individual activity processing errors', async () => {
    mockDocRef.set.mockRejectedValueOnce(new Error('firestore error'));

    const activities = [
      {
        externalId: 'ext-1',
        source: 'healthkit',
        activityName: 'Running',
        startTime: '2026-01-01T12:00:00Z',
        endTime: '2026-01-01T12:30:00Z',
        duration: 1800,
      },
      {
        externalId: 'ext-2',
        source: 'health_connect',
        activityName: 'WeightTraining',
        startTime: '2026-01-01T13:00:00Z',
        endTime: '2026-01-01T14:00:00Z',
        duration: 3600,
      }
    ];

    await handler(({
      method: 'POST',
      body: { activities },
    } as any), res, ctx);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      processedCount: 1,
      skippedCount: 1,
    }));
  });
});
