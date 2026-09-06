import type { Sheet, Section } from "./types.ts";

// ---------------------------------------------------------------------------
// Layout geometry, in SVG user units. All spacing/sizing for the sheet lives
// here so the renderer in svg.ts stays purely about emitting markup. Tweak a
// value here and every export (SVG/PNG/PDF via SVG) changes consistently.
// ---------------------------------------------------------------------------
export const LAYOUT = {
	pagePad: 72,
	pageRadius: 44,
	cardW: 900,
	cardRadius: 18,
	cardPadX: 44,
	cardPadTop: 64, // room below the pill that straddles the card's top edge
	cardPadBottom: 40,
	colGap: 56,
	cardGap: 56,
	rowH: 38,
	pillH: 46,
	pillPadX: 44,
	pillRadius: 8,
} as const;

export function cardHeight(section: Section): number {
	return LAYOUT.cardPadTop + section.maps.length * LAYOUT.rowH + LAYOUT.cardPadBottom;
}

/** A section positioned on the page, ready to render. */
export interface PlacedSection {
	section: Section;
	/** Original index in the sheet (drives palette auto-color). */
	index: number;
	col: number;
	/** Top offset within the content area (before page padding is added). */
	y: number;
}

export interface Placement {
	placed: PlacedSection[];
	contentHeight: number;
}

/**
 * Masonry placement: sections with an explicit 1-based `column` are pinned to
 * it; everything else drops into the currently shortest column. Source order
 * is preserved within each column.
 */
export function placeSections(sheet: Sheet, columns: number): Placement {
	const heights = new Array<number>(columns).fill(0);
	const placed: PlacedSection[] = [];

	sheet.sections.forEach((section, index) => {
		const pinned = section.column && section.column >= 1 && section.column <= columns;
		const col = pinned ? section.column! - 1 : heights.indexOf(Math.min(...heights));
		placed.push({ section, index, col, y: heights[col] });
		heights[col] += cardHeight(section) + LAYOUT.cardGap;
	});

	return { placed, contentHeight: Math.max(...heights) - LAYOUT.cardGap };
}

/** Total page dimensions for a given column count. */
export function pageSize(columns: number, contentHeight: number) {
	return {
		width: LAYOUT.pagePad * 2 + columns * LAYOUT.cardW + (columns - 1) * LAYOUT.colGap,
		height: LAYOUT.pagePad * 2 + contentHeight,
	};
}
