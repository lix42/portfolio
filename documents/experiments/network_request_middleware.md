# Network Request Middleware at Databricks

## Overview

The Network Request Middleware project was a foundational initiative at Databricks to support **multi-workspace routing** under a single URL—a core requirement of the company's long-term vision for **SPOG (Single Panel Of Glass)**. The middleware introduced a unified, extensible request layer that transparently injected `workspaceId` into all outgoing network requests and centralized the handling of CSRF tokens, session expiration, streaming, and observability.

## Background and Motivation

Databricks user assets (e.g., notebooks, dashboards, data modules) were originally scoped per workspace, and each workspace had its own unique URL. This architecture posed several limitations:

- Workspace URLs were long and not user-friendly
- Users couldn't view or interact with multiple workspaces on a single page
- The frontend couldn't easily support features that spanned multiple workspaces

To address this, Databricks launched **SPOG**, a multi-year initiative to allow users to interact with multiple workspaces via a unified interface. The initial phase included three projects:

1. **SPOG UI Infrastructure** – foundational work, including the network request middleware
2. **SPOG API Service** – a backend that routes requests to the correct workspace
3. **SPOG UI Features** – new frontend features that leverage the multi-workspace model

The middleware was the **linchpin** of SPOG UI Infrastructure, ensuring that `workspaceId` was correctly passed in all frontend network requests.

## Goals and Approach

**Goals:**

- Support multiple workspaces under a single URL by injecting `workspaceId` into all requests
- Replace fragmented request methods with a single unified API
- Centralize handling of security (CSRF tokens, session checks)
- Enable streaming response support and GraphQL compatibility
- Lay the groundwork for global error handling and observability

**Approach:**

Initially, I evaluated low-level solutions like monkey-patching `fetch` or injecting a service worker. While technically viable, these options lacked maintainability. Based on prior experience, I also recognized that Databricks had over **10 fragmented network request methods** across the frontend codebase. To solve both the SPOG and long-standing architectural issues, I proposed and built a **unified network request API** that:

- Centralized logic for request transformation
- Ensured long-term maintainability and extensibility
- Provided a platform layer usable by all frontend teams

## Key Challenges

### 1. Micro Frontend Architecture and Shared State
Databricks uses a micro frontend architecture that doesn't support shared modules. This meant each frontend module had its own isolated instance of any package. To work around this, I used the global RPC registry to manage shared state and request logic.

I registered shared request handlers like `fetchDataRpc` and `sessionDataRpc` to RPC, and built robust boxing/unboxing layers to support:
- Complex types like `Headers`
- Binary response data (`Blob`, `ArrayBuffer`)
- Streaming readers (`ReadableStream`) for fetch responses

### 2. API Fragmentation
At the time, network requests were performed through:
- jQuery, Backbone
- Native `fetch`, raw Axios
- Multiple internal wrappers on both
- Three different GraphQL clients

Each had distinct needs, such as:
- `onUploadProgress` (Axios only)
- Streaming support (fetch only)
- Binary response parsing
- Legacy data formats (e.g., `application/x-www-form-urlencoded`)

The new API needed to accommodate all these constraints.

### 3. Switching Between Axios and Fetch
The middleware dynamically chose between Axios and fetch:
- Used Axios when `onUploadProgress` was needed
- Used fetch for streaming and modern response types

We planned to migrate fully to fetch when native upload progress was supported.

### 4. Testing Constraints
The integration test coverage was under 5%, and most tests used mocked responses. This made regression testing difficult. Instead, I used:
- Feature flags to control rollout
- Internal staging environments for validation
- Deep monitoring to catch real-world regressions early
- Manual regression checklists for high-risk areas (file uploads, large query responses, session expiry)

## Architecture

I selected an existing internal wrapper as the base for the unified API because it already integrated with RPC. After assuming ownership from its original maintainer, I expanded it into a robust, extensible platform.

### Request Interceptor Middleware

A pluggable middleware layer that modifies request configs, injects `workspaceId`, and applies headers. This serves as the core extension point for all cross-cutting request concerns.

### Key Components

- **`fetchDataRpc`**: Core network function that:
  - Injects `workspaceId`
  - Appends CSRF token
  - Performs error handling and session detection

- **`sessionDataRpc`**: Manages CSRF tokens per workspace. Automatically fetches new tokens if expired or missing. Enforces caching and lock-based retry to prevent duplicate token requests.

- **Host App Setup**: Each top-level app (workspace console, account console, SQL) registers `fetchDataRpc` to RPC.

- **API Adapters**: Thin wrappers over `fetchDataRpc` that expose Axios-compatible and fetch-compatible interfaces, easing adoption for teams on legacy request patterns.

- **`spogFetch` API**: New unified API surface used by teams. Internally routes to `fetchDataRpc`. Supports REST, GraphQL, file uploads, downloads, streaming, and advanced retry logic.

### GraphQL Integration

- Replaces legacy middleware with custom `HttpLink` powered by `fetchDataRpc`
- Updates `useQuery` and `useMutation` to inject `workspaceId` automatically

### CSRF and Session Management

- **`CsrfBarrier`**:
  - Pauses in-flight requests when a CSRF error occurs
  - Triggers token refresh via `sessionDataRpc`
  - Resumes all paused requests once resolved

- **`SessionPolicy` Event System**:
  - Publishes `SESSION_EXPIRED`, `LOGIN`, and `SESSION_RESTORED` events
  - React Query and GQL clients pause/resume requests accordingly
  - A global modal prompts users to sign in when needed
  - Session health is verified via a `HealthChecker`

### Observability

- Multi-layer error monitoring built into:
  - `fetchDataRpc`
  - API Adapters
  - GraphQL and React Query clients
- Covers Fetch/Axios errors, middleware transformation errors, and React Query/GraphQL layer failures
- Logging hooks to aid debugging in production and staging
- Allows detection of failures in real time

## Cross-Team Collaboration

The success of this project depended heavily on close collaboration with multiple frontend and platform teams. I initiated and maintained technical partnerships with:

- **Platform UI Team**: Worked together on React Query and GraphQL integrations. Aligned on how to structure the unified request interface and standardized handling of workspace-scoped queries.

- **Security Team**: Validated CSRF strategies and RPC boxing/unboxing formats. Incorporated their feedback into CSRF token management and session recovery design.

- **Feature Teams**: Interviewed and gathered requirements from teams across different products (e.g., Jobs, Compute, SQL) to understand edge cases like streaming logs, binary export in SQL, file downloads, or multipart form uploads.

- **Original Owners of Legacy Libraries**: Reviewed and deprecated older request utilities. Coordinated transitions and provided migration utilities, code examples, and support for migration to the new unified API.

- **GraphQL Platform Team**: While writing my design document, I heard about a team working on a similar initiative. I reached out and discovered they owned the GraphQL platform. Their long-term goal was to unify all network requests under GraphQL, but their first step was to consolidate all REST requests into a single API—which directly overlapped with my project's scope. After reading their design spec, I found they hadn't done sufficient research into the micro frontend architecture constraints, and their plan would have migrated REST requests to an API that didn't meet those requirements. I discussed the issue with them, pointed out the gaps, and shared my design document. After our conversation, they agreed to let me lead the unification of all network requests using my new API. Their team would then continue their GraphQL-specific work using the new API as a foundation.

- **QA and Release Teams**: Established staging environments with feature flags and shared rollout plans. Partnered to monitor regressions, triage issues, and ensure system stability.

This collaboration ensured the middleware not only met SPOG's needs but was also robust and flexible enough to become the foundation for all frontend network communication at Databricks.

## Rollout Strategy

- Launched as an opt-in platform, with detailed migration guides
- Introduced behind feature flags for safe rollout
- Deployed first to internal staging, then incremental rollout to SPOG features and selected high-traffic paths
- Added telemetry and error logging for traceability
- Built custom Grafana dashboards to monitor errors by app/module/request type
- Triggered email and Slack alerts for CSRF/session/streaming failures
- Gradually adopted by teams working on SPOG and other shared UI infrastructure

## Post-Launch Iteration

The project spanned from June 2024 to January 2025. In November 2024, the SPOG prototype went live internally, and we began receiving bug reports. I investigated and fixed these issues, and in the process discovered a gap in the initial design: workspace API URLs were not only used in network requests, but also in contexts like image `src` attributes and `window.open` calls. These usages also required `workspaceId` as a query parameter, but were not covered by the middleware. (URL-based routing had already been handled separately, so that was not affected.)

In January 2025, I initiated a follow-up effort to close this gap. I created new components and APIs to handle cases where API URLs were used outside of standard network requests—such as in image sources or `window.open`. I wrote documentation explaining how to handle these usages, shared it with all frontend teams, and migrated all existing instances across the codebase.

## Results & Impact

- Unblocked SPOG development and cross-workspace features
- Consolidated over 10 disparate network methods into one unified API
- Created a long-term platform layer for secure, observable network traffic
- Improved CSRF/session error resilience across apps
- Reduced confusion and duplication in frontend request logic

## Lessons Learned

- Shared state in micro frontend architectures must be planned carefully
- Supporting multiple request interfaces requires flexible abstraction
- Real-world observability is critical when integration test coverage is low
- Taking ownership of and evolving existing internal tools accelerates delivery
- Design decisions validated through real adoption are more scalable than theoretical alignment
- Proactive cross-team alignment accelerates platform consolidation

---

This system is now the de facto standard for network communication in the Databricks frontend, and it serves as a core piece of infrastructure powering the company's move toward a unified user experience across multiple workspaces.
