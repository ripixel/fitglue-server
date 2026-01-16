# Debugging Fitbit Integration

This guide describes how to debug issues with the Fitbit integration using the provided helper script.

## Fitbit Debug Script

The `scripts/debug-fitbit.ts` script allows you to manually inspect the Fitbit API response for a specific user and date. It checks:
1.  **Activity List**: Fetches the list of activities for the given date.
2.  **Processing Status**: Checks if the activity has already been processed in Firestore.
3.  **TCX Availability**: Attempts to fetch the TCX file for each activity.
4.  **Raw API Response**: If the client fails (e.g., 403 Forbidden), it attempts a raw fetch to inspect headers and the raw error body.

### Usage

Run the script using `ts-node` from the `server` directory:

```bash
npx ts-node scripts/debug-fitbit.ts <USER_ID> <DATE>
```

-   `<USER_ID>`: The FitGlue User UUID (not the Fitbit ID). You can find this in the Firestore `users` collection or execution logs.
-   `<DATE>`: The date in `YYYY-MM-DD` format.

### Example

```bash
npx ts-node scripts/debug-fitbit.ts 832bc50d-4814-4fce-89ff-f94ef4bba9b1 2026-01-01
```

### Common Issues

-   **403 Forbidden on TCX Fetch**: This usually indicates that the `location` scope was not granted during authentication. Use the `admin-cli` to re-authenticate the user with the correct scopes (`activity heartrate profile location`).
-   **No TCX Data**: Not all Fitbit activities have TCX data. Manual logs or auto-detected walks often do not.
