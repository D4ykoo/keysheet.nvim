import { stripString } from "./lua-scan.ts";

// ---------------------------------------------------------------------------
// Turning a keymap's right-hand side into a human-readable description when the
// config didn't provide a `desc`. All of this is heuristic and best-effort;
// anything it can't confidently name comes back as PLACEHOLDER for the user to
// fill in during curation.
// ---------------------------------------------------------------------------

export const PLACEHOLDER = "TODO: describe";

/** Common `vim.*.<verb>` / `builtin.<verb>` endings mapped to friendly text. */
const KNOWN_VERBS: Record<string, string> = {
	rename: "rename symbol",
	code_action: "code action",
	definition: "goto definition",
	declaration: "goto declaration",
	references: "goto references",
	implementation: "goto implementation",
	hover: "hover",
	setloclist: "diagnostics to loclist",
	open_float: "show diagnostic float",
	goto_next: "next diagnostic",
	goto_prev: "previous diagnostic",
};

/** harpoon `:list():<verb>(arg)` chains → friendly text. */
function harpoonChain(rhs: string): string | null {
	const chains = [...rhs.matchAll(/:(\w+)\(([^)]*)\)/g)].filter((m) => m[1] !== "list");
	if (!chains.length) return null;
	const [, verb, arg] = chains[chains.length - 1];
	switch (verb) {
		case "select":
			return `nav file ${arg || "?"}`;
		case "replace_at":
			return `replace file ${arg || "?"}`;
		case "add":
			return "add file to menu";
		case "prev":
			return "previous buffer";
		case "next":
			return "next buffer";
		case "toggle_quick_menu":
			return "toggle quick menu";
		default:
			return null;
	}
}

/**
 * A command mapping → the command name. Matches `<cmd>Foo<cr>`, `:Foo<cr>`, or
 * a bare `:Foo`, but NOT a macro that merely starts with an ex-command, e.g.
 * `:m '>+1<CR>gv=gv` (there the command isn't the whole mapping). Those fall
 * through to the placeholder for the user to describe.
 */
function commandString(str: string): string | null {
	const m =
		str.match(/<cmd>(.+?)<cr>/i) ||
		str.match(/^:([A-Za-z]\w*)<cr>$/i) ||
		str.match(/^:([A-Za-z]\w*)$/);
	return m ? m[1] : null;
}

/**
 * Infer a description from a right-hand side. Returns PLACEHOLDER when the rhs
 * is a macro or otherwise not confidently nameable (e.g. `:m '>+1<CR>gv=gv`).
 */
export function inferDesc(rhs: string | undefined): string {
	if (!rhs) return PLACEHOLDER;
	rhs = rhs.trim();

	// String rhs: a command mapping like "<cmd>NvimTreeToggle<cr>" or ":Oil<CR>".
	const str = stripString(rhs);
	if (str !== null) return commandString(str) ?? PLACEHOLDER;

	// harpoon chains, possibly wrapped in `function() ... end`.
	const chain = harpoonChain(rhs);
	if (chain) return chain;

	// Dotted identifier: vim.lsp.buf.rename / builtin.find_files / vim.cmd.Foo.
	if (/^[\w.]+$/.test(rhs)) {
		const last = rhs.split(".").pop()!;
		return KNOWN_VERBS[last] ?? last.replace(/_/g, " ");
	}

	return PLACEHOLDER;
}
