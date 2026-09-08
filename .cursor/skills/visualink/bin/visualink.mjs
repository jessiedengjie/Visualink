#!/usr/bin/env node

import { watch } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { renderSpec } from "../lib/render.mjs";
import { assertValidSpec, VisualinkValidationError } from "../lib/validate.mjs";

const MAX_SPEC_BYTES = 2 * 1024 * 1024;

function usage() {
  return `Visualink structured renderer

Usage:
  visualink validate <spec.json>
  visualink render <spec.json> [-o <output.html>]
  visualink dev <spec.json> [--port <port>]

Examples:
  visualink validate examples/rag.json
  visualink render examples/rag.json
  visualink dev examples/rag.json --port 4173
`;
}

function resolveWithinCwd(input, label) {
  if (typeof input !== "string" || input.trim() === "") {
    throw new Error(`${label} path is required.`);
  }
  const cwd = path.resolve(process.cwd());
  const resolved = path.resolve(cwd, input);
  const relative = path.relative(cwd, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`${label} must stay inside the current working directory.`);
  }
  return resolved;
}

async function loadSpec(inputPath) {
  const filePath = resolveWithinCwd(inputPath, "Spec");
  if (path.extname(filePath).toLowerCase() !== ".json") {
    throw new Error("Visualink specs must use the .json extension.");
  }
  const source = await readFile(filePath, "utf8");
  if (Buffer.byteLength(source, "utf8") > MAX_SPEC_BYTES) {
    throw new Error("Visualink spec exceeds the 2 MB safety limit.");
  }
  let spec;
  try {
    spec = JSON.parse(source);
  } catch (error) {
    throw new Error(`Could not parse ${inputPath}: ${error.message}`);
  }
  assertValidSpec(spec);
  return { spec, filePath };
}

function optionValue(args, names) {
  for (let index = 0; index < args.length; index += 1) {
    if (names.includes(args[index])) return args[index + 1];
  }
  return undefined;
}

function defaultOutputPath(inputPath) {
  const basename = path.basename(inputPath, path.extname(inputPath));
  return path.join("dist", `${basename}.html`);
}

async function validateCommand(inputPath) {
  await loadSpec(inputPath);
  console.log(`Valid VisualinkSpec: ${inputPath}`);
}

async function renderCommand(inputPath, args) {
  const { spec } = await loadSpec(inputPath);
  const outputArg = optionValue(args, ["-o", "--output"]) ?? defaultOutputPath(inputPath);
  const outputPath = resolveWithinCwd(outputArg, "Output");
  if (path.extname(outputPath).toLowerCase() !== ".html") {
    throw new Error("Rendered output must use the .html extension.");
  }
  const html = await renderSpec(spec);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, html, "utf8");
  console.log(`Rendered ${inputPath} -> ${path.relative(process.cwd(), outputPath)}`);
}

function parsePort(args) {
  const raw = optionValue(args, ["--port"]);
  if (raw === undefined) return 4173;
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error("--port must be an integer between 1024 and 65535.");
  }
  return port;
}

async function devCommand(inputPath, args) {
  const port = parsePort(args);
  const { filePath } = await loadSpec(inputPath);
  let html = "";
  let buildError = null;

  async function rebuild() {
    try {
      const loaded = await loadSpec(path.relative(process.cwd(), filePath));
      html = await renderSpec(loaded.spec);
      buildError = null;
      console.log(`[visualink] rendered ${inputPath}`);
    } catch (error) {
      buildError = error;
      console.error(`[visualink] ${error.message}`);
    }
  }

  await rebuild();
  const server = createServer((request, response) => {
    const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
    if (request.method !== "GET" || !["/", "/index.html"].includes(requestUrl.pathname)) {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }
    if (buildError) {
      response.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
      response.end(buildError.message);
      return;
    }
    response.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff"
    });
    response.end(html);
  });

  const watcher = watch(filePath, { persistent: true }, () => {
    clearTimeout(watcher.rebuildTimer);
    watcher.rebuildTimer = setTimeout(rebuild, 80);
  });

  function close() {
    watcher.close();
    server.close();
  }
  process.once("SIGINT", close);
  process.once("SIGTERM", close);

  server.listen(port, "127.0.0.1", () => {
    console.log(`[visualink] preview: http://127.0.0.1:${port}`);
    console.log("[visualink] watching for spec changes; press Ctrl+C to stop");
  });
}

export async function main(argv = process.argv.slice(2)) {
  const [command, inputPath, ...args] = argv;
  if (!command || command === "--help" || command === "-h") {
    console.log(usage());
    return;
  }
  if (!inputPath) throw new Error(`Missing spec path.\n\n${usage()}`);

  if (command === "validate") return validateCommand(inputPath);
  if (command === "render") return renderCommand(inputPath, args);
  if (command === "dev") return devCommand(inputPath, args);
  throw new Error(`Unknown command "${command}".\n\n${usage()}`);
}

const isDirect = process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isDirect) {
  main().catch((error) => {
    if (error instanceof VisualinkValidationError) {
      console.error(error.message);
    } else {
      console.error(`Visualink error: ${error.message}`);
    }
    process.exitCode = 1;
  });
}
