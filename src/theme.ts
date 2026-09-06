import type { SheetTheme } from "./types.ts";

// Palette sampled from the original overview image. Section colors are
// referenced by name in keymaps.json, or you can pass any #hex directly.
export const PALETTE: Record<string, string> = {
	sky: "#8fd0dd",
	pink: "#dd8fb4",
	orchid: "#d7a2ea",
	chartreuse: "#d4de8e",
	mint: "#8fdd94",
	forest: "#5f976c",
	violet: "#9086dd",
	amber: "#e5c07b",
	coral: "#e8927c",
	steel: "#8fa7dd",
};

export const DEFAULT_THEME: SheetTheme = {
	background: "#10151c",
	card: "#1b222c",
	text: "#dfe4ea",
	keys: "#f4f6f8",
	muted: "#657081",
	pillText: "#10151c",
	fontFamily:
		"'JetBrains Mono','Fira Code','Cascadia Mono',ui-monospace,'SF Mono',Menlo,Consolas,monospace",
	fontSize: 17,
	charRatio: 0.601, // JetBrains Mono advance width
};

export function resolveColor(name: string | undefined, index: number): string {
	if (name?.startsWith("#")) return name;
	if (name && PALETTE[name]) return PALETTE[name];
	const cycle = Object.values(PALETTE);
	return cycle[index % cycle.length];
}
