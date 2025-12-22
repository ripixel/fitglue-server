import { HttpFunction } from '@google-cloud/functions-framework';
import * as admin from 'firebase-admin';
import * as winston from 'winston';
import { logExecutionStart, logExecutionSuccess, logExecutionFailure } from '../execution/logger';

// Initialize Firebase (Idempotent)
if (admin.apps.length === 0) {
  admin.initializeApp();
}
const db = admin.firestore();

// Configure Structured Logging
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  defaultMeta: { service: process.env.K_SERVICE || 'unknown-service' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(info => {
          // Map to GCP keys
          const gcpInfo: any = {
            timestamp: info.timestamp,
            ...info,
            severity: info.level.toUpperCase(),
            message: info.message
          };
          // Remove default keys to avoid duplication/conflict
          delete gcpInfo.level;
          return JSON.stringify(gcpInfo);
        })
      )
    })
  ]
});

export interface FrameworkContext {
  db: admin.firestore.Firestore;
  logger: winston.Logger;
  executionId: string;
}

export type FrameworkHandler = (
  req: any,
  res: any,
  ctx: FrameworkContext
) => Promise<any>;

/**
 * Extract metadata from HTTP request
 * Handles both HTTP requests and Pub/Sub messages
 */
function extractMetadata(req: any): { userId?: string; testRunId?: string; triggerType: string } {
  let userId: string | undefined;
  let testRunId: string | undefined;
  let triggerType = 'http';

  // Check if this is a Pub/Sub message (has message.data structure)
  if (req.body && req.body.message && req.body.message.data) {
    triggerType = 'pubsub';

    // Decode base64 Pub/Sub message data
    try {
      const messageData = Buffer.from(req.body.message.data, 'base64').toString('utf-8');
      const payload = JSON.parse(messageData);
      userId = payload.user_id || payload.userId;
    } catch (e) {
      // If parsing fails, continue without user_id
    }

    // Check Pub/Sub message attributes for test_run_id
    if (req.body.message.attributes) {
      testRunId = req.body.message.attributes.test_run_id || req.body.message.attributes.testRunId;
    }
  } else {
    // HTTP request
    // Try to extract user_id from request body
    if (req.body) {
      userId = req.body.user_id || req.body.userId;
    }

    // Try to extract test_run_id from headers (check both formats)
    if (req.headers) {
      testRunId = req.headers['x-test-run-id'] || req.headers['x-testrunid'];
    }
  }

  return { userId, testRunId, triggerType };
}

export function createCloudFunction(handler: FrameworkHandler): HttpFunction {
  return async (req, res) => {
    const serviceName = process.env.K_SERVICE || 'unknown-function';

    // Extract metadata from request (handles both HTTP and Pub/Sub)
    const { userId, testRunId, triggerType } = extractMetadata(req);

    // Log execution start
    let executionId: string;
    try {
      executionId = await logExecutionStart(db, serviceName, {
        userId,
        testRunId,
        triggerType,
      });
    } catch (e) {
      logger.warn('Failed to log execution start', { error: e });
      executionId = 'unknown';
    }

    // Create context with enriched logger
    const contextLogger = logger.child({
      executionId,
      ...(userId && { user_id: userId })
    });

    const ctx: FrameworkContext = {
      db,
      logger: contextLogger,
      executionId
    };

    contextLogger.info('Function started');

    try {
      // Execute Handler
      const result = await handler(req, res, ctx);

      // Log execution success
      await logExecutionSuccess(db, executionId, result || {});

      contextLogger.info('Function completed successfully');

    } catch (err: any) {
      // Log execution failure
      ctx.logger.error('Function failed', { error: err.message, stack: err.stack });

      await logExecutionFailure(db, executionId, err);

      if (!res.headersSent) {
        res.status(500).send('Internal Server Error');
      }
    }
  };
}
