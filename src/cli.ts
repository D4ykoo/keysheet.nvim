#!/usr/bin/env bun
import { readFileSync, writeFileSync } from "node:fs";
import type { Sheet } from "./types.ts";
import { build, type Format } from "./build.ts";
import { extractSheet } from "./extract.ts";
import { serve } from "./serve.ts";

const HELP = `keysheet — keymap overview generator

Usage:
  keysheet serve   [keymaps.json] [--port 4711]   interactive editor (recommended)
  keysheet build   <keymaps.json> [-o outdir] [--format svg,html]
  keysheet extract <nvim-config-dir> [-o draft.json]

Editor (serve):
  Open the URL it prints. Upload your whole nvim config (a folder, or a set
  of .lua files) to auto-generate sections, edit them in the form with live
  preview, and export SVG / PNG / HTML / PDF / JSON. "Save" writes the model
  back to the given JSON file so your edits persist. If the JSON doesn't
  exist yet you start from an empty sheet.

Formats (build):
  svg    deterministic vector export (default)
  html   standalone page, selectable text, print → PDF
  png    browser-only (use the editor's PNG buttons — rasterized with your fonts)

Examples:
  bun run src/cli.ts serve keymaps.json
  bun run src/cli.ts build keymaps.json -o out --format svg,html
  bun run src/cli.ts extract ~/.config/nvim -o draft.json
`;

function arg(flag: string, fallback?: string): string | undefined {
	const i = process.argv.indexOf(flag);
	return i !== -1 ? process.argv[i + 1] : fallback;
}

function fail(msg: string): never {
	console.error("error:", msg, "\n");
	console.log(HELP);
	process.exit(1);
}

function readSheet(path: string): Sheet {
	return JSON.parse(readFileSync(path, "utf8"));
}

const [, , command, target] = process.argv;

switch (command) {
	case "build": {
		if (!target) fail("build needs a keymaps.json path");
		const formats = (arg("--format", "svg") ?? "svg").split(",").map((f) => f.trim()) as Format[];
		const result = build(readSheet(target), arg("-o", ".")!, formats);
		result.written.forEach((p) => console.log("wrote", p));
		result.warnings.forEach((w) => console.warn("warn:", w));
		result.skipped.forEach((s) => console.warn("skip:", s));
		break;
	}

	case "serve": {
		// Path is optional — defaults to keymaps.json (created on first Save).
		serve(target ?? "keymaps.json", Number(arg("--port") ?? process.env.PORT ?? "4711"));
		break;
	}

	case "extract": {
		if (!target) fail("extract needs a Neovim config directory");
		const draft = JSON.stringify(extractSheet(target), null, "\t");
		const out = arg("-o");
		if (out) {
			writeFileSync(out, draft);
			console.log("wrote", out);
		} else {
			console.log(draft);
		}
		break;
	}

	default:
		console.log(HELP);
}
