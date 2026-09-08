import { readFile } from "node:fs/promises";
import { assertValidSpec } from "./validate.mjs";
import { layoutSpec } from "./layout.mjs";

const stylesUrl = new URL("../renderer/styles.css", import.meta.url);
const runtimeUrl = new URL("../renderer/runtime.js", import.meta.url);

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("\n", "&#10;");
}

function safeJson(value) {
  return JSON.stringify(value)
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
}

function fixed(value) {
  return Number(value.toFixed(1));
}

function visualFamily(type) {
  if (["actor", "input", "output"].includes(type)) return "external";
  if (["process", "service"].includes(type)) return "service";
  if (type === "model") return "model";
  if (type === "store") return "store";
  if (["infrastructure", "boundary"].includes(type)) return "infra";
  return "concept";
}

function familyLabel(family) {
  return {
    external: "Actors, inputs, and outputs",
    service: "Processes and services",
    model: "Models",
    store: "Stores",
    infra: "Infrastructure",
    concept: "Concepts"
  }[family];
}

function groupFamily(group, spec) {
  const nodeById = new Map(spec.nodes.map((node) => [node.id, node]));
  const groupById = new Map((spec.groups ?? []).map((item) => [item.id, item]));
  const counts = new Map();

  function visit(id) {
    const current = groupById.get(id);
    if (!current) return;
    for (const nodeId of current.nodes ?? []) {
      const node = nodeById.get(nodeId);
      if (!node) continue;
      const family = visualFamily(node.type);
      counts.set(family, (counts.get(family) ?? 0) + 1);
    }
    for (const node of spec.nodes) {
      if (node.group === id) {
        const family = visualFamily(node.type);
        counts.set(family, (counts.get(family) ?? 0) + 1);
      }
    }
    for (const childId of current.groups ?? []) visit(childId);
  }

  visit(group.id);
  let winner = "concept";
  let best = 0;
  for (const [family, count] of counts) {
    if (count > best) {
      winner = family;
      best = count;
    }
  }
  return winner;
}

function renderDefinitions() {
  const kinds = ["flow", "control", "data", "dependency", "relationship"];
  return `<defs>
    ${kinds.map((kind) => `<marker id="arrow-${kind}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,1 L9,5 L0,9 z" fill="context-stroke"/></marker>`).join("\n    ")}
  </defs>`;
}

function renderGroups(spec, layout) {
  const byId = new Map((spec.groups ?? []).map((group) => [group.id, group]));
  return [...layout.groups.values()]
    .sort((a, b) => a.depth - b.depth || a.id.localeCompare(b.id))
    .map((position) => {
      const group = byId.get(position.id);
      return `<g class="group" data-group-id="${escapeAttribute(group.id)}" data-depth="${position.depth}" data-family="${groupFamily(group, spec)}">
        <rect class="group-boundary" x="${fixed(position.x)}" y="${fixed(position.y)}" width="${fixed(position.width)}" height="${fixed(position.height)}" rx="12"/>
        <text class="group-label" x="${fixed(position.x + 13)}" y="${fixed(position.y + 19)}">${escapeHtml(group.label)}</text>
      </g>`;
    })
    .join("\n      ");
}

function renderEdges(spec, layout) {
  return spec.edges.map((edge) => {
    const position = layout.edges.get(edge.id);
    const kind = edge.kind ?? "flow";
    const importance = edge.importance ?? "supporting";
    const path = position.points
      .map((item, index) => `${index === 0 ? "M" : "L"}${fixed(item.x)},${fixed(item.y)}`)
      .join(" ");
    const labelWidth = Math.max(38, Math.min(190, edge.label.length * 5.8 + 14));
    return `<g class="edge" data-edge-id="${escapeAttribute(edge.id)}" data-from="${escapeAttribute(edge.from)}" data-to="${escapeAttribute(edge.to)}" data-kind="${kind}" data-importance="${importance}">
        <path class="edge-path" d="${path}" marker-end="url(#arrow-${kind})"/>
        <rect class="edge-label-bg" x="${fixed(position.label.x - labelWidth / 2)}" y="${fixed(position.label.y - 11)}" width="${fixed(labelWidth)}" height="17" rx="5"/>
        <text class="edge-label" x="${fixed(position.label.x)}" y="${fixed(position.label.y + 1)}" text-anchor="middle">${escapeHtml(edge.label)}</text>
      </g>`;
  }).join("\n      ");
}

function renderNodes(spec, layout) {
  return spec.nodes.map((node) => {
    const position = layout.nodes.get(node.id);
    const labelY = node.caption ? position.y + 27 : position.y + 34;
    const caption = node.caption
      ? `<text class="node-caption" x="${fixed(position.x + 18)}" y="${fixed(position.y + 47)}">${escapeHtml(node.caption)}</text>`
      : "";
    return `<g class="node" data-node-id="${escapeAttribute(node.id)}" data-type="${node.type}" data-importance="${node.importance ?? "primary"}" role="button" tabindex="0" aria-label="${escapeAttribute(`${node.label}: ${node.description}`)}">
        <rect class="node-bg" x="${fixed(position.x)}" y="${fixed(position.y)}" width="${fixed(position.width)}" height="${fixed(position.height)}" rx="8"/>
        <rect class="node-stripe" x="${fixed(position.x)}" y="${fixed(position.y)}" width="4" height="${fixed(position.height)}" rx="2"/>
        <text class="node-label" x="${fixed(position.x + 18)}" y="${fixed(labelY)}">${escapeHtml(node.label)}</text>
        ${caption}
      </g>`;
  }).join("\n      ");
}

function renderDiagram(spec, layout) {
  const aria = spec.audience?.role
    ? `${spec.concept.name} system map for ${spec.audience.role}`
    : `${spec.concept.name} system map`;
  return `<svg id="diagram" viewBox="0 0 ${layout.width} ${layout.height}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${escapeAttribute(aria)}">
    ${renderDefinitions()}
    <g id="scene">
      ${renderGroups(spec, layout)}
      ${renderEdges(spec, layout)}
      ${renderNodes(spec, layout)}
    </g>
  </svg>`;
}

function renderThemeIcon(kind) {
  if (kind === "sun") {
    return `<circle cx="8" cy="8" r="3.15" fill="currentColor"/><g fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M8 1.2v1.7M8 13.1v1.7M1.2 8h1.7M13.1 8h1.7"/><path d="M3.15 3.15l1.2 1.2M11.65 11.65l1.2 1.2M3.15 12.85l1.2-1.2M11.65 4.35l1.2-1.2"/></g>`;
  }
  return `<path fill="currentColor" d="M11.7 11.05A5.35 5.35 0 0 1 6.1 3.15 5.9 5.9 0 1 0 13.4 11.2a5.1 5.1 0 0 1-1.7-.15z"/>`;
}

function renderTools() {
  return `<div class="tools">
    <button class="tool-button" id="play" type="button" aria-label="Play guided chapters">Play</button>
    <div class="drop">
      <button class="tool-button" id="export" type="button" aria-haspopup="menu" aria-expanded="false">Export</button>
      <div class="menu" id="export-menu" role="menu" hidden>
        <button type="button" id="copy-image" role="menuitem">Copy image</button>
        <button type="button" id="download-image" role="menuitem">Download PNG</button>
      </div>
    </div>
    <div class="drop">
      <button class="theme-trigger" id="theme" type="button" aria-haspopup="menu" aria-expanded="false">
        <svg class="theme-icon" id="theme-icon" viewBox="0 0 16 16" aria-hidden="true">${renderThemeIcon("moon")}</svg>
        <span id="theme-label">Dark</span>
        <svg class="chevron" viewBox="0 0 12 12" aria-hidden="true"><path d="m3 4.5 3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <div class="menu" id="theme-menu" role="menu" hidden>
        <button type="button" id="theme-light" role="menuitemradio" aria-checked="false">
          <svg class="theme-icon" viewBox="0 0 16 16" aria-hidden="true">${renderThemeIcon("sun")}</svg>
          Light
        </button>
        <button type="button" id="theme-dark" role="menuitemradio" aria-checked="true">
          <svg class="theme-icon" viewBox="0 0 16 16" aria-hidden="true">${renderThemeIcon("moon")}</svg>
          Dark
        </button>
      </div>
    </div>
  </div>`;
}

function renderChapterStrip(spec) {
  const chapters = spec.chapters.map((chapter, index) => {
    const number = String(index + 1).padStart(2, "0");
    return `<button class="chip" type="button" data-chapter-index="${index}" aria-pressed="false"><b>${number}</b><span>${escapeHtml(chapter.shortTitle ?? chapter.title)}</span></button>`;
  }).join("\n      ");
  return `<section class="strip" aria-label="Guided chapters">
    <div class="strip-meta">
      <div class="eyebrow" id="eyebrow">Overview</div>
      <div class="now" id="now">The whole picture</div>
    </div>
    <div class="chips">${chapters}</div>
    <div class="takeaways" id="takeaways" hidden>
      <div class="eyebrow">Takeaways</div>
      <ul id="takeaway-list"></ul>
    </div>
  </section>`;
}

function renderLegend(spec) {
  const families = [];
  for (const node of spec.nodes) {
    const family = visualFamily(node.type);
    if (!families.includes(family)) families.push(family);
  }
  return `<div class="legend" aria-label="Diagram legend">
    ${families.map((family) => `<div class="legend-item"><span class="legend-swatch" style="--swatch:var(--${family})"></span>${familyLabel(family)}</div>`).join("\n    ")}
  </div>`;
}

function renderRoleRelevance(spec) {
  if (!spec.roleRelevance) return "";
  return `<section class="role-relevance" aria-labelledby="role-relevance-title">
    <div class="eyebrow">Your role</div>
    <h2 id="role-relevance-title">${escapeHtml(spec.roleRelevance.title)}</h2>
    <ul>${spec.roleRelevance.points.map((point) => `<li>${escapeHtml(point)}</li>`).join("")}</ul>
  </section>`;
}

function renderContextCards(spec) {
  if (!spec.contextCards?.length) return "";
  return `<div class="cards">
    ${spec.contextCards.map((card) => `<section class="card">
      <h2>${escapeHtml(card.title)}</h2>
      <ul>${card.points.map((point) => `<li>${escapeHtml(point)}</li>`).join("")}</ul>
    </section>`).join("\n    ")}
  </div>`;
}

export async function renderSpec(spec) {
  assertValidSpec(spec);
  const [styles, runtime] = await Promise.all([
    readFile(stylesUrl, "utf8"),
    readFile(runtimeUrl, "utf8")
  ]);
  const layout = layoutSpec(spec);
  const title = spec.concept.title ?? (
    spec.audience?.role
      ? `${spec.concept.name}, for ${spec.audience.role}`
      : spec.concept.name
  );
  const audience = spec.audience?.role
    ? `<p class="audience">For ${escapeHtml(spec.audience.role)}</p>`
    : spec.audience?.context
      ? `<p class="audience">${escapeHtml(spec.audience.context)}</p>`
      : "";
  const roleRelevance = renderRoleRelevance(spec);
  const cards = renderContextCards(spec);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="generator" content="Visualink renderer 1.0"/>
<title>${escapeHtml(title)}</title>
<style>
${styles.replaceAll("</style", "<\\/style")}
</style>
</head>
<body data-theme="dark">
<main class="app">
  <header class="bar">
    <div class="title">
      <h1>${escapeHtml(title)}</h1>
      ${audience}
      <p class="lede" id="lede">${escapeHtml(spec.concept.definition)}</p>
    </div>
    ${renderTools()}
  </header>
  ${renderChapterStrip(spec)}
  <section class="stage" aria-label="Interactive system map">
    ${renderDiagram(spec, layout)}
    <div class="tip" id="tip" role="tooltip" hidden></div>
    <div class="foot">
      ${renderLegend(spec)}
      <div class="zoom" aria-label="Diagram zoom controls">
        <button id="zoom-out" type="button" aria-label="Zoom out">−</button>
        <span class="zoom-output" id="zoom-output">100%</span>
        <button id="zoom-in" type="button" aria-label="Zoom in">+</button>
        <button id="zoom-reset" type="button" aria-label="Reset view">↺</button>
      </div>
    </div>
  </section>
  <div class="below">
    ${roleRelevance}
    ${cards}
  </div>
</main>
<div class="toast" id="toast" role="status" aria-live="polite" hidden></div>
<script>window.__VISUALINK_SPEC__=${safeJson(spec)};</script>
<script>
${runtime.replaceAll("</script", "<\\/script")}
</script>
</body>
</html>
`;
}
