const IDENTIFIER = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

export const NODE_TYPES = Object.freeze([
  "actor",
  "input",
  "process",
  "service",
  "model",
  "store",
  "infrastructure",
  "boundary",
  "output",
  "concept"
]);

export const EDGE_KINDS = Object.freeze([
  "flow",
  "control",
  "data",
  "dependency",
  "relationship"
]);

export const IMPORTANCE_LEVELS = Object.freeze(["primary", "supporting"]);
export const TECHNICAL_LEVELS = Object.freeze(["beginner", "intermediate", "advanced"]);
export const LAYOUT_DIRECTIONS = Object.freeze(["left-to-right", "top-to-bottom"]);

const ROOT_KEYS = [
  "version",
  "concept",
  "audience",
  "nodes",
  "edges",
  "groups",
  "chapters",
  "roleRelevance",
  "contextCards",
  "layout"
];

export class VisualinkValidationError extends Error {
  constructor(errors) {
    super(`Invalid VisualinkSpec:\n${errors.map((error) => `- ${error}`).join("\n")}`);
    this.name = "VisualinkValidationError";
    this.errors = errors;
  }
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function pushUnknownKeys(value, allowed, path, errors) {
  if (!isObject(value)) return;
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) {
      errors.push(`${path} contains unsupported property "${key}".`);
    }
  }
}

function requireObject(value, path, errors) {
  if (!isObject(value)) {
    errors.push(`${path} must be an object.`);
    return false;
  }
  return true;
}

function requireArray(value, path, errors, { min = 0, max = Infinity } = {}) {
  if (!Array.isArray(value)) {
    errors.push(`${path} must be an array.`);
    return false;
  }
  if (value.length < min) errors.push(`${path} must contain at least ${min} item${min === 1 ? "" : "s"}.`);
  if (value.length > max) errors.push(`${path} must contain at most ${max} items.`);
  return true;
}

function requireString(value, path, errors) {
  if (typeof value !== "string" || value.trim() === "") {
    errors.push(`${path} must be a non-empty string.`);
    return false;
  }
  return true;
}

function optionalString(value, path, errors) {
  if (value === undefined) return true;
  return requireString(value, path, errors);
}

function requireIdentifier(value, path, errors) {
  if (!requireString(value, path, errors)) return false;
  if (!IDENTIFIER.test(value)) {
    errors.push(`${path} must be a lowercase kebab-case identifier.`);
    return false;
  }
  return true;
}

function checkEnum(value, values, path, errors) {
  if (!values.includes(value)) {
    errors.push(`${path} must be one of: ${values.join(", ")}.`);
    return false;
  }
  return true;
}

function checkStringArray(value, path, errors, options) {
  if (!requireArray(value, path, errors, options)) return;
  value.forEach((item, index) => requireString(item, `${path}[${index}]`, errors));
}

function checkIdArray(value, path, errors) {
  if (!requireArray(value, path, errors)) return;
  const seen = new Set();
  value.forEach((item, index) => {
    if (!requireIdentifier(item, `${path}[${index}]`, errors)) return;
    if (seen.has(item)) errors.push(`${path} contains duplicate ID "${item}".`);
    seen.add(item);
  });
}

function checkRequired(value, keys, path, errors) {
  for (const key of keys) {
    if (!hasOwn(value, key)) errors.push(`${path}.${key} is required.`);
  }
}

function registerId(kind, value, seen, errors) {
  if (typeof value !== "string" || !IDENTIFIER.test(value)) return;
  if (seen.has(value)) errors.push(`Duplicate ${kind} ID "${value}".`);
  seen.add(value);
}

function validateConcept(concept, errors) {
  if (!requireObject(concept, "concept", errors)) return;
  pushUnknownKeys(concept, ["name", "shortName", "title", "definition", "problem"], "concept", errors);
  checkRequired(concept, ["name", "definition", "problem"], "concept", errors);
  requireString(concept.name, "concept.name", errors);
  optionalString(concept.shortName, "concept.shortName", errors);
  optionalString(concept.title, "concept.title", errors);
  requireString(concept.definition, "concept.definition", errors);
  requireString(concept.problem, "concept.problem", errors);
}

function validateAudience(audience, errors) {
  if (!requireObject(audience, "audience", errors)) return;
  const keys = ["role", "context", "technicalLevel", "goals"];
  pushUnknownKeys(audience, keys, "audience", errors);
  if (Object.keys(audience).length === 0) errors.push("audience must contain at least one property.");
  optionalString(audience.role, "audience.role", errors);
  optionalString(audience.context, "audience.context", errors);
  if (audience.technicalLevel !== undefined) {
    checkEnum(audience.technicalLevel, TECHNICAL_LEVELS, "audience.technicalLevel", errors);
  }
  if (audience.goals !== undefined) checkStringArray(audience.goals, "audience.goals", errors);
}

function validateNode(node, index, nodeIds, errors) {
  const path = `nodes[${index}]`;
  if (!requireObject(node, path, errors)) return;
  const keys = ["id", "label", "caption", "type", "description", "importance", "group", "layoutHint"];
  pushUnknownKeys(node, keys, path, errors);
  checkRequired(node, ["id", "label", "type", "description"], path, errors);
  requireIdentifier(node.id, `${path}.id`, errors);
  registerId("node", node.id, nodeIds, errors);
  requireString(node.label, `${path}.label`, errors);
  optionalString(node.caption, `${path}.caption`, errors);
  checkEnum(node.type, NODE_TYPES, `${path}.type`, errors);
  requireString(node.description, `${path}.description`, errors);
  if (node.importance !== undefined) {
    checkEnum(node.importance, IMPORTANCE_LEVELS, `${path}.importance`, errors);
  }
  if (node.group !== undefined) requireIdentifier(node.group, `${path}.group`, errors);
  if (node.layoutHint !== undefined) {
    if (requireObject(node.layoutHint, `${path}.layoutHint`, errors)) {
      pushUnknownKeys(node.layoutHint, ["rank", "order"], `${path}.layoutHint`, errors);
      if (node.layoutHint.rank !== undefined &&
          (!Number.isInteger(node.layoutHint.rank) || node.layoutHint.rank < 0)) {
        errors.push(`${path}.layoutHint.rank must be a non-negative integer.`);
      }
      if (node.layoutHint.order !== undefined &&
          (typeof node.layoutHint.order !== "number" || !Number.isFinite(node.layoutHint.order))) {
        errors.push(`${path}.layoutHint.order must be a finite number.`);
      }
    }
  }
}

function validateEdge(edge, index, edgeIds, errors) {
  const path = `edges[${index}]`;
  if (!requireObject(edge, path, errors)) return;
  const keys = ["id", "from", "to", "label", "kind", "importance"];
  pushUnknownKeys(edge, keys, path, errors);
  checkRequired(edge, ["id", "from", "to", "label"], path, errors);
  requireIdentifier(edge.id, `${path}.id`, errors);
  registerId("edge", edge.id, edgeIds, errors);
  requireIdentifier(edge.from, `${path}.from`, errors);
  requireIdentifier(edge.to, `${path}.to`, errors);
  requireString(edge.label, `${path}.label`, errors);
  if (edge.kind !== undefined) checkEnum(edge.kind, EDGE_KINDS, `${path}.kind`, errors);
  if (edge.importance !== undefined) {
    checkEnum(edge.importance, IMPORTANCE_LEVELS, `${path}.importance`, errors);
  }
}

function validateGroup(group, index, groupIds, errors) {
  const path = `groups[${index}]`;
  if (!requireObject(group, path, errors)) return;
  const keys = ["id", "label", "description", "nodes", "groups"];
  pushUnknownKeys(group, keys, path, errors);
  checkRequired(group, ["id", "label"], path, errors);
  requireIdentifier(group.id, `${path}.id`, errors);
  registerId("group", group.id, groupIds, errors);
  requireString(group.label, `${path}.label`, errors);
  optionalString(group.description, `${path}.description`, errors);
  if (group.nodes !== undefined) checkIdArray(group.nodes, `${path}.nodes`, errors);
  if (group.groups !== undefined) checkIdArray(group.groups, `${path}.groups`, errors);
}

function validateChapter(chapter, index, chapterIds, errors) {
  const path = `chapters[${index}]`;
  if (!requireObject(chapter, path, errors)) return;
  const keys = [
    "id",
    "title",
    "shortTitle",
    "explanation",
    "focusNodes",
    "focusEdges",
    "focusGroups",
    "introducedNodes",
    "takeaways"
  ];
  pushUnknownKeys(chapter, keys, path, errors);
  checkRequired(chapter, ["id", "title", "explanation"], path, errors);
  requireIdentifier(chapter.id, `${path}.id`, errors);
  registerId("chapter", chapter.id, chapterIds, errors);
  requireString(chapter.title, `${path}.title`, errors);
  optionalString(chapter.shortTitle, `${path}.shortTitle`, errors);
  requireString(chapter.explanation, `${path}.explanation`, errors);
  for (const key of ["focusNodes", "focusEdges", "focusGroups", "introducedNodes"]) {
    if (chapter[key] !== undefined) checkIdArray(chapter[key], `${path}.${key}`, errors);
  }
  if (chapter.takeaways !== undefined) checkStringArray(chapter.takeaways, `${path}.takeaways`, errors);
}

function validateRoleRelevance(roleRelevance, errors) {
  if (!requireObject(roleRelevance, "roleRelevance", errors)) return;
  pushUnknownKeys(roleRelevance, ["title", "points"], "roleRelevance", errors);
  checkRequired(roleRelevance, ["title", "points"], "roleRelevance", errors);
  requireString(roleRelevance.title, "roleRelevance.title", errors);
  checkStringArray(roleRelevance.points, "roleRelevance.points", errors, { min: 1 });
}

function validateContextCard(card, index, cardIds, errors) {
  const path = `contextCards[${index}]`;
  if (!requireObject(card, path, errors)) return;
  pushUnknownKeys(card, ["id", "title", "points"], path, errors);
  checkRequired(card, ["id", "title", "points"], path, errors);
  requireIdentifier(card.id, `${path}.id`, errors);
  registerId("context card", card.id, cardIds, errors);
  requireString(card.title, `${path}.title`, errors);
  checkStringArray(card.points, `${path}.points`, errors, { min: 1 });
}

function findGroupCycles(groups, errors) {
  const children = new Map(groups.map((group) => [group.id, group.groups ?? []]));
  const visiting = new Set();
  const visited = new Set();

  function visit(id, path) {
    if (visiting.has(id)) {
      const start = path.indexOf(id);
      const cycle = [...path.slice(start), id];
      errors.push(`Group nesting contains a cycle: ${cycle.join(" -> ")}.`);
      return;
    }
    if (visited.has(id)) return;
    visiting.add(id);
    for (const child of children.get(id) ?? []) visit(child, [...path, id]);
    visiting.delete(id);
    visited.add(id);
  }

  for (const id of children.keys()) visit(id, []);
}

function validateReferences(spec, sets, errors) {
  const { nodeIds, edgeIds, groupIds } = sets;

  for (const edge of spec.edges ?? []) {
    if (!isObject(edge) || typeof edge.id !== "string") continue;
    if (typeof edge.from === "string" && !nodeIds.has(edge.from)) {
      errors.push(`Edge "${edge.id}" references unknown source node "${edge.from}".`);
    }
    if (typeof edge.to === "string" && !nodeIds.has(edge.to)) {
      errors.push(`Edge "${edge.id}" references unknown target node "${edge.to}".`);
    }
  }

  const membership = new Map();
  function assignNode(nodeId, groupId, source) {
    if (!nodeIds.has(nodeId)) {
      errors.push(`${source} references unknown node "${nodeId}".`);
      return;
    }
    const previous = membership.get(nodeId);
    if (previous && previous !== groupId) {
      errors.push(`Node "${nodeId}" belongs to multiple groups: "${previous}" and "${groupId}".`);
    } else {
      membership.set(nodeId, groupId);
    }
  }

  for (const node of spec.nodes ?? []) {
    if (!isObject(node) || typeof node.id !== "string" || typeof node.group !== "string") continue;
    if (!groupIds.has(node.group)) {
      errors.push(`Node "${node.id}" references unknown group "${node.group}".`);
    } else {
      assignNode(node.id, node.group, `Node "${node.id}"`);
    }
  }

  const childParents = new Map();
  for (const group of spec.groups ?? []) {
    if (!isObject(group) || typeof group.id !== "string") continue;
    for (const nodeId of group.nodes ?? []) assignNode(nodeId, group.id, `Group "${group.id}"`);
    for (const childId of group.groups ?? []) {
      if (!groupIds.has(childId)) {
        errors.push(`Group "${group.id}" references unknown child group "${childId}".`);
        continue;
      }
      if (childId === group.id) {
        errors.push(`Group "${group.id}" cannot contain itself.`);
        continue;
      }
      const previous = childParents.get(childId);
      if (previous && previous !== group.id) {
        errors.push(`Group "${childId}" belongs to multiple parent groups: "${previous}" and "${group.id}".`);
      } else {
        childParents.set(childId, group.id);
      }
    }
  }
  findGroupCycles((spec.groups ?? []).filter(isObject), errors);

  for (const chapter of spec.chapters ?? []) {
    if (!isObject(chapter) || typeof chapter.id !== "string") continue;
    for (const nodeId of chapter.focusNodes ?? []) {
      if (!nodeIds.has(nodeId)) {
        errors.push(`Chapter "${chapter.id}" references unknown node "${nodeId}".`);
      }
    }
    for (const nodeId of chapter.introducedNodes ?? []) {
      if (!nodeIds.has(nodeId)) {
        errors.push(`Chapter "${chapter.id}" introduces unknown node "${nodeId}".`);
      }
    }
    for (const edgeId of chapter.focusEdges ?? []) {
      if (!edgeIds.has(edgeId)) {
        errors.push(`Chapter "${chapter.id}" references unknown edge "${edgeId}".`);
      }
    }
    for (const groupId of chapter.focusGroups ?? []) {
      if (!groupIds.has(groupId)) {
        errors.push(`Chapter "${chapter.id}" references unknown group "${groupId}".`);
      }
    }
  }
}

export function validateSpec(spec) {
  const errors = [];
  if (!requireObject(spec, "VisualinkSpec", errors)) return errors;
  pushUnknownKeys(spec, ROOT_KEYS, "VisualinkSpec", errors);
  checkRequired(spec, ["version", "concept", "nodes", "edges", "chapters"], "VisualinkSpec", errors);

  if (spec.version !== "1.0") errors.push('version must be exactly "1.0".');
  validateConcept(spec.concept, errors);
  if (spec.audience !== undefined) validateAudience(spec.audience, errors);

  const nodeIds = new Set();
  if (requireArray(spec.nodes, "nodes", errors, { min: 1 })) {
    spec.nodes.forEach((node, index) => validateNode(node, index, nodeIds, errors));
  }

  const edgeIds = new Set();
  if (requireArray(spec.edges, "edges", errors)) {
    spec.edges.forEach((edge, index) => validateEdge(edge, index, edgeIds, errors));
  }

  const groupIds = new Set();
  if (spec.groups !== undefined && requireArray(spec.groups, "groups", errors)) {
    spec.groups.forEach((group, index) => validateGroup(group, index, groupIds, errors));
  }

  for (const id of nodeIds) {
    if (groupIds.has(id)) errors.push(`ID "${id}" is used by both a node and a group.`);
  }

  const chapterIds = new Set();
  if (requireArray(spec.chapters, "chapters", errors, { min: 1, max: 8 })) {
    spec.chapters.forEach((chapter, index) => validateChapter(chapter, index, chapterIds, errors));
  }

  if (spec.roleRelevance !== undefined) {
    validateRoleRelevance(spec.roleRelevance, errors);
    if (spec.audience === undefined) {
      errors.push("roleRelevance requires audience metadata.");
    }
  }

  const cardIds = new Set();
  if (spec.contextCards !== undefined &&
      requireArray(spec.contextCards, "contextCards", errors, { max: 4 })) {
    spec.contextCards.forEach((card, index) => validateContextCard(card, index, cardIds, errors));
  }

  if (spec.layout !== undefined && requireObject(spec.layout, "layout", errors)) {
    pushUnknownKeys(spec.layout, ["preferredDirection"], "layout", errors);
    if (spec.layout.preferredDirection !== undefined) {
      checkEnum(
        spec.layout.preferredDirection,
        LAYOUT_DIRECTIONS,
        "layout.preferredDirection",
        errors
      );
    }
  }

  validateReferences(spec, { nodeIds, edgeIds, groupIds }, errors);
  return errors;
}

export function assertValidSpec(spec) {
  const errors = validateSpec(spec);
  if (errors.length > 0) throw new VisualinkValidationError(errors);
  return spec;
}
