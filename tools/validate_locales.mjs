#!/usr/bin/env node

import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const localesRoot = join(repoRoot, "apps", "web", "src", "i18n", "locales");
const baseLocalePath = join(localesRoot, "en", "common.json");

function flattenKeys(node, prefix = "") {
  if (node === null || typeof node !== "object" || Array.isArray(node)) {
    return new Map([[prefix, String(node)]]);
  }

  const entries = new Map();
  for (const [key, value] of Object.entries(node)) {
    const nextPrefix = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      for (const [nestedKey, nestedValue] of flattenKeys(value, nextPrefix).entries()) {
        entries.set(nestedKey, nestedValue);
      }
    } else {
      entries.set(nextPrefix, String(value));
    }
  }
  return entries;
}

function interpolationTokens(value) {
  return new Set([...value.matchAll(/{{\s*([a-zA-Z0-9_.-]+)\s*}}/g)].map((match) => match[1]));
}

function setEquals(left, right) {
  if (left.size !== right.size) {
    return false;
  }
  for (const item of left) {
    if (!right.has(item)) {
      return false;
    }
  }
  return true;
}

function loadJson(path) {
  const raw = readFileSync(path, "utf8").replace(/^\uFEFF/, "");
  return JSON.parse(raw);
}

const base = loadJson(baseLocalePath);
const baseFlat = flattenKeys(base);
const localeDirs = readdirSync(localesRoot).filter((entry) => {
  const fullPath = join(localesRoot, entry);
  return statSync(fullPath).isDirectory() && entry !== "en";
});

let hasErrors = false;
console.log(`Base locale keys: ${baseFlat.size}`);

for (const locale of localeDirs) {
  const localePath = join(localesRoot, locale, "common.json");
  const localeJson = loadJson(localePath);
  const localeFlat = flattenKeys(localeJson);
  const missing = [...baseFlat.keys()].filter((key) => !localeFlat.has(key));
  const extra = [...localeFlat.keys()].filter((key) => !baseFlat.has(key));

  const tokenMismatches = [];
  for (const [key, localizedValue] of localeFlat.entries()) {
    const baseValue = baseFlat.get(key);
    if (baseValue === undefined) {
      continue;
    }
    const baseTokens = interpolationTokens(baseValue);
    const localeTokens = interpolationTokens(localizedValue);
    if (!setEquals(baseTokens, localeTokens)) {
      tokenMismatches.push(key);
    }
  }

  const coverage = ((baseFlat.size - missing.length) / baseFlat.size) * 100;
  console.log(
    `${locale}: coverage=${coverage.toFixed(1)}% missing=${missing.length} extra=${extra.length} tokenMismatch=${tokenMismatches.length}`
  );

  if (extra.length > 0 || tokenMismatches.length > 0) {
    hasErrors = true;
  }
}

if (hasErrors) {
  console.error("Locale validation failed: remove extra keys and fix interpolation token mismatches.");
  process.exit(1);
}

console.log("Locale validation passed.");
