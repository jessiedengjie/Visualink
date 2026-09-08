(() => {
  "use strict";

  const spec = window.__VISUALINK_SPEC__;
  if (!spec) throw new Error("Visualink runtime could not find its embedded spec.");

  const diagram = document.getElementById("diagram");
  const scene = document.getElementById("scene");
  const lede = document.getElementById("lede");
  const eyebrow = document.getElementById("eyebrow");
  const now = document.getElementById("now");
  const takeaways = document.getElementById("takeaways");
  const takeawayList = document.getElementById("takeaway-list");
  const tip = document.getElementById("tip");
  const toast = document.getElementById("toast");
  const playButton = document.getElementById("play");
  const chapterButtons = [...document.querySelectorAll(".chip")];
  const nodes = [...document.querySelectorAll(".node")];
  const groups = [...document.querySelectorAll(".group")];
  const edges = [...document.querySelectorAll(".edge")];
  const parts = [...nodes, ...groups];

  const nodeById = new Map(spec.nodes.map((node) => [node.id, node]));
  const groupById = new Map((spec.groups || []).map((group) => [group.id, group]));
  const edgeById = new Map(spec.edges.map((edge) => [edge.id, edge]));
  const groupParent = new Map();
  const nodeGroup = new Map();

  for (const group of spec.groups || []) {
    for (const childId of group.groups || []) groupParent.set(childId, group.id);
    for (const nodeId of group.nodes || []) nodeGroup.set(nodeId, group.id);
  }
  for (const node of spec.nodes) {
    if (node.group) nodeGroup.set(node.id, node.group);
  }

  function groupAncestors(groupId) {
    const result = new Set();
    let current = groupId;
    while (current) {
      result.add(current);
      current = groupParent.get(current);
    }
    return result;
  }

  function groupsForNodes(nodeIds) {
    const result = new Set();
    for (const nodeId of nodeIds) {
      for (const groupId of groupAncestors(nodeGroup.get(nodeId))) result.add(groupId);
    }
    return result;
  }

  function descendantNodes(groupId, result = new Set()) {
    const group = groupById.get(groupId);
    if (!group) return result;
    for (const nodeId of group.nodes || []) result.add(nodeId);
    for (const node of spec.nodes) {
      if (node.group === groupId) result.add(node.id);
    }
    for (const childId of group.groups || []) descendantNodes(childId, result);
    return result;
  }

  let chapterIndex = -1;
  let playTimer = null;
  let toastTimer = null;

  function stopPlayback() {
    if (!playTimer) return;
    clearInterval(playTimer);
    playTimer = null;
    playButton.textContent = "Play";
    playButton.setAttribute("aria-label", "Play guided chapters");
  }

  function clearDiagramState() {
    for (const element of [...parts, ...edges]) {
      element.classList.remove("is-dim", "is-hot", "is-hover", "is-new");
    }
  }

  function paintChapterButtons() {
    chapterButtons.forEach((button, index) => {
      const active = index === chapterIndex;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function renderTakeaways(items) {
    takeawayList.replaceChildren();
    if (!items || items.length === 0) {
      takeaways.hidden = true;
      return;
    }
    for (const item of items) {
      const li = document.createElement("li");
      li.textContent = item;
      takeawayList.appendChild(li);
    }
    takeaways.hidden = false;
  }

  function overviewMode() {
    chapterIndex = -1;
    eyebrow.textContent = "Overview";
    now.textContent = "The whole picture";
    lede.textContent = spec.concept.definition;
    renderTakeaways([]);
    paintChapterButtons();
    clearDiagramState();
    hideTip();
  }

  function focusChapter(index) {
    chapterIndex = (index + spec.chapters.length) % spec.chapters.length;
    const chapter = spec.chapters[chapterIndex];
    const focusNodes = new Set(chapter.focusNodes || []);
    const introducedNodes = new Set(chapter.introducedNodes || []);
    for (const id of introducedNodes) focusNodes.add(id);

    const relevantGroups = groupsForNodes(focusNodes);
    for (const id of chapter.focusGroups || []) {
      for (const ancestor of groupAncestors(id)) relevantGroups.add(ancestor);
    }

    let focusEdges;
    if (Array.isArray(chapter.focusEdges)) {
      focusEdges = new Set(chapter.focusEdges);
    } else {
      focusEdges = new Set(
        spec.edges
          .filter((edge) => focusNodes.has(edge.from) && focusNodes.has(edge.to))
          .map((edge) => edge.id)
      );
    }

    eyebrow.textContent = `Chapter ${chapterIndex + 1} of ${spec.chapters.length}`;
    now.textContent = chapter.title;
    lede.textContent = chapter.explanation;
    renderTakeaways(chapter.takeaways || []);
    paintChapterButtons();

    const hasNodeFocus = focusNodes.size > 0;
    for (const element of nodes) {
      const id = element.dataset.nodeId;
      const focused = !hasNodeFocus || focusNodes.has(id);
      element.classList.toggle("is-hot", focused && hasNodeFocus);
      element.classList.toggle("is-dim", !focused);
      element.classList.toggle("is-new", introducedNodes.has(id));
      element.classList.remove("is-hover");
    }

    for (const element of groups) {
      const focused = relevantGroups.has(element.dataset.groupId);
      element.classList.toggle("is-hot", focused);
      element.classList.toggle("is-dim", relevantGroups.size > 0 && !focused);
      element.classList.remove("is-hover");
    }

    for (const element of edges) {
      const focused = focusEdges.has(element.dataset.edgeId);
      element.classList.toggle("is-hot", focused);
      element.classList.toggle("is-dim", !focused);
      element.classList.remove("is-hover");
    }
    hideTip();
  }

  chapterButtons.forEach((button, index) => {
    button.addEventListener("click", () => {
      stopPlayback();
      focusChapter(index);
    });
  });

  playButton.addEventListener("click", () => {
    if (playTimer) {
      stopPlayback();
      return;
    }
    playButton.textContent = "Pause";
    playButton.setAttribute("aria-label", "Pause guided chapters");
    if (chapterIndex < 0) focusChapter(0);
    playTimer = setInterval(() => focusChapter(chapterIndex + 1), 3600);
  });

  function neighboringNodes(nodeId) {
    const result = new Set([nodeId]);
    for (const edge of spec.edges) {
      if (edge.from === nodeId) result.add(edge.to);
      if (edge.to === nodeId) result.add(edge.from);
    }
    return result;
  }

  function showTip(element, text) {
    if (!text) return;
    const stage = document.querySelector(".stage").getBoundingClientRect();
    const bounds = element.getBoundingClientRect();
    tip.textContent = text;
    tip.hidden = false;
    const tipWidth = tip.offsetWidth;
    const tipHeight = tip.offsetHeight;
    let left = bounds.left - stage.left;
    let top = bounds.bottom - stage.top + 8;
    if (left + tipWidth > stage.width - 12) left = stage.width - tipWidth - 12;
    if (left < 12) left = 12;
    if (top + tipHeight > stage.height - 12) top = bounds.top - stage.top - tipHeight - 8;
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
  }

  function hideTip() {
    tip.hidden = true;
  }

  function hoverNode(nodeId, element) {
    const near = neighboringNodes(nodeId);
    for (const node of nodes) {
      const relevant = near.has(node.dataset.nodeId);
      node.classList.toggle("is-hover", node.dataset.nodeId === nodeId);
      if (chapterIndex < 0) node.classList.toggle("is-dim", !relevant);
    }
    for (const edge of edges) {
      const semanticEdge = edgeById.get(edge.dataset.edgeId);
      const relevant = semanticEdge.from === nodeId || semanticEdge.to === nodeId;
      edge.classList.toggle("is-hover", relevant);
      if (chapterIndex < 0) edge.classList.toggle("is-dim", !relevant);
    }
    if (chapterIndex < 0) {
      const relatedGroups = groupsForNodes(near);
      for (const group of groups) {
        group.classList.toggle("is-dim", !relatedGroups.has(group.dataset.groupId));
      }
    }
    showTip(element, nodeById.get(nodeId)?.description);
  }

  function hoverGroup(groupId, element) {
    const members = descendantNodes(groupId);
    for (const group of groups) {
      group.classList.toggle("is-hover", group.dataset.groupId === groupId);
      if (chapterIndex < 0) {
        const related = groupAncestors(groupId).has(group.dataset.groupId) ||
          groupAncestors(group.dataset.groupId).has(groupId);
        group.classList.toggle("is-dim", !related);
      }
    }
    if (chapterIndex < 0) {
      for (const node of nodes) node.classList.toggle("is-dim", !members.has(node.dataset.nodeId));
      for (const edge of edges) {
        const semanticEdge = edgeById.get(edge.dataset.edgeId);
        edge.classList.toggle(
          "is-dim",
          !(members.has(semanticEdge.from) && members.has(semanticEdge.to))
        );
      }
    }
    showTip(element, groupById.get(groupId)?.description);
  }

  function clearHover() {
    for (const element of [...parts, ...edges]) element.classList.remove("is-hover");
    if (chapterIndex < 0) {
      for (const element of [...parts, ...edges]) element.classList.remove("is-dim");
    }
    hideTip();
  }

  function chapterForNode(nodeId) {
    return spec.chapters.findIndex((chapter) =>
      (chapter.focusNodes || []).includes(nodeId) ||
      (chapter.introducedNodes || []).includes(nodeId)
    );
  }

  for (const element of nodes) {
    const nodeId = element.dataset.nodeId;
    element.addEventListener("pointerenter", () => hoverNode(nodeId, element));
    element.addEventListener("pointerleave", clearHover);
    element.addEventListener("focus", () => hoverNode(nodeId, element));
    element.addEventListener("blur", clearHover);
    element.addEventListener("click", (event) => {
      event.stopPropagation();
      const target = chapterForNode(nodeId);
      if (target >= 0) {
        stopPlayback();
        focusChapter(target);
      }
    });
    element.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        element.click();
      }
    });
  }

  for (const element of groups) {
    const groupId = element.dataset.groupId;
    element.addEventListener("pointerenter", () => hoverGroup(groupId, element));
    element.addEventListener("pointerleave", clearHover);
    element.addEventListener("click", (event) => {
      event.stopPropagation();
      const target = spec.chapters.findIndex((chapter) =>
        (chapter.focusGroups || []).includes(groupId)
      );
      if (target >= 0) {
        stopPlayback();
        focusChapter(target);
      }
    });
  }

  const themeButton = document.getElementById("theme");
  const themeMenu = document.getElementById("theme-menu");
  const themeLabel = document.getElementById("theme-label");
  const themeIcon = document.getElementById("theme-icon");
  const lightButton = document.getElementById("theme-light");
  const darkButton = document.getElementById("theme-dark");
  const moonIcon = '<path fill="currentColor" d="M11.7 11.05A5.35 5.35 0 0 1 6.1 3.15 5.9 5.9 0 1 0 13.4 11.2a5.1 5.1 0 0 1-1.7-.15z"/>';
  const sunIcon = '<circle cx="8" cy="8" r="3.15" fill="currentColor"/><g fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M8 1.2v1.7M8 13.1v1.7M1.2 8h1.7M13.1 8h1.7"/><path d="M3.15 3.15l1.2 1.2M11.65 11.65l1.2 1.2M3.15 12.85l1.2-1.2M11.65 4.35l1.2-1.2"/></g>';

  function closeThemeMenu() {
    themeMenu.hidden = true;
    themeButton.setAttribute("aria-expanded", "false");
  }

  function setTheme(theme) {
    document.body.dataset.theme = theme;
    const dark = theme === "dark";
    themeLabel.textContent = dark ? "Dark" : "Light";
    themeIcon.innerHTML = dark ? moonIcon : sunIcon;
    lightButton.setAttribute("aria-checked", String(!dark));
    darkButton.setAttribute("aria-checked", String(dark));
    closeThemeMenu();
  }

  themeButton.addEventListener("click", (event) => {
    event.stopPropagation();
    const opening = themeMenu.hidden;
    themeMenu.hidden = !opening;
    themeButton.setAttribute("aria-expanded", String(opening));
  });
  themeMenu.addEventListener("click", (event) => event.stopPropagation());
  lightButton.addEventListener("click", () => setTheme("light"));
  darkButton.addEventListener("click", () => setTheme("dark"));

  const exportButton = document.getElementById("export");
  const exportMenu = document.getElementById("export-menu");

  function closeExportMenu() {
    exportMenu.hidden = true;
    exportButton.setAttribute("aria-expanded", "false");
  }

  exportButton.addEventListener("click", (event) => {
    event.stopPropagation();
    const opening = exportMenu.hidden;
    exportMenu.hidden = !opening;
    exportButton.setAttribute("aria-expanded", String(opening));
  });
  exportMenu.addEventListener("click", (event) => event.stopPropagation());

  document.addEventListener("click", () => {
    closeExportMenu();
    closeThemeMenu();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeExportMenu();
      closeThemeMenu();
      hideTip();
      return;
    }
    if (event.target.closest("button, [role='button']")) return;
    if (event.key === "ArrowRight") {
      stopPlayback();
      focusChapter(chapterIndex < 0 ? 0 : chapterIndex + 1);
    } else if (event.key === "ArrowLeft") {
      stopPlayback();
      if (chapterIndex <= 0) overviewMode();
      else focusChapter(chapterIndex - 1);
    }
  });

  function announce(message) {
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.hidden = true;
    }, 2300);
  }

  const viewBox = diagram.viewBox.baseVal;
  let scale = 1;
  let translateX = 0;
  let translateY = 0;
  let drag = null;

  function applyView() {
    scene.setAttribute(
      "transform",
      `translate(${translateX.toFixed(1)},${translateY.toFixed(1)}) scale(${scale.toFixed(3)})`
    );
    document.getElementById("zoom-output").textContent = `${Math.round(scale * 100)}%`;
  }

  function zoom(factor) {
    const next = Math.min(2.6, Math.max(0.6, scale * factor));
    const centerX = viewBox.x + viewBox.width / 2;
    const centerY = viewBox.y + viewBox.height / 2;
    translateX = centerX - (centerX - translateX) * (next / scale);
    translateY = centerY - (centerY - translateY) * (next / scale);
    scale = next;
    applyView();
  }

  document.getElementById("zoom-in").addEventListener("click", () => zoom(1.18));
  document.getElementById("zoom-out").addEventListener("click", () => zoom(1 / 1.18));
  document.getElementById("zoom-reset").addEventListener("click", () => {
    scale = 1;
    translateX = 0;
    translateY = 0;
    applyView();
  });
  diagram.addEventListener("wheel", (event) => {
    event.preventDefault();
    zoom(event.deltaY < 0 ? 1.08 : 1 / 1.08);
  }, { passive: false });
  diagram.addEventListener("pointerdown", (event) => {
    if (event.target.closest(".node")) return;
    drag = {
      x: event.clientX,
      y: event.clientY,
      translateX,
      translateY
    };
    diagram.classList.add("is-dragging");
    diagram.setPointerCapture(event.pointerId);
  });
  diagram.addEventListener("pointermove", (event) => {
    if (!drag) return;
    const bounds = diagram.getBoundingClientRect();
    translateX = drag.translateX + (event.clientX - drag.x) * (viewBox.width / bounds.width);
    translateY = drag.translateY + (event.clientY - drag.y) * (viewBox.height / bounds.height);
    applyView();
  });
  function endDrag() {
    drag = null;
    diagram.classList.remove("is-dragging");
  }
  diagram.addEventListener("pointerup", endDrag);
  diagram.addEventListener("pointercancel", endDrag);

  function cloneForExport() {
    const clone = diagram.cloneNode(true);
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.querySelector("#scene")?.removeAttribute("transform");
    clone.querySelectorAll(".is-dim, .is-hot, .is-hover, .is-new").forEach((element) => {
      element.classList.remove("is-dim", "is-hot", "is-hover", "is-new");
    });

    const sourceElements = [diagram, ...diagram.querySelectorAll("*")];
    const cloneElements = [clone, ...clone.querySelectorAll("*")];
    const properties = [
      "fill",
      "stroke",
      "stroke-width",
      "stroke-dasharray",
      "stroke-linecap",
      "stroke-linejoin",
      "opacity",
      "font-size",
      "font-weight",
      "font-family",
      "letter-spacing",
      "text-anchor"
    ];
    sourceElements.forEach((source, index) => {
      const target = cloneElements[index];
      if (!target) return;
      const computed = getComputedStyle(source);
      for (const property of properties) {
        const value = computed.getPropertyValue(property).trim();
        if (value && value !== "normal") target.style.setProperty(property, value);
      }
    });

    const background = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    background.setAttribute("x", String(viewBox.x));
    background.setAttribute("y", String(viewBox.y));
    background.setAttribute("width", String(viewBox.width));
    background.setAttribute("height", String(viewBox.height));
    background.setAttribute(
      "fill",
      getComputedStyle(document.body).getPropertyValue("--panel").trim()
    );
    clone.insertBefore(background, clone.firstChild);
    return clone;
  }

  function rasterize() {
    return new Promise((resolve, reject) => {
      const clone = cloneForExport();
      const width = 2080;
      const height = Math.max(720, Math.round(width * viewBox.height / viewBox.width));
      clone.setAttribute("width", String(width));
      clone.setAttribute("height", String(height));
      const xml = new XMLSerializer().serializeToString(clone);
      const url = URL.createObjectURL(new Blob([xml], { type: "image/svg+xml;charset=utf-8" }));
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        context.fillStyle = getComputedStyle(document.body).getPropertyValue("--panel").trim();
        context.fillRect(0, 0, width, height);
        context.drawImage(image, 0, 0, width, height);
        URL.revokeObjectURL(url);
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Could not build image."));
        }, "image/png");
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Could not render diagram."));
      };
      image.src = url;
    });
  }

  function downloadBlob(blob) {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    const slug = spec.concept.shortName || spec.concept.name;
    link.download = `${slug.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.png`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  document.getElementById("copy-image").addEventListener("click", async (event) => {
    event.stopPropagation();
    closeExportMenu();
    const blobPromise = rasterize();
    try {
      if (navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blobPromise })]);
        announce("Copied image");
        return;
      }
    } catch {
      // Clipboard access can be unavailable for local files; download is the portable fallback.
    }
    try {
      downloadBlob(await blobPromise);
      announce("Clipboard unavailable — downloaded PNG instead");
    } catch {
      announce("Could not export image");
    }
  });

  document.getElementById("download-image").addEventListener("click", async (event) => {
    event.stopPropagation();
    closeExportMenu();
    try {
      downloadBlob(await rasterize());
      announce("Downloaded PNG");
    } catch {
      announce("Could not download image");
    }
  });

  overviewMode();
  applyView();
})();
