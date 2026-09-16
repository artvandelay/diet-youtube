#!/usr/bin/env node
/**
 * Bundle isolated content.js + static imports into a classic IIFE.
 * Chrome Load unpacked executes content_scripts as classic JS (no modules).
 */
import * as esbuild from "esbuild";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

await esbuild.build({
  absWorkingDir: root,
  entryPoints: ["src/content/content.js"],
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "es2020",
  outfile: "src/content/content.bundle.js",
  legalComments: "none",
  banner: {
    js: "/* Diet-Youtube isolated content — generated classic IIFE. Source: src/content/content.js */",
  },
});

console.log("wrote src/content/content.bundle.js");
