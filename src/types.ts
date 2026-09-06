// Data model for a keymap sheet.
//
// A sheet is a list of sections; each section becomes one card with a
// colored header pill. Entries are (description, keys) pairs rendered
// as left/right aligned rows, matching the original overview layout.

export interface KeymapEntry {
	/** Left-aligned description, e.g. "toggle quick menu" */
	desc: string;
	/** Right-aligned key notation, e.g. "<leader> + a" or "C-e" */
	keys: string;
	/** Render dimmed (used for meta rows like the leader definition) */
	muted?: boolean;
}

export interface Section {
	/** Header pill label */
	name: string;
	/** Named palette color (see theme.ts) or a raw #hex value */
	color?: string;
	/** Pin to a column (1-based). Omit for automatic masonry placement. */
	column?: number;
	maps: KeymapEntry[];
}

export interface SheetTheme {
	background: string;
	card: string;
	text: string;
	keys: string;
	muted: string;
	pillText: string;
	fontFamily: string;
	fontSize: number;
	/** average glyph width relative to fontSize (monospace) */
	charRatio: number;
}

export interface Sheet {
	title?: string;
	/** Number of card columns (default 2) */
	columns?: number;
	theme?: Partial<SheetTheme>;
	sections: Section[];
}
