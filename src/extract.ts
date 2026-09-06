import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, basename } from "node:path";
import type { Sheet, Section, KeymapEntry } from "./types.ts";
import { PALETTE } from "./theme.ts";
import { stripString, splitArgs, findCalls, findBraceBlocks } from "./lua-scan.ts";
import { inferDesc } from "./infer.ts";

// ---------------------------------------------------------------------------
// Turns Neovim Lua configs into a draft sheet, one section per file. Not a Lua
// parser (see lua-scan.ts) — a best-effort scanner over the map shapes real
// configs use. Recognized:
//
//   vim.keymap.set(mode, lhs, rhs, { desc = "..." })
//   map(lhs, rhs, "desc")                      -- kickstart-style helper
//   keys = { { lhs, rhs, desc = "..." }, ... }  -- lazy.nvim specs
//
// Missing descriptions are inferred from the rhs (see infer.ts).
// ---------------------------------------------------------------------------

export interface RawFile {
	/** Path or name; only the basename (minus .lua) drives the section name. */
	path: string;
	content: string;
}

const PALETTE_NAMES = Object.keys(PALETTE);

/** Pull `desc = "..."` out of an options-table token, if present. */
function descOf(optsTok: string | undefined): string | undefined {
	if (!optsTok) return undefined;
	const m = optsTok.match(/desc\s*=\s*(?:"([^"]*)"|'([^']*)')/);
	return m ? (m[1] ?? m[2]) : undefined;
}

/** Extract keymap entries from one file's Lua source. */
export function extractFromSource(src: string): KeymapEntry[] {
	const entries: KeymapEntry[] = [];
	const seen = new Set<string>();

	const push = (lhsRaw: string | undefined, desc: string | undefined, rhs?: string) => {
		if (!lhsRaw) return;
		const lhs = stripString(lhsRaw);
		if (lhs === null) return;
		const key = lhs + "\u0000" + (desc ?? "");
		if (seen.has(key)) return;
		seen.add(key);
		entries.push({ desc: desc && desc.length ? desc : inferDesc(rhs), keys: lhs });
	};

	// vim.keymap.set(mode, lhs, rhs, opts)
	for (const inner of findCalls(src, "vim.keymap.set")) {
		const a = splitArgs(inner);
		push(a[1], descOf(a[3]), a[2]);
	}

	// map(lhs, rhs, "desc") — kickstart helper. First arg must be a key literal.
	for (const inner of findCalls(src, "map")) {
		const a = splitArgs(inner);
		if (a.length < 2 || stripString(a[0]) === null) continue;
		push(a[0], stripString(a[2] ?? "") ?? undefined, a[1]);
	}

	// lazy.nvim keys = { { lhs, rhs, desc = "..." }, ... }
	// Scoped strictly to `keys = {` blocks so dependency/cmd tables aren't
	// mistaken for keymaps.
	for (const block of findBraceBlocks(src, /keys\s*=\s*/)) {
		for (const entryTok of splitArgs(block)) {
			const inner = entryTok.trim().replace(/^\{/, "").replace(/\}$/, "");
			const parts = splitArgs(inner);
			if (parts.length === 0 || stripString(parts[0]) === null) continue;
			const rhs = parts[1] && stripString(parts[1]) !== null ? parts[1] : undefined;
			push(parts[0], descOf(parts.slice(1).join(",")), rhs);
		}
	}

	return entries;
}

/** Clean a filename into a section label: config_keymaps.lua -> "keymaps". */
export function sectionName(path: string): string {
	const base = basename(path).replace(/\.lua$/, "");
	const stripped = base.replace(/^(config|plugins)[_.-]?/, "");
	return stripped.length ? stripped : base;
}

/** Build a draft sheet from in-memory files (the editor's upload path). */
export function extractFromFiles(files: RawFile[]): Sheet {
	const lua = files
		.filter((f) => f.path.endsWith(".lua"))
		.sort((a, b) => a.path.localeCompare(b.path));

	const sections: Section[] = [];
	let colorIdx = 0;
	for (const f of lua) {
		const maps = extractFromSource(f.content);
		if (maps.length === 0) continue;
		sections.push({
			name: sectionName(f.path),
			color: PALETTE_NAMES[colorIdx % PALETTE_NAMES.length],
			maps,
		});
		colorIdx++;
	}
	return { title: "extracted keymaps (draft — curate me)", columns: 2, sections };
}

function walkLuaFiles(root: string, acc: string[] = []): string[] {
	for (const name of readdirSync(root)) {
		const p = join(root, name);
		if (statSync(p).isDirectory()) walkLuaFiles(p, acc);
		else if (name.endsWith(".lua")) acc.push(p);
	}
	return acc;
}

/** Scan a config directory on disk (the CLI `extract` path). */
export function extractSheet(configDir: string): Sheet {
	const files: RawFile[] = walkLuaFiles(configDir).map((p) => ({
		path: p,
		content: readFileSync(p, "utf8"),
	}));
	return extractFromFiles(files);
}
