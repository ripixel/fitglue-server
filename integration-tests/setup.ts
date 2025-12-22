import * as admin from 'firebase-admin';
import { config } from './config';

const PROJECT_ID = config.projectId;

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: PROJECT_ID,
  });
}

const db = admin.firestore();

export const setupTestUser = async (userId: string) => {
  console.log(`[Setup] Creating test user: ${userId}`);
  await db.collection('users').doc(userId).set({
    created_at: new Date(),
    strava_enabled: true,
    strava_access_token: 'valid_mock_token',
    strava_refresh_token: 'mock_refresh',
    strava_expires_at: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 3600000)),
  });
};
