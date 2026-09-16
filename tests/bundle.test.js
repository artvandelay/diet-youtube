import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bundlePath = path.join(root, "src/content/content.bundle.js");

describe("isolated content bundle (classic IIFE)", () => {
  const source = readFileSync(bundlePath, "utf8");

  it("is a generated IIFE, not an ESM entry", () => {
    assert.match(source, /generated classic IIFE/);
    assert.equal(source.trimStart().startsWith("import "), false);
    assert.doesNotMatch(source, /^import\s/m);
    assert.match(source, /\(function\s*\(|=>\s*\{/);
  });

  it("parses as classic JavaScript", () => {
    const check = spawnSync(process.execPath, ["--check", bundlePath], {
      encoding: "utf8",
    });
    assert.equal(check.status, 0, check.stderr || check.stdout);
  });
});
