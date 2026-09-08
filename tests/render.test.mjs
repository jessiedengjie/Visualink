import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { renderSpec } from "../.cursor/skills/visualink/lib/render.mjs";
import { validateSpec } from "../.cursor/skills/visualink/lib/validate.mjs";

const exampleNames = [
  "kubernetes",
  "kubernetes-csm",
  "kubernetes-engineer",
  "rag",
  "oauth",
  "litellm",
  "litellm-csm"
];

async function loadExample(name) {
  return JSON.parse(
    await readFile(new URL(`../examples/${name}.json`, import.meta.url), "utf8")
  );
}

test("renderer emits every semantic section", async () => {
  const spec = await loadExample("rag");
  const html = await renderSpec(spec);

  for (const node of spec.nodes) {
    assert.match(html, new RegExp(`data-node-id="${node.id}"`));
  }
  for (const edge of spec.edges) {
    assert.match(html, new RegExp(`data-edge-id="${edge.id}"`));
  }
  for (const group of spec.groups) {
    assert.match(html, new RegExp(`data-group-id="${group.id}"`));
  }
  spec.chapters.forEach((_, index) => {
    assert.match(html, new RegExp(`data-chapter-index="${index}"`));
  });

  assert.ok(html.includes(spec.roleRelevance.title));
  for (const card of spec.contextCards) assert.ok(html.includes(card.title));
  assert.ok(html.includes('id="takeaways"'));
  assert.ok(html.includes('id="play"'));
  assert.ok(html.includes('id="theme-menu"'));
  assert.ok(html.includes('id="export-menu"'));
});

test("rendered HTML is standalone and has no unresolved placeholders", async () => {
  const spec = await loadExample("oauth");
  const html = await renderSpec(spec);
  assert.ok(html.startsWith("<!DOCTYPE html>"));
  assert.doesNotMatch(html, /<script[^>]+\bsrc=/i);
  assert.doesNotMatch(html, /<link[^>]+\brel=["']stylesheet/i);
  assert.doesNotMatch(html, /\{\{[^}]+\}\}|\[object Object\]|\bundefined\b/);
  assert.ok(html.includes("window.__VISUALINK_SPEC__="));
  assert.ok(html.includes("<style>"));
});

test("renderer escapes display content and embedded JSON", async () => {
  const spec = await loadExample("kubernetes");
  spec.concept.title = "</script><script>alert('unsafe')</script>";
  const html = await renderSpec(spec);
  assert.doesNotMatch(html, /<script>alert\('unsafe'\)<\/script>/);
  assert.ok(html.includes("&lt;/script&gt;&lt;script&gt;"));
  assert.ok(html.includes("\\u003c/script\\u003e"));
});

test("role-specific specs render audience content", async () => {
  const spec = await loadExample("kubernetes-csm");
  const html = await renderSpec(spec);
  assert.ok(html.includes("For Customer Success Managers"));
  assert.ok(html.includes(spec.roleRelevance.title));
  assert.ok(html.includes(spec.roleRelevance.points[0]));
  assert.doesNotMatch(html, /data-node-id="api-server"/);
});

test("all example specs validate and render", async (t) => {
  for (const name of exampleNames) {
    await t.test(name, async () => {
      const spec = await loadExample(name);
      assert.deepEqual(validateSpec(spec), []);
      const html = await renderSpec(spec);
      assert.ok(html.length > 20_000, `${name} output is unexpectedly small`);
      assert.doesNotMatch(html, /\bNaN\b|Infinity/);
    });
  }
});
