import * as admin from 'firebase-admin';
import * as converters from './converters';
import { ExecutionRecord } from '../../types/pb/execution';

/**
 * ExecutionStore provides typed access to execution-related Firestore operations.
 */
export class ExecutionStore {
  constructor(private db: admin.firestore.Firestore) { }

  /**
   * Get the executions collection reference.
   */
  private collection() {
    return this.db.collection('executions').withConverter(converters.executionConverter);
  }

  /**
   * Create a new execution record.
   */
  async create(executionId: string, data: Partial<ExecutionRecord>): Promise<void> {
    await this.collection().doc(executionId).set(data as ExecutionRecord);
  }

  /**
   * Update an execution record.
   */
  async update(executionId: string, data: Partial<ExecutionRecord>): Promise<void> {
    await this.collection().doc(executionId).update(data);
  }

  /**
   * Get an execution by ID.
   */
  async get(executionId: string): Promise<ExecutionRecord | null> {
    const doc = await this.collection().doc(executionId).get();
    if (!doc.exists) {
      return null;
    }
    return doc.data() || null;
  }
}
