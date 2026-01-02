import * as admin from 'firebase-admin';
import * as converters from './converters';

/**
 * IntegrationIdentityStore provides typed access to integration identity mapping operations.
 */
export class IntegrationIdentityStore {
  constructor(private db: admin.firestore.Firestore) { }

  /**
   * Get the integration identities collection for a specific provider.
   */
  private collection(provider: string) {
    return this.db.collection('integrations').doc(provider).collection('ids').withConverter(converters.integrationIdentityConverter);
  }

  /**
   * Find a user ID by external ID for a given provider.
   */
  async findUserByExternalId(provider: string, externalId: string): Promise<string | null> {
    const doc = await this.collection(provider).doc(externalId).get();
    if (!doc.exists) {
      return null;
    }
    const data = doc.data();
    return data?.userId || null;
  }

  /**
   * Map an external ID to a user ID.
   */
  async mapIdentity(provider: string, externalId: string, userId: string): Promise<void> {
    await this.collection(provider).doc(externalId).set({
      userId,
      createdAt: new Date()
    });
  }
}
