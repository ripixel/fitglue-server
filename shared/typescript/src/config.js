"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PROJECT_ID = exports.TOPICS = void 0;
exports.TOPICS = {
    RAW_ACTIVITY: 'topic-raw-activity',
    ENRICHED_ACTIVITY: 'topic-enriched-activity',
    JOB_UPLOAD_STRAVA: 'topic-job-upload-strava',
    JOB_UPLOAD_OTHER: 'topic-job-upload-other'
};
// In a real monorepo, we might inject this via build process or env var,
// but having a constant default helps local dev consistency.
exports.PROJECT_ID = process.env.GCP_PROJECT || 'fitglue-project';
