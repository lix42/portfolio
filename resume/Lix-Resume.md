# Li Xu

- 425-301-4266
- i@xuli.dev
- Kirkland, WA 98034
- [linkedin.com/in/lix42](https://www.linkedin.com/in/lix42/)

## Senior Frontend Engineer

Frontend architect with 15+ years building large-scale web applications at Microsoft, Amazon, DocuSign, Databricks, and UiPath. Specialized in frontend architecture, design systems, real-time data UIs, performance, and AI-assisted development. Known for leading cross-team platform initiatives, shipping durable developer platforms, and scaling teams through practical coding-agent workflows.

## Skills

- **Languages:** TypeScript, JavaScript, HTML, CSS
- **Frameworks:** React, TanStack Query, GraphQL
- **Design Systems:** Tailwind CSS, shadcn/ui, Accessibility (WCAG), Component Architecture
- **Architecture:** Micro Frontends, Real-time/Streaming UIs, BFF APIs, Optimistic UI, State Management
- **Platform:** Performance Optimization, Observability, Developer Experience, Feature-flagged Rollouts
- **AI Development:** Coding Agent Skills, AI-Assisted Workflows, AI Agent Observability (LLMOps)
- **Testing:** Jest, React Testing Library, Cypress, Playwright
- **Tools:** Vite, Webpack

## Experience

### UiPath — Senior Software Engineer

*Sep 2025 – Present*

- Rewrote **TraceView**, UiPath's AI agent trace visualization component, from Angular to React through a phased top-down migration: zero breaking changes across 7 consuming apps, restored native performance, and unblocked React 18 concurrent features.
- Redesigned TraceView state around a custom **SpanIndex**: **O(1)** lookups for most operations and subtree-scoped mutations, enabling rapid feature delivery including a new usage cost service.
- Built a unified **data layer** with TanStack Query for trace fetching, schema validation, WebSocket real-time updates, and stable-reference caching, exposed through both a `traceId` prop and `useTraceQuery` hook.
- Added **telemetry** to TraceView and used interaction data to redesign navigation: identified low toggle discoverability (0.25% of renders) and shipped a Chrome DevTools-inspired unified panel that merges timeline and detail views.
- Championed **apollo-wind**, a Tailwind-based CSS platform replacing legacy Angular WebComponent styling; gained cross-functional support and UI platform adoption for the next design system version.
- Rebuilt the team's **AI-assisted oncall triage** skill with chunked task processing, custom telemetry queries, and a living architecture doc; diagnosed a Saturday 4 AM Sev 1 in 3 minutes.

### Databricks — Senior Frontend Engineer

*Oct 2022 – Jan 2025*

- Led the **Network Request Middleware** project, unifying 10+ fragmented request patterns into one type-safe API for CSRF refresh, session handling, streaming responses, React Query/GraphQL integration, and multi-workspace routing.
- Built a **multi-level error monitoring system** across fetch adapters, React Query, and GraphQL clients, improving reliability in an area with limited integration test coverage.
- Aligned with an overlapping GraphQL Platform team effort on REST unification, consolidating both initiatives into a single API and avoiding months of duplicated work.
- Rolled out via feature flags across micro-frontend apps — became the de facto standard for network communication at Databricks.
- Designed and launched the **Top Navigation Bar** and new **homepage**; improved **File Browser** reliability and UX.

### DocuSign — Principal Frontend Engineer

*Oct 2021 – Oct 2022*

- Designed and implemented core frontend architecture for **WebForms**, DocuSign's no-code app builder, as the most senior frontend engineer on the founding team.
- Built high-performance rendering logic, key features like dynamic schema updates and user logic flows, and contributed to the drag-and-drop UX.
- Partnered with DocuSign's accessibility team to design **WCAG-compliant** keyboard navigation for the Builder, including custom focus-skip controls for property panels.
- Defined frontend coding standards and mentored new engineers.
- Collaborated with backend, design, and QA teams to launch on schedule with strong product feedback.

### Amazon — Senior Frontend Engineer

*Jan 2016 – Oct 2021*

- Led the **UI platform team** for **AWS SageMaker**, delivering foundational components used across the product.
- Built a frontend **sync engine** for real-time collaborative editing in the **Honeycode** no-code builder: optimistic updates, conflict resolution, offline fallback.
- Improved **frontend performance** for Honeycode by optimizing rendering and data sync.
- Enhanced **Amazon.com** performance by refining caching strategies.

### Microsoft — Senior Software Design Engineer

*Jan 2005 – Jan 2016*

- Built frontend features and developer tools for Azure ML and Windows 8 apps.
- Early contributor to JavaScript-based Windows Store apps and internal design system tooling.
