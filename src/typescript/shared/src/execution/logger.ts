import * as admin from 'firebase-admin';
import { ExecutionRecord, ExecutionStatus } from '../types/pb/execution';

export interface ExecutionOptions {
  userId?: string;
  testRunId?: string;
  triggerType?: string;
  inputs?: any;
}

/**
 * Log the start of a function execution
 * @returns execution ID
 */
export async function logExecutionStart(
  db: admin.firestore.Firestore,
  service: string,
  opts: ExecutionOptions = {}
): Promise<string> {
  // Generate ID to match Go implementation: {service}-{timestamp}
  // This improves sorting and readability
  const execId = `${service}-${Date.now()}`;
  const execRef = db.collection('executions').doc(execId);

  const now = new Date();

  const record: Partial<ExecutionRecord> = {
    executionId: execId,
    service,
    status: ExecutionStatus.STATUS_STARTED,
    timestamp: now,
    startTime: now,
    userId: opts.userId,
    testRunId: opts.testRunId,
    triggerType: opts.triggerType,
  };

  // Encode inputs as JSON if provided
  if (opts.inputs) {
    record.inputsJson = JSON.stringify(opts.inputs);
  }

  // Convert to Firestore-compatible format
  const data = executionRecordToFirestore(record);

  await execRef.set(data);

  return execId;
}

/**
 * Log the start of a child function execution linked to a parent
 * @returns execution ID
 */
export async function logChildExecutionStart(
  db: admin.firestore.Firestore,
  service: string,
  parentExecutionID: string,
  opts: ExecutionOptions = {}
): Promise<string> {
  const execId = `${service}-${Date.now()}`;
  const execRef = db.collection('executions').doc(execId);

  const now = new Date();

  const record: Partial<ExecutionRecord> = {
    executionId: execId,
    service,
    status: ExecutionStatus.STATUS_STARTED,
    timestamp: now,
    startTime: now,
    userId: opts.userId,
    testRunId: opts.testRunId,
    triggerType: opts.triggerType,
    parentExecutionId: parentExecutionID,
  };

  // Encode inputs as JSON if provided
  if (opts.inputs) {
    record.inputsJson = JSON.stringify(opts.inputs);
  }

  // Convert to Firestore-compatible format
  const data = executionRecordToFirestore(record);

  await execRef.set(data);

  return execId;
}

/**
 * Log successful completion of a function execution
 */
export async function logExecutionSuccess(
  db: admin.firestore.Firestore,
  execId: string,
  outputs?: any
): Promise<void> {
  const execRef = db.collection('executions').doc(execId);

  const now = new Date();

  const updates: any = {
    status: ExecutionStatus[ExecutionStatus.STATUS_SUCCESS],
    timestamp: now,
    endTime: now,
  };

  // Encode outputs as JSON if provided
  if (outputs) {
    updates.outputsJson = JSON.stringify(outputs);
  }

  await execRef.update(updates);
}

/**
 * Log failed execution of a function
 */
export async function logExecutionFailure(
  db: admin.firestore.Firestore,
  execId: string,
  error: Error
): Promise<void> {
  const execRef = db.collection('executions').doc(execId);

  const now = new Date();

  const updates = {
    status: ExecutionStatus[ExecutionStatus.STATUS_FAILED],
    timestamp: now,
    endTime: now,
    errorMessage: error.message,
  };

  await execRef.update(updates);
}

/**
 * Convert ExecutionRecord to Firestore-compatible format
 */
function executionRecordToFirestore(record: Partial<ExecutionRecord>): any {
  const data: any = {
    service: record.service,
    status: ExecutionStatus[record.status!],
    timestamp: record.timestamp,
  };

  if (record.userId) data.user_id = record.userId;
  if (record.testRunId) data.test_run_id = record.testRunId;
  if (record.triggerType) data.trigger_type = record.triggerType;
  if (record.startTime) data.startTime = record.startTime;
  if (record.inputsJson) data.inputs = record.inputsJson;
  if (record.parentExecutionId) data.parent_execution_id = record.parentExecutionId;

  return data;
}
