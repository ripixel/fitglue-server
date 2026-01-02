import * as admin from 'firebase-admin';
import * as converters from './converters';

/**
 * ActivityStore provides typed access to user activity operations.
 */
export class ActivityStore {
  constructor(private db: admin.firestore.Firestore) { }

  /**
   * Get the raw activities collection for a specific user.
   */
  private collection(userId: string) {
    return this.db.collection('users').doc(userId).collection('raw_activities').withConverter(converters.processedActivityConverter);
  }

  /**
   * Check if an activity has been processed.
   */
  async isProcessed(userId: string, activityId: string): Promise<boolean> {
    const doc = await this.collection(userId).doc(activityId).get();
    return doc.exists;
  }

  /**
   * Mark an activity as processed.
   */
  async markProcessed(userId: string, activityId: string, data: import('../../types/pb/user').ProcessedActivityRecord): Promise<void> {
    await this.collection(userId).doc(activityId).set(data);
  }

  /**
   * List processed activities for a user.
   */
  async list(userId: string, limit: number = 20): Promise<import('../../types/pb/user').ProcessedActivityRecord[]> {
    const snapshot = await this.collection(userId)
      .orderBy('processed_at', 'desc')
      .limit(limit)
      .get();

    return snapshot.docs.map(doc => doc.data());
  }

  /**
   * Delete a processed activity record.
   */
  async delete(userId: string, activityId: string): Promise<void> {
    await this.collection(userId).doc(activityId).delete();
  }
}
