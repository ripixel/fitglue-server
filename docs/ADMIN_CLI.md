# FitGlue Admin CLI

The Admin CLI is a tool for managing users and integrations in the FitGlue system. It interacts directly with the Firestore database and handles tasks like generating API keys and configuring third-party integrations (e.g., Hevy).

## Quick Start

We provide a wrapper script in the root directory for easy execution:

```bash
./fitglue-admin <command> [options]
```

## Commands

### `users:create [userId]`

Creates a new user in the system. If `userId` is omitted, a random UUID will be generated. This command is interactive and will prompt you for necessary details.

**Usage:**
```bash
./fitglue-admin users:create
# OR
./fitglue-admin users:create my-specific-id
```

**Prompts:**
1.  **Ingress API Key**: Do you want to generate an API Key for this user? (Default: Yes)
    *   **Label**: A descriptive name for the key (e.g., "Mobile App").
    *   **Scopes**: Select `write:activity` (required for ingesting data).
2.  **Hevy Integration**: Do you want to configure Hevy? (Default: Yes)
    *   **API Key**: The user's Hevy API Key (for fetching their data).

### `users:list`

Lists all users currently in the Firestore database, along with their creation date and enabled integrations. Useful for auditing and cleanup.

**Usage:**
```bash
./fitglue-admin users:list
```

### `users:clean`

**DANGER:** Permanently deletes **ALL** users from the system. Requires double confirmation.

**Usage:**
```bash
./fitglue-admin users:clean
```

### `users:delete <userId>`

Permanently deletes a user and their associated root document. Note that subcollections may need manual cleanup in a production environment.

**Usage:**
```bash
./fitglue-admin users:delete my-user-id
```


### `users:update <userId>`

Updates the configuration for an existing user. Currently supports updating integration settings.

**Usage:**
```bash
./fitglue-admin users:update my-test-user
```

**Prompts:**
1.  **Hevy Integration**: Do you want to update the Hevy API Key?
    *   If yes, enter the new key.

## Development

The CLI source code is located in `src/typescript/admin-cli`.

To build it manually:
```bash
npm run build --workspace=admin-cli
```

To run it via npm (without the wrapper):
```bash
npm start --prefix src/typescript/admin-cli -- <command>
```
