import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { validateSpec } from "../.cursor/skills/visualink/lib/validate.mjs";

const kubernetes = JSON.parse(
  await readFile(new URL("../examples/kubernetes.json", import.meta.url), "utf8")
);

function copySpec() {
  return structuredClone(kubernetes);
}

function expectError(spec, expected) {
  const errors = validateSpec(spec);
  assert.ok(
    errors.includes(expected),
    `Expected error:\n${expected}\nActual errors:\n${errors.join("\n")}`
  );
}

test("a valid VisualinkSpec passes", () => {
  assert.deepEqual(validateSpec(kubernetes), []);
});

test("unknown edge endpoint produces an actionable message", () => {
  const spec = copySpec();
  spec.edges[0].to = "missing-node";
  expectError(spec, 'Edge "image-to-manager" references unknown target node "missing-node".');
});

test("unknown edge source produces an actionable message", () => {
  const spec = copySpec();
  spec.edges[0].from = "missing-node";
  expectError(spec, 'Edge "image-to-manager" references unknown source node "missing-node".');
});

test("unknown chapter edge produces an actionable message", () => {
  const spec = copySpec();
  spec.chapters[0].focusEdges.push("missing-edge");
  expectError(spec, 'Chapter "package" references unknown edge "missing-edge".');
});

test("unknown chapter node produces an actionable message", () => {
  const spec = copySpec();
  spec.chapters[0].focusNodes.push("missing-node");
  expectError(spec, 'Chapter "package" references unknown node "missing-node".');
});

test("duplicate node IDs are rejected", () => {
  const spec = copySpec();
  spec.nodes[1].id = spec.nodes[0].id;
  expectError(spec, 'Duplicate node ID "image".');
});

test("invalid version and enum values identify their paths", () => {
  const versionSpec = copySpec();
  versionSpec.version = "2.0";
  expectError(versionSpec, 'version must be exactly "1.0".');

  const enumSpec = copySpec();
  enumSpec.nodes[0].type = "box";
  expectError(
    enumSpec,
    "nodes[0].type must be one of: actor, input, process, service, model, store, infrastructure, boundary, output, concept."
  );
});

test("group cycles are rejected with the full cycle", () => {
  const spec = copySpec();
  spec.groups.find((group) => group.id === "worker-a").groups = ["cluster"];
  expectError(spec, "Group nesting contains a cycle: cluster -> worker-a -> cluster.");
});

test("a node cannot belong to two groups", () => {
  const spec = copySpec();
  spec.groups.find((group) => group.id === "worker-b").nodes.push("pod-a");
  expectError(spec, 'Node "pod-a" belongs to multiple groups: "worker-a" and "worker-b".');
});

test("empty concept fields fail with a path", () => {
  const spec = copySpec();
  spec.concept.definition = "   ";
  expectError(spec, "concept.definition must be a non-empty string.");
});

test("duplicate chapter IDs are rejected", () => {
  const spec = copySpec();
  spec.chapters[1].id = spec.chapters[0].id;
  expectError(spec, 'Duplicate chapter ID "package".');
});
