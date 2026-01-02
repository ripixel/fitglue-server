
import { fitbitWebhookHandler } from './index';

// Mock shared library
jest.mock('@fitglue/shared', () => {
  const originalModule = jest.requireActual('@fitglue/shared');
  return {
    ...originalModule,
    createCloudFunction: jest.fn().mockImplementation((handler) => handler),
    createWebhookProcessor: jest.fn().mockReturnValue((req: any, res: any, ctx: any) => Promise.resolve()),
  };
});

describe('fitbitWebhookHandler', () => {
  it('should be defined', () => {
    expect(fitbitWebhookHandler).toBeDefined();
  });

  it('should be created via createCloudFunction', () => {
    const { createCloudFunction } = require('@fitglue/shared');
    expect(createCloudFunction).toHaveBeenCalled();
  });
});
