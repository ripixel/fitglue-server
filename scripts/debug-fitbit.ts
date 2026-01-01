
import * as admin from 'firebase-admin';
import { UserService, createFitbitClient } from '../src/typescript/shared/src/index';

async function main() {
  // Usage: npx ts-node scripts/debug-fitbit.ts <userId> <date>
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error('Usage: npx ts-node scripts/debug-fitbit.ts <userId> <date>');
    console.error('Example: npx ts-node scripts/debug-fitbit.ts 832bc50d-4814-4fce-89ff-f94ef4bba9b1 2026-01-01');
    process.exit(1);
  }

  const [USER_ID, DATE] = args;

  if (admin.apps.length === 0) {
    admin.initializeApp();
  }
  const db = admin.firestore();
  const userService = new UserService(db);

  console.log(`Debug Fitbit for User: ${USER_ID}, Date: ${DATE}`);

  try {
    const client = createFitbitClient(userService, USER_ID);

    console.log('Fetching activities...');
    // Type assertion or casting might be needed depending on strictness, but let's try
    const { data: activityData, error } = await client.GET("/1/user/-/activities/date/{date}.json", {
      params: { path: { date: DATE } }
    });

    if (error) {
      console.error('Error fetching list:', JSON.stringify(error, null, 2));
      return;
    }

    // Check data structure
    const activities = (activityData as any)?.activities;

    if (!activities) {
      console.log('No activities found in response.');
      return;
    }

    console.log(`Found ${activities.length} activities.`);

    for (const act of activities as any[]) {
      console.log(`\n--------------------------------------------------`);
      console.log(`Activity [${act.logId}]: ${act.name}`);

      const logIdStr = act.logId!.toString();

      // Manually get token to debug
      const token = await userService.getValidToken(USER_ID, 'fitbit');
      console.log(`  Token: ${token.substring(0, 10)}... (Length: ${token.length})`);

      console.log(`  Fetching TCX (Client)...`);
      const { data: tcx, error: tcxError } = await client.GET("/1/user/-/activities/{log-id}.tcx", {
        params: { path: { 'log-id': logIdStr } },
        parseAs: 'text'
      });

      if (tcxError) {
        console.log(`  TCX Request Error (Client):`, JSON.stringify(tcxError, null, 2));

        // Try Raw Fetch to see headers
        const url = `https://api.fitbit.com/1/user/-/activities/${logIdStr}.tcx`;
        console.log(`  Fetching TCX (Raw): ${url}`);
        const rawRes = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        console.log(`  Raw Status: ${rawRes.status} ${rawRes.statusText}`);
        console.log(`  Raw Headers:`, JSON.stringify(Object.fromEntries(rawRes.headers.entries()), null, 2));
        const rawText = await rawRes.text();
        console.log(`  Raw Body: ${rawText.substring(0, 200)}`);

      } else if (!tcx) {
        console.log(`  TCX Result: Empty/Null`);
      } else {
        const tcxStr = tcx as string;
        console.log(`  TCX Result: Found ${tcxStr.length} chars`);
      }
    }
  } catch (err) {
    console.error("Global error:", err);
  }
}

main().catch(console.error);
