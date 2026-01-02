import * as admin from 'firebase-admin';
import * as converters from './converters';
import { ApiKeyRecord } from '../../types/pb/auth';

/**
 * ApiKeyStore provides typed access to ingress API key operations.
 */
export class ApiKeyStore {
  constructor(private db: admin.firestore.Firestore) { }

  /**
   * Get the API keys collection reference.
   */
  private collection() {
    return this.db.collection('ingress_api_keys').withConverter(converters.apiKeyConverter);
  }

  /**
   * Find an API key by its hash.
   */
  async findByHash(hash: string): Promise<ApiKeyRecord | null> {
    const snapshot = await this.collection()
      .where('hash', '==', hash)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return null;
    }

    return snapshot.docs[0].data();
  }

  /**
   * Get an API key by ID.
   */
  async get(keyId: string): Promise<ApiKeyRecord | null> {
    const doc = await this.collection().doc(keyId).get();
    if (!doc.exists) {
      return null;
    }
    return doc.data() || null;
  }

  /**
   * Create an API key.
   */
  async create(record: ApiKeyRecord & { id?: string; hash?: string; enabled?: boolean }): Promise<void> {
    const { id, ...data } = record;
    if (id) {
      await this.collection().doc(id).set(data as any);
    } else {
      await this.collection().add(data as any);
    }
  }
}
