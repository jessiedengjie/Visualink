import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { layoutSpec } from "../.cursor/skills/visualink/lib/layout.mjs";

const spec = JSON.parse(
  await readFile(new URL("../examples/kubernetes.json", import.meta.url), "utf8")
);

function normalize(layout) {
  return {
    width: layout.width,
    height: layout.height,
    direction: layout.direction,
    nodes: [...layout.nodes.entries()],
    groups: [...layout.groups.entries()],
    edges: [...layout.edges.entries()]
  };
}

function overlaps(a, b) {
  return !(
    a.x + a.width <= b.x ||
    b.x + b.width <= a.x ||
    a.y + a.height <= b.y ||
    b.y + b.height <= a.y
  );
}

function contains(outer, inner) {
  const epsilon = 0.001;
  return (
    outer.x <= inner.x + epsilon &&
    outer.y <= inner.y + epsilon &&
    outer.x + outer.width + epsilon >= inner.x + inner.width &&
    outer.y + outer.height + epsilon >= inner.y + inner.height
  );
}

test("layered layout is deterministic", () => {
  assert.deepEqual(normalize(layoutSpec(spec)), normalize(layoutSpec(spec)));
});

test("nodes do not overlap", () => {
  const layout = layoutSpec(spec);
  const nodes = [...layout.nodes.values()];
  for (let left = 0; left < nodes.length; left += 1) {
    for (let right = left + 1; right < nodes.length; right += 1) {
      assert.equal(
        overlaps(nodes[left], nodes[right]),
        false,
        `${nodes[left].id} overlaps ${nodes[right].id}`
      );
    }
  }
});

test("group bounds contain direct members and child groups", () => {
  const layout = layoutSpec(spec);
  for (const group of spec.groups) {
    const bounds = layout.groups.get(group.id);
    for (const nodeId of group.nodes ?? []) {
      assert.ok(contains(bounds, layout.nodes.get(nodeId)), `${group.id} misses ${nodeId}`);
    }
    for (const childId of group.groups ?? []) {
      assert.ok(contains(bounds, layout.groups.get(childId)), `${group.id} misses ${childId}`);
    }
  }
});

test("edge routes and canvas dimensions remain finite", () => {
  const layout = layoutSpec(spec);
  assert.ok(Number.isFinite(layout.width) && layout.width > 0);
  assert.ok(Number.isFinite(layout.height) && layout.height > 0);
  for (const edge of layout.edges.values()) {
    assert.ok(edge.points.length >= 2, `${edge.id} has no usable route`);
    for (const point of [...edge.points, edge.label]) {
      assert.ok(Number.isFinite(point.x), `${edge.id} has an invalid x coordinate`);
      assert.ok(Number.isFinite(point.y), `${edge.id} has an invalid y coordinate`);
    }
  }
});

test("top-to-bottom layout places later ranks lower", () => {
  const verticalSpec = structuredClone(spec);
  verticalSpec.layout.preferredDirection = "top-to-bottom";
  const layout = layoutSpec(verticalSpec);
  assert.ok(layout.nodes.get("container-a").y > layout.nodes.get("image").y);
});

test("sibling groups do not overlap", () => {
  const layout = layoutSpec(spec);
  const siblings = [
    ["control-plane", "worker-a"],
    ["control-plane", "worker-b"],
    ["worker-a", "worker-b"]
  ];
  for (const [leftId, rightId] of siblings) {
    assert.equal(
      overlaps(layout.groups.get(leftId), layout.groups.get(rightId)),
      false,
      `${leftId} overlaps ${rightId}`
    );
  }
});

test("nodes sit only inside ancestor groups", () => {
  const layout = layoutSpec(spec);
  const ancestors = {
    image: [],
    user: [],
    manager: ["cluster", "control-plane"],
    "desired-state": ["cluster", "control-plane"],
    service: ["cluster"],
    "pod-a": ["cluster", "worker-a"],
    "container-a": ["cluster", "worker-a"],
    "pod-b": ["cluster", "worker-b"],
    "container-b": ["cluster", "worker-b"]
  };

  for (const [nodeId, groupIds] of Object.entries(ancestors)) {
    const node = layout.nodes.get(nodeId);
    for (const group of spec.groups) {
      const inside = contains(layout.groups.get(group.id), node);
      const expected = groupIds.includes(group.id);
      assert.equal(inside, expected, `${nodeId} inside ${group.id}`);
    }
  }
});

test("compound layout keeps the Kubernetes map compact", () => {
  const layout = layoutSpec(spec);
  assert.ok(layout.width < 1400, `width ${layout.width} is too wide for the nested campus`);
  assert.ok(layout.nodes.get("image").x < layout.groups.get("cluster").x);
  assert.ok(layout.groups.get("worker-a").x > layout.groups.get("control-plane").x);
});
