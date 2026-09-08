const DEFAULTS = Object.freeze({
  margin: 48,
  rankGap: 92,
  rowGap: 36,
  groupPadding: 22,
  groupLabelHeight: 26,
  groupGap: 20
});

function clamp(min, value, max) {
  return Math.max(min, Math.min(value, max));
}

function measureNode(node) {
  const longest = Math.max(node.label.length, node.caption?.length ?? 0);
  return {
    width: clamp(144, 44 + longest * 7.2, 224),
    height: node.caption ? 66 : 54
  };
}

function stronglyConnectedComponents(ids, edges) {
  const adjacency = new Map(ids.map((id) => [id, []]));
  for (const edge of edges) adjacency.get(edge.from)?.push(edge.to);

  let index = 0;
  const stack = [];
  const onStack = new Set();
  const indexes = new Map();
  const lowlinks = new Map();
  const components = [];

  function visit(id) {
    indexes.set(id, index);
    lowlinks.set(id, index);
    index += 1;
    stack.push(id);
    onStack.add(id);

    for (const next of adjacency.get(id) ?? []) {
      if (!indexes.has(next)) {
        visit(next);
        lowlinks.set(id, Math.min(lowlinks.get(id), lowlinks.get(next)));
      } else if (onStack.has(next)) {
        lowlinks.set(id, Math.min(lowlinks.get(id), indexes.get(next)));
      }
    }

    if (lowlinks.get(id) === indexes.get(id)) {
      const component = [];
      let current;
      do {
        current = stack.pop();
        onStack.delete(current);
        component.push(current);
      } while (current !== id);
      components.push(component);
    }
  }

  for (const id of ids) {
    if (!indexes.has(id)) visit(id);
  }
  return components;
}

function assignRanks(items, edges) {
  const ids = items.map((item) => item.id);
  const components = stronglyConnectedComponents(ids, edges);
  const componentById = new Map();
  components.forEach((members, component) => {
    members.forEach((id) => componentById.set(id, component));
  });

  const outgoing = new Map(components.map((_, index) => [index, new Set()]));
  const indegree = new Map(components.map((_, index) => [index, 0]));
  for (const edge of edges) {
    const from = componentById.get(edge.from);
    const to = componentById.get(edge.to);
    if (from === undefined || to === undefined || from === to || outgoing.get(from).has(to)) continue;
    outgoing.get(from).add(to);
    indegree.set(to, indegree.get(to) + 1);
  }

  const queue = [...indegree.entries()]
    .filter(([, count]) => count === 0)
    .map(([id]) => id)
    .sort((a, b) => a - b);
  const componentRank = new Map(components.map((_, index) => [index, 0]));

  while (queue.length > 0) {
    const component = queue.shift();
    for (const next of outgoing.get(component)) {
      componentRank.set(next, Math.max(componentRank.get(next), componentRank.get(component) + 1));
      indegree.set(next, indegree.get(next) - 1);
      if (indegree.get(next) === 0) {
        queue.push(next);
        queue.sort((a, b) => a - b);
      }
    }
  }

  const rank = new Map();
  for (const item of items) {
    rank.set(item.id, item.rankHint ?? componentRank.get(componentById.get(item.id)) ?? 0);
  }
  return rank;
}

function buildMembership(spec) {
  const nodeById = new Map(spec.nodes.map((node) => [node.id, node]));
  const groupById = new Map((spec.groups ?? []).map((group) => [group.id, group]));
  const parentGroup = new Map();
  const directGroup = new Map();

  for (const group of spec.groups ?? []) {
    for (const nodeId of group.nodes ?? []) directGroup.set(nodeId, group.id);
    for (const childId of group.groups ?? []) parentGroup.set(childId, group.id);
  }
  for (const node of spec.nodes) {
    if (node.group) directGroup.set(node.id, node.group);
  }

  function groupPath(nodeId) {
    const path = [];
    let current = directGroup.get(nodeId);
    while (current) {
      path.unshift(current);
      current = parentGroup.get(current);
    }
    return path;
  }

  function groupDepth(groupId) {
    let depth = 0;
    let current = parentGroup.get(groupId);
    while (current) {
      depth += 1;
      current = parentGroup.get(current);
    }
    return depth;
  }

  function descendantNodeIds(groupId, result = new Set()) {
    const group = groupById.get(groupId);
    if (!group) return result;
    for (const nodeId of group.nodes ?? []) result.add(nodeId);
    for (const node of spec.nodes) {
      if (node.group === groupId) result.add(node.id);
    }
    for (const childId of group.groups ?? []) descendantNodeIds(childId, result);
    return result;
  }

  return { nodeById, groupById, parentGroup, directGroup, groupPath, groupDepth, descendantNodeIds };
}

function topLevelGroupIds(spec, membership) {
  return (spec.groups ?? [])
    .filter((group) => !membership.parentGroup.has(group.id))
    .map((group) => group.id);
}

function directNodeIds(spec, groupId, membership) {
  if (groupId == null) {
    return spec.nodes.filter((node) => !membership.directGroup.has(node.id)).map((node) => node.id);
  }
  const ids = new Set(membership.groupById.get(groupId)?.nodes ?? []);
  for (const node of spec.nodes) {
    if (node.group === groupId) ids.add(node.id);
  }
  return [...ids];
}

function itemForNode(nodeId, itemIds, membership) {
  if (itemIds.has(nodeId)) return nodeId;
  let current = membership.directGroup.get(nodeId);
  while (current) {
    if (itemIds.has(current)) return current;
    current = membership.parentGroup.get(current);
  }
  return null;
}

function itemOrderHint(item, membership) {
  if (item.kind === "node") return item.node.layoutHint?.order;
  const orders = [...membership.descendantNodeIds(item.id)]
    .map((id) => membership.nodeById.get(id)?.layoutHint?.order)
    .filter((value) => value !== undefined);
  return orders.length ? Math.min(...orders) : undefined;
}

function contractEdges(spec, itemIds, membership) {
  const edges = [];
  const seen = new Set();
  for (const edge of spec.edges) {
    const from = itemForNode(edge.from, itemIds, membership);
    const to = itemForNode(edge.to, itemIds, membership);
    if (!from || !to || from === to) continue;
    const key = `${from}->${to}`;
    if (seen.has(key)) continue;
    seen.add(key);
    edges.push({ from, to });
  }
  return edges;
}

function placeItems(items, ranks, edges, options, horizontal) {
  const indexes = new Map(items.map((item, index) => [item.id, index]));
  const incoming = new Map(items.map((item) => [item.id, []]));
  for (const edge of edges) incoming.get(edge.to)?.push(edge.from);

  const byRank = new Map();
  for (const item of items) {
    const rank = ranks.get(item.id);
    if (!byRank.has(rank)) byRank.set(rank, []);
    byRank.get(rank).push(item);
  }

  const orderedRanks = [...byRank.keys()].sort((a, b) => a - b);
  const placedOrder = new Map();
  for (const rank of orderedRanks) {
    byRank.get(rank).sort((a, b) => {
      const hintedA = a.orderHint;
      const hintedB = b.orderHint;
      if (hintedA !== undefined || hintedB !== undefined) {
        if (hintedA === undefined) return 1;
        if (hintedB === undefined) return -1;
        if (hintedA !== hintedB) return hintedA - hintedB;
      }
      const predecessorsA = incoming.get(a.id).filter((id) => placedOrder.has(id));
      const predecessorsB = incoming.get(b.id).filter((id) => placedOrder.has(id));
      const barycenter = (ids) => ids.length
        ? ids.reduce((sum, id) => sum + placedOrder.get(id), 0) / ids.length
        : Infinity;
      const delta = barycenter(predecessorsA) - barycenter(predecessorsB);
      if (Number.isFinite(delta) && delta !== 0) return delta;
      return indexes.get(a.id) - indexes.get(b.id);
    });
    byRank.get(rank).forEach((item, order) => placedOrder.set(item.id, order));
  }

  const rankPrimarySize = new Map();
  const rankCrossSize = new Map();
  for (const rank of orderedRanks) {
    const members = byRank.get(rank);
    rankPrimarySize.set(
      rank,
      Math.max(...members.map((item) => horizontal ? item.width : item.height))
    );
    rankCrossSize.set(
      rank,
      members.reduce((sum, item, index) => {
        const size = horizontal ? item.height : item.width;
        const gap = index === 0 ? 0 : (item.kind === "group" || members[index - 1].kind === "group"
          ? options.groupGap
          : options.rowGap);
        return sum + size + gap;
      }, 0)
    );
  }

  const maxCross = Math.max(...rankCrossSize.values(), 0);
  const primaryStart = new Map();
  let primaryCursor = 0;
  for (const rank of orderedRanks) {
    primaryStart.set(rank, primaryCursor);
    primaryCursor += rankPrimarySize.get(rank) + options.rankGap;
  }

  const positions = new Map();
  for (const rank of orderedRanks) {
    const members = byRank.get(rank);
    let crossCursor = (maxCross - rankCrossSize.get(rank)) / 2;
    for (let index = 0; index < members.length; index += 1) {
      const item = members[index];
      const primarySize = horizontal ? item.width : item.height;
      const crossSize = horizontal ? item.height : item.width;
      const primary = primaryStart.get(rank) + (rankPrimarySize.get(rank) - primarySize) / 2;
      positions.set(item.id, {
        x: horizontal ? primary : crossCursor,
        y: horizontal ? crossCursor : primary,
        rank
      });
      const next = members[index + 1];
      const gap = next && (item.kind === "group" || next.kind === "group")
        ? options.groupGap
        : options.rowGap;
      crossCursor += crossSize + gap;
    }
  }
  return positions;
}

function offsetLayout(nodes, groups, dx, dy) {
  for (const item of nodes.values()) {
    item.x += dx;
    item.y += dy;
  }
  for (const item of groups.values()) {
    item.x += dx;
    item.y += dy;
  }
}

function boundsOf(boxes, fallback = { x: 0, y: 0, width: 180, height: 100 }) {
  if (boxes.length === 0) return fallback;
  const minX = Math.min(...boxes.map((item) => item.x));
  const minY = Math.min(...boxes.map((item) => item.y));
  const maxX = Math.max(...boxes.map((item) => item.x + item.width));
  const maxY = Math.max(...boxes.map((item) => item.y + item.height));
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  };
}

function layoutScope(spec, groupId, membership, options, direction) {
  const horizontal = direction === "left-to-right";
  const childGroupIds = groupId == null
    ? topLevelGroupIds(spec, membership)
    : [...(membership.groupById.get(groupId)?.groups ?? [])];
  const nodeIds = directNodeIds(spec, groupId, membership);

  const childLayouts = new Map();
  for (const childId of childGroupIds) {
    childLayouts.set(childId, layoutScope(spec, childId, membership, options, direction));
  }

  const items = [
    ...nodeIds.map((id) => {
      const node = membership.nodeById.get(id);
      const size = measureNode(node);
      return {
        id,
        kind: "node",
        node,
        width: size.width,
        height: size.height,
        rankHint: node.layoutHint?.rank,
        orderHint: node.layoutHint?.order
      };
    }),
    ...childGroupIds.map((id) => {
      const child = childLayouts.get(id);
      return {
        id,
        kind: "group",
        width: child.width,
        height: child.height,
        rankHint: undefined,
        orderHint: itemOrderHint({ kind: "group", id }, membership)
      };
    })
  ];

  if (items.length === 0) {
    return {
      width: 180,
      height: 100,
      nodes: new Map(),
      groups: new Map()
    };
  }

  const itemIds = new Set(items.map((item) => item.id));
  const itemEdges = contractEdges(spec, itemIds, membership);
  const ranks = assignRanks(items, itemEdges);
  const positions = placeItems(items, ranks, itemEdges, options, horizontal);

  const nodes = new Map();
  const groups = new Map();

  for (const item of items) {
    const position = positions.get(item.id);
    if (item.kind === "node") {
      nodes.set(item.id, {
        id: item.id,
        x: position.x,
        y: position.y,
        width: item.width,
        height: item.height,
        rank: position.rank
      });
      continue;
    }
    const child = childLayouts.get(item.id);
    offsetLayout(child.nodes, child.groups, position.x, position.y);
    for (const [id, node] of child.nodes) nodes.set(id, node);
    for (const [id, group] of child.groups) groups.set(id, group);
    groups.set(item.id, {
      id: item.id,
      x: position.x,
      y: position.y,
      width: item.width,
      height: item.height,
      depth: membership.groupDepth(item.id)
    });
  }

  const boxes = [...nodes.values(), ...groups.values()];
  const inner = boundsOf(boxes);
  const padX = groupId == null ? options.margin : options.groupPadding;
  const padY = groupId == null ? options.margin : options.groupPadding + options.groupLabelHeight;
  const bottomPad = groupId == null ? options.margin : options.groupPadding;
  offsetLayout(nodes, groups, padX - inner.x, padY - inner.y);

  return {
    width: inner.width + padX + (groupId == null ? options.margin : options.groupPadding),
    height: inner.height + padY + bottomPad,
    nodes,
    groups
  };
}

function point(x, y) {
  return { x, y };
}

function routeEdge(source, target, horizontal, index) {
  if (source.id === target.id) {
    const pad = 28 + (index % 3) * 9;
    const start = point(source.x + source.width, source.y + source.height / 2);
    return [
      start,
      point(source.x + source.width + pad, start.y),
      point(source.x + source.width + pad, source.y - pad),
      point(source.x + source.width / 2, source.y - pad),
      point(source.x + source.width / 2, source.y)
    ];
  }

  if (horizontal) {
    const forward = target.x >= source.x + source.width / 2;
    const start = forward
      ? point(source.x + source.width, source.y + source.height / 2)
      : point(source.x, source.y + source.height / 2);
    const end = forward
      ? point(target.x, target.y + target.height / 2)
      : point(target.x + target.width, target.y + target.height / 2);
    if (Math.abs(start.y - end.y) < 1) return [start, end];
    const lane = forward
      ? (start.x + end.x) / 2 + (index % 3 - 1) * 8
      : Math.min(start.x, end.x) - 48 - (index % 3) * 12;
    return [start, point(lane, start.y), point(lane, end.y), end];
  }

  const forward = target.y >= source.y + source.height / 2;
  const start = forward
    ? point(source.x + source.width / 2, source.y + source.height)
    : point(source.x + source.width / 2, source.y);
  const end = forward
    ? point(target.x + target.width / 2, target.y)
    : point(target.x + target.width / 2, target.y + target.height);
  if (Math.abs(start.x - end.x) < 1) return [start, end];
  const lane = forward
    ? (start.y + end.y) / 2 + (index % 3 - 1) * 8
    : Math.min(start.y, end.y) - 48 - (index % 3) * 12;
  return [start, point(start.x, lane), point(end.x, lane), end];
}

function labelPoint(points) {
  let longest = { length: -1, start: points[0], end: points.at(-1) };
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    if (length > longest.length) longest = { length, start, end };
  }
  return point(
    (longest.start.x + longest.end.x) / 2,
    (longest.start.y + longest.end.y) / 2
  );
}

function placeEdges(spec, nodes) {
  const horizontal = (spec.layout?.preferredDirection ?? "left-to-right") === "left-to-right";
  const edges = new Map();
  spec.edges.forEach((edge, index) => {
    const points = routeEdge(nodes.get(edge.from), nodes.get(edge.to), horizontal, index);
    edges.set(edge.id, {
      id: edge.id,
      points,
      label: labelPoint(points)
    });
  });
  return edges;
}

function shiftLayout(nodes, groups, edges, margin) {
  const boxes = [...nodes.values(), ...groups.values()];
  const edgePoints = [...edges.values()].flatMap((edge) => edge.points);
  const minX = Math.min(...boxes.map((item) => item.x), ...edgePoints.map((item) => item.x), margin);
  const minY = Math.min(...boxes.map((item) => item.y), ...edgePoints.map((item) => item.y), margin);
  const shiftX = minX < margin ? margin - minX : 0;
  const shiftY = minY < margin ? margin - minY : 0;

  for (const item of [...nodes.values(), ...groups.values()]) {
    item.x += shiftX;
    item.y += shiftY;
  }
  for (const edge of edges.values()) {
    edge.points.forEach((item) => {
      item.x += shiftX;
      item.y += shiftY;
    });
    edge.label.x += shiftX;
    edge.label.y += shiftY;
  }
}

export function layoutSpec(spec, overrides = {}) {
  const options = { ...DEFAULTS, ...overrides };
  const membership = buildMembership(spec);
  const direction = spec.layout?.preferredDirection ?? "left-to-right";
  const scoped = layoutScope(spec, null, membership, options, direction);
  const nodes = scoped.nodes;
  const groups = scoped.groups;
  const edges = placeEdges(spec, nodes);
  shiftLayout(nodes, groups, edges, options.margin);

  const allBoxes = [...nodes.values(), ...groups.values()];
  const allPoints = [...edges.values()].flatMap((edge) => edge.points);
  const width = Math.ceil(
    Math.max(...allBoxes.map((item) => item.x + item.width), ...allPoints.map((item) => item.x), 0) +
    options.margin
  );
  const height = Math.ceil(
    Math.max(...allBoxes.map((item) => item.y + item.height), ...allPoints.map((item) => item.y), 0) +
    options.margin
  );

  return {
    width: Math.max(width, 640),
    height: Math.max(height, 360),
    direction,
    nodes,
    groups,
    edges
  };
}
