import { ExecutionStore } from '../../storage/firestore';
import { ExecutionRecord } from '../../types/pb/execution';

/**
 * ExecutionService provides business logic for execution tracking.
 */
export class ExecutionService {
  constructor(private executionStore: ExecutionStore) { }

  /**
   * Create a new execution record.
   */
  async create(executionId: string, data: Partial<ExecutionRecord>): Promise<void> {
    return this.executionStore.create(executionId, data);
  }

  /**
   * Update an execution record.
   */
  async update(executionId: string, data: Partial<ExecutionRecord>): Promise<void> {
    return this.executionStore.update(executionId, data);
  }

  /**
   * Get an execution by ID.
   */
  async get(executionId: string): Promise<ExecutionRecord | null> {
    return this.executionStore.get(executionId);
  }
}
