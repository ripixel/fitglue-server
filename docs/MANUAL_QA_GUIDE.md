# Manual Integration QA Guide

This guide describes the complete workflow to configure and verify the FitGlue integration pipeline directly. It covers the new Pipeline Architecture, allowing for flexible routing like `Hevy -> Fitbit HR -> Strava`.

## Prerequisites

-   Access to `fitglue-admin` CLI.
-   A running Dev environment (or access to Prod via correct GCloud project selection).
-   User's **Hevy API Key** (from Hevy App Settings -> API).
-   **Client IDs** for Strava and Fitbit (from your developer portals).

## 1. User Setup

### Step 1: Create the User & Ingress Key
Create a new user. This establishes their identity and secure ingress.

```bash
./fitglue-admin users:create
```

1.  **Copy the User ID** (e.g., `user-123`).
2.  **Generate Ingress Key**: Select "Yes".
3.  **Label**: e.g., "Manual Test".
4.  **Copy the Ingress Key** (`fg_sk_...`).
5.  **Configure Hevy**: Select "Yes". Enter the user's personal Hevy API Key.

### Step 2: Configure Hevy Webhook
Add the webhook in the Hevy App or Dashboard.

-   **URL**: `https://[env].fitglue.tech/hooks/hevy` (e.g., `https://dev.fitglue.tech/hooks/hevy`)
-   **Secret**: Paste the **Ingress Key** from Step 1.

### Step 3: Connect OAuth Services
Generate auth links for the user to authorize Strava and Fitbit.

**Connect Strava:**
```bash
./fitglue-admin users:connect user-123 strava
```
*Prompts for Client ID. Enter your Strava Client ID.*
*Visit the generated URL to authorize.*

**Connect Fitbit:**
```bash
./fitglue-admin users:connect user-123 fitbit
```
*Prompts for Client ID. Enter your Fitbit Client ID.*
*Visit the generated URL to authorize.*

---

## 2. Pipeline Configuration

This is the core new feature. Instead of hardcoded routing, we define a pipeline.

### Scenario: Hevy -> Fitbit HR -> Strava

We want Hevy workouts to be enriched with Fitbit heart rate data and then sent to Strava.

```bash
./fitglue-admin users:add-pipeline user-123
```

1.  **Source**: Select `SOURCE_HEVY`.
2.  **Enrichers**:
    *   Select `Yes` to add an enricher.
    *   Choose `fitbit-heart-rate`.
    *   (Optional) Inputs: Press Enter to skip (defaults are fine).
    *   Select `No` to stop adding enrichers.
3.  **Destinations**: Check `strava`.

**Result**: A pipeline ID is generated. The system is now configured to listen for Hevy webhooks for this user, fetch HR from Fitbit, and upload to Strava.

---

## 3. Verification

### Trigger a Workout
1.  **Real**: Finish a workout in Hevy.
2.  **Simulation**: Use Postman or curl to send a dummy webhook event to `https://dev.fitglue.tech/hooks/hevy` with the `X-Hevy-Webhook-Secret` header set to your Ingress Key.

### Trace Execution

**1. Check Hevy Handler:**
```bash
./fitglue-admin executions:list -s hevy-handler -u user-123
```
*Status should be `STATUS_SUCCESS`. Note the message ID.*

**2. Check Enricher:**
```bash
./fitglue-admin executions:list -s enricher -u user-123
```
*   **Log Message**: Look for "Resolved pipelines count=1".
*   **Log Message**: Look for "Executing pipeline id=...".
*   **Log Message**: Look for "Enrichment complete".

**3. Check Router:**
```bash
./fitglue-admin executions:list -s router -u user-123
```
*   **Log Message**: Look for "Resolved destinations from payload" -> `['strava']`.
*   **Log Message**: Look for "Routed activity" -> `['strava:msg-id']`.

**4. Check Strava Uploader:**
```bash
./fitglue-admin executions:list -s strava-uploader-job -u user-123
```
*Status should be `STATUS_SUCCESS`. The activity should surely appear in the user's Strava feed.*

---

## 4. Troubleshooting

*   **"Provider not found":** Ensure the enricher name in the pipeline (`fitbit-heart-rate`) matches the registered provider name in `enricher/function.go`.
*   **No executions listed:** Check Cloud Logging in GCP Console for `fitglue-server-dev` for lower-level infrastructure errors (e.g., 500 errors, timeouts).
*   **OAuth Failures:** Verify the Callback URL matches *exactly* what is registered in your Strava/Fitbit developer portal settings (must include `https` and the correct environment subdomain).
