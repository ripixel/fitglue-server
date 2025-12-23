# **Cloud-Native Architecture for High-Fidelity Fitness Telemetry Integration: A Comprehensive Technical Report on Syncing Hevy, Keiser, Fitbit, and Strava**

## **1\. Executive Summary and Architectural Vision**

The contemporary landscape of digital health and fitness tracking is defined by a paradox of abundance and isolation. Users have access to highly specialized, best-in-class platforms for specific modalities—Hevy for resistance training log-keeping, Keiser for high-fidelity power output in indoor cycling, and Fitbit for continuous, granular biometric monitoring. However, these platforms function largely as data silos, utilizing proprietary schemas and disparate synchronization protocols that hinder the creation of a unified, holistic view of an athlete's performance. For the software engineer acting as a "Quantified Self" architect, the objective extends beyond simple data mirroring; it requires the synthesis of these heterogeneous data streams into a cohesive, high-fidelity narrative within Strava, the central hub of the athletic social graph.

This report articulates a rigorous, cloud-native architecture designed to solve this integration challenge. Unlike simple automation scripts that might rely on point-to-point triggers (e.g., IFTTT or Zapier), which often lack the capability to handle binary file manipulation or complex time-series merging, this solution proposes a bespoke "Fitness Data Lakehouse" architecture hosted on the Google Cloud Platform (GCP). The system is architected to ingest raw telemetry, normalize disparate data models, perform temporal alignment and interpolation on asynchronous sensor streams, and ultimately construct industry-standard Flexible and Interoperable Data Transfer (FIT) files for export.

The analysis that follows recommends a Serverless Event-Driven Microservices pattern. This choice is predicated on the operational reality of fitness data: it is bursty, intermittent, and highly sensitive to latency during the synchronization window. By leveraging Google Cloud Functions (2nd Gen) for compute, Cloud Pub/Sub for asynchronous orchestration, and Cloud Firestore for state management, the proposed infrastructure achieves elasticity—scaling to zero during periods of inactivity to minimize costs while maintaining the capability to process complex, memory-intensive data fusion tasks on demand. This report provides an exhaustive examination of the authentication protocols, API surfaces, and data modeling strategies required to realize this vision, with a specific focus on security best practices for credential management and the intricacies of accessing high-resolution intraday telemetry.

## **2\. The Fragmented Fitness Ecosystem: A Technical Analysis of Data Silos**

To understand the architectural necessities of the proposed solution, one must first analyze the technical divergence of the source systems. The integration difficulty is not merely a matter of mapping field A to field B; it is a fundamental mismatch of data granularity, transport mechanisms, and temporal availability.

### **2.1 Hevy: The Asynchronous Push Model**

Hevy operates as the system of record for resistance training. Its data model is hierarchical, structured around Workouts, Exercises, and Sets. Unlike cardio-centric platforms that generate continuous time-series data (streams), Hevy generates discrete event data. The integration interface is primarily "push-based" via webhooks. Upon the completion of a workout, Hevy transmits a JSON payload containing the session summary. The technical challenge here lies not in data volume, but in security and normalization. The receiving endpoint must verify the authenticity of the push event to prevent data injection attacks and then transform a complex, nested JSON structure into a linear narrative suitable for Strava's description fields or metadata tags. The absence of a continuous "stream" (e.g., second-by-second heart rate or position) in the native Hevy payload necessitates external enrichment if the user desires biometric correlation.1

### **2.2 Keiser M Series: The Proprietary Cloud Model**

The Keiser M Series ecosystem, particularly the M3i indoor bike, presents a different challenge. It operates on a "store-and-forward" model where the bike broadcasts Bluetooth Low Energy (BLE) packets to a mobile intermediary (the M Series app), which then synchronizes with the Keiser Cloud. Accessing this data programmatically requires interfacing with the Keiser Metrics SDK. The data here is high-value telemetry: power (watts), cadence (RPM), and energy (kilojoules). However, this data is often locked behind a proprietary cloud API that does not offer real-time webhooks. Consequently, the integration architecture must adopt a "polling" strategy, proactively querying the Keiser infrastructure for new sessions. Furthermore, the data returned is often in a custom array format that requires significant transformation to align with standard FIT file specifications.1

### **2.3 Fitbit: The Biometric Master Clock**

Fitbit serves as the source of truth for physiological response, specifically heart rate. The critical requirement for this integration is "high-fidelity" merging. Standard Fitbit API responses often provide heart rate data at 1-minute intervals, which acts as a low-pass filter, smoothing out the rapid heart rate spikes associated with interval training (HIIT) or heavy compound lifts. To achieve a professional-grade integration, the system must access the **Intraday Heart Rate Time Series**, which offers 1-second granularity. This introduces a strict constraint: the application registered with Fitbit must be of the **"Personal"** type. The "Server" or "Client" application types are explicitly restricted from accessing this endpoint due to privacy and data volume concerns. This architectural constraint dictates that the system cannot easily be offered as a multi-tenant SaaS product without individual users registering their own applications, a factor that significantly influences the deployment model.1

### **2.4 Strava: The Destination and Visualization Layer**

Strava acts as the consumer of the processed data. While it exposes a comprehensive API, it has strict rate limits (typically 100 requests per 15 minutes) and specific requirements for file uploads. Strava favors the FIT file format for rich sensor data. A simple JSON creation of an activity is insufficient for rendering advanced analysis like power curves or heart rate zones; the data must be encapsulated in a binary file. Additionally, Strava's visualization engine—specifically the "StatMaps" feature—is controlled not through explicit API parameters but through semantic hashtags (e.g., \#PaceMap, \#PowerMap) embedded in the activity description. This requires the egress logic to include text processing capabilities to inject these control signals based on the content of the workout.1

## ---

**3\. Cloud-Native Architecture on Google Cloud Platform**

The proposed solution eschews a monolithic server application in favor of a distributed, serverless architecture. This design maximizes scalability and minimizes operational overhead (NoOps).

### **3.1 The Fitness Data Lakehouse Paradigm**

A naive integration approach might attempt to fetch data from Keiser and stream it directly to Strava. This fails in the face of asynchronous data availability. The Keiser ride might upload at 9:00 AM, but the Fitbit sync might not occur until 9:15 AM. To solve this, the architecture implements a **Fitness Data Lakehouse**.

In this paradigm, incoming data is not processed immediately for egress. Instead, it is "landed" in a staging area.

* **Structured Metadata:** Session IDs, timestamps, user IDs, and status flags (e.g., pending\_biometrics, ready\_to\_merge) are stored in **Cloud Firestore**. Firestore's real-time capabilities and document-oriented structure make it ideal for tracking the state of each activity as it moves through the processing pipeline.
* **Unstructured Telemetry:** The raw, high-volume arrays of integers representing second-by-second power and heart rate are stored as JSON blobs or binary objects in **Cloud Storage (GCS)**. This separation concerns is critical for cost optimization; storing megabytes of raw time-series data in Firestore documents would be prohibitively expensive and could exceed document size limits (1MB).

### **3.2 Compute Layer: Cloud Functions (2nd Gen)**

The processing logic is encapsulated in discrete, single-purpose functions.

* **Ingestion Functions (Node.js/TypeScript):** The choice of Node.js for ingestion is driven by the availability of the **Keiser Metrics SDK** and **Fitbit Web API** client libraries, which are predominantly JavaScript/TypeScript based. These functions handle the I/O-bound tasks of fetching data, verifying webhook signatures, and writing to the Data Lakehouse.
* **Transformation Functions (Golang):** The CPU-bound task of merging time-series data and encoding it into the binary FIT format is assigned to **Go**. Go’s strict typing, efficient memory management, and superior performance with binary manipulation libraries (like tormoder/fit) make it the superior choice over Node.js for this specific component. Cloud Functions (2nd Gen) are built on top of Cloud Run, allowing for longer execution timeouts (up to 60 minutes), which is essential for processing long endurance events or handling complex retry backoff strategies.1

### **3.3 The Asynchronous Messaging Backbone: Cloud Pub/Sub**

To decouple the ingestion rate from the processing rate, **Cloud Pub/Sub** is employed as an intermediary buffer.

1. **Ingestion:** When a webhook arrives from Hevy or a poll returns new data from Keiser, the ingestion function writes the data to the Lakehouse and immediately publishes a "New Activity" event to a Pub/Sub topic.
2. **Buffering:** If the destination API (Strava) is rate-limiting the application (returning 429 Too Many Requests), the Pub/Sub subscription can be configured to retain messages and retry them with exponential backoff. This ensures zero data loss even during API outages or rate limit exhaustion.
3. **Triggering:** The processing functions are triggered by these Pub/Sub messages, ensuring they only run when there is work to do.

## ---

**4\. Identity and Access Management: A Deep Dive into Authentication**

Security in this architecture is paramount, particularly regarding the handling of long-lived credentials (refresh tokens) and the verification of incoming data (webhooks).

### **4.1 The "Token Vending Machine" Middleware Pattern**

Managing OAuth 2.0 lifecycles across multiple providers (Strava, Fitbit) is complex. Tokens expire, refresh tokens rotate, and race conditions can occur if multiple processes try to refresh the same token simultaneously. To abstract this complexity, the system implements a "Token Vending Machine" pattern.

This internal service (implemented as a shared library or microservice) is the only entity authorized to read raw credentials from the database. When a business logic function (e.g., the Keiser Poller) needs to access an API, it requests a token from the Vending Machine.

1. **Check:** The machine retrieves the current token metadata from Firestore.
2. **Validate:** It checks the expires\_at timestamp against the current time, applying a **5-minute safety buffer** to account for clock skew and network latency.
3. **Refresh (if necessary):** If the token is expired or near expiration, the machine executes the Refresh Grant flow with the provider.
4. **Atomic Rotation:** Crucially, both Strava and Fitbit employ **Refresh Token Rotation**. This means every time a refresh token is used, a *new* refresh token is issued, and the old one is invalidated. The Vending Machine uses **Firestore Transactions** to atomically update the new access token and refresh token. This prevents race conditions where two concurrent functions might trigger a refresh, causing one to fail with an invalid token.1

### **4.2 Secure Credential Storage: The Firestore vs. Secret Manager Debate**

A critical design decision involves where to store these sensitive user tokens. The two primary candidates on GCP are **Secret Manager** and **Firestore**.

#### **4.2.1 Google Cloud Secret Manager**

Secret Manager is a specialized service for storing API keys, passwords, and certificates. It offers strong encryption, automatic replication, and fine-grained IAM access control.

* **Cost Analysis:** Secret Manager charges **$0.06 per active secret version per month** and **$0.03 per 10,000 access operations**.7
* **Scalability Impact:** For an application with 1,000 users, each requiring tokens for Strava and Fitbit (2 secrets), the monthly cost would be $0.06 \* 2 \* 1,000 \= **$120/month**. This linear cost scaling makes it economically inefficient for storing *per-user* credentials in a consumer-facing application.

#### **4.2.2 Cloud Firestore**

Firestore is a NoSQL database that encrypts all data at rest by default using AES-256.

* **Cost Analysis:** Firestore charges for storage ($0.18/GB) and operations ($0.06/100k reads). Storing thousands of small token strings costs fractions of a cent per month.8
* **Security Posture:** While Firestore is secure, storing tokens "in plain text" within the database (even if encrypted at rest) means that any administrator with database read access can see them.

#### **4.2.3 Recommendation: The Hybrid Approach**

To balance robust security with economic viability, this report recommends a **Hybrid Strategy**:

1. **Application-Level Secrets:** Store the static, high-value credentials—**Strava Client Secret**, **Fitbit Client Secret**, **Hevy Webhook Signing Key**, and **Keiser Service Credentials**—in **Secret Manager**. These are singular secrets used globally by the application. Their cost is negligible ($0.24/month), and their protection is critical.
2. **User-Level Tokens:** Store the per-user OAuth tokens (Access/Refresh) in **Firestore** within the users collection.
   * **Enhanced Security:** To mitigate the risk of database inspection, implement **Application-Layer Encryption**. Use a single encryption key (stored in Secret Manager) to encrypt the user tokens *before* writing them to Firestore. This ensures that a database dump is useless without the master key, providing a security posture comparable to Secret Manager at a fraction of the cost.9

### **4.3 Hevy Webhook Verification: HMAC-SHA256**

Hevy uses a push model where security relies on verifying that the payload originated from Hevy and has not been tampered with. This is achieved via a signature header, typically X-Hevy-Signature (or X-Apideck-Signature if utilizing an intermediary).

* **Mechanism:** Hevy computes an HMAC-SHA256 hash of the request body using a shared secret key (provided in the Hevy Developer Console).
* **Verification Logic:** The Cloud Function must replicate this process:
  1. **Capture Raw Body:** It is imperative to capture the **raw bytes** of the request body *before* any JSON parsing middleware processes it. Frameworks like Express often parse JSON automatically, discarding whitespace or reordering keys. This alters the payload and invalidates the hash. The system must use express.raw({ type: 'application/json' }) or equivalent to buffer the stream.2
  2. **Compute Hash:** Using the Node.js crypto library, compute the HMAC-SHA256 of the raw buffer using the stored Signing Key.
  3. **Compare:** Use crypto.timingSafeEqual() to compare the computed hash with the header value. Standard string comparison (===) is vulnerable to **timing attacks**, where an attacker can deduce the signature character-by-character based on how long the comparison takes to fail.2

### **4.4 Keiser and Fitbit Specifics**

* **Keiser:** Authentication is session-based. The system must capture the refresh\_token returned by the initial authLogin call. The SDK manages session renewal, but the system must persist the new token whenever the onRefreshTokenChangeEvent fires to ensure the poller can survive restarts.3
* **Fitbit:** As noted, the **"Personal"** application type is mandatory for accessing the **Intraday Heart Rate** series (1-second intervals). This restriction is enforced by Fitbit to limit data volume on their servers. Standard "Server" apps are capped at 1-minute resolution, which would render the "data fusion" strategy ineffective (leading to flat-line HR data during intervals). This implies the tool, if multi-user, might require users to register their own "Personal" app on the Fitbit dev portal and provide their Client ID/Secret, a pattern common in developer-centric tools ("Bring Your Own Key").4

## ---

**5\. Data Ingestion: Protocols, Payloads, and Specific API Calls**

The ingestion layer is the entry point for all telemetry. It requires handling three distinct API paradigms: Push (Hevy), Poll (Keiser), and On-Demand Fetch (Fitbit).

### **5.1 Hevy: The Resistance Training Payload**

* **Trigger:** Webhook POST request.
* **Payload Analysis:** The JSON structure typically contains a root workout object with id, title, start\_time, end\_time, and an exercises array.
  * **Mapping:** The key to integration is the exercise\_template\_id. The system maintains a mapping table (in Firestore) linking these IDs to human-readable names (e.g., "38492" \-\> "Barbell Squat").
  * **Volume Calculation:** The logic iterates through the sets array, summing weight\_kg \* reps to calculate total volume load, a metric Strava does not natively calculate for manual entries.
* **Specific API Call (Webhook Response):** The server must respond with a 200 OK status immediately to acknowledge receipt. Any heavy processing should be offloaded to Pub/Sub to prevent the webhook connection from timing out.

### **5.2 Keiser M Series: The Power Data Stream**

* **Method:** Polling via SDK.
* **Data Structure:** The MSeriesDataSet object is the core artifact. It utilizes a **Structure of Arrays (SoA)** format rather than an Array of Structures (AoS). This means there is a single power array \[200, 205, 210...\], a cadence array, etc., rather than a list of objects like {power: 200, cadence: 90}.
* **Time Alignment:** The dataset includes a start time and a duration. The indices of the arrays correspond to time offsets. However, Keiser data may be compressed or event-based (recording only on change). The ingestion logic must expand this into a second-by-second timeline.
* **Specific API Call (SDK):**
  JavaScript
  // Reconstitute Session
  const userSession \= await metrics.authenticateWithToken({ token: storedRefreshToken });

  // Fetch Data
  const sessions \= await userSession.getCyclingSessions({
      from: lastSyncTimestamp,
      limit: 10
  });

  (Note: Method names like getCyclingSessions are illustrative of the SDK's semantic structure; the actual method may be getMSeriesData or similar depending on the specific SDK version 3).

### **5.3 Fitbit: The Intraday Heart Rate Stream**

* **Method:** REST API (GET).
* **Endpoint:** /1/user/\[user-id\]/activities/heart/date/\[date\]/1d/1sec.json.5
* **Constraint:** The 1sec detail level is only available for the "Personal" app type.
* **Payload:** The response contains activities-heart-intraday, which holds a dataset array: \[{ "time": "08:00:00", "value": 65 },...\].
* **Specific API Call:**
  Bash
  GET https://api.fitbit.com/1/user/-/activities/heart/date/2023-10-27/1d/1sec.json
  Authorization: Bearer

  This request fetches the high-resolution heart rate data for the entire day. The system must then slice this array to match the start and end timestamps of the Keiser activity.

## ---

**6\. The Transformation Engine: Algorithmic Data Fusion**

This section details the logic performed by the **Golang** microservice to merge the datasets. This is the "secret sauce" of the architecture.

### **6.1 Temporal Alignment and Interpolation**

We have two datasets:

1. **Keiser:** Power/Cadence arrays, starting at $T\_{start\\\_keiser}$, duration $D$.
2. **Fitbit:** Heart Rate array, covering the entire day (00:00 to 23:59).

**The Fusion Algorithm:**

1. **Normalization:** Convert $T\_{start\\\_keiser}$ to a Unix Epoch timestamp.
2. **Timeline Construction:** Create a result array of length $D$ (seconds).
3. **Iteration:** For each second $i$ from 0 to $D$:
   * **Timestamp:** $T\_{current} \= T\_{start\\\_keiser} \+ i$.
   * **Power/Cadence:** Retrieve value at index $i$ from the Keiser arrays.
   * **Heart Rate Lookup:** Search the Fitbit dataset for an entry where time matches $T\_{current}$.
   * Handling Gaps (Interpolation): Fitbit devices do not record every second perfectly; there may be gaps. If a value is missing at $T\_{current}$, the algorithm finds the nearest previous value ($HR\_{prev}$) and nearest next value ($HR\_{next}$) and performs Linear Interpolation:

     $$HR\_{current} \= HR\_{prev} \+ (HR\_{next} \- HR\_{prev}) \\times \\frac{T\_{current} \- T\_{prev}}{T\_{next} \- T\_{prev}}$$

     This ensures the resulting FIT file has a smooth, continuous heart rate stream, which is essential for Strava's "Relative Effort" calculations.1

### **6.2 FIT File Generation**

The system uses a Go library (like tormoder/fit) to write the binary file.

* **File ID Message:** Sets the manufacturer (custom ID), product, and creation time.
* **Session Message:** Summarizes the activity (total distance, total calories, avg power).
* **Record Messages:** The loop described above generates one Record Message per second, packing the fused telemetry fields (timestamp, position, heart\_rate, cadence, power) into the binary record structure.

## ---

**7\. Egress and Synchronization: The Strava Interface**

The final stage is delivering the fused artifact to Strava. This involves a multi-step API interaction to upload the file, poll for processing status, and enrich the metadata.

### **7.1 Uploading the Activity**

Strava does not accept raw JSON arrays for sensor data; it requires a file upload.

* **Endpoint:** POST https://www.strava.com/api/v3/uploads
* **Protocol:** multipart/form-data. This is critical. Sending a JSON body will fail. The request must be constructed with a file part.
* **Parameters:**
  * file: The binary content of the generated .fit file.
  * data\_type: Must be explicitly set to fit.
  * activity\_type: Set to ride (for Keiser) or weight\_training (for Hevy).
  * name: "Keiser Indoor Ride (Fused)"
  * description: "Synced via FitGlue. Merged with Fitbit HR data."
* **Specific API Call:**
  Bash
  curl \-X POST https://www.strava.com/api/v3/uploads \\
    \-H "Authorization: Bearer" \\
    \-F file=@/tmp/activity.fit \\
    \-F data\_type="fit" \\
    \-F activity\_type="ride"

.12

### **7.2 Handling Asynchronous Processing**

The upload API is asynchronous. It returns an id (upload ID), not the final activity ID. The system must enter a polling loop.

* **Polling Endpoint:** GET https://www.strava.com/api/v3/uploads/\[upload\_id\]
* **Logic:** Poll every 2 seconds. Check the status field.
  * If status is "Your activity is ready", extract the activity\_id.
  * If error is present (e.g., "Duplicate activity"), handle gracefully (log and exit).

### **7.3 Visual Enrichment: The Map Type Hashtags**

The user requirement includes setting "Map Types" (e.g., visualizing Pace or Heart Rate). Strava does not expose a map\_type parameter in its API. Instead, this feature is unlocked via **Hashtags** in the activity description. This is a "power user" feature supported by Strava's backend.

Supported Hashtags 6:

* **\#PaceMap** / **\#SpeedMap**: Colors the trackline blue, with darker shades indicating higher speed. Ideal for runs or sprints.
* **\#HeartrateMap**: Colors the line red, with darker shades indicating higher cardiac intensity. Best for zone training.
* **\#PowerMap**: Colors the line purple/violet based on wattage. Perfect for the Keiser integration.
* **\#ElevationMap**: Colors the line based on altitude (Black \= high, Yellow \= low).
* **\#GradientMap**: Colors the line Red (climbing) or Green (descending).

Implementation:
Once the activity\_id is obtained from the upload poll, the system issues a final update request.

* **Endpoint:** PUT https://www.strava.com/api/v3/activities/\[activity\_id\]
* **Payload:**
  JSON
  {
    "description": "Keiser Ride. Stats: 200W Avg. \#PowerMap"
  }

  This triggers the Strava backend to re-render the map tiles using the Power stream data contained in the FIT file.1

## ---

**8\. Operational Resilience and Scale**

### **8.1 Rate Limiting and Quotas**

Strava's rate limits (100/15min) are a primary bottleneck. The **Cloud Pub/Sub** architecture provides native resilience. If the egress function hits a rate limit (HTTP 429), it returns a failure code. Pub/Sub is configured with **Exponential Backoff**, ensuring the system retries the request after 10s, 20s, 40s, etc., smoothing out the load without losing data.

### **8.2 Cost Optimization Strategy**

The architecture is designed to be nearly free for low-volume usage (personal use) and linear for scaling.

* **Secrets:** Using Firestore \+ Application Layer Encryption instead of Secret Manager for user tokens saves \~$60/month per 1,000 users.
* **Compute:** Cloud Functions (Gen 2\) billing is granular (100ms increments). Most syncing operations take \< 2 seconds.
* **Storage:** Archiving raw JSON telemetry in Coldline Storage (GCS) minimizes long-term retention costs while keeping data available for re-processing if algorithms improve.

## ---

**9\. Conclusion**

The integration of Hevy, Keiser, Fitbit, and Strava represents a complex interoperability challenge that cannot be solved with simple API-to-API plumbing. It requires a sophisticated **Data Lakehouse** architecture that treats fitness data as first-class, immutable telemetry. By leveraging **Google Cloud Functions** for event-driven logic, **Firestore** for state management, and **Pub/Sub** for resilience, the system effectively bridges the gap between disparate ecosystems.

Key architectural wins include the **Token Vending Machine** for robust authentication management, the **Hybrid Credential Storage** strategy for cost-effective security, and the **Algorithmic Data Fusion** engine that interpolates asynchronous biometric streams to create high-fidelity FIT files. This approach ensures that the final output on Strava is not merely a log of "activity occurred" but a rich, data-driven artifact that leverages advanced features like **\#PowerMap** and **\#HeartrateMap**, providing the user with deep insights into their athletic performance.

#### **Works cited**

1. Cloud-Based Fitness Data Integration (1).txt
2. Webhook Signature Verification \- Apideck, accessed on December 23, 2025, [https://developers.apideck.com/guides/webhook-signature-verification](https://developers.apideck.com/guides/webhook-signature-verification)
3. KeiserCorp/Keiser.Metrics.SDK \- GitHub, accessed on December 23, 2025, [https://github.com/KeiserCorp/Keiser.Metrics.SDK](https://github.com/KeiserCorp/Keiser.Metrics.SDK)
4. Researchers FAQ \- Fitbit Enterprise, accessed on December 23, 2025, [https://fitbit.google/enterprise/researchers-faqs/](https://fitbit.google/enterprise/researchers-faqs/)
5. Get Heart Rate Intraday by Date Range \- Fitbit, accessed on December 23, 2025, [https://dev.fitbit.com/build/reference/web-api/intraday/get-heartrate-intraday-by-date-range/](https://dev.fitbit.com/build/reference/web-api/intraday/get-heartrate-intraday-by-date-range/)
6. Map Types \- Strava Support, accessed on December 23, 2025, [https://support.strava.com/hc/en-us/articles/360049869011-Map-Types](https://support.strava.com/hc/en-us/articles/360049869011-Map-Types)
7. Secret Manager pricing \- Google Cloud, accessed on December 23, 2025, [https://cloud.google.com/secret-manager/pricing](https://cloud.google.com/secret-manager/pricing)
8. Firestore pricing | Google Cloud, accessed on December 23, 2025, [https://cloud.google.com/firestore/pricing](https://cloud.google.com/firestore/pricing)
9. How to Manage OAuth Tokens Without Extra Storage Fees \- HubSpot Developers, accessed on December 23, 2025, [https://developers.hubspot.com/blog/how-to-manage-oauth-tokens-without-extra-storage-fees](https://developers.hubspot.com/blog/how-to-manage-oauth-tokens-without-extra-storage-fees)
10. How to Securely Store OAuth Tokens for Multiple Users and Apps? \- AWS re:Post, accessed on December 23, 2025, [https://repost.aws/questions/QU\_u51s2nbQnOV9XDTBJa-7g/how-to-securely-store-oauth-tokens-for-multiple-users-and-apps](https://repost.aws/questions/QU_u51s2nbQnOV9XDTBJa-7g/how-to-securely-store-oauth-tokens-for-multiple-users-and-apps)
11. What Are Webhooks, and How Do You Implement Them? \- DEV Community, accessed on December 23, 2025, [https://dev.to/flutterwaveeng/what-are-webhooks-and-how-do-you-implement-them-15j4](https://dev.to/flutterwaveeng/what-are-webhooks-and-how-do-you-implement-them-15j4)
12. Uploading \- Strava Developers, accessed on December 23, 2025, [https://developers.strava.com/docs/uploads/](https://developers.strava.com/docs/uploads/)
13. I just found out that you can colour-code the route overview on Strava\! Am I the only one that missed this? \- Reddit, accessed on December 23, 2025, [https://www.reddit.com/r/Strava/comments/jyibzf/i\_just\_found\_out\_that\_you\_can\_colourcode\_the/](https://www.reddit.com/r/Strava/comments/jyibzf/i_just_found_out_that_you_can_colourcode_the/)
