import { ActivityStore } from '../../storage/firestore';

/**
 * ActivityService provides business logic for activity operations.
 */
export class ActivityService {
  constructor(private activityStore: ActivityStore) { }

  /**
   * Check if an activity has been processed.
   */
  async hasProcessed(userId: string, activityId: string): Promise<boolean> {
    return this.activityStore.isProcessed(userId, activityId);
  }

  /**
   * Mark an activity as processed.
   */
  async markProcessed(userId: string, activityId: string, metadata: { processedAt: Date; source: number }): Promise<void> {
    return this.activityStore.markProcessed(userId, activityId, metadata);
  }
}
