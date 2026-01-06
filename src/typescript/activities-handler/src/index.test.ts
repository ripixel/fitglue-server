import { handler } from './index';
import { CloudEventPublisher } from '@fitglue/shared';

// Mock shared dependencies
jest.mock('@fitglue/shared', () => {
  const original = jest.requireActual('@fitglue/shared');
  return {
    ...original,
    CloudEventPublisher: jest.fn(),
  };
});

describe('activities-handler', () => {
  let res: any;
  let ctx: any;
  let mockPublish: any;

  beforeEach(() => {
    mockPublish = jest.fn();
    (CloudEventPublisher as any).mockImplementation(() => ({
      publish: mockPublish
    }));

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
      pubsub: {}, // Mock pubsub object (CloudEventPublisher uses it, but we mocked the class)
      services: {},
      stores: {
        activities: {
          countSynchronized: jest.fn(),
          listSynchronized: jest.fn(),
          getSynchronized: jest.fn(),
        },
      }
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET', () => {
    it('/ returns 401 if no user', async () => {
      ctx.userId = undefined;
      await handler(({
        method: 'GET',
        body: {},
        query: {},
        path: '',
      } as any), res, ctx);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('/ returns list of synchronized activities', async () => {
      ctx.stores.activities.listSynchronized.mockResolvedValue([{
        activityId: 'a1',
        title: 'Activity 1',
        description: 'Description 1',
        type: 5, // ACTIVITY_TYPE_CROSSFIT
        source: 'SOURCE_HEVY',
      }]);

      await handler(({
        method: 'GET',
        body: {},
        query: {},
        path: '',
      } as any), res, ctx);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        activities: [{
          activityId: 'a1',
          title: 'Activity 1',
          description: 'Description 1',
          type: 'Crossfit',
          source: 'Hevy',
        }]
      });
    });

    it('/stats returns a count of', async () => {
      ctx.stores.activities.countSynchronized.mockResolvedValue(1);

      await handler(({
        method: 'GET',
        body: {},
        query: {},
        path: '/stats',
      } as any), res, ctx);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ synchronizedCount: 1 });
    });

    it('/:id returns single activity', async () => {
      const activity = {
        activityId: 'a1',
        title: 'Activity 1',
        description: 'Description 1',
        type: 46, // ACTIVITY_TYPE_WEIGHT_TRAINING
        source: 'SOURCE_FITBIT',
      }
      ctx.stores.activities.getSynchronized.mockResolvedValue(activity);

      await handler(({
        method: 'GET',
        body: {},
        query: {},
        path: '/a1',
      } as any), res, ctx);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        activity: {
          activityId: 'a1',
          title: 'Activity 1',
          description: 'Description 1',
          type: 'Weight Training',
          source: 'Fitbit',
        }
      });
    });

    it('handles errors', async () => {
      ctx.stores.activities.listSynchronized.mockRejectedValue(new Error('db error'));
      await handler(({
        method: 'GET',
        body: {},
        query: {},
        path: '',
      } as any), res, ctx);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});
