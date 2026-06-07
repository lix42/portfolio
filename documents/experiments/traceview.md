# TraceView: Rewriting and Rearchitecting Trace Visualization at UiPath

## Overview

TraceView is the core UI component at UiPath for visualizing AI agent execution traces. When I joined the LLMOps team, TraceView was an Angular component buried under multiple WebComponent wrapper layers, consumed by React apps through a fragile adapter chain. I led a full rewrite to React, then redesigned the internal architecture — introducing an O(1) state model, a unified data layer with real-time updates, and an extensibility system — growing adoption from 4 to 7 consuming apps.

## Background and Motivation

UiPath is an enterprise agentic automation platform. The LLMOps team provides trace and observability services that help customers understand how their AI agents execute. The team's backend ingests and queries trace spans; the frontend renders them through the TraceView component.

### The Wrapper Problem

The original TraceView was implemented as an Angular component (`trace`), but nearly every consuming app was built with React. To bridge the gap, the component was wrapped multiple times:

1. **Angular component** (`trace`) — the actual implementation
2. **Angular Elements WebComponent** (`web-execution-trace`) — first wrapper
3. **Stencil WebComponent** (`ap-execution-trace`) in portal-shell — second wrapper, wrapping the first WebComponent into yet another WebComponent
4. **React wrapper** (`ApExecutionTrace`) in portal-shell-react — thin adapter over the Stencil component

This layering created compounding problems:

- **Performance**: Every prop/state change traversed two WebComponent boundaries and triggered both Angular and React reconciliation. React 18's concurrent rendering was effectively disabled — the Fabric scheduler couldn't detect user interactions or control rendering inside WebComponent boundaries.
- **Bundle bloat**: Apps loaded React, Stencil, and Angular runtimes simultaneously.
- **Knowledge gap**: React developers maintained a component they couldn't read or debug. The Angular internals were effectively a black box, and the wrapper layers made the call stack nearly impossible to trace.
- **Quality decay**: Because no one fully understood the implementation, bugs accumulated and the component settled into a low-quality steady state.

### Why Not Just Fix the Wrappers?

The wrapper layers weren't the root cause — they were symptoms of a framework mismatch. Removing one layer (e.g., Stencil) would still leave Angular running inside a WebComponent inside React. The only path to a clean, maintainable, and performant component was a native React implementation.

## Goals and Approach

**Goals:**

- Replace the Angular/WebComponent stack with a native React component
- Maintain feature parity and interface compatibility with `ApExecutionTrace`
- Avoid breaking changes during migration — consuming apps should transition incrementally
- Improve performance, maintainability, and developer experience
- Create a foundation for architectural improvements (state model, data layer, extensibility)

**Approach: Top-Down Phased Migration**

I evaluated three approaches:

1. **Brand new React component** — clean but risky. All new features would need dual implementation during development, and compatibility was hard to guarantee.
2. **Top-down partial replacement** (chosen) — replace the top-level `trace` facade with a React component that internally renders Angular sub-components via their existing WebComponent wrappers. Then replace sub-components one by one.
3. **Bottom-up partial replacement** — start with the most complex sub-component (`trace-span-view`). This de-risks the hardest piece first but increases architectural complexity during the transition, since Angular components would need to embed React WebComponents.

Option 2 was the best balance: small initial scope, immediate value, and new Angular features automatically flow into the React component until each sub-component is replaced.

### Migration Phases

1. Create `Trace2` React package, using `web-execution-trace-flow` internally
2. Replace `trace-flow` with `TraceFlow2`, still using Angular sub-components for tree, waterfall, and span view
3. Replace remaining Angular sub-components one by one
4. Remove Angular fallback entirely

Each phase shipped behind feature flags (`enableTreeV2`, `enableWaterfallV2`, etc.) so consuming apps could opt in gradually.

## Architecture: State Model

After completing the React rewrite and removing the Angular fallback, I tackled the deeper architectural problems that the original design had accumulated.

### Problems with the Original State Model

The original component transformed raw trace data through multiple intermediate representations, keeping several different state shapes in memory simultaneously. Despite this redundancy:

- Most operations still required O(n) traversals (e.g., finding a span by ID, computing visible nodes)
- No optimization for data updates — every new trace payload triggered a full state recalculation and complete UI re-render
- Selection state was purely uncontrolled — callers couldn't programmatically control which span was selected, forcing some apps to bypass the public API and use internal components directly

### SpanIndex: Canonical State Structure

I designed a single canonical index that all UI operations derive from:

```ts
type SpanIndex<TSpan> = {
  byId: Map<SpanId, TSpan>;
  parentById: Map<SpanId, SpanId | null>;
  childrenById: Map<SpanId, SpanId[]>;
  rootIds: SpanId[];
};
```

This gives:

- **O(1)** span lookup by ID (selection, detail view)
- **O(1)** parent and children access (tree navigation)
- **Cheap list derivations** for tree/waterfall views (DFS/BFS order, filtered order)
- **Scoped mutations** — operations like subtree collapse/expand only touch the affected subtree, not the entire state

### Incremental Updates

With SpanIndex, data updates became incremental. When new spans arrive (via polling or WebSocket), only the changed entries in the index are updated. React components subscribe to specific spans or derived lists, so only affected UI re-renders. This was a dramatic improvement over the previous "recalculate everything" approach.

### Controlled and Uncontrolled Modes

I redesigned the component to support both controlled and uncontrolled patterns for the primary UI state (selection):

- **Uncontrolled** (default): TraceView manages selection internally
- **Controlled**: caller provides `selectedSpanId` + `onSelectedSpanIdChange`

This eliminated the need for apps to reach into internal components for programmatic selection control.

## Architecture: Data Layer

### Problems with the Original Data Fetching

Every consuming app fetched trace data independently using its own code. This led to:

- **Inconsistent implementations**: different caching, error handling, and refetch strategies across apps
- **Stale APIs**: none of the apps used the latest trace API; many were stuck on deprecated endpoints
- **No real-time updates**: most apps polled or did one-shot fetches. The few that used WebSocket notifications gained little — notifications only contained the changed `traceId`, forcing a full trace refetch regardless of what actually changed
- **Poor loading UX**: apps showed blank screens while waiting for the first trace data to appear

### Unified Data Layer

I built a data layer using TanStack Query that provides:

- **Standardized fetching** from the latest trace API with schema-based validation (unknown fields preserved, validation errors reported clearly)
- **Real-time updates** via WebSocket notifications — I updated the backend notification payload to include the changed `spanId`, enabling the data layer to fetch only the updated spans and merge them into the existing cache
- **Stable reference caching** — only changed spans get new object references, so React components downstream can use reference equality to skip unnecessary re-renders
- **Two integration levels**:
  - A single `traceId` prop on `TraceView` — the component handles all data fetching internally with optimized caching and real-time updates
  - A `useTraceQuery` hook — for apps that need trace data outside the component (e.g., for custom UI or analytics)

### Full-Stack WebSocket Improvement

The original WebSocket notification was a blunt instrument: it signaled that a trace had changed, but not which spans were affected. This forced consumers to refetch the entire trace on every notification.

I updated the backend notification to include the changed `spanId`. Combined with the data layer's stable-reference caching, this enabled a pipeline where:

1. WebSocket delivers a changed span ID
2. Data layer fetches only that span
3. SpanIndex updates only the affected entry
4. Only the UI components rendering that span re-render

This turned TraceView into a high-performance real-time viewer suitable for monitoring live agent executions.

## Architecture: Extensibility

### Problems with the Original Design

TraceView renders different detail views for different span types (agent run, tool call, LLM completion, etc.). The original implementation used untyped JSON for span attributes, leading to:

- Defensive runtime checks scattered throughout the rendering code
- No compile-time guarantees about what data each view would receive
- Adding a new span type required modifying deep internals
- App-specific features (like "Add to evaluation set" in one app) inflated the core API with one-off props

### Strongly Typed Span Rendering

After validation and decoding, each span is narrowed to a strongly typed discriminated union by `SpanType`. I set up a registry mapping span types to their view components:

```tsx
// Each view receives strongly typed span data
switch (span.type) {
  case 'agentRun':
    return <AgentRunSpanView span={span} />;
  case 'toolCall':
    return <ToolCallSpanView span={span} />;
  default:
    return <GenericSpanView span={span} />;
}
```

Adding support for a new span type means adding a schema definition and a view component — no changes to the core TraceView code.

### Extension Points

I added two levels of extensibility:

1. **Internal extensions** (in the TraceView repo): the span type → view component map. New span views are added here with full type safety.
2. **External extensions** (`extraTabs` prop): consuming apps pass additional tab components that render alongside the built-in views, using the app's own state and context.
3. **Slot-based extension**: a special slot tab renders a DOM slot element, enabling Angular consuming apps to extend TraceView's detail panel without React. This was critical for the two remaining Angular consumers.

### Enabling New Features

The SpanIndex + data layer + extensibility system proved its value when I added usage cost tracking. This feature required:

- Extra network requests to a separate cost service
- Assembling cost data based on user interaction (which spans are selected/expanded)
- Rendering cost information in the span detail view

With the optimized architecture, this was delivered quickly: the data layer handled fetching, SpanIndex provided efficient span access, and the extensibility system made it easy to add the cost view without modifying core rendering logic.

## Migration and Adoption

### Working with Consuming Teams

When the project started, 4 apps used TraceView. I worked directly with each team to:

- Migrate from `ApExecutionTrace` to the new React component
- Adopt the data layer (replacing custom fetch code with `traceId` prop or `useTraceQuery`)
- Leverage new features like `extraTabs` for app-specific UI

My forward-looking API design paid off during onboarding. When engineers from new teams asked "can we add custom views?", I could point them to `extraTabs` — already shipped and documented. This reduced integration friction and helped grow adoption to 7 consuming apps, with more teams onboarding.

### Moving to a Standalone Repository

Originally, TraceView lived inside the Apollo design system monorepo — a pragmatic choice to leverage existing CI/CD. But a trace visualization component with service dependencies doesn't belong in a design system. After the React rewrite stabilized, I moved TraceView to its own repository, giving it independent versioning, CI, and ownership boundaries.

## Developer Experience and AI-Assisted Development

### Documentation and Agent Skills

I invested heavily in making the TraceView repo productive for both human developers and coding agents:

- **Comprehensive documentation**: every feature, data flow, and extension point is documented and kept current
- **Coding agent skills**: beyond general dev-cycle skills (test, review), I created task-specific skills — for example, a skill that walks through the steps to add UI support for a new span type

This investment changed the contribution model. Most new customer-facing code (e.g., new span type views) is now written by engineers outside my team, working independently with the documentation and agent skills. The repo effectively scales beyond the LLMOps team.

### AI-Assisted Oncall

The LLMOps team's oncall covers the full trace pipeline. As a frontend-focused engineer, I depend heavily on AI assistance for backend incident triage.

The team had an existing oncall triage skill, but it was ineffective: it processed all tickets in a single pass and ran out of context window with more than 8 tickets. I rewrote it in two iterations:

**First iteration**: chunked task processing — the skill processes tickets sequentially in manageable batches, maintaining state across chunks. This fixed the context window limitation.

**Second iteration**: deep investigation — I found the skill rarely identified root causes. I replaced the unstable MCP-based telemetry queries with custom skills, created a living architecture document that the agent references for context, and shifted the interaction model from "agent solves everything" to "agent investigates and presents findings, user pushes deeper." The agent also creates follow-up tasks for root cause fixes or telemetry improvements.

The updated skill proved its value during a Saturday 4 AM Sev 1 incident — I identified the root cause within 3 minutes using the skill's guided investigation.

## Results and Impact

- Eliminated multi-layer WebComponent stack, restoring native React performance and enabling React 18 concurrent features
- Achieved O(1) state operations for most interactions via SpanIndex, replacing O(n) traversals
- Unified data fetching across 7 consuming apps with real-time WebSocket updates and stable-reference caching
- Grew adoption from 4 to 7 consuming apps, with a self-service contribution model enabling engineers outside the team to add features independently
- Established TraceView as a standalone package with clean ownership boundaries

## Lessons Learned

- Phased migration (top-down replacement with feature flags) enables large rewrites without breaking consumers — the key is maintaining interface compatibility at every phase boundary
- A well-designed canonical data structure (SpanIndex) pays compound returns: it simplifies state management, enables incremental updates, and makes new features cheap to build
- Investing in documentation and agent skills creates a force multiplier — the repo scales beyond the owning team when contributors can be productive independently
- When pushing for architectural change, building a working prototype is more persuasive than any document. But the document still matters — it's what people reference after the meeting
- Full-stack thinking (updating WebSocket payloads to include span IDs) can unlock frontend optimizations that would be impossible to achieve with frontend changes alone
- AI-assisted oncall works best as a collaborative tool — the agent investigates and surfaces findings, the human directs depth and makes judgment calls
