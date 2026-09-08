# VisualinkSpec v1 contributor guide

`VisualinkSpec` is the semantic source format for Visualink explainers. It records what the learner needs to understand; the renderer decides how that meaning becomes layout, SVG, themes, controls, and a standalone HTML file.

## Workflow

```bash
npm run visualink -- validate examples/rag.json
npm run visualink -- render examples/rag.json
npm run visualink -- dev examples/rag.json
```

`render` writes `dist/<spec-name>.html` by default. Use `--output path/to/file.html` to choose another location. `dev` serves one generated preview on `127.0.0.1:4173` and rebuilds when the spec changes.

The public JSON Schema is at `.cursor/skills/visualink/schema/visualink.schema.json`.

## Complete minimal spec

```json
{
  "version": "1.0",
  "concept": {
    "name": "HTTPS request",
    "definition": "HTTPS lets a browser and web server exchange HTTP messages through an authenticated, encrypted connection.",
    "problem": "Plain HTTP exposes requests to reading and modification while they travel across untrusted networks."
  },
  "audience": {
    "role": "Web developers",
    "technicalLevel": "intermediate",
    "goals": ["understand where TLS protects an application request"]
  },
  "nodes": [
    {
      "id": "browser",
      "label": "Browser",
      "caption": "starts the request",
      "type": "actor",
      "description": "The browser verifies the server certificate and sends HTTP through the encrypted connection.",
      "layoutHint": { "rank": 0 }
    },
    {
      "id": "tls-connection",
      "label": "TLS Connection",
      "caption": "authenticated and encrypted",
      "type": "boundary",
      "description": "TLS authenticates the server and protects data in transit.",
      "layoutHint": { "rank": 1 }
    },
    {
      "id": "web-server",
      "label": "Web Server",
      "caption": "handles HTTP",
      "type": "service",
      "description": "The server terminates TLS and passes the HTTP request to the application.",
      "layoutHint": { "rank": 2 }
    }
  ],
  "edges": [
    {
      "id": "browser-to-tls",
      "from": "browser",
      "to": "tls-connection",
      "label": "negotiates",
      "kind": "control",
      "importance": "primary"
    },
    {
      "id": "tls-to-server",
      "from": "tls-connection",
      "to": "web-server",
      "label": "carries HTTP",
      "kind": "data",
      "importance": "primary"
    }
  ],
  "groups": [
    {
      "id": "server-side",
      "label": "Server Side",
      "description": "The systems controlled by the website operator.",
      "nodes": ["web-server"]
    }
  ],
  "chapters": [
    {
      "id": "establish-trust",
      "title": "Establish trust",
      "explanation": "The browser validates the server identity and negotiates encryption before sending the HTTP request.",
      "focusNodes": ["browser", "tls-connection", "web-server"],
      "focusEdges": ["browser-to-tls"],
      "introducedNodes": ["tls-connection"],
      "takeaways": ["TLS protects transport; it does not make application input trustworthy"]
    },
    {
      "id": "send-request",
      "title": "Send HTTP through TLS",
      "explanation": "After the connection is established, encrypted records carry the HTTP request to the server.",
      "focusNodes": ["tls-connection", "web-server"],
      "focusEdges": ["tls-to-server"],
      "focusGroups": ["server-side"]
    }
  ],
  "roleRelevance": {
    "title": "Why this matters for a web developer",
    "points": [
      "TLS protects data in transit but does not replace authentication or input validation."
    ]
  },
  "contextCards": [
    {
      "id": "limits",
      "title": "What HTTPS does not do",
      "points": [
        "It does not prove that user input is safe.",
        "It does not encrypt data after TLS terminates."
      ]
    }
  ],
  "layout": {
    "preferredDirection": "left-to-right"
  }
}
```

## Authoring rules

- Use stable lowercase kebab-case IDs.
- Keep node labels short and put detail in `caption` and `description`.
- Choose semantic node types. Do not choose a type to obtain a preferred color.
- Label important edges with a verb or verb phrase.
- Use groups only for real boundaries or containment.
- Use three to six chapters for a normal explainer. Each chapter should teach one step and reference only existing IDs.
- Use `introducedNodes` for concepts newly explained in a chapter. The overview still shows every node.
- Add `roleRelevance` only when `audience` exists.
- Prefer automatic layout. Optional `rank` and `order` hints are pedagogical ordering hints, not coordinates.
- Never include HTML, CSS, SVG, JavaScript, colors, pixel coordinates, or connector paths.

## Renderer-owned behavior

The shared renderer owns layered placement, nested group bounds, orthogonal edge routes, semantic colors, Dark and Light themes, complete-map overview, chapter focus, introduced-node emphasis, takeaways, role relevance, context cards, hover explanations, keyboard navigation, Play/Pause, pan, zoom/reset, and image export.

If multiple explainers expose the same visual problem, fix `.cursor/skills/visualink/renderer/` or `.cursor/skills/visualink/lib/` rather than adding concept-specific rendering fields.

## Validation

Validation includes the structural schema plus semantic checks for:

- duplicate node, edge, group, chapter, and context-card IDs
- unknown edge endpoints
- unknown node, edge, or group references in chapters
- unknown and duplicate group membership
- group nesting cycles
- unsupported properties, enum values, versions, and layout fields

Errors identify the failing path or semantic ID so an author can repair the spec before rendering.
