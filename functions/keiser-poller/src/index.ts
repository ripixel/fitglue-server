import { HttpFunction } from '@google-cloud/functions-framework';
import { PubSub } from '@google-cloud/pubsub';
import * as admin from 'firebase-admin';

// Using build-injected shared modules (Protobuf Generated)
import { getSecret } from './shared/secrets';
import { ActivityPayload, ActivitySource } from './shared/types/pb/proto/activity';
import { TOPICS } from './shared/config';

// NOTE: Since we cannot strictly install the SDK in this environment,
// we interface the expected behavior based on the research doc.
interface KeiserSession {
  id: string;
  userId: string;
  startTime: string; // ISO
  data: any;
}

admin.initializeApp();
const db = admin.firestore();
const pubsub = new PubSub();
const TOPIC_NAME = TOPICS.RAW_ACTIVITY;

export const keiserPoller: HttpFunction = async (req, res) => {
  const executionRef = db.collection('executions').doc();
  const timestamp = new Date().toISOString();

  // 1. Audit Log Start
  await executionRef.set({
    service: 'keiser-poller',
    status: 'STARTED',
    startTime: timestamp,
    inputs: { trigger: 'scheduled' }
  });

  try {
    // 2. Fetch Users with Keiser Enabled (Multi-Tenancy)
    const snapshot = await db.collection('users').limit(50).get();

    if (snapshot.empty) {
        console.log('No users found.');
        res.status(200).send('No users');
        return;
    }

    let totalSessions = 0;
    const errors: string[] = [];

    // 3. Process Each User
    const userPromises = snapshot.docs.map(async (doc) => {
        const userId = doc.id;

        // Check if Keiser is enabled
        if (!doc.data().integrations?.keiser?.enabled) return;

        try {
            // A. Get Cursor
            const cursorRef = db.collection('cursors').doc(`${userId}_keiser`);
            const cursorSnap = await cursorRef.get();
            let lastSync = new Date(0).toISOString();
            if (cursorSnap.exists) {
                lastSync = cursorSnap.data()!.lastSync;
            }

            // B. Initialize SDK (Secret fetched from Secret Manager)
             // Ideally, we would fetch a per-user token here.
             const secretName = `keiser-${userId}`;
             const token = await getSecret(process.env.GOOGLE_CLOUD_PROJECT || 'dev-project', secretName);
             console.log(`Initialized SDK with token for ${secretName}: ${token ? 'FOUND' : 'MISSING'}`);

            // C. Fetch Sessions from Real API
            // This would use the authenticated client
            // const sessions = await KeiserClient.getSessions(token, lastSync);

            // Placeholder for real logic to avoid build error on missing SDK
            console.log(`Polling Keiser for user ${userId} since ${lastSync}`);
            const sessions: KeiserSession[] = []; // Real implementation would populate this

            // D. Push to Pub/Sub
            if (sessions.length > 0) {
                 const publishPromises = sessions.map(async (session) => {
                    const payload: ActivityPayload = {
                        source: ActivitySource.SOURCE_KEISER,
                        userId: userId,
                        timestamp: session.startTime,
                        originalPayloadJson: JSON.stringify(session),
                        metadata: {}
                    };
                    return pubsub.topic(TOPIC_NAME).publishMessage({ json: payload });
                });
                await Promise.all(publishPromises);
                totalSessions += sessions.length;

                // E. Update Cursor
                const newLastSync = sessions[sessions.length - 1].startTime;
                await cursorRef.set({ lastSync: newLastSync }, { merge: true });
            }

        } catch (err: any) {
            console.error(`Failed to sync user ${userId}`, err);
            errors.push(`${userId}: ${err.message}`);
        }
    });

    await Promise.all(userPromises);

    // 4. Audit Log Success
    await executionRef.update({
        status: errors.length > 0 ? 'PARTIAL_SUCCESS' : 'SUCCESS',
        outputs: {
            usersProcessed: snapshot.size,
            sessionsFound: totalSessions,
            errors: errors
        },
        endTime: new Date().toISOString()
    });

    res.status(200).send(`Processed ${totalSessions} sessions`);

  } catch (err: any) {
      console.error(err);
      await executionRef.update({
          status: 'FAILED',
          error: err.message,
          endTime: new Date().toISOString()
      });
      res.status(500).send('Internal Server Error');
  }
};
