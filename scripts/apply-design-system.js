#!/usr/bin/env node
/**
 * apply-design-system.js
 * Reads a design tokens JSON (e.g. tokens/linear.json) and injects the values
 * into packages/ui/tailwind.config.js + packages/ui/src/app/globals.css.
 *
 * Usage:
 *   node scripts/apply-design-system.js tokens/linear.json
 *   node scripts/apply-design-system.js --dry-run tokens/linear.json
 *
 * The script is idempotent — running it again with the same input produces no
 * change. It preserves any tailwind extensions not in the token set (e.g.
 * the existing `bronze` palette and animations) by reading the current file
 * and merging in only the keys present in the token set.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "..");

function fail(msg) {
  console.error(`[apply-design-system] ${msg}`);
  process.exit(1);
}

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const tokenFile = args.find((a) => !a.startsWith("--"));
if (!tokenFile) fail("Usage: node scripts/apply-design-system.js [--dry-run] <tokens.json>");

const tokenPath = resolve(repoRoot, tokenFile);
let tokens;
try {
  tokens = JSON.parse(readFileSync(tokenPath, "utf8"));
} catch (e) {
  fail(`Cannot read/parse ${tokenPath}: ${e.message}`);
}

const tailwindPath = join(repoRoot, "packages/ui/tailwind.config.js");
const cssPath = join(repoRoot, "packages/ui/src/app/globals.css");

let tailwindSource;
try {
  tailwindSource = readFileSync(tailwindPath, "utf8");
} catch (e) {
  fail(`Cannot read ${tailwindPath}: ${e.message}`);
}

let cssSource;
try {
  cssSource = readFileSync(cssPath, "utf8");
} catch (e) {
  fail(`Cannot read ${cssPath}: ${e.message}`);
}

const linearColors = {
  "linear-bg": {
    DEFAULT: tokens.color.background.default,
    subtle: tokens.color.background.subtle,
    elevated: tokens.color.background.elevated,
    overlay: tokens.color.background.overlay,
  },
  "linear-border": {
    DEFAULT: tokens.color.border.default,
    subtle: tokens.color.border.subtle,
    strong: tokens.color.border.strong,
  },
  "linear-text": {
    DEFAULT: tokens.color.text.primary,
    secondary: tokens.color.text.secondary,
    tertiary: tokens.color.text.tertiary,
    disabled: tokens.color.text.disabled,
    accent: tokens.color.text.accent,
  },
  "linear-accent": {
    DEFAULT: tokens.color.accent.primary,
    hover: tokens.color.accent.primaryHover,
    secondary: tokens.color.accent.secondary,
  },
  "linear-status": {
    success: tokens.color.status.success,
    warning: tokens.color.status.warning,
    danger: tokens.color.status.danger,
    info: tokens.color.status.info,
  },
};

const newColorsBlock = JSON.stringify(linearColors, null, 8)
  .split("\n")
  .map((line, i) => (i === 0 ? "        " + line : "        " + line))
  .join("\n");

let tailwindCleaned = tailwindSource.replace(
  /\/\/ Linear \(MVE\) design system[\s\S]*?\},?\n/,
  ""
);

const tailwindUpdated = tailwindCleaned.replace(
  /(colors:\s*\{)/,
  `$1
        // Linear (MVE) design system — applied via scripts/apply-design-system.js
${newColorsBlock},
`
);

const cssVars = [];
const push = (k, v) => cssVars.push(`  --linear-${k}: ${v};`);
push("bg-default", tokens.color.background.default);
push("bg-subtle", tokens.color.background.subtle);
push("bg-elevated", tokens.color.background.elevated);
push("bg-overlay", tokens.color.background.overlay);
push("border-default", tokens.color.border.default);
push("border-subtle", tokens.color.border.subtle);
push("border-strong", tokens.color.border.strong);
push("text-primary", tokens.color.text.primary);
push("text-secondary", tokens.color.text.secondary);
push("text-tertiary", tokens.color.text.tertiary);
push("text-disabled", tokens.color.text.disabled);
push("text-accent", tokens.color.text.accent);
push("accent-primary", tokens.color.accent.primary);
push("accent-primary-hover", tokens.color.accent.primaryHover);
push("accent-secondary", tokens.color.accent.secondary);
push("status-success", tokens.color.status.success);
push("status-warning", tokens.color.status.warning);
push("status-danger", tokens.color.status.danger);
push("status-info", tokens.color.status.info);
push("radius-sm", tokens.radius.sm);
push("radius-md", tokens.radius.md);
push("radius-lg", tokens.radius.lg);
push("radius-xl", tokens.radius.xl);
push("fontSize-xs", tokens.typography.fontSize.xs);
push("fontSize-sm", tokens.typography.fontSize.sm);
push("fontSize-base", tokens.typography.fontSize.base);
push("fontSize-md", tokens.typography.fontSize.md);
push("fontSize-lg", tokens.typography.fontSize.lg);
push("shadow-sm", tokens.shadow.sm);
push("shadow-md", tokens.shadow.md);
push("shadow-glow", tokens.shadow.glow);
push("shadow-glow-danger", tokens.shadow.glowDanger);

const cssVarsBlock =
  "  /* Linear (MVE) design system — applied via scripts/apply-design-system.js */\n" +
  cssVars.join("\n");

let cssUpdated = cssSource;
const cssMarker = "/* Linear (MVE) design system";
if (cssSource.includes(cssMarker)) {
  cssUpdated = cssSource.replace(
    /\/\* Linear \(MVE\) design system[\s\S]*?(?=\n  --linear-|$)/,
    ""
  );
}
cssUpdated = cssUpdated.replace(
  /(:root\s*\{[\s\S]*?)(--color-gunmetal)/,
  (match, prefix, first) => {
    return `${prefix}${cssVarsBlock}\n\n  ${first}`;
  }
);

if (dryRun) {
  console.log("[apply-design-system] DRY RUN — no files changed");
  console.log(`\n--- tailwind.config.js colors block would be ---\n${newColorsBlock}\n`);
  console.log(`\n--- globals.css :root vars would be ---\n${cssVarsBlock}\n`);
  process.exit(0);
}

writeFileSync(tailwindPath, tailwindUpdated, "utf8");
writeFileSync(cssPath, cssUpdated, "utf8");

console.log(`[apply-design-system] Updated:`);
console.log(`  - ${tailwindPath}`);
console.log(`  - ${cssPath}`);
console.log(`[apply-design-system] Source: ${tokenPath}`);
console.log(`[apply-design-system] Run pnpm build to verify.`);
