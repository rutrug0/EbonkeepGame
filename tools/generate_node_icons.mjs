#!/usr/bin/env node

import { createHash } from "node:crypto";
import { request as httpsRequest, Agent as HttpsAgent } from "node:https";
import { request as httpRequest } from "node:http";
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const THIS_FILE = fileURLToPath(import.meta.url);
const THIS_DIR = path.dirname(THIS_FILE);
const REPO_ROOT = path.resolve(THIS_DIR, "..");
const DEFAULT_CSV_PATH = path.join(REPO_ROOT, "docs", "data", "passive_and_academy_icon_prompts_v1.csv");
const DEFAULT_OUTPUT_DIR = path.join(REPO_ROOT, "apps", "web", "public", "assets", "icons", "nodes");
const DEFAULT_CACHE_DIR = path.join(REPO_ROOT, "tools", ".cache");
const DEFAULT_STATE_PATH = path.join(DEFAULT_CACHE_DIR, "node_icon_art_state.json");
const DEFAULT_REPORT_PATH = path.join(DEFAULT_CACHE_DIR, "node_icon_art_last_run.json");
const DEFAULT_ENV_PATH = path.join(REPO_ROOT, ".env");
const DEFAULT_MANIFEST_TS_PATH = path.join(REPO_ROOT, "apps", "web", "src", "generated", "nodeIconManifest.ts");
const DEFAULT_MANIFEST_JSON_PATH = path.join(DEFAULT_OUTPUT_DIR, "node_icon_manifest.json");

const TRANSIENT_STATUS_CODES = new Set([429, 500, 502, 503, 504]);
const DEFAULT_RENDER_SETTINGS = {
  model: "gpt-image-1.5",
  size: "1024x1024",
  background: "transparent",
  quality: "medium",
};

function parseArgs(argv) {
  const args = {
    csv: DEFAULT_CSV_PATH,
    outputDir: DEFAULT_OUTPUT_DIR,
    limit: null,
    dryRun: false,
    force: false,
    regenerateChanged: false,
    onlyMissing: false,
    verbose: false,
    caBundle: null,
    insecure: false,
  };

  for (let idx = 0; idx < argv.length; idx += 1) {
    const arg = argv[idx];
    const next = argv[idx + 1];
    switch (arg) {
      case "--csv":
        args.csv = next;
        idx += 1;
        break;
      case "--output-dir":
        args.outputDir = next;
        idx += 1;
        break;
      case "--limit":
        args.limit = Number.parseInt(next, 10);
        idx += 1;
        break;
      case "--dry-run":
        args.dryRun = true;
        break;
      case "--force":
        args.force = true;
        break;
      case "--regenerate-changed":
        args.regenerateChanged = true;
        break;
      case "--only-missing":
        args.onlyMissing = true;
        break;
      case "--verbose":
        args.verbose = true;
        break;
      case "--ca-bundle":
        args.caBundle = next;
        idx += 1;
        break;
      case "--insecure":
        args.insecure = true;
        break;
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (args.limit !== null && Number.isNaN(args.limit)) {
    throw new Error("--limit must be an integer.");
  }

  return args;
}

function printHelp() {
  console.log(`Generate UI skill node icons from ${path.relative(REPO_ROOT, DEFAULT_CSV_PATH)}.

Usage:
  node tools/generate_node_icons.mjs [options]

Options:
  --csv <path>              CSV source with icon_key and prompt columns
  --output-dir <path>       Output directory for generated PNGs
  --limit <n>               Process at most N eligible rows
  --dry-run                 Plan only; do not call OpenAI or write files
  --force                   Regenerate even when output files already exist
  --regenerate-changed      Regenerate when the saved prompt/render hash changed
  --only-missing            Equivalent to the default missing-only behavior
  --verbose                 Log per-item decisions
  --ca-bundle <path>        PEM CA bundle for TLS verification
  --insecure                Disable TLS verification for troubleshooting only
`);
}

function resolvePath(candidate) {
  if (!candidate) {
    return candidate;
  }
  return path.isAbsolute(candidate) ? candidate : path.resolve(REPO_ROOT, candidate);
}

function loadDotenv(envPath) {
  if (!existsSync(envPath)) {
    return;
  }

  const text = readFileSync(envPath, "utf8");
  for (const rawLine of text.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const eqIndex = line.indexOf("=");
    if (eqIndex === -1) {
      continue;
    }
    const key = line.slice(0, eqIndex).trim();
    const value = line
      .slice(eqIndex + 1)
      .trim()
      .replace(/^['"]|['"]$/gu, "");
    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let idx = 0; idx < text.length; idx += 1) {
    const char = text[idx];
    const next = text[idx + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        idx += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(field);
      field = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        idx += 1;
      }
      row.push(field);
      field = "";
      if (row.length > 1 || row[0] !== "") {
        rows.push(row);
      }
      row = [];
      continue;
    }

    field += char;
  }

  if (field !== "" || row.length > 0) {
    row.push(field);
    if (row.length > 1 || row[0] !== "") {
      rows.push(row);
    }
  }

  if (rows.length === 0) {
    return [];
  }

  const headers = rows[0].map((entry) => entry.trim());
  return rows.slice(1).map((values) => {
    const record = {};
    const normalizedValues =
      values.length > headers.length
        ? [...values.slice(0, headers.length - 1), values.slice(headers.length - 1).join(",")]
        : values;
    headers.forEach((header, index) => {
      record[header] = normalizedValues[index] ?? "";
    });
    return record;
  });
}

function readCsvRows(csvPath) {
  const encodings = ["utf8", "latin1"];
  let lastError = null;
  for (const encoding of encodings) {
    try {
      return parseCsv(readFileSync(csvPath, { encoding }));
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

function loadJson(filePath) {
  if (!existsSync(filePath)) {
    return {};
  }
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return {};
  }
}

function saveJson(filePath, data) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function ensureDir(dirPath) {
  mkdirSync(dirPath, { recursive: true });
}

function validateIconKey(iconKey) {
  if (!/^[a-zA-Z0-9_-]+$/u.test(iconKey)) {
    throw new Error(`Invalid icon_key "${iconKey}". Expected only letters, numbers, underscores, and hyphens.`);
  }
  return iconKey;
}

function computePromptHash(renderSettings, prompt, iconKey) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        ...renderSettings,
        prompt,
        iconKey,
      }),
      "utf8",
    )
    .digest("hex");
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function createRequestOptions(urlText, method, headers, caBundlePath, insecure) {
  const url = new URL(urlText);
  const ca = caBundlePath ? readFileSync(caBundlePath, "utf8") : undefined;
  const common = {
    protocol: url.protocol,
    hostname: url.hostname,
    port: url.port || undefined,
    path: `${url.pathname}${url.search}`,
    method,
    headers,
  };

  if (url.protocol === "https:") {
    return {
      transport: httpsRequest,
      options: {
        ...common,
        agent: new HttpsAgent({
          ca,
          rejectUnauthorized: !insecure,
        }),
      },
    };
  }

  return {
    transport: httpRequest,
    options: common,
  };
}

function sendRequest(urlText, { method = "GET", headers = {}, body = null, caBundlePath = null, insecure = false } = {}) {
  return new Promise((resolve, reject) => {
    const { transport, options } = createRequestOptions(urlText, method, headers, caBundlePath, insecure);
    const req = transport(options, (res) => {
      const chunks = [];
      res.on("data", (chunk) => {
        chunks.push(chunk);
      });
      res.on("end", () => {
        resolve({
          statusCode: res.statusCode ?? 0,
          headers: res.headers,
          body: Buffer.concat(chunks),
        });
      });
    });
    req.on("error", reject);
    if (body) {
      req.write(body);
    }
    req.end();
  });
}

async function callOpenAiImage({
  apiKey,
  baseUrl,
  renderSettings,
  prompt,
  caBundlePath,
  insecure,
  maxAttempts = 5,
}) {
  const endpoint = `${baseUrl.replace(/\/+$/u, "")}/v1/images/generations`;
  const payload = JSON.stringify({
    model: renderSettings.model,
    prompt,
    size: renderSettings.size,
    background: renderSettings.background,
    quality: renderSettings.quality,
    output_format: "png",
    n: 1,
  });

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await sendRequest(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
        body: payload,
        caBundlePath,
        insecure,
      });

      if (TRANSIENT_STATUS_CODES.has(response.statusCode) && attempt < maxAttempts) {
        await sleep(2 ** (attempt - 1) * 1000);
        continue;
      }

      if (response.statusCode < 200 || response.statusCode >= 300) {
        const bodyText = response.body.toString("utf8");
        throw new Error(`OpenAI HTTP ${response.statusCode}: ${bodyText.slice(0, 500)}`);
      }

      const parsed = JSON.parse(response.body.toString("utf8"));
      const data = Array.isArray(parsed.data) ? parsed.data : [];
      if (data.length === 0) {
        throw new Error("OpenAI response missing image data.");
      }

      const first = data[0];
      if (typeof first.b64_json === "string" && first.b64_json) {
        return Buffer.from(first.b64_json, "base64");
      }

      if (typeof first.url === "string" && first.url) {
        const download = await sendRequest(first.url, {
          method: "GET",
          caBundlePath,
          insecure,
        });
        if (download.statusCode < 200 || download.statusCode >= 300) {
          throw new Error(`Image download failed with HTTP ${download.statusCode}.`);
        }
        return download.body;
      }

      throw new Error("OpenAI response missing b64_json/url.");
    } catch (error) {
      const isRetriable = attempt < maxAttempts && /OpenAI HTTP (429|500|502|503|504)|ECONN|ENOTFOUND|ETIMEDOUT|socket/i.test(String(error));
      if (!isRetriable) {
        throw error;
      }
      await sleep(2 ** (attempt - 1) * 1000);
    }
  }

  throw new Error("Image generation failed after retries.");
}

function buildNodeIconManifest(outputDir) {
  const manifest = {};
  if (!existsSync(outputDir)) {
    return manifest;
  }

  for (const entry of readdirSync(outputDir).sort()) {
    const fullPath = path.join(outputDir, entry);
    if (!statSync(fullPath).isFile()) {
      continue;
    }
    if (!entry.toLowerCase().endsWith(".png")) {
      continue;
    }
    const key = path.basename(entry, ".png");
    manifest[key] = `/assets/icons/nodes/${entry}`;
  }

  return manifest;
}

function maybeWriteNodeIconManifest(outputDir) {
  const hasTsManifest = existsSync(DEFAULT_MANIFEST_TS_PATH);
  const hasJsonManifest = existsSync(DEFAULT_MANIFEST_JSON_PATH);
  if (!hasTsManifest && !hasJsonManifest) {
    return { rebuilt: false, entryCount: 0 };
  }

  const manifest = buildNodeIconManifest(outputDir);
  if (hasTsManifest) {
    ensureDir(path.dirname(DEFAULT_MANIFEST_TS_PATH));
    writeFileSync(
      DEFAULT_MANIFEST_TS_PATH,
      `// Auto-generated by tools/generate_node_icons.mjs\n// Do not edit manually.\n\nexport const GENERATED_NODE_ICON_PATHS: Record<string, string> = ${JSON.stringify(manifest, null, 2)};\n`,
      "utf8",
    );
  }
  if (hasJsonManifest) {
    ensureDir(path.dirname(DEFAULT_MANIFEST_JSON_PATH));
    writeFileSync(DEFAULT_MANIFEST_JSON_PATH, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  }
  return { rebuilt: true, entryCount: Object.keys(manifest).length };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  loadDotenv(DEFAULT_ENV_PATH);

  const csvPath = resolvePath(args.csv);
  const outputDir = resolvePath(args.outputDir);
  const caBundlePath = resolvePath(args.caBundle || process.env.OPENAI_CA_BUNDLE || "");
  const baseUrl = process.env.OPENAI_BASE_URL || "https://api.openai.com";
  const apiKey = process.env.OPENAI_API_KEY || "";

  if (!existsSync(csvPath)) {
    throw new Error(`CSV source not found: ${csvPath}`);
  }

  const rows = readCsvRows(csvPath);
  const state = loadJson(DEFAULT_STATE_PATH);
  const stateItems = typeof state.items === "object" && state.items ? state.items : {};

  const counts = {
    totalRows: 0,
    eligibleRows: 0,
    skippedMissingPrompt: 0,
    skippedMissingIconKey: 0,
    skippedUnchanged: 0,
    generated: 0,
    regenerated: 0,
    failed: 0,
  };

  const planned = [];
  for (const [rowIndex, row] of rows.entries()) {
    counts.totalRows += 1;
    const iconKeyRaw = String(row.icon_key || "").trim();
    const prompt = String(row.prompt || "");
    if (!iconKeyRaw) {
      counts.skippedMissingIconKey += 1;
      continue;
    }
    if (!prompt.trim()) {
      counts.skippedMissingPrompt += 1;
      continue;
    }

    const iconKey = validateIconKey(iconKeyRaw);
    const outputPath = path.join(outputDir, `${iconKey}.png`);
    const promptSidecarPath = path.join(outputDir, `${iconKey}.txt`);
    const promptHash = computePromptHash(DEFAULT_RENDER_SETTINGS, prompt, iconKey);

    counts.eligibleRows += 1;
    planned.push({
      iconKey,
      prompt,
      outputPath,
      promptSidecarPath,
      promptHash,
      rowNumber: rowIndex + 2,
    });
  }

  const limited = args.limit !== null && args.limit >= 0 ? planned.slice(0, args.limit) : planned;
  if (args.verbose || args.dryRun) {
    console.log(`Planned eligible icons: ${limited.length}`);
  }

  if (!args.dryRun && !apiKey) {
    throw new Error("OPENAI_API_KEY is required for non-dry runs.");
  }

  const runItems = [];
  for (const item of limited) {
    const previous = typeof stateItems[item.iconKey] === "object" && stateItems[item.iconKey] ? stateItems[item.iconKey] : {};
    const previousHash = previous.hash || null;
    const fileExists = existsSync(item.outputPath);

    let action = "generate";
    if (args.force) {
      action = fileExists ? "regenerate" : "generate";
    } else if (args.regenerateChanged && !args.onlyMissing) {
      if (fileExists && previousHash === item.promptHash) {
        action = "skip_unchanged";
      } else if (fileExists) {
        action = "regenerate";
      }
    } else if (fileExists) {
      action = "skip_unchanged";
    }

    if (action === "skip_unchanged") {
      counts.skippedUnchanged += 1;
      runItems.push({
        iconKey: item.iconKey,
        status: "skipped_unchanged",
        outputPath: item.outputPath,
      });
      if (args.verbose) {
        console.log(`SKIP ${item.iconKey} -> ${item.outputPath}`);
      }
      continue;
    }

    if (args.dryRun) {
      runItems.push({
        iconKey: item.iconKey,
        status: `would_${action}`,
        outputPath: item.outputPath,
        promptPreview: item.prompt.slice(0, 220),
      });
      if (args.verbose) {
        console.log(`DRYRUN ${action.toUpperCase()} ${item.iconKey} -> ${item.outputPath}`);
      }
      continue;
    }

    try {
      const imageBytes = await callOpenAiImage({
        apiKey,
        baseUrl,
        renderSettings: DEFAULT_RENDER_SETTINGS,
        prompt: item.prompt,
        caBundlePath,
        insecure: args.insecure,
      });
      ensureDir(path.dirname(item.outputPath));
      writeFileSync(item.outputPath, imageBytes);
      writeFileSync(item.promptSidecarPath, `${item.prompt}\n`, "utf8");

      if (action === "generate") {
        counts.generated += 1;
      } else {
        counts.regenerated += 1;
      }

      stateItems[item.iconKey] = {
        hash: item.promptHash,
        outputPath: item.outputPath,
        promptSidecarPath: item.promptSidecarPath,
        rowNumber: item.rowNumber,
        updatedAt: Math.floor(Date.now() / 1000),
        ...DEFAULT_RENDER_SETTINGS,
      };
      runItems.push({
        iconKey: item.iconKey,
        status: action,
        outputPath: item.outputPath,
      });
      if (args.verbose) {
        console.log(`${action.toUpperCase()} ${item.iconKey} -> ${item.outputPath}`);
      }
    } catch (error) {
      counts.failed += 1;
      runItems.push({
        iconKey: item.iconKey,
        status: "failed",
        outputPath: item.outputPath,
        error: String(error),
      });
      console.error(`FAILED ${item.iconKey}: ${error}`);
    }
  }

  let manifestStatus = { rebuilt: false, entryCount: 0 };
  if (!args.dryRun) {
    saveJson(DEFAULT_STATE_PATH, { items: stateItems });
    manifestStatus = maybeWriteNodeIconManifest(outputDir);
  }

  const report = {
    timestamp: Math.floor(Date.now() / 1000),
    csvPath,
    outputDir,
    dryRun: args.dryRun,
    force: args.force,
    regenerateChanged: args.regenerateChanged,
    onlyMissing: args.onlyMissing,
    limit: args.limit,
    render: {
      ...DEFAULT_RENDER_SETTINGS,
      baseUrl,
      tlsVerify: !args.insecure,
      caBundle: caBundlePath || "",
    },
    manifest: manifestStatus,
    counts,
    items: runItems,
  };
  saveJson(DEFAULT_REPORT_PATH, report);

  console.log(
    JSON.stringify(
      {
        counts,
        manifest: manifestStatus,
        reportPath: DEFAULT_REPORT_PATH,
      },
      null,
      2,
    ),
  );

  process.exitCode = counts.failed > 0 ? 1 : 0;
}

main().catch((error) => {
  console.error(String(error));
  process.exit(1);
});
