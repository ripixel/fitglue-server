#!/usr/bin/env node
/**
 * Migration Script: inputs → typedConfig
 *
 * This script migrates existing pipeline enricher configurations from
 * the old `inputs` field to the new `typed_config` field.
 *
 * Run this script BEFORE deploying the new backend code that expects typedConfig.
 *
 * Usage:
 *   DRY_RUN=true npx ts-node scripts/migrate-enricher-config.ts   # Preview changes
 *   npx ts-node scripts/migrate-enricher-config.ts                # Apply changes
 *
 * The script is idempotent - it won't overwrite existing typedConfig values.
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, DocumentData } from 'firebase-admin/firestore';
import * as path from 'path';

// Configuration
const DRY_RUN = process.env.DRY_RUN === 'true';
const SERVICE_ACCOUNT_PATH = process.env.SERVICE_ACCOUNT_PATH ||
  path.join(__dirname, '../service-account.json');

interface EnricherConfig {
  providerType?: number;
  inputs?: Record<string, string>;
  typedConfig?: Record<string, string>;
}

interface Pipeline {
  source?: string;
  enrichers?: EnricherConfig[];
  destinations?: string[];
}

async function main() {
  console.log('='.repeat(60));
  console.log('FitGlue Pipeline Migration: inputs → typedConfig');
  console.log('='.repeat(60));
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes will be made)' : 'LIVE'}`);
  console.log('');

  // Initialize Firebase Admin
  let app;
  try {
    const serviceAccount = require(SERVICE_ACCOUNT_PATH);
    app = initializeApp({
      credential: cert(serviceAccount),
    });
    console.log(`✓ Connected to project: ${serviceAccount.project_id}`);
  } catch (error) {
    console.error('✗ Failed to initialize Firebase Admin');
    console.error('  Set SERVICE_ACCOUNT_PATH env var or place service-account.json in server/');
    process.exit(1);
  }

  const db = getFirestore(app);

  // Get all users
  const usersSnapshot = await db.collection('users').get();
  console.log(`\n📊 Found ${usersSnapshot.size} users to process\n`);

  let totalPipelines = 0;
  let migratedPipelines = 0;
  let migratedEnrichers = 0;
  let skippedPipelines = 0;

  for (const userDoc of usersSnapshot.docs) {
    const userId = userDoc.id;

    // Get all pipelines for this user
    const pipelinesSnapshot = await db
      .collection('users')
      .doc(userId)
      .collection('pipelines')
      .get();

    if (pipelinesSnapshot.empty) continue;

    console.log(`\n👤 User: ${userId} (${pipelinesSnapshot.size} pipelines)`);

    for (const pipelineDoc of pipelinesSnapshot.docs) {
      totalPipelines++;
      const pipelineId = pipelineDoc.id;
      const pipeline = pipelineDoc.data() as Pipeline;

      if (!pipeline.enrichers || pipeline.enrichers.length === 0) {
        console.log(`  📝 ${pipelineId}: No enrichers, skipping`);
        skippedPipelines++;
        continue;
      }

      let needsMigration = false;
      const updatedEnrichers: EnricherConfig[] = [];

      for (const enricher of pipeline.enrichers) {
        const updated: EnricherConfig = { ...enricher };

        // Check if migration is needed
        if (enricher.inputs && Object.keys(enricher.inputs).length > 0) {
          if (!enricher.typedConfig || Object.keys(enricher.typedConfig).length === 0) {
            // Migrate inputs → typedConfig
            updated.typedConfig = { ...enricher.inputs };
            delete updated.inputs;
            needsMigration = true;
            migratedEnrichers++;
            console.log(`  ✨ ${pipelineId}: Migrating enricher type ${enricher.providerType}`);
            console.log(`     inputs: ${JSON.stringify(enricher.inputs)}`);
          } else {
            // Both exist - prefer typedConfig, remove inputs
            delete updated.inputs;
            needsMigration = true;
            console.log(`  ⚠️ ${pipelineId}: Both fields exist, removing inputs`);
          }
        }

        updatedEnrichers.push(updated);
      }

      if (needsMigration) {
        migratedPipelines++;

        if (!DRY_RUN) {
          await pipelineDoc.ref.update({
            enrichers: updatedEnrichers,
            _migratedAt: new Date().toISOString(),
            _migrationVersion: 'inputs_to_typedConfig_v1',
          });
          console.log(`  ✓ ${pipelineId}: Updated in Firestore`);
        } else {
          console.log(`  🔍 ${pipelineId}: Would update (dry run)`);
        }
      } else {
        console.log(`  ✓ ${pipelineId}: Already migrated or no inputs`);
        skippedPipelines++;
      }
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('Migration Summary');
  console.log('='.repeat(60));
  console.log(`Total pipelines scanned:  ${totalPipelines}`);
  console.log(`Pipelines migrated:       ${migratedPipelines}`);
  console.log(`Enrichers migrated:       ${migratedEnrichers}`);
  console.log(`Pipelines skipped:        ${skippedPipelines}`);
  console.log('');

  if (DRY_RUN) {
    console.log('🔍 This was a DRY RUN. No changes were made.');
    console.log('   Run without DRY_RUN=true to apply changes.');
  } else {
    console.log('✓ Migration complete!');
  }
}

main().catch(error => {
  console.error('Migration failed:', error);
  process.exit(1);
});
