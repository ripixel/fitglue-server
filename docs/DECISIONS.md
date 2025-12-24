# Architecture & Workflow Decisions

## 001 - Hybrid Local Development Strategy (2025-12-19)

### Context
We needed a local development environment that is fast, isolated, but realistic.
Full local emulation (Firestore Emulator, Pub/Sub Emulator) requires heavy dependencies (Java JDK) not currently present.
Creating separate GCP projects for every developer is heavyweight.

### Decision
We adopted a **Hybrid Cloud/Local** workflow:

1.  **Run Local:** Services run locally via `make local` (Go binaries).
2.  **Real Database (Dev):** We use a shared "Dev" GCP Project (`fitglue-server`) for Firestore.
    - *Mitigation:* Developers use unique inputs/IDs during manual testing to collision.
    - *Test Isolation:* Integration tests generate random UUIDs (`user_test_<uuid>`) and clean up after themselves.
3.  **Mocked Pub/Sub:** We use a `LogPublisher` (No-Op) adapter by default.
    - *Why:* Prevents "Topic Pollution" where one dev's test event triggers another dev's local subscriber.
    - *Mechanism:* `ENABLE_PUBLISH` env var. Default is `false` (Log Only).
4.  **Future:** Formal "Test" and "Prod" environments will be separate GCP Projects managed by Terraform.

### Consequences
- **Pros:** Zero setup cost (no Java/Emulators). Wiring verification is fast. No topic collisions.
- **Cons:** Requires internet. "Dev" database is shared (but handled via unique IDs).

## 002 - Infrastructure & Environment Isolation (2025-12-19)

### Context
We need to support "Dev", "Test", and "Prod" environments.
We initially considered using the existing `fitglue-server` for Dev, but decided to start fresh to ensure consistency across all three envs.

### Decision
We will use **Terraform Workspaces** coupled with **tfvars** files.
We will create **3 Fresh GCP Projects** (leaving `fitglue-server` dormant).

1.  **Project Mapping:**
    - Workspace `dev` -> `fitglue-server-dev`
    - Workspace `test` -> `fitglue-server-test`
    - Workspace `prod` -> `fitglue-server-prod`
2.  **Configuration:**
    - `envs/dev.tfvars`, `envs/test.tfvars`, `envs/prod.tfvars`
3.  **State Management:**
    - Local State with Workspaces (`terraform.tfstate.d/`).

## 003 - Naming Convention (2025-12-19)

### Standard
`[project]-[purpose]-[environment]`

### Examples
- `fitglue-server-dev` (Backend Functions - Dev)
- `fitglue-server-prod` (Backend Functions - Prod)
- (Future) `fitglue-web-prod` (Frontend - Prod)

### Rationale
Allows grouping by project (`fitglue`), purpose (`server`/`app`), and environment (`dev`/`prod`) systematically.

## 004 - Monorepo Structure (2025-12-21)

### Context
We initially used a polyrepo-style structure with multiple `go.mod` files and specialized `make` targets to inject shared code into each function's directory. This caused:
-   Persistent `go.sum` checksum mismatches in CI.
-   Complexity in local development (workspace vs replacement directives).
-   "Missing module" errors because of tangled dependency graphs.

### Decision
We refactored the repository into a **Monorepo** structure:
-   `src/go`: Single Go module (`github.com/ripixel/fitglue-server/src/go`) containing all backend functions and shared packages.
-   `src/typescript`: TypeScript functions using npm workspaces.
-   `src/proto`: Unified Protocol Buffers.

### Consequences
-   **Pros:** Simplified build (standard Go tooling works). No code injection/sed hacking. Single source of truth for dependencies.
-   **Cons:** Deployments upload the entire module context (negligible size impact).

## 005 - User Identity & Integration Mapping (2025-12-22)

### Context
We need to map internal FitGlue users to multiple external identities (Strava ID, Hevy ID, etc.) and handle authentication securely across functions. Using simple ID references scattered across Firestore documents makes it hard to manage permissions or perform lookups (e.g., "Find the FitGlue user for Strava ID 12345").

### Decision
We introduced a **User Record Pattern** with two core entity types stored in Firestore:

1.  **User Record (`users/{userId}`)**: The single source of truth for a user's identity.
    -   Contains a map of `integrations` (e.g., `strava: "12345"`, `hevy: "abc-def"`).
    -   Contains API keys and roles.
2.  **Identity Maps (`integrations/{platform}/ids/{externalId}`)**: Reverse-lookup documents.
    -   Example: `integrations/strava/ids/998877` -> `{ userId: "uuid-5566" }`.
    -   Allows fast lookup from incoming webhooks (which only have the provider's ID) to our internal User ID.

### Consequences
-   **Pros**: O(1) lookup for webhooks. Centralized integration status.
-   **Cons**: Requires dual-write transaction when linking an account (update User + create Identity Map).

## 006 - DNS & Domain Architecture (2025-12-24)

### Context
We have three environments (Dev, Test, Prod) but one purchased domain (`fitglue.tech`). We also anticipate a future where the frontend hosting (website/app) might live in a separate Google Cloud Project from the backend server functions.

### Decision
We adopted a **Hub-and-Spoke DNS Strategy** centered on the Production environment.

1.  **DNS Hub (Prod)**:
    -   `fitglue-server-prod` holds the **Cloud DNS Managed Zone** for `fitglue.tech` (the root).
    -   This zone is the "Source of Truth" for the domain.

2.  **Environment Isolation (Subdomains)**:
    -   **Dev**: Manages its own zone `dev.fitglue.tech`. Prod delegates to it via `NS` records.
    -   **Test**: Manages its own zone `test.fitglue.tech`. Prod delegates to it via `NS` records.
    -   **Benefit**: You can tear down/rebuild the Dev environment entirely without affecting Prod.

3.  **Future Frontend Integration**:
    -   **Root (`fitglue.tech`)**: When we add a frontend (e.g., Firebase Hosting), we will likely keep the frontend code in a separate project. We will simply add the `A` and `TXT` records provided by that hosting service directly into the `fitglue-server-prod` Terraform zone.
    -   **Subdomains (`app.fitglue.tech`)**: If we use a subdomain for the app, we can use the same NS delegation strategy used for Dev/Test.

### Consequences
-   **Pros**: Clean separation of environments. Infrastructure-as-code controls the domain. Ready for multi-project architecture.
-   **Cons**: Initial manual setup step required to paste "Dev" nameservers into "Prod" zone (Chain of Trust).

## 007 - Unified URL Strategy (2025-12-24)

### Context
We need to expose various resources (Marketing Site, Dashboard, Webhooks, OAuth Callbacks) to the internet.
We considered using subdomains (e.g., `hooks.fitglue.tech`, `api.fitglue.tech`) vs. a unified domain structure.
We are prioritizing user trust, brand cohesiveness, and ease of cross-origin (CORS) management.

### Decision
We will use a **Unified Domain Strategy** served via **Firebase Hosting Rewrites**.

1.  **Single Origin**: All public endpoints will be accessible via the root domain (per environment).
    -   Prod: `https://fitglue.tech`
    -   Dev: `https://dev.fitglue.tech`
2.  **Path-Based Routing**:
    -   **Frontend**: `/` and `/app/**` -> Served by Firebase Hosting (Static/SPA).
    -   **Webhooks**: `/hooks/{provider}` -> Rewrites to Cloud Function `webhook-handler`.
    -   **API**: `/api/{version}/**` -> Rewrites to Cloud Function `api-service`.
    -   **Auth**: `/auth/{provider}/callback` -> Rewrites to Auth Handler.

### Consequences
-   **Pros**:
    -   Eliminates CORS issues for the dashboard calling the API.
    -   Simplified SSL identity.
    -   Clean, professional URLs (`fitglue.tech/app` vs `app.fitglue.tech`).
    -   Abstracts the underlying backend (Cloud Functions) from the public interface.
-   **Cons**:
    -   Requires Firebase Hosting configuration (`firebase.json`) to be the entry point.
    -   Slight latency overhead from the Hosting proxy (typically negligible).

### Update to 007 (2025-12-24)
**Strict Separation of Concerns**: We validated that the Firebase Hosting / Routing layer should **NOT** be part of the `fitglue-server` infrastructure. It will live in a distinct `fitglue-web` project. The server project will only provide the raw Cloud Functions and the DNS Zone, to which the Web project will attach its records.

## 008 - Project & Repository Architecture (2025-12-24)

### Context
We require:
1.  **Unified URLs**: `fitglue.tech/hooks/...` should mask backend functions.
2.  **Strict Code Separation**: Frontend code and Backend code must live in separate Git repositories.
3.  **Environment Isolation**: Dev, Test, Prod must be completely separate.

### Constraint
**Firebase Hosting Rewrites** (the technology that powers component 1) only work if the Hosting site and the Cloud Functions reside in the **same Google Cloud Project**.

### Decision
We will adopt a **Shared Project / Separate Repository** model.

1.  **GCP Projects**:
    One project per environment acting as the "Environment Container".
    -   `fitglue-dev`
    -   `fitglue-test`
    -   `fitglue-prod`
    (Note: Previously named `fitglue-server-*`, we are likely renaming to reflect their broader scope).

2.  **Repositories**:
    -   **Repo A (`fitglue-server`)**: Deploys Cloud Functions, Firestore, Pub/Sub to the project.
    -   **Repo B (`fitglue-web`)**: Deploys Static Files and Firebase Hosting Configuration to the **same** project.

### Consequences
-   **Pros**:
    -   Enables zero-cost routing/proxying via Firebase Hosting.
    -   Keeps codebases clean and decoupled.
    -   Simplifies IAM (Service Account A deploys Server, Service Account B deploys Web).
-   **Cons**:
    -   Coordination required: Repo B cannot "rewrite" to a function that Repo A hasn't deployed yet.
