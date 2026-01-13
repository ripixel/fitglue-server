import * as functions from '@google-cloud/functions-framework';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp();
}

const COLLECTION = 'integration_requests';

// Canonical name aliases for fuzzy matching
const INTEGRATION_ALIASES: Record<string, string> = {
  // Garmin variations
  'garmin': 'garmin',
  'garmin connect': 'garmin',
  'garmin watch': 'garmin',
  'garmin app': 'garmin',
  'garmin health': 'garmin',
  'health garmin': 'garmin',
  // Apple Health variations
  'apple health': 'apple-health',
  'apple': 'apple-health',
  'healthkit': 'apple-health',
  'health kit': 'apple-health',
  // Nike variations
  'nike': 'nike-run-club',
  'nike run club': 'nike-run-club',
  'nike+': 'nike-run-club',
  'nike plus': 'nike-run-club',
  'nike run': 'nike-run-club',
  'nike running': 'nike-run-club',
  // WHOOP
  'whoop': 'whoop',
  'whoop band': 'whoop',
  'whoop strap': 'whoop',
  // Oura
  'oura': 'oura',
  'oura ring': 'oura',
  // Peloton
  'peloton': 'peloton',
  'peloton bike': 'peloton',
  // Zwift
  'zwift': 'zwift',
  // Polar
  'polar': 'polar',
  'polar flow': 'polar',
  // MyFitnessPal
  'myfitnesspal': 'myfitnesspal',
  'my fitness pal': 'myfitnesspal',
  'mfp': 'myfitnesspal',
  // TrainingPeaks
  'trainingpeaks': 'trainingpeaks',
  'training peaks': 'trainingpeaks',
  // Samsung Health
  'samsung': 'samsung-health',
  'samsung health': 'samsung-health',
  // Google Fit
  'google fit': 'google-fit',
  'google fitness': 'google-fit',
};

function normalizeIntegrationName(input: string): string {
  // Lowercase and trim
  let cleaned = input.toLowerCase().trim();

  // Remove common suffixes
  cleaned = cleaned.replace(/(app|watch|wristband|band|tracker|fitness|health)$/, '').trim();

  // Check direct alias match
  if (INTEGRATION_ALIASES[cleaned]) {
    return INTEGRATION_ALIASES[cleaned];
  }

  // Try matching without spaces
  const noSpaces = cleaned.replace(/\s+/g, '');
  for (const [alias, canonical] of Object.entries(INTEGRATION_ALIASES)) {
    if (alias.replace(/\s+/g, '') === noSpaces) {
      return canonical;
    }
  }

  // Return cleaned version if no match
  return cleaned.replace(/\s+/g, '-');
}

export const integrationRequestHandler = async (req: functions.Request, res: functions.Response) => {
  // CORS Headers
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  res.set('Access-Control-Max-Age', '3600');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  // GET: Return stats (admin use)
  if (req.method === 'GET') {
    try {
      const snapshot = await admin.firestore().collection(COLLECTION).get();
      const stats: Record<string, { count: number; rawInputs: string[] }> = {};

      snapshot.forEach(doc => {
        const data = doc.data();
        stats[doc.id] = {
          count: data.count || 0,
          rawInputs: data.rawInputs || [],
        };
      });

      // Sort by count descending
      const sorted = Object.entries(stats)
        .sort(([, a], [, b]) => b.count - a.count)
        .map(([name, data]) => ({ name, ...data }));

      res.status(200).json({ requests: sorted });
    } catch (error) {
      console.error('Error fetching stats:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
    return;
  }

  // POST: Submit a request
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  const { integration, email, website_url } = req.body;

  // Honeypot spam protection
  if (website_url) {
    console.warn(`Spam detected: honeypot filled. Integration: "${integration}"`);
    res.status(200).json({ success: true, message: 'Thanks for your feedback!' });
    return;
  }

  // Validation
  if (!integration || typeof integration !== 'string' || integration.length < 2) {
    res.status(400).json({ error: 'Please provide a valid integration name.' });
    return;
  }

  const canonicalName = normalizeIntegrationName(integration);
  const rawInput = integration.trim();

  try {
    const docRef = admin.firestore().collection(COLLECTION).doc(canonicalName);

    await admin.firestore().runTransaction(async (transaction) => {
      const doc = await transaction.get(docRef);

      if (doc.exists) {
        const data = doc.data()!;
        const rawInputs: string[] = data.rawInputs || [];

        // Add new raw input if not already present
        if (!rawInputs.includes(rawInput)) {
          rawInputs.push(rawInput);
        }

        transaction.update(docRef, {
          count: admin.firestore.FieldValue.increment(1),
          rawInputs,
          lastRequestedAt: admin.firestore.Timestamp.now(),
          ...(email && { emails: admin.firestore.FieldValue.arrayUnion(email) }),
        });
      } else {
        transaction.create(docRef, {
          count: 1,
          rawInputs: [rawInput],
          createdAt: admin.firestore.Timestamp.now(),
          lastRequestedAt: admin.firestore.Timestamp.now(),
          ...(email && { emails: [email] }),
        });
      }
    });

    console.log(`Integration request: "${rawInput}" -> "${canonicalName}"`);
    res.status(200).json({
      success: true,
      message: "Thanks! We'll consider adding this integration.",
      canonicalName,
    });
  } catch (error) {
    console.error('Error processing integration request:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// Register function
functions.http('integrationRequestHandler', integrationRequestHandler);
