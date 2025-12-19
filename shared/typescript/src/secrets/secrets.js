"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSecret = getSecret;
const secret_manager_1 = require("@google-cloud/secret-manager");
const client = new secret_manager_1.SecretManagerServiceClient();
/**
 * Fetches the latest version of a secret from Google Secret Manager.
 * @param projectId The Google Cloud Project ID.
 * @param secretName The name of the secret (not the full path).
 * @returns The secret string value.
 */
async function getSecret(projectId, secretName) {
    // 1. Local Fallback: Check environment variable first
    // This allows local development without needing authenticated access to Secret Manager
    if (process.env[secretName]) {
        console.log(`[SecretManager] Using local env var for: ${secretName}`);
        return process.env[secretName];
    }
    // 2. Cloud Secret Manager
    const name = `projects/${projectId}/secrets/${secretName}/versions/latest`;
    try {
        const [version] = await client.accessSecretVersion({
            name: name,
        });
        const payload = version.payload?.data?.toString();
        if (!payload) {
            throw new Error(`Secret payload is empty for ${secretName}`);
        }
        return payload;
    }
    catch (err) {
        console.error(`Failed to fetch secret ${secretName}:`, err);
        throw err;
    }
}
