# Network Request Middleware at Databricks

Project Duration: June 2024 – January 2025

## Overview

The Network Request Middleware project was a foundational initiative at
Databricks to support **multi-workspace routing** under a single URL—a core
requirement of the company's long-term vision for **SPOG (Single Pane Of
Glass)**. The middleware introduced a unified, extensible request layer that
transparently injected `workspaceId` into all outgoing network requests and
centralized the handling of CSRF tokens, session expiration, streaming, binary
response handling, and observability.

## Background and Motivation

Databricks user assets (e.g., notebooks, dashboards, data modules) were
originally scoped per workspace, and each workspace had its own unique URL. This
architecture posed several limitations:

- Workspace URLs were long and not user-friendly
- Users couldn't view or interact with multiple workspaces on a single page
- The frontend couldn't easily support features that spanned multiple workspaces

To address this, Databricks launched **SPOG**, a multi-year initiative to allow
users to interact with multiple workspaces via a unified interface. The initial
phase included three projects:

1. **SPOG UI Infrastructure** – foundational work, including the network request
   middleware
2. **SPOG API Service** – a backend that routes requests to the correct
   workspace
3. **SPOG UI Features** – new frontend features that leverage the multi-workspace
   model, such as a unified config page

The middleware was the **linchpin** of SPOG UI Infrastructure, ensuring that
`workspaceId` was correctly passed in all frontend network requests, enabling
SPOG API routing.

## Early Decisions

Initially, I evaluated low-level solutions like monkey-patching `fetch` or
injecting a service worker. These approaches were brittle, hard to test, and
offered poor maintainability. Databricks' frontend was already fragmented with
over **10 different ways** of sending network requests—ranging from raw `fetch`
and Axios to jQuery, Backbone, and various wrappers on top of each. This made
cross-cutting concerns like session handling and CSRF protection difficult to
standardize.

To resolve this, I proposed creating a **unified network request API**, designed
to be extensible, observable, and compatible with all the frontend stacks. It
would serve SPOG's needs while laying a long-term foundation for all Databricks
frontend teams.

## Key Challenges

### 1. Micro Frontend Architecture and Shared State

Databricks uses a micro frontend architecture where each micro app is deployed
independently and does not share memory. As a result, modules cannot rely on
shared singletons or common runtime state.

To share request state like CSRF tokens, I used the company's global function
registry, **RPC**. I registered core request handlers like `fetchDataRpc` and
`sessionDataRpc` to this registry, allowing any micro app to invoke them as
shared services. Because RPC calls serialize data, I extended the
boxing/unboxing system to support:

- JavaScript `Headers` objects
- Binary response data (`Blob`, `ArrayBuffer`)
- Streaming readers for fetch responses

### 2. Heterogeneous Request APIs

The project had to support a wide range of request use cases:

- `onUploadProgress` (XHR/Axios only)
- `ReadableStream` response parsing (fetch only)
- Multipart file uploads
- Legacy data formats (e.g., `application/x-www-form-urlencoded`)

I implemented dual low-level implementation for the unified API:

- **Axios**: used when upload progress tracking is required
- **fetch**: used for streaming and modern workflows

This switch is done dynamically based on request config, allowing gradual
migration while supporting legacy and modern use cases.

### 3. Low Test Coverage

Databricks had **less than 5% integration test coverage** for many core apps,
and most tests relied on mocked responses. To mitigate this:

- All changes were behind **feature flags**, with gradual rollout to staging
- Built **alert hooks** and **internal dashboards** to monitor real traffic
- Developed **manual regression checklists** for high-risk areas (file uploads,
  large query responses, session expiry)

## Architecture

I based the system on an existing RPC-compatible fetch wrapper that I extended
and productionized. Core components:

- **`fetchDataRpc`**: Main entry point for all requests. Injects `workspaceId`,
  CSRF token, common headers. Handles errors, logs telemetry, and selects Axios
  or fetch backend.
- **`sessionDataRpc`**: Tracks CSRF tokens per workspace. Fetches tokens when
  missing or expired. Enforces caching and lock-based retry to prevent duplicate
  token requests.
- **Host App Bootstrapping**: The RPC implementations (`fetchDataRpc`,
  `sessionDataRpc`) are registered by top-level host apps like Workspace
  Console, SQL App, and Account Console.
- **API Adapters**: Drop-in compatibility layers that wrap the unified API and
  mimic legacy Axios/fetch interfaces, easing team adoption.
- **`spogFetch` API**: The primary developer-facing API. Supports REST, GraphQL,
  file uploads, downloads, streaming, and advanced retry logic.
- **GraphQL Integration**: I rewired all GraphQL clients to use a new `HttpLink`
  built on `fetchDataRpc`, bypassing legacy CSRF/session middleware. Updated
  `useQuery` and `useMutation` wrappers to include workspace context.
- **`CsrfBarrier`**: A concurrency-safe gate that pauses outgoing requests when
  a CSRF failure is detected. It triggers `sessionDataRpc` to refresh the token,
  then resumes queued requests.
- **`SessionPolicy` Event System**: Publishes lifecycle events like
  `SESSION_EXPIRED`, `LOGIN`, and `SESSION_RESTORED`. All major consumers
  (GraphQL, React Query) respond to these events to pause or resume requests. A
  global modal prompts user re-authentication when needed. Once logged in, a
  `HealthChecker` confirms session restoration.
- **Observability Layer**: Integrated logging and alerting at all major
  boundaries:
  - Request initiation and completion
  - Axios/fetch failures
  - RPC response decoding
  - Session recovery attempts

## Cross-Team Collaboration

This project required alignment across multiple engineering and platform orgs:

- **Platform UI Team**: Co-designed GraphQL integration strategy. Shared
  requirements for fetch abstraction and workspace-scoped queries.
- **Security Team**: Reviewed token strategy and ensured CSRF mitigation aligned
  with company policy. Helped validate RPC serialization safety.
- **Feature Teams (Jobs, SQL, Compute)**: I proactively interviewed developers
  to gather usage patterns—e.g., binary export in SQL, streaming logs in Jobs.
  These inputs shaped adapter interface and fallback handling.
- **Legacy Library Owners**: Audited and deprecated various internal wrappers.
  Shared migration utilities and code examples to ease adoption.
- **GraphQL Platform Team**: I discovered a parallel initiative aiming to unify
  REST and GraphQL traffic. Their proposed API did not support micro frontend
  constraints. After reviewing their spec and discussing trade-offs, they agreed
  to adopt my API as the unified solution. They retained focus on GraphQL
  tooling while building on my platform.
- **QA and Release Teams**: Worked closely to set up staging environments,
  feature toggles, and monitoring dashboards. Triage regressions during rollout.

## Internal Launch and Follow-Up

In **November 2024**, the SPOG prototype went live internally. We received early
bug reports from users, which I investigated and resolved. During this debugging
phase, I uncovered a gap in the original design: the assumption that
`workspaceId` only needed to be included in network requests.

In reality, some application components generated URLs for use in:

- `<img>` `src` attributes
- `window.open()` calls
- Embedding APIs into markdown and rich content

These URLs also needed to include `workspaceId` as a query parameter to function
properly under the SPOG API gateway.

In **January 2025**, I initiated and completed follow-up work to fix this issue:

- Designed and implemented a new component and utility API for generating
  SPOG-safe URLs
- Updated all known usages across multiple frontend modules
- Documented the correct usage patterns and shared the guidelines company-wide
- Partnered with platform maintainers to ensure all future usages adopted the
  new pattern

This work closed a critical design gap and improved SPOG stability across a
wider set of real-world use cases.

## Rollout Strategy

- Launched as an **opt-in platform**, with detailed migration guides
- **Incremental rollout** to SPOG features and selected high-traffic paths
- Used **feature flags** to control exposure
- Built custom **Grafana dashboards** to monitor errors by app/module/request
  type
- Triggered **email and Slack alerts** for CSRF/session/streaming failures

## Results & Impact

- Unblocked SPOG development and cross-workspace features
- Replaced over 10+ legacy request implementations with one unified platform
- Greatly improved resiliency to CSRF/session errors
- Reduced overhead of adding cross-cutting concerns to request paths
- Became the **default request system** for all new frontend features
- Enabled consistent **observability and security** practices across micro frontends

## Lessons Learned

- Micro frontend environments need deliberate shared state mechanisms
- Dual backends (Axios + fetch) allow flexible evolution while supporting legacy
  needs
- Centralized observability is vital in low-test environments
- Design decisions validated through real adoption are more scalable than
  theoretical alignment
- Proactive cross-team alignment accelerates platform consolidation
- Early internal feedback surfaces edge cases often missed in initial scope

---

This system is now the de facto standard for network communication in the
Databricks frontend. It powers key SPOG experiences and continues to scale with
new product features, reinforcing its role as a core frontend infrastructure
component.
