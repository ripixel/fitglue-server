#!/usr/bin/env node

const admin = require('firebase-admin');

admin.initializeApp({ projectId: 'fitglue-server-dev' });
const db = admin.firestore();

async function checkExecutions() {
  console.log('Checking execution records...\n');

  const snapshot = await db.collection('executions')
    .orderBy('start_time', 'desc')
    .limit(5)
    .get();

  if (snapshot.empty) {
    console.log('❌ No execution records found');
    return;
  }

  console.log(`Found ${snapshot.size} recent executions:\n`);

  snapshot.docs.forEach((doc, index) => {
    const data = doc.data();
    console.log(`Execution ${index + 1}:`);
    console.log(`  ID: ${doc.id}`);
    console.log(`  Service: ${data.service || 'N/A'}`);
    console.log(`  User ID: ${data.user_id || 'N/A'}`);
    console.log(`  Test Run ID: ${data.test_run_id || '❌ MISSING'}`);
    console.log(`  Status: ${data.status || 'N/A'}`);
    console.log(`  Trigger: ${data.trigger_type || 'N/A'}`);
    console.log(`  Start Time: ${data.start_time?.toDate?.() || 'N/A'}`);
    console.log('');
  });

  const withTestRunId = snapshot.docs.filter(doc => doc.data().test_run_id);
  console.log(`\n✅ ${withTestRunId.length}/${snapshot.size} have test_run_id`);

  if (withTestRunId.length === 0) {
    console.log('\n⚠️  WARNING: No executions have test_run_id!');
    console.log('This means the framework is not extracting test_run_id from events.');
  }
}

checkExecutions()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
