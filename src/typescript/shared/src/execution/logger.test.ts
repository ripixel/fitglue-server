
import { logExecutionStart, logExecutionSuccess, logExecutionFailure } from './logger';


// Mock Firestore
const mockSet = jest.fn();
const mockUpdate = jest.fn();
const mockDoc = jest.fn(() => ({
  id: 'exec-123',
  set: mockSet,
  update: mockUpdate,
}));
const mockCollection = jest.fn(() => ({
  doc: mockDoc,
}));
const mockDb = {
  collection: mockCollection,
} as any;

describe('Execution Logger', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('logExecutionStart', () => {
    it('should create a new execution document', async () => {
      const id = await logExecutionStart(mockDb, 'test-service', { userId: 'user-1' });

      expect(id).toBe('exec-123');
      expect(mockCollection).toHaveBeenCalledWith('executions');
      expect(mockDoc).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({
        service: 'test-service',
        status: 'STATUS_STARTED',
        user_id: 'user-1'
      }));
    });
  });

  describe('logExecutionSuccess', () => {
    it('should update execution with success status', async () => {
      await logExecutionSuccess(mockDb, 'exec-123', { result: 'ok' });

      expect(mockDoc).toHaveBeenCalledWith('exec-123');
      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
        status: 'STATUS_SUCCESS',
        outputsJson: '{"result":"ok"}'
      }));
    });
  });

  describe('logExecutionFailure', () => {
    it('should update execution with failed status', async () => {
      await logExecutionFailure(mockDb, 'exec-123', new Error('oops'));

      expect(mockDoc).toHaveBeenCalledWith('exec-123');
      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
        status: 'STATUS_FAILED',
        errorMessage: 'oops'
      }));
    });
  });
});
