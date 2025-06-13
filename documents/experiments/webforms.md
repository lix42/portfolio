# WebForms at DocuSign: Architecture, Implementation, and Leadership Reflections

## Background & Motivation

Before WebForms, DocuSign already supported **PDF templates**—dynamic PDFs embedded with fillable fields that users could complete before finalizing and signing the document. While this approach worked well on desktop, it posed serious usability challenges on mobile. Interacting with form fields inside a PDF—especially on small screens—was often frustrating, slow, and error-prone.

To address this limitation, the WebForms project was created to deliver a **mobile-optimized, form-first experience** that complements the existing PDF workflow. The core idea was to decouple the form input experience from the PDF layout, making it easier for users to complete tasks on mobile devices while still preserving the PDF-based agreement downstream.

### The WebForms Workflow:

1. **Author prepares a PDF template** with fillable fields.
2. **Author uses the WebForms Builder** to create a form-based app that maps those fields into a mobile-friendly interface.
3. **User accesses the WebForms Player** on their device to complete the form.
4. **Submitted data is merged into the PDF template** to generate a finalized document.
5. **The final PDF is signed** by the author or user.

This streamlined experience unblocks many use cases—such as **patient onboarding at clinics**—that previously suffered from poor mobile support. WebForms is also designed to grow into a **general-purpose form builder**, applicable to many workflows beyond PDF augmentation.

## Project Overview

WebForms is a no-code application builder that enables users to create responsive, dynamic forms tied to DocuSign workflows. I joined the team as the most senior frontend engineer among the first three members, helping define and deliver the architecture, feature set, and engineering standards from the ground up.

### Builder

The Builder is a form-authoring environment that allows authors to create **multi-page forms** using a library of configurable components:

- Text input, number input, date picker  
- Checkbox list, dropdown selector  
- Section titles, layout blocks, and more

Authors can:

- Use **expressions** to define dynamic visibility, validation, and computed values
- Set up **expression-based validation rules**
- Manage versions using built-in version control (publish or roll back)
- Auto-generate form layouts from **existing PDF templates**

### Player

The Player renders published forms for end users with a responsive UI optimized for desktop and mobile. It enables:

- Data entry and navigation across pages
- A summary review screen
- Submitting the result
- Transitioning into the **DocuSign signing flow** with the filled PDF

## Architecture & Core Infrastructure

### Data Model: Form

The form schema is modeled as a map:
```ts
Record<ComponentID, FormNode>
```

Each `FormNode` includes:
```ts
{
  componentId: ComponentID;
  type: ComponentType;
  dataId: string;
  ... // type-specific config
  children?: ComponentID[];
}
```

This structure supports tree-like hierarchies while enabling **constant-time access** to any node. We implemented a **tree validation algorithm** to ensure structural integrity.

### Data Model: UserData

User input is stored as:
```ts
Record<ComponentID, ComponentData>
```

Where `ComponentData` is type-checked against its corresponding form component type using advanced TypeScript mappings.

### Monorepo Packages

- `common`: Shared types, data access/mutation functions, validation, optimized rendering helpers
- `builder`: Form authoring UI and logic
- `player`: Mobile-friendly runtime UI
- `service`: DB access, API endpoints, platform integration

### Efficient Rendering with `CommonRender`

We introduced `CommonRender` as a performance-focused rendering layer. It supports both Builder and Player contexts, efficiently rendering form nodes based on change detection.

#### Mechanism:

- `Form` is stored in context
- `CommonRender` receives a `componentId`
- It retrieves the node from context and compares it with the previous version
- If changed: re-renders and caches
- If unchanged: returns the cached element

This layer also evaluates expressions (`visible`, `isValid`) and avoids re-rendering full component trees unnecessarily.

#### Unified Rendering via `RendererMap`

We introduced a `RendererMap` context that maps `ComponentType` to UI components. This allows rendering the same form in:

- Builder Canvas
- Component Panel
- Player Pages
- Summary Page

Each environment sets its own `RendererMap` so `CommonRender` dynamically renders based on context.

### Advanced Type Modeling with TypeScript

To improve type safety and control:

- `ComponentID` is defined as string template unions (`text-${string}`, `dropdown-${string}`)
- `ComponentType` is a predefined union of valid types
- Component types are statically defined with type-safe props

We built:

- A mapping from `ComponentID` → `ComponentType`
- A `ValueTypeMap` to map IDs to data types

This enabled strong compile-time checks and precise runtime validation for both `Form` and `UserData`.

### Component Categorization & Predefined Components

Components are divided into four categories:

1. **Container**: e.g. `Root`, `Page`, `Block`
2. **Simple**: map to primitives (e.g. `Text`, `Dropdown`)
3. **Composite**: predefined blocks like `Address`, saved as JSON
4. **Static**: no input (e.g. `Label`, `Image`)

We also introduced **predefined components** (e.g., `StateDropdown`) to simplify common inputs without requiring authors to build complex configuration manually.


## Expression Engine: Dynamic Visibility and Validation

Expressions are used to control:
- `visible` – whether a component is shown
- `isValid` – custom validation logic

These expressions are defined as strings and stored at the component level in the Form.

### Engine Architecture

We selected [`expression-eval`](https://github.com/donmccurdy/expression-eval) for its small size and extensibility. I built a wrapper engine with:

- Custom function registration
- React hooks (`useExpression`)
- Shared UI components for authoring and evaluation

### Integration in WebForms

- Supported functions were aligned with PM-defined UX requirements
- Added `getData(componentId)` for runtime lookups
- Introduced `this_component` for self-referencing

### Optimized Evaluation

The engine uses multiple caches:
- Parsed AST
- Resolved parameter references
- Evaluation results

This ensures fast execution even for large forms.

### Rule Virtual Editor

To allow authors to define rules visually:
- I defined a structured `Rule` object format
- Mapped `ComponentType → RuleUnit[]` to restrict valid rules
- Created bidirectional converters (Rule ↔ expression string)
- Built an interactive rule editor UI that writes expressions back into the Form schema

## Cross-Functional Collaboration

### Expression Engine Planning

Worked with PM to define supported functions for validation and visibility. This ensured alignment between backend engine capabilities and UI expectations.

### RepeaterComponent Scope Adjustment

I proposed a `RepeaterComponent` to support dynamic structured input. While technically designed and included in the schema, the PM decided to defer implementation to reduce scope for the MVP. I agreed, documented the full spec, and tracked it for future implementation.

## Technical Alignment & Conflict Resolution

Early in the project, another engineer proposed a design with:
- Tree nodes linked by `parentId`
- `Form` and `UserData` combined per user

I raised concerns about:
- `O(n²)` rendering performance
- Storage waste and consistency issues

We discussed it in 1:1s and team meetings but couldn’t reach consensus. I asked for a design doc, but when none came, I wrote my own spec and demoed a prototype.

Despite verbal agreement, the engineer submitted a large PR based on the original design. I wrote over 100 comments, and with my manager’s help, reviewed and refined them before posting.

In a follow-up meeting, we agreed to:
- Merge the PR
- Follow up with incremental PRs to migrate toward my architecture
- Avoid merging PRs with unresolved design conflicts in the future

Over time, our relationship improved. I invited my manager to preview feedback for tone, and I helped the engineer understand how our `UserData` could support Repeaters without embedding schema.

This experience reinforced the importance of:
- Staying calm under pressure
- Leading by example and clarity
- Listening—even when you disagree
- Keeping humility and openness in technical conversations

## Accessibility: Beyond Guidelines

DocuSign's dedicated A11Y team taught me to think beyond surface-level best practices.

### Example: Properties Panel Navigation

In the Builder, authors select a component and edit its properties in a side panel. For keyboard users with vision impairments, this presents a challenge:

- If focus moves into the properties panel, tabbing through every input is tedious
- But skipping it entirely removes key editing functionality

The A11Y team shared a precedent from the PDF signing experience: a **visually hidden button** at the top of the document allows keyboard users to skip directly to the signing position.

Inspired by this, I added a visually hidden skip button to the properties panel. It becomes visible when focused and lets users skip back to the canvas after editing, or skip over the panel entirely.

This taught me:
> Accessibility is not just about following rules—it’s about understanding the goals behind them, imagining real-world scenarios, and crafting inclusive, empathetic solutions.
