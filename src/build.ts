import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Sheet } from "./types.ts";
import { renderSVG } from "./svg.ts";
import { renderHTML } from "./html.ts";

export type Format = "svg" | "html" | "png";

export interface BuildResult {
	written: string[];
	warnings: string[];
	skipped: string[];
}

/**
 * Render `sheet` into `outdir` in the requested formats. PNG is intentionally
 * not produced here — it's rasterized in the browser (with the user's fonts)
 * via the editor — so it's reported as skipped rather than written.
 */
export function build(sheet: Sheet, outdir: string, formats: Format[]): BuildResult {
	mkdirSync(outdir, { recursive: true });
	const result: BuildResult = { written: [], warnings: [], skipped: [] };

	for (const format of formats) {
		switch (format) {
			case "svg": {
				const { svg, warnings } = renderSVG(sheet);
				const path = join(outdir, "keysheet.svg");
				writeFileSync(path, svg);
				result.written.push(path);
				result.warnings.push(...warnings);
				break;
			}
			case "html": {
				const path = join(outdir, "keysheet.html");
				writeFileSync(path, renderHTML(sheet));
				result.written.push(path);
				break;
			}
			case "png":
				result.skipped.push("png (browser-only — use the editor's PNG buttons)");
				break;
			default:
				result.skipped.push(`unknown format "${format}"`);
		}
	}
	return result;
}
