# WebForms: High-Performance Frontend Architecture for a No-Code Builder

## Background & Motivation

Before WebForms, DocuSign already supported PDF templates—dynamic PDFs embedded with fillable fields that users could complete before finalizing and signing the document. While this approach worked well on desktop, it posed serious usability challenges on mobile. Interacting with form fields inside a PDF—especially on small screens—was often frustrating, slow, and error-prone.

To address this limitation, the WebForms project was created to deliver a mobile-optimized, form-first experience that complements the existing PDF workflow. The core idea was to decouple the form input experience from the PDF layout, making it easier for users to complete tasks on mobile devices while still preserving the PDF-based agreement downstream.

The end-to-end workflow:

1. Author prepares a PDF template with fillable fields.
2. Author uses the WebForms Builder to create a form-based app that maps those fields into a mobile-friendly interface.
3. User accesses the WebForms Player on their device to complete the form.
4. Submitted data is merged into the PDF template to generate a finalized document.
5. The final PDF is signed by the author or user.

This streamlined experience unblocks many use cases—such as patient onboarding at clinics—that previously suffered from poor mobile support. I’ve also experienced this firsthand during a PCC membership sign-up, where I abandoned the process due to the difficulty of filling a PDF form on my phone. WebForms directly addresses this gap.

Looking forward, WebForms is also designed to grow into a general-purpose form builder applicable to many workflows beyond PDF augmentation, and that direction is reflected in the product roadmap.

## Project Overview

WebForms is a no-code application builder that enables users to create responsive, dynamic forms tied to DocuSign workflows. I joined the team as the most senior frontend engineer among the first three members, helping define and deliver the architecture, feature set, and engineering standards from the ground up.

The system consists of two main components: the Builder and the Player, both tightly integrated with the existing DocuSign platform.

### Builder

The Builder is a form-authoring environment that allows authors to create multi-page forms using a library of configurable components, including:

- Text input, number input, date picker
- Checkbox list, dropdown selector
- Section titles and layout blocks

Authors can:

- Use expressions to define dynamic behaviors—such as conditional visibility or computed field values
- Add expression-based validation rules to ensure form correctness
- Manage changes using a basic version control system with the ability to publish a form or roll back to any previously published version
- Automatically generate a form layout from an existing PDF template, mapping fields from the document into editable form components

### Player

The Player is a mobile- and desktop-friendly runtime experience that renders published forms to end users. Users can:

- Fill in form data through a clean, responsive interface
- Navigate across pages and review their input in a summary view
- Submit the form to complete the process

After submission, the Player integrates with the DocuSign signing flow—merging the data into the original PDF template and transitioning the user to the signature experience seamlessly.

## Architecture & Core Infrastructure

I designed the WebForms architecture to support a flexible, schema-driven form system optimized for mobile use, real-time responsiveness, and deep integration with the DocuSign platform. The frontend is built with React and TypeScript, organized into a modular monorepo, and the core of the system revolves around two key data models: Form and UserData.

### Data Model: Form

Semantically, a Form is a hierarchical tree of components, starting from a root node. Each node in the tree represents a form element. I separated components into four categories:

- **Container**: Contains other elements. Examples: Root, Page, Block.
- **Simple Component**: Maps to a single primitive value. Examples: TextComponent, DropdownComponent.
- **Composite Component**: A predefined block containing multiple input elements. Its UserData is a JSON object. Example: Address.
- **Static Component**: Has no input value. Examples: Label, Image.

Later, I found that some components are commonly used but tedious for authors to create. For example, a Dropdown for selecting a U.S. state is conceptually simple, but manually adding 50+ options through the Builder UI is extremely annoying. To solve this, I added predefined components—pre-configured instances that authors can use directly. "State" is one such predefined component: authors drop it in and it works immediately, instead of rebuilding it from a blank Dropdown.

In implementation, the Form is represented as a map:

```TS
Record<ComponentID, FormNode>
```

Each FormNode includes:

```TS
{
  componentId: ComponentID; // unique ID used for rendering and data lookup
  type: ComponentType;
  dataId: string; // public-facing ID for expressions and evaluation
  ... // component-specific configuration
  children?: ComponentID[]; // for container components only
}
```

To ensure the integrity of the structure, I implemented a tree validation algorithm that verifies the graph is a valid, connected, acyclic tree rooted at the root component.

### Data Model: UserData

UserData represents user input collected in the Player. It is implemented as:

```TS
Record<ComponentID, ComponentData>
```

Each entry corresponds to the value (or state) of a specific component, typed and validated based on the form schema. I also leveraged advanced TypeScript typing to statically associate component types with their expected data formats—ensuring robust validation and safe rendering logic across the builder and player.

### Form Runtime Engine: Expression System

The expression engine is the core of WebForms' dynamic behavior, powering two key capabilities: component visibility (show/hide elements based on form state) and custom form validation.

#### Design Philosophy

Early requirements were simple—e.g., show a field when a checkbox is checked. But they quickly grew in complexity: computing values from user input across different data types, supporting author-defined validation rules, and doing all of this through a simple UI where authors don't need to hand-write expressions.

I wanted to avoid a single-door solution. My approach was to use expression-based rules at the data layer, but expose only limited operations on the UI layer. This keeps the author-facing experience simple and straightforward, while preserving compatibility with more powerful expression capabilities for future versions.

#### Expression Engine Selection and Abstraction

I evaluated several expression libraries. [Math.js](https://mathjs.org/) worked but provided a much larger scope of functions than needed. I chose [expression-eval](https://github.com/donmccurdy/expression-eval), which offered exactly the functions we needed with a much smaller code footprint. I also read its source code and was confident that if needed, we could take ownership of it.

On top of expression-eval, I built a more generic expression engine that supports custom function registration. The engine's interface is an abstract layer over the underlying library, so the lower-level engine can be swapped to Math.js or other implementations if needed. I also created React hooks and UI components over the expression engine and added them to the DocuSign shared components library, making them reusable across other DocuSign projects.

#### Integration with WebForms

Integrating the expression engine into WebForms required solving several problems:

- **Supported functions**: I worked with our PM to define all required methods for each data type across both visibility and validation use cases—for example, `date.isLaterThan(...)`, `string.equals(...)`, etc.—and implemented them as registered functions.

- **Accessing UserData**: The expression engine needs to read from the UserData map. I added a `getData(componentId)` function and registered it in the engine, which treats `componentId` as a variable. The `useExpression` hook retrieves `UserData` from context and feeds the data to `getData`. To make expressions more convenient to compose, I also added support for a special variable `this_component`, which resolves to the value bound to the expression's host component.

- **Efficient evaluation with caching**: To avoid redundant computation when form or user data changes, I set up a multi-layer caching strategy. The eval function uses the expression engine to extract all parameters from the expression, replaces `this_component` with the actual `componentId`, and caches the result keyed by expression string. The parsed expression AST is also cached by expression string. Finally, the computed result is cached. If neither the expression string nor the parameter values have changed, the previous cached result is reused.

#### Rule UI: Author-Friendly Expression Editing

Authors need a UI to create expression-based rules without writing raw expressions. I designed a structured rule model:

```typescript
type RuleUnit = {
  functionName: ExpressionFunction; // union of supported expression functions
  parameter1: PrimitiveType | ComponentId;
  parameter2?: PrimitiveType | ComponentId;
}

type Rule = {
  units: RuleUnit[];
  relationship: 'and' | 'or';
}
```

I built functions to convert between expression strings and `Rule` objects, and a UI to render and edit rules. This allows authors to create and modify rules through a user-friendly interface, while the system saves the result as an expression string in the Form data.

Most expression functions have at least one parameter, and the first parameter is always a component. To drive the visual editor, I created a map from `ComponentType` to supported functions:

```typescript
type ComponentTypeRuleUnitMap = {
  [componentType: ComponentType]: RuleUnit[]
}

const typeRulesMap = {
  textComponent: [isFilled, equals, startsWith, contains...],
  dateComponent: [isFilled, equals, isLaterThan, isEarlyThan...],
  ...
}
```

At the UI layer, after the author selects a component (defaulting to `this_component`), the editor checks `typeRulesMap` to determine which functions are available for that component's type, presents them in a dropdown, and provides an input for the optional second parameter. This keeps the editing experience contextual and error-free—authors only see functions that are valid for the selected component type.

### CommonRender: Unified Rendering Engine

One of the key performance challenges in WebForms is efficiently rendering large, dynamic forms as authors edit them in the Builder. Every change to the form structure produces a new version of the Form data map. To ensure a responsive editing experience, I needed to re-render only the components that were actually affected.

#### Why a Map-Based Form Model?

Using a map instead of a strict tree structure is the foundation of the rendering strategy. In a tree, any change to a child node may propagate updates to all of its ancestors, making it difficult to scope changes. With a map (`Record<ComponentID, FormNode>`), updates are isolated to specific component IDs, allowing us to optimize rendering with fine-grained precision.

Each `FormNode` maps 1:1 to a React component instance. However, since the React component tree is inherently hierarchical, I had to solve the challenge of propagating Form data without causing global re-renders.

#### Rendering Optimization Strategy

I introduced a two-part solution:

1. **Form Context Provider**: I store the full Form map in a React Context at the top of the component tree. This allows any node in the tree to access the full set of components without prop-drilling.

2. **CommonRender Component**: Each form node is rendered through a specialized wrapper component:

```TSX
<CommonRender componentId="field-123" />
```

The `CommonRender` is responsible for:

- Reading the form data for its `componentId` from the Form context
- Comparing the current form node to its previous version using useRef to avoid shallow prop diffs
- If the node has changed:
  - Re-rendering the associated React component
  - Updating the internal cache
- If not changed:
  - Returning the cached React element to skip unnecessary render

This pattern creates a thin evaluation layer that intercepts and filters updates, ensuring only the affected components actually re-render. Component developers do not need to manually implement memo or other React-specific optimizations—it's built into the wrapper.

#### RendererMap: Driving Multiple Rendering Contexts

`CommonRender` is used to drive rendering in both the Builder and the Player. The same Form data is rendered in different formats depending on the context—including the Builder canvas, Builder component panel, Player pages, and Player summary page.

To support this, I created a `RendererMap` interface that maps from `ComponentType` to the actual React component to use for rendering. Builder and Player each initialize their own maps and set them in a React Context at the top of their respective rendering surfaces (Builder canvas, component panel, Player page, summary page). `CommonRender` reads the map from this context and uses the appropriate component to render each form node.

This decouples `CommonRender` from any specific rendering target, allowing the same traversal and optimization logic to power all four surfaces without duplication.

#### Expression Integration

Expressions are saved at the component level. Every component—including `Page`—has a `visible` prop, and inputable components additionally have an `isValid` prop. Both props hold expression strings as values.

`CommonRender` integrates with the expression engine's eval function via the `useExpression` hook to calculate expression results. Because expression evaluation has been optimized with multi-layer caching (as described in the Expression System section), this is fast even for large forms. `CommonRender` then uses the results to hide the component when `visible` evaluates to false, or pass validation error information to the child component when `isValid` fails.

This allows real-time reactivity based on form state and user interaction, without bloating individual components with expression logic.

### Advanced Type Modeling with TypeScript

While the map-based Form and UserData structures offer flexibility and performance, they come with tradeoffs in type safety. Naively, these maps are little more than `Record<string, any>`, which poses several issues:

- No static control over whether a component can have children (e.g., TextInput vs. Block)
- No enforced component-specific props (e.g., options only on Dropdown)
- UserData has no guardrails for data validity or type compatibility
- Incorrect combinations (e.g., a Root component with TextInput children) are silently allowed

To address these issues, I applied advanced TypeScript techniques to regain strict typing and expressiveness across the entire data model.

#### Strongly Typed ComponentID with Template Literals

Instead of using plain strings as IDs, I defined them with unique prefixes per component type:

```typescript
type TextComponentID = `text-${string}`
type DropdownComponentID = `dropdown-${string}`

type ComponentID =
  | TextComponentID
  | DropdownComponentID
  | BlockComponentID
  | ...
```

This enables precise tracking of a component's identity and type throughout the system.

#### Discriminated Union for Component Types

Each component is represented as a specific type with a fixed `type` field:

```typescript
type TextComponent = {
  componentId: TextComponentID;
  type: 'text';
  label: string;
  // other text-specific props
}

type BlockComponent = {
  componentId: BlockComponentID;
  type: 'block';
  label: string;
  children: ComponentID[]; // filtered at type level
}
```

By controlling the mapping from ComponentID to its structure, I can enforce that:

- Only container components include children
- children arrays include only valid child types (e.g. BlockComponent can't contain RootComponentID)
- RootComponent can only have PageComponentID[] as children

#### Static Maps for Component Behavior

I defined mapping types to drive consistency and validation across Form and UserData.

Example: Value type mapping

```typescript
type ValueTypeMap = {
  [K in TextComponentID]: string;
  [K in NumberComponentID]: number;
  ...
}
```

These mappings are used to generate:

- Typed `Form`:

```typescript
type Form = Record<ComponentID, Component>
```

- Typed `UserData`:

```typescript
type UserData = {
  [K in ComponentID]?: ValueTypeMap[K]
}
```

This pattern allows inferring the correct value type based on the `ComponentID`, preventing invalid assignments at compile time.

#### Validation Functions

With the type structure in place, I also implemented runtime validators for both:

- Form validation: Ensures tree integrity, correct structure, valid children types, and missing required fields.
- UserData validation: Ensures that user-entered data matches the expected shape and type, derived from `Form`.

Together, these techniques provide strong guarantees at both compile time and runtime, creating a robust foundation for correctness, tooling support, and long-term scalability.

### Monorepo Structure

The WebForms codebase is organized into four well-scoped packages:

- common:
  - Shared types (FormNode, ComponentID, ComponentData)
  - Core data operations (CRUD helpers, validation, expression resolution)
  - Optimized utilities for rendering and change tracking
- builder:
  - UI and interaction logic for form authors
  - Layout editor, component palette, drag-and-drop, versioning
  - Expression and validation editors
- player:
  - Mobile-optimized runtime for form filling
  - User data capture, navigation, summary view, and submit flow
  - Integrates with PDF merge and DocuSign signature experience
- service:
  - Backend API and DB access
  - PDF template import/export
  - Envelope creation and platform integration

## Collaboration & Leadership

- Cross-Team Workflows: Interfaced with backend services for form persistence, PDF merging, and envelope preparation. Worked closely with product managers, designers, and QA to ensure aligned delivery.
- Team Standards: Defined TypeScript and React best practices, enforced code quality via reviews and testing, and mentored new hires as the team scaled.
- Knowledge Sharing: Documented internal APIs, architectural patterns, and onboarding materials to support new engineers and parallel teams.

### Working with PM: Expression Function Definition

When integrating the expression engine, I worked closely with our PM to define the full set of supported functions. I asked him to think through both visibility and validation use cases and list all required methods for each data type. This collaborative process ensured the expression system covered real product needs from day one.

### Working with PM: Scoping the Repeater Component

I had originally designed a `RepeaterComponent`—a container that holds labels and input elements, rendering a "+" button in the Player so users can add multiple blocks of structured data (e.g., a list of addresses). I included the data model in my design, covering how to render the list and how to save the data.

When we planned to implement it, the PM pushed back: none of the targeted user cases for the initial release required Repeaters. To reduce workload and ensure enough time to develop and refine the product before the deadline, he suggested moving this feature to the next release.

I agreed—our data model wouldn't block us from adding Repeater later. I created a ticket to track the work, wrote a document describing how to implement the Repeater, and saved it for a future version. This was a good example of balancing architectural ambition with pragmatic scope management.

### Working with A11Y Team: Keyboard Navigation in the Builder

Before joining DocuSign, I thought I was strong in accessibility—but my approach was mostly following best practices. DocuSign has a dedicated A11Y team that focuses on accessibility starting from the design phase. They are real experts, and I learned a lot from working with them.

One challenge arose in the Builder: when an author selects a component, a properties panel renders on the right side for editing. How should this work for keyboard users who may have vision disabilities? We could render the panel when a component receives focus, but then how does the user enter the panel via keyboard? If pressing Tab moves focus to the first input in the properties panel, the user would have to tab through every input in the panel before reaching the next component on the Builder canvas—which is extremely annoying.

I reviewed this with the A11Y team. They shared an example from DocuSign's signing flow: when a PDF loads, a sighted user can read through it or scroll to the end to sign directly. To give keyboard users the same choice, they added a visually hidden button at the top of the PDF. The button becomes visible when focused, and clicking it jumps directly to the signing position.

I initially wondered if a visually hidden button would break accessibility rules. The A11Y team explained it was fine: mouse/touchpad users never see it and aren't impacted; only keyboard users encounter it, and it's both visible on focus and screen-reader supported.

Inspired by this pattern, I added a visually hidden button at the top of the component properties panel. When activated, it skips everything inside the panel and moves focus to the next stop on the Builder canvas. This gave keyboard users a similar experience to mouse/touchpad users—the ability to inspect component properties or skip past them.

This taught me an important lesson: accessibility is not just about following guidelines and best practices. It requires thinking deeply about the principles behind those guidelines, putting yourself in the shoes of users with disabilities, and solving their problems with creative solutions.

### Navigating a Design Disagreement

When I joined the WebForms team, two engineers were already onboarding. One had been working on the project for a week. I asked him about the current design direction and noticed two concerns:

- **Tree node structure**: Each node was defined as `{ componentId: string, ..., parentId: string }`. To render a map-based tree with only `parentId`, finding each node's children requires an O(n) scan, making the total render time O(n².
- **Merged Form and UserData**: He planned to combine form structure and user data into a single data structure, saving a copy per Player user. This would place immutable form data into every Player session—not only wasting space, but creating a much bigger problem of data consistency.

I thought there might be context I was missing, so I asked him to explain the reasoning in a 1:1. We didn't reach alignment, so I scheduled a broader meeting with all three engineers and our dev manager. We had a good discussion, but he had strong conviction in his approach and we still didn't converge.

I tried a different tactic: I asked him to write a document explaining his rationale so we could evaluate both approaches side by side. After a couple of days with no document, I decided to lead by example—I wrote my own design spec, including the monorepo structure and a draft version of CommonRender, and built a prototype to demonstrate the approach.

I walked the team through my spec in a follow-up meeting, answered all questions, and felt we'd reached alignment. However, he then submitted a large PR implementing his original design. At that point, I realized we needed more structured process.

I drafted thorough review comments on the PR—over 100 in total. Before sending them, I asked my manager to review the comments and help calibrate the tone, since I wanted the feedback to be constructive and focused on the technical merits. She agreed with my assessment and helped me refine the delivery.

After sending the comments, we had another meeting. With my manager facilitating, we reached a practical compromise: his PR would merge to unblock progress, and I would submit follow-up PRs to evolve the codebase toward my design spec. We also established a process norm: no PRs should go out while there's still unresolved disagreement on the design.

From that point, I became much more deliberate about communication. I frequently asked my manager to review my code review comments before publishing. Over time, our working relationship improved significantly. He began sharing more of his reasoning—for example, he had merged Form and UserData because he wanted to support Repeater updates. I explained the data consistency concern and showed how we could save Repeater user data as an array, so that a single block in the Form data could render multiple times based on the UserData array. I had covered this in the first design review, but I think it didn't fully land without the shared context we'd built over time. Once we had mutual trust, the technical alignment followed naturally.

**Reflection**: This experience taught me that technical disagreements are often communication problems in disguise. The things that actually moved us forward—writing a spec, building a prototype, involving my manager for tone calibration, establishing process norms—were all communication investments, not technical ones. It also reinforced something I try to hold onto: stay humble, keep an open mind, genuinely listen to pushback, and always ask whether there's a better approach beyond my first design.

## Impact

- Successfully launched the MVP version of WebForms on time, unlocking key mobile workflows and receiving strong early adoption feedback.
- Created architectural foundations that supported fast iteration and onboarding as new use cases and form types were added.
- Unblocked new DocuSign initiatives that previously struggled with mobile adoption due to PDF limitations.

## Timeline Highlights

- Early 2022: Joined project during initial discovery and technical exploration. Led architecture design.
- Mid 2022: Built and delivered MVP with builder/player, expression engine, and PDF integration.
- Late 2022 – 2023: Scaled form capabilities, improved mobile UX, mentored new engineers, and prepared platform for GA.
