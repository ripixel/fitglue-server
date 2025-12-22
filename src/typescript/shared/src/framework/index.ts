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

export function createCloudFunction(handler: FrameworkHandler): HttpFunction {
  return async (req, res) => {
    const serviceName = process.env.K_SERVICE || 'unknown-function';

    // Log execution start
    let executionId: string;
    try {
      executionId = await logExecutionStart(db, serviceName, {
        triggerType: 'http',
      });
    } catch (e) {
      logger.warn('Failed to log execution start', { error: e });
      executionId = 'unknown';
    }

    const ctx: FrameworkContext = {
      db,
      logger: logger.child({ executionId }),
      executionId
    };

    try {
      // Execute Handler
      const result = await handler(req, res, ctx);

      // Log execution success
      await logExecutionSuccess(db, executionId, result || {});

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
