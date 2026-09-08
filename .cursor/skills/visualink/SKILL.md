---
name: visualink
description: Turns difficult technical concepts into clear, interactive visual maps. Use when a user asks to visualize, understand, or explain infrastructure, software architecture, networking, AI systems, developer tools, or another unfamiliar technical concept as a standalone HTML explainer. Adapt the mental model, terminology, depth, examples, and learning path when the user states or implies a role.
license: MIT
compatibility: Requires Node.js 18+ and filesystem write access. Browser tools are recommended for visual and interaction verification.
---

# Visualink

Create a validated `VisualinkSpec` and render it into a self-contained interactive HTML explainer that helps the learner build an accurate mental model of a technical concept.

The goal is understanding, not decoration. Give the direct answer first, show the full picture second, then guide the learner through connected concepts.

The right explanation depends on who is learning. A Customer Success Manager, salesperson, product manager, software engineer, solutions architect, executive, and beginner may ask about the same concept and still need different emphasis, terminology, depth, examples, adjacent concepts, system-map structure, and chapter ordering.

## Start from the learner

Assume the learner may:

- Know the term but not the system behind it
- Be overwhelmed by long technical explanations
- Need to connect the concept to a real work scenario
- Not know which adjacent concepts to ask about

Use plain language without being vague or inaccurate. Define unavoidable jargon where it first appears.

Ask a clarification only when the requested concept has multiple materially different meanings. Do not pause to ask for a job title, persona, or technical level if a useful explainer can already be produced.

## Determine the audience

Before choosing nodes, chapters, or wording, determine who the explanation is for.

1. If the user states a role, use it.
2. If the user describes relevant context instead of a title, infer an audience carefully from that context.
3. If there is no audience or role information, use a general technical-learner default and work exactly as Visualink does for an unspecified learner. Do not invent a persona.

Treat role as a reasoning input, not a label to stamp onto a generic explainer. The audience must change what the map shows, which relationships are primary, how chapters are ordered, how deep terminology goes, and which examples appear.

Do not force the user into a small set of rigid personas. Informal context is enough. For example, "I work with enterprise AI customers but I'm not an engineer" can be read as customer-facing / enterprise AI, with beginner-to-intermediate technical familiarity.

Do not stereotype. A CSM can learn precise vocabulary; an engineer may still need the business purpose. Adaptation is prioritization, not a different technical truth.

### Audience profile

Internally reason with an audience profile. Do not render this JSON in the UI unless the user asks to see the reasoning.

```json
{
  "role": "Customer Success Manager",
  "technicalLevel": "intermediate",
  "goals": [
    "understand customer architecture discussions",
    "explain the concept accurately to customers",
    "recognize important implementation implications"
  ]
}
```

Fill every field from evidence in the request. `role` may be a title, a function, or a short inferred description. `technicalLevel` is a working estimate (`beginner`, `intermediate`, or `advanced`) — not a judgment of the person. Put this audience metadata in the spec when it exists.

When no audience is given, skip the profile and use the general technical-learner default:

- Define the concept in plain language
- Show the smallest accurate system map
- Order chapters from a newcomer's starting point toward the full system
- Omit the "Why this matters to you" section

### Audience heuristics

These are reusable lenses, not an enum and not concept-specific templates. Infer a nearby lens when the user describes a function rather than a title. Combine lenses when needed.

| Lens | Emphasize | Deprioritize | Start chapters from |
| --- | --- | --- | --- |
| Customer-facing (CSM, TAM, support) | Where the concept sits, reliability, operations, vocabulary customers use, how to explain it accurately | Scheduler-level internals, APIs, code | The customer's system and the problem they are trying to solve |
| Sales | Problem, business value, portability, efficiency, reliability, consistency | Implementation vocabulary that does not help a buying conversation | The pain the concept removes |
| Product | User/problem, dependencies, constraints, tradeoffs, terms needed to talk with engineering | Low-level runtime internals unless they constrain the product | The user-visible problem and what this concept enables or blocks |
| Engineering | Core objects, runtime behavior, APIs, desired state, failure, debugging | Purely commercial framing, metaphors that hide the real model | The objects and control flow they will actually touch |
| Architecture / solutions architect | Boundaries, integrations, placement, networking, storage, observability, tradeoffs, failure modes | Tutorial syntax, one-vendor click-paths | System boundaries and interaction points |
| Executive | What it is, why companies use it, where it fits, major benefits and tradeoffs | Jargon, component catalogs, implementation detail | The one-sentence definition and the business reason |
| General technical learner | Clear definition, essential actors, one end-to-end story | Both executive abstraction and specialist internals | The concrete thing they named |

Kubernetes examples of the same underlying system, prioritized differently:

- CSM mental model: Application → Container → Kubernetes, which deploys, scales, recovers, and manages. Show reliability, scaling, deployment, and where Kubernetes sits in a customer stack. Do not lead with scheduler, API-server, or control-plane internals.
- Software engineer mental model: Deployment → ReplicaSet → Pods → Nodes, with Scheduler and API Server closing the loop. Show desired state and reconciliation. Do not hide the real object model behind metaphors.

Use those only as a method check: if two audiences would see the same primary nodes, chapters, and edge labels, the explanation is not adapted enough. Do not copy these maps for unrelated concepts.

## Build the mental model

Before authoring the spec, work through this sequence. The audience should affect steps 3–11.

1. **Determine the concept.** Identify what the learner asked to understand.
2. **Determine audience / role / technical familiarity.** Build the audience profile, or use the general default.
3. **Define the concept** in language appropriate for that audience.
4. **Identify the problem** the concept solves — the problem this audience actually encounters.
5. **Build the minimum useful mental model** for that audience. Five to nine essential components is a starting range, not a quota.
6. **Select only the components that matter for this audience.** Primary nodes are the ideas this learner must hold. Supporting ideas belong in later chapters, cards, or hover text. Do not turn every related term into a node.
7. **Build relationships** between those components. Label every important connector with a verb this audience can use.
8. **Construct an end-to-end story** through the selected map.
9. **Introduce adjacent concepts only when they help the audience's goal.**
10. **Explain why the concept matters specifically in the user's role** when a role or equivalent context exists.
11. **Generate progressive learning chapters** from this audience's starting point toward the full selected map.
12. **End with the complete mental model.** The default view is still the complete map for this audience, not a fragment.

Do not produce one universal architecture diagram and only change the prose around it. Different roles may need different primary nodes, secondary nodes, edge labels, highlighted flows, and chapter sequences. Do not distort technical truth: role adaptation is prioritization of the same system, not a fictional variant of it.

## Accuracy

- Verify uncertain technical claims before drawing.
- Keep metaphors short and label them as orientation aids, not literal architecture.
- Choose examples and analogies from the audience's world. Do not reuse the same metaphor for every role.
- Do not invent runtime relationships, security boundaries, or failure behavior.
- Make arrow direction match the described action.
- Use one term consistently throughout the explainer.
- Prefer a smaller accurate map over a comprehensive but confusing one.
- Match terminology depth to the audience: introduce a term only if this learner needs it, and define it at first use. Engineers should see real system names; non-engineering audiences may use plain language with the official term nearby when customers or colleagues will say it.

## Information hierarchy

The page should read in this order:

1. Title
2. One- or two-sentence direct explanation, in the audience's language
3. Numbered guided chapters
4. Complete diagram for this audience
5. When a role or equivalent audience context exists, a concise **Why this matters for [role]** section
6. Three compact context cards:
   - How the pieces fit
   - What the neighbors do
   - Why this exists

Do not add the "Why this matters" section when the user provided no role or audience context. When it is present, write role-specific insights, not generic filler. Useful tests: would this bullet help the learner in a real conversation, incident, design review, or decision? Would the same bullet be wrong for a different role?

Selecting a chapter updates the direct explanation to define that chapter's subject before discussing its connections.

## Overview and chapters

- Open on the complete map with no dimmed elements.
- Treat the complete map as the unselected overview state.
- Do not place a “Whole map” item in the numbered chapter navigation.
- Use three to six chapters, ordered from this audience's starting point toward the full system.
- Reveal only what the audience needs at that stage: simple mental model → important relationships → deeper layers → complete map.
- Starting Play from the overview begins at chapter 1.
- A selected chapter may dim unrelated nodes and edges.
- Never dim a parent boundary in a way that washes out focused children.

## Spec-first output workflow

Do not hand-author HTML, CSS, SVG, JavaScript, pixel coordinates, colors, or connector paths. The renderer owns layout, themes, interactions, responsiveness, keyboard behavior, pan/zoom, chapter playback, hover, and image export.

1. Locate this skill directory from the path used to read `SKILL.md`.
2. Author a JSON `VisualinkSpec` version `1.0` in the user's working directory. Use `.cursor/skills/visualink/schema/visualink.schema.json` as the public contract and `docs/visualink-spec.md` in the repository as authoring guidance when available.
3. Encode only meaning:
   - `concept`: name, definition, and problem
   - optional `audience`: role/context, technical level, and goals
   - semantic `nodes`, `edges`, and `groups`
   - progressive `chapters` with focus IDs, introduced nodes, and takeaways
   - optional `roleRelevance` and `contextCards`
   - optional `layout.preferredDirection` plus non-pixel node `rank`/`order` hints
4. Validate before rendering:

```bash
node "<skill-directory>/bin/visualink.mjs" validate "<spec-file>.json"
```

5. Render the standalone artifact:

```bash
node "<skill-directory>/bin/visualink.mjs" render "<spec-file>.json" --output "<output-file>.html"
```

6. Open the generated HTML in a browser when tools permit. If the layout or visual behavior is poor across concepts, improve the shared renderer rather than adding concept-specific CSS, SVG paths, or raw markup to the spec.

The output HTML is portable and backend-free. It inlines the shared visual system and runtime, so the learner does not need Node.js to view the finished file.

## VisualinkSpec authoring constraints

- IDs are stable, lowercase kebab-case.
- Node `type` is semantic: `actor`, `input`, `process`, `service`, `model`, `store`, `infrastructure`, `boundary`, `output`, or `concept`.
- Edge labels are concise verbs or verb phrases. Use `kind` to distinguish `flow`, `control`, `data`, `dependency`, and `relationship`.
- Groups express real containment or system boundaries. Do not use groups as decoration.
- Every chapter ID reference must exist. `introducedNodes` marks concepts newly taught in that chapter; it does not hide them from the overview.
- Use `importance: "supporting"` for detail that should recede visually.
- Use layout hints only when the automatic topological order does not tell the clearest pedagogical story. Hints are rank/order numbers, never coordinates.
- Include `roleRelevance` only when audience metadata exists.
- Do not place HTML, Markdown, CSS, SVG, URLs, executable code, or event handlers in text fields.

The schema and validator reject unsupported properties, duplicate IDs, unknown references, duplicate membership, invalid enums, and group cycles with path-aware errors.

## Iteration

When the user gives visual feedback:

1. Read the screenshot and identify the specific mismatch.
2. Translate the feedback into observable acceptance criteria.
3. Decide whether it is a semantic-content problem or a shared-renderer problem.
4. For content, change the smallest coherent part of the spec. For visual or interaction behavior, change the shared renderer.
5. Preserve unrelated working behavior.
6. Validate and re-render the affected artifact.
7. Check both themes after shared style changes.
8. Repeat until the screenshot matches the requested direction.

Do not redesign unrelated areas during a narrow feedback round.

## Verification

Before handing off:

- [ ] The spec passes `visualink validate` with no warnings or unresolved references.
- [ ] The spec contains semantic data only: no coordinates, SVG paths, CSS, colors, or executable code.
- [ ] The core question is answered in one or two sentences appropriate to the audience.
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
- [ ] If a role or audience was given, the diagram itself differs from a generic map of the same concept, not only the surrounding prose.
- [ ] If a role or audience was given, chapters, terminology depth, examples, and "Why this matters" are specific to that audience.
- [ ] If no role or audience was given, the explainer uses the general technical-learner default and has no "Why this matters to you" section.

Do not claim an interaction works based only on source inspection. If browser verification is unavailable, say exactly what remains unverified.
