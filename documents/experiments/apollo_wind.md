# apollo-wind: Championing a Modern CSS Platform at UiPath

## Overview

When I joined UiPath, the UI platform was a patchwork of Angular components wrapped as WebComponents, supplemented by a locked-down MUI theme. I proposed apollo-wind, a Tailwind-based CSS solution, as the foundation for a modern UI platform — free from WebComponent overhead and Shadow DOM isolation issues. After initial pushback from the UI platform team, I built cross-functional support, secured skip-level approval, and delivered a working foundation with shadcn integration and agent skills for component development. The UI platform team ultimately adopted apollo-wind as part of their next design system version.

## Background and Motivation

### The State of UiPath's UI Platform

UiPath's web application is a dual-framework system — a mix of Angular and React — inherited from a period when the product was primarily Angular and React adoption grew organically. The UI component team had built several layers to bridge the gap:

1. **Angular components** — the original implementation for most UI components
2. **WebComponent wrappers** — Angular components wrapped as WebComponents so React apps could use them
3. **MUI theme** — a Material UI theme provided for React-native components, but locked to an older MUI version

Each layer introduced its own problems:

- **WebComponent performance**: Shadow DOM boundary crossing adds overhead to every render cycle. Props and events must be serialized across the boundary.
- **Shadow DOM style isolation**: CSS cannot cross the Shadow DOM boundary, making it extremely difficult to customize components, apply consistent theming, or debug visual issues. Teams resorted to `::part()` selectors and CSS custom properties, but coverage was inconsistent.
- **Version lock**: The MUI theme was pinned to an older version. Teams that wanted newer MUI features were blocked, and the theme itself required ongoing maintenance to stay compatible with Apollo's design tokens.
- **Developer confusion**: Engineers had to choose between WebComponent-wrapped Angular components and themed MUI components, with different APIs, different styling models, and different limitations. There was no clear "right way" to build UI.

### Why Another Approach?

The existing implementations were all patches connecting the legacy Angular foundation to growing React requirements. None was designed as a long-term solution:

- WebComponents were a bridge technology, not a target architecture
- The MUI theme was a workaround for not having native React components
- Both approaches tied the platform to specific framework versions and imposed constraints that newer patterns (server components, streaming) would struggle with

I believed the platform needed a fundamentally lightweight, framework-agnostic CSS layer that could serve as the foundation for the next generation of UI components — regardless of which rendering framework teams chose.

## Proposal and Initial Pushback

### The apollo-wind Proposal

I proposed building apollo-wind: a Tailwind CSS-based design system utility layer that would:

- Encode Apollo design tokens (colors, spacing, typography, shadows) as Tailwind theme extensions
- Provide utility-first CSS classes that work in any framework without WebComponent boundaries
- Serve as the styling foundation for new React components, replacing both WebComponent wrappers and the MUI theme over time
- Integrate shadcn/ui as a component library — unstyled, composable components that consume the Tailwind theme

### The Pushback

The UI platform team manager pushed back immediately. The core objection: the platform already supported too many implementation patterns (Angular, WebComponents, MUI theme), and adding another would increase complexity and maintenance burden.

This was a reasonable concern. The team was genuinely overextended, and "just add Tailwind" could easily become yet another partially-adopted pattern that fragments the ecosystem further.

### Building the Case

I held my position, but shifted from arguing about Tailwind specifically to framing the problem differently:

**The current implementations are not future-proof.** They're patches connecting a legacy Angular app to growing React requirements. Each patch adds complexity but doesn't move the platform forward. apollo-wind isn't another patch — it's a lightweight foundation that the next UI platform version can build on, regardless of framework.

Key arguments:

- **No runtime overhead**: Tailwind is compile-time CSS. No Shadow DOM, no framework runtime, no WebComponent serialization.
- **Framework agnostic**: The same utility classes work in React, Angular, or any future framework. This is the path off the dual-framework treadmill.
- **Ecosystem alignment**: Tailwind + shadcn is the dominant pattern in the React ecosystem. New hires already know it. Documentation and community support are abundant.
- **Incremental adoption**: Teams can adopt apollo-wind for new components without migrating existing ones. No big bang required.

### Cross-Functional Support

My Slack message proposing apollo-wind drew support from across the organization:

- **Designers** saw an opportunity to get closer to a single source of truth for design tokens
- **Product managers** liked the prospect of faster UI delivery without WebComponent debugging overhead
- **Engineers outside the UI platform** had been frustrated with WebComponent limitations and wanted a lighter alternative

### The Meeting and Approval

We held a meeting with stakeholders from the UI platform team, consuming teams, and design. The skip-level manager of the UI platform team supported treating apollo-wind as an experimental project — not a commitment to full adoption, but a green light to prove the concept.

## Implementation

### Foundation Setup

I set up the apollo-wind package with:

- **Tailwind configuration** mapping Apollo design tokens to Tailwind theme values (colors, spacing, typography, border radius, shadows)
- **CSS base layer** with reset styles and Apollo-specific defaults
- **Component utilities** for common patterns (card layouts, form elements, navigation items)

### shadcn Integration

I integrated shadcn/ui components into apollo-wind, customizing them to match Apollo's design language:

- Adapted shadcn components to use Apollo tokens via the Tailwind theme
- Added variants that match existing Apollo component APIs where possible
- Created documentation showing side-by-side comparisons with existing WebComponent equivalents

### Agent Skills for Development

To make apollo-wind productive from day one, I created coding agent skills for:

- **New component development**: a skill that scaffolds a new component with the correct file structure, Tailwind classes, and test setup
- **Component adoption**: a skill that guides migrating from a WebComponent to its apollo-wind equivalent, including prop mapping and style translation

These skills lowered the barrier for engineers outside the UI platform team to contribute components and adopt apollo-wind in their apps.

## Adoption and Outcome

The UI platform team initially treated apollo-wind as an experiment, but as teams began using it for new features and the developer experience proved significantly better than WebComponent alternatives, the team's position shifted.

The UI platform team agreed to take ownership of apollo-wind and incorporate it as part of the next version of the design system. This was the outcome I'd hoped for — not for apollo-wind to remain a side project, but for it to become the foundation that the platform team builds on.

## Lessons Learned

- When proposing change to a platform team, frame the problem in terms they care about (maintenance burden, support cost) rather than the solution you prefer (Tailwind). The team's pushback was valid — they were protecting themselves from yet another partially-adopted pattern. The argument that worked was "this reduces your future burden" not "Tailwind is better."
- Cross-functional support is a force multiplier. The skip-level manager's approval came partly because designers, PMs, and engineers outside the platform team all voiced support. A proposal with broad grassroots backing is harder to dismiss than a solo technical argument.
- Building a working prototype with agent skills removed the "who will maintain this?" objection. When the platform team saw that engineers could contribute independently using the skills, the maintenance burden concern shrunk significantly.
- Timing matters. I was new to the company and had just delivered the TraceView rewrite, which gave me credibility. Proposing apollo-wind before establishing that track record might have been dismissed as a new-hire opinion rather than an informed recommendation.
- Persistence with respect. I pushed back on the initial rejection but did so by engaging with the team's concerns, not by escalating or going around them. The skip-level meeting happened because the broader interest was visible, not because I forced it.
