---
name: visualink
description: Turns difficult technical concepts into clear, interactive visual maps for non-technical learners. Use when a user asks to visualize, understand, or explain infrastructure, software architecture, networking, AI systems, developer tools, or another technical concept as a standalone HTML explainer.
---

# Visualink

Create a self-contained interactive HTML explainer that helps a non-technical person build an accurate mental model of a technical concept.

The goal is understanding, not decoration. Give the direct answer first, show the full picture second, then guide the learner through connected concepts.

## Start from the learner

Assume the learner may:

- Know the term but not the system behind it
- Be overwhelmed by long technical explanations
- Need to connect the concept to a real work scenario
- Not know which adjacent concepts to ask about

Use plain language without being vague or inaccurate. Define unavoidable jargon where it first appears.

Ask a clarification only when the requested concept has multiple materially different meanings or the learner's context would change the diagram.

## Build the mental model

Before writing HTML, establish:

1. **The answer**: define the requested concept in one or two sentences.
2. **The purpose**: state what problem it solves.
3. **The actors**: identify five to nine essential components.
4. **The boundaries**: show what contains what and what sits outside.
5. **The relationships**: label every important connector with a verb.
6. **The story**: describe one end-to-end path through the system.
7. **The neighbors**: include only adjacent concepts necessary to understand the whole.

Do not turn every related term into a node. Put secondary detail in explanation cards.

## Accuracy

- Verify uncertain technical claims before drawing.
- Keep metaphors short and label them as orientation aids, not literal architecture.
- Do not invent runtime relationships, security boundaries, or failure behavior.
- Make arrow direction match the described action.
- Use one term consistently throughout the explainer.
- Prefer a smaller accurate map over a comprehensive but confusing one.

## Information hierarchy

The page should read in this order:

1. Title
2. One- or two-sentence direct explanation
3. Numbered guided chapters
4. Complete diagram
5. Three compact context cards:
   - How the pieces fit
   - What the neighbors do
   - Why this exists

Selecting a chapter updates the direct explanation to define that chapter's subject before discussing its connections.

## Overview and chapters

- Open on the complete map with no dimmed elements.
- Treat the complete map as the unselected overview state.
- Do not place a “Whole map” item in the numbered chapter navigation.
- Use three to six chapters, ordered from the learner's starting point toward the full system.
- Starting Play from the overview begins at chapter 1.
- A selected chapter may dim unrelated nodes and edges.
- Never dim a parent boundary in a way that washes out focused children.

## Output

Create one portable `.html` file with inline HTML, CSS, SVG, and JavaScript.

- No framework or build step
- No external dependency unless explicitly approved
- Responsive enough for laptop and mobile viewing
- Accessible labels for controls and the main diagram
- Semantic buttons, menu states, and keyboard navigation
- Clear comments around major sections

Open the finished file in a browser when tools permit.

## Visual system

Assign one vivid accent to each semantic category. Use that color consistently for:

- Node accent and border
- Relevant connectors
- Connector labels
- Arrowheads
- Boundary and boundary label when applicable
- Legend entry

Arrowheads must match their connector. For inline SVG, prefer `context-stroke` when supported.

### Dark mode

- Use a cool near-black page and slightly lighter panels.
- Default to Dark unless the user requests otherwise.
- Use bright, high-contrast titles and node labels.
- Keep supporting text readable rather than gray-on-gray.
- Make dashed system boundaries clearly visible and category-aware.
- Use luminous accents without excessive glow.

### Light mode

- Use a bright cool background with white panels.
- Avoid beige, cream, flesh, or muddy warm surfaces unless requested.
- Use saturated category colors for arrows, borders, and boundaries.
- Keep text dark and crisp.

### Shape

- Controls and chapter chips: pill-shaped
- Panels and cards: `8–12px` radius
- Diagram nodes: `6–9px` radius
- Diagram boundaries: `10–14px` radius

Avoid rigid, square interfaces.

## Required controls

### Theme

Use one rounded dropdown trigger that displays the active theme:

- Moon icon + Dark
- Sun icon + Light

Keep both options inside the same dropdown. Expose the selected state and close the menu after selection or an outside click.

### Diagram

Provide:

- Zoom in
- Zoom out
- Reset view
- Pointer-based pan
- Play or pause for guided chapters

### Export

Use one Export menu containing:

- Copy image
- Download PNG

Export the complete diagram at a useful resolution. Remove transient hover and pan state from the exported copy. If clipboard image access is blocked, download the PNG and show a short fallback message.

## Hover behavior

Clickable nodes and controls use a pointer cursor.

When hovering a node:

- Strengthen its border
- Emphasize directly connected edges and neighbors
- Temporarily dim unrelated nodes
- Show a concise explanatory tooltip

Clear the temporary state on pointer leave.

## Iteration

When the user gives visual feedback:

1. Read the screenshot and identify the specific mismatch.
2. Translate the feedback into observable acceptance criteria.
3. Change the smallest coherent set of tokens, selectors, or copy.
4. Preserve unrelated working behavior.
5. Re-render the affected state.
6. Check both themes after shared style changes.
7. Repeat until the screenshot matches the requested direction.

Do not redesign unrelated areas during a narrow feedback round.

## Verification

Before handing off:

- [ ] The core question is answered in one or two sentences.
- [ ] The complete map is visible by default.
- [ ] Only numbered chapters appear in chapter navigation.
- [ ] All important connectors are directional and verb-labeled.
- [ ] Category colors are consistent across nodes, lines, labels, and arrowheads.
- [ ] Dark mode has strong text and boundary contrast.
- [ ] Light mode is bright, cool, and vivid.
- [ ] Theme dropdown, chapters, hover, pan, zoom, and reset work.
- [ ] Copy image and Download PNG are exposed.
- [ ] Rounded corners render cleanly.
- [ ] The page has no syntax or console errors.
- [ ] The layout remains usable at narrower widths.

Do not claim an interaction works based only on source inspection. If browser verification is unavailable, say exactly what remains unverified.
