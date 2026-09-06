import type { Sheet, SheetTheme } from "./types.ts";
import { DEFAULT_THEME, resolveColor } from "./theme.ts";

function esc(s: string): string {
	return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Standalone HTML document: same look as the SVG, but real text
 * (selectable, searchable) and a print stylesheet so the browser's
 * "Print → Save as PDF" produces a clean PDF export.
 */
export function renderHTML(sheet: Sheet): string {
	const theme: SheetTheme = { ...DEFAULT_THEME, ...sheet.theme };
	const columns = Math.max(1, sheet.columns ?? 2);
	const title = sheet.title ?? "keymaps";

	const cards = sheet.sections
		.map((section, i) => {
			const color = resolveColor(section.color, i);
			const rows = section.maps
				.map(
					(m) =>
						`<div class="row${m.muted ? " muted" : ""}"><span class="desc">${esc(m.desc)}</span><span class="keys">${esc(m.keys)}</span></div>`,
				)
				.join("\n");
			return `<section class="card"><h2 style="background:${color}">${esc(section.name)}</h2>\n${rows}\n</section>`;
		})
		.join("\n");

	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>
	:root {
		--bg: ${theme.background};
		--card: ${theme.card};
		--text: ${theme.text};
		--keys: ${theme.keys};
		--muted: ${theme.muted};
		--pill-text: ${theme.pillText};
	}
	* { box-sizing: border-box; margin: 0; }
	body {
		background: var(--bg);
		font-family: ${theme.fontFamily};
		font-size: ${theme.fontSize}px;
		padding: 56px;
	}
	.sheet {
		columns: ${columns};
		column-gap: 44px;
		max-width: ${columns * 760 + (columns - 1) * 44}px;
		margin: 0 auto;
	}
	.card {
		background: var(--card);
		border-radius: 16px;
		padding: 52px 36px 32px;
		margin-bottom: 44px;
		break-inside: avoid;
		position: relative;
	}
	.card h2 {
		position: absolute;
		top: -22px;
		left: 50%;
		transform: translateX(-50%);
		color: var(--pill-text);
		font-size: ${theme.fontSize}px;
		font-weight: 700;
		padding: 10px 36px;
		border-radius: 8px;
		white-space: nowrap;
	}
	.row {
		display: flex;
		justify-content: space-between;
		gap: 24px;
		line-height: 2.1;
	}
	.desc { color: var(--text); }
	.keys { color: var(--keys); white-space: nowrap; }
	.row.muted .desc, .row.muted .keys { color: var(--muted); }

	@media (max-width: 900px) { .sheet { columns: 1; } }

	@media print {
		body { padding: 24px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
		.card { box-shadow: none; }
		@page { margin: 10mm; }
	}
</style>
</head>
<body>
<main class="sheet">
${cards}
</main>
</body>
</html>
`;
}
