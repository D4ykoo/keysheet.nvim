import type { Sheet, SheetTheme } from "./types.ts";
import { DEFAULT_THEME, resolveColor } from "./theme.ts";
import { LAYOUT, cardHeight, placeSections, pageSize } from "./layout.ts";

export interface RenderResult {
	svg: string;
	width: number;
	height: number;
	/** Non-fatal issues, e.g. descriptions truncated to fit their card. */
	warnings: string[];
}

function esc(s: string): string {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

/**
 * Render a sheet to a self-contained SVG string. Deterministic: the same sheet
 * always produces byte-identical output, which keeps diffs and PNG exports
 * stable. Layout decisions live in layout.ts; this function only emits markup.
 */
export function renderSVG(sheet: Sheet): RenderResult {
	const theme: SheetTheme = { ...DEFAULT_THEME, ...sheet.theme };
	const columns = Math.max(1, sheet.columns ?? 2);
	const charW = theme.fontSize * theme.charRatio;
	const warnings: string[] = [];

	const { placed, contentHeight } = placeSections(sheet, columns);
	const { width, height } = pageSize(columns, contentHeight);

	const parts: string[] = [
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" font-family="${esc(theme.fontFamily)}" font-size="${theme.fontSize}">`,
		// Full-bleed base fill + rounded page. Two rects (same color) so the
		// rounded corners never expose the transparent canvas behind them.
		`<rect width="${width}" height="${height}" fill="${theme.background}"/>`,
		`<rect width="${width}" height="${height}" rx="${LAYOUT.pageRadius}" fill="${theme.background}"/>`,
	];

	for (const { section, index, col, y } of placed) {
		const x = LAYOUT.pagePad + col * (LAYOUT.cardW + LAYOUT.colGap);
		const top = LAYOUT.pagePad + y;
		const h = cardHeight(section);
		const color = resolveColor(section.color, index);

		parts.push(`<g>`);
		parts.push(
			`<rect x="${x}" y="${top}" width="${LAYOUT.cardW}" height="${h}" rx="${LAYOUT.cardRadius}" fill="${theme.card}"/>`,
		);

		// Header pill straddling the top edge of the card.
		const pillW = section.name.length * charW + LAYOUT.pillPadX * 2;
		const pillX = x + (LAYOUT.cardW - pillW) / 2;
		const pillY = top - LAYOUT.pillH / 2;
		parts.push(
			`<rect x="${pillX.toFixed(1)}" y="${pillY}" width="${pillW.toFixed(1)}" height="${LAYOUT.pillH}" rx="${LAYOUT.pillRadius}" fill="${color}"/>`,
			`<text x="${(x + LAYOUT.cardW / 2).toFixed(1)}" y="${pillY + LAYOUT.pillH / 2}" fill="${theme.pillText}" font-weight="700" text-anchor="middle" dominant-baseline="central">${esc(section.name)}</text>`,
		);

		// Rows: description left-aligned, keys right-aligned.
		const usable = LAYOUT.cardW - LAYOUT.cardPadX * 2;
		section.maps.forEach((entry, row) => {
			const cy = top + LAYOUT.cardPadTop + row * LAYOUT.rowH + LAYOUT.rowH / 2;
			const descColor = entry.muted ? theme.muted : theme.text;
			const keyColor = entry.muted ? theme.muted : theme.keys;

			// Truncate the description if it would collide with the keys.
			const keysW = entry.keys.length * charW;
			const maxDescChars = Math.floor((usable - keysW - 3 * charW) / charW);
			let desc = entry.desc;
			if (desc.length > maxDescChars) {
				warnings.push(
					`[${section.name}] truncated: "${entry.desc}" (${desc.length} > ${maxDescChars} chars)`,
				);
				desc = desc.slice(0, Math.max(0, maxDescChars - 1)) + "…";
			}

			parts.push(
				`<text x="${x + LAYOUT.cardPadX}" y="${cy}" fill="${descColor}" dominant-baseline="central">${esc(desc)}</text>`,
				`<text x="${x + LAYOUT.cardW - LAYOUT.cardPadX}" y="${cy}" fill="${keyColor}" text-anchor="end" dominant-baseline="central">${esc(entry.keys)}</text>`,
			);
		});

		parts.push(`</g>`);
	}

	parts.push(`</svg>`);
	return { svg: parts.join("\n"), width, height, warnings };
}
