// ---------------------------------------------------------------------------
// Low-level Lua source scanning primitives. These know nothing about keymaps —
// they just tokenize enough Lua to pull arguments out of calls and tables.
// The keymap-specific logic lives in extract.ts / infer.ts.
//
// This is deliberately not a full Lua parser. It handles the shapes real
// Neovim configs use (string literals, nested (), {}, [] and call/table
// structure) well enough to seed a draft that a human then curates.
// ---------------------------------------------------------------------------

/** Unescape the backslash escapes that matter inside Lua string literals. */
export function unescapeLua(s: string): string {
	return s.replace(/\\(["'\\])/g, "$1");
}

/**
 * If `tok` is a single Lua string literal ("x", 'x', or [[x]]), return its
 * contents; otherwise return null. Used to tell "a key like <leader>f" apart
 * from an expression like `vim.lsp.buf.rename`.
 */
export function stripString(tok: string): string | null {
	tok = tok.trim();
	let m = tok.match(/^"((?:[^"\\]|\\.)*)"$/);
	if (m) return unescapeLua(m[1]);
	m = tok.match(/^'((?:[^'\\]|\\.)*)'$/);
	if (m) return unescapeLua(m[1]);
	m = tok.match(/^\[\[([\s\S]*)\]\]$/);
	if (m) return m[1];
	return null;
}

/**
 * Split a Lua argument/element list on top-level commas, respecting (), {}, []
 * nesting and string literals. Input is the text *inside* the outer delimiter.
 */
export function splitArgs(inner: string): string[] {
	const args: string[] = [];
	let depth = 0;
	let quote: string | null = null;
	let start = 0;
	for (let i = 0; i < inner.length; i++) {
		const c = inner[i];
		if (quote) {
			if (c === "\\") i++;
			else if (c === quote) quote = null;
			continue;
		}
		if (c === '"' || c === "'") quote = c;
		else if (c === "(" || c === "{" || c === "[") depth++;
		else if (c === ")" || c === "}" || c === "]") depth--;
		else if (c === "," && depth === 0) {
			args.push(inner.slice(start, i).trim());
			start = i + 1;
		}
	}
	const tail = inner.slice(start).trim();
	if (tail.length) args.push(tail);
	return args;
}

/** Walk from just after an opening delimiter to its balanced close. */
function scanBalanced(src: string, from: number, open: string, close: string): number {
	let depth = 1;
	let quote: string | null = null;
	let i = from;
	for (; i < src.length && depth > 0; i++) {
		const c = src[i];
		if (quote) {
			if (c === "\\") i++;
			else if (c === quote) quote = null;
		} else if (c === '"' || c === "'") quote = c;
		else if (c === open) depth++;
		else if (c === close) depth--;
	}
	return depth === 0 ? i - 1 : -1; // index of the matching close, or -1
}

/**
 * Find every `name(` call and return the substring inside its balanced
 * parentheses. `name` may contain dots (e.g. "vim.keymap.set").
 */
export function findCalls(src: string, name: string): string[] {
	const re = new RegExp(`\\b${name.replace(/\./g, "\\.")}\\s*\\(`, "g");
	const out: string[] = [];
	let m: RegExpExecArray | null;
	while ((m = re.exec(src))) {
		const start = m.index + m[0].length;
		const end = scanBalanced(src, start, "(", ")");
		if (end !== -1) out.push(src.slice(start, end));
	}
	return out;
}

/**
 * Find every `<prefix>{ ... }` block and return the balanced brace contents.
 * Used to isolate lazy.nvim `keys = { ... }` from dependency / cmd tables.
 */
export function findBraceBlocks(src: string, prefix: RegExp): string[] {
	const re = new RegExp(prefix.source + "\\{", "g");
	const out: string[] = [];
	let m: RegExpExecArray | null;
	while ((m = re.exec(src))) {
		const start = m.index + m[0].length;
		const end = scanBalanced(src, start, "{", "}");
		if (end !== -1) out.push(src.slice(start, end));
	}
	return out;
}
