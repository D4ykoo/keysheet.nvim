import { test } from "node:test";
import assert from "node:assert/strict";
import type { Sheet } from "../src/types.ts";
import { placeSections, cardHeight } from "../src/layout.ts";
import { renderSVG } from "../src/svg.ts";

const sheet = (over: Partial<Sheet> = {}): Sheet => ({
	title: "t",
	columns: 2,
	sections: [
		{ name: "a", maps: [{ desc: "one", keys: "x" }] },
		{ name: "b", maps: [{ desc: "two", keys: "y" }, { desc: "three", keys: "z" }] },
		{ name: "c", maps: [{ desc: "four", keys: "w" }] },
	],
	...over,
});

test("masonry drops each section into the shortest column", () => {
	const { placed } = placeSections(sheet(), 2);
	// a -> col0 (empty), b -> col1 (empty), c -> col0 (shorter after a)
	assert.deepEqual(placed.map((p) => p.col), [0, 1, 0]);
});

test("explicit column pins override auto-placement", () => {
	const s = sheet();
	s.sections[0].column = 2; // pin "a" to column 2
	const { placed } = placeSections(s, 2);
	assert.equal(placed[0].col, 1);
});

test("cardHeight grows with row count", () => {
	assert.ok(cardHeight(sheet().sections[1]) > cardHeight(sheet().sections[0]));
});

test("renderSVG is deterministic and self-contained", () => {
	const a = renderSVG(sheet()).svg;
	const b = renderSVG(sheet()).svg;
	assert.equal(a, b);
	assert.match(a, /^<svg xmlns=/);
	assert.match(a, /<\/svg>$/);
});

test("renderSVG paints a full-bleed background before the rounded page", () => {
	const { svg } = renderSVG(sheet());
	// two same-color rects: the first has no rx (covers the rounded corners)
	const rects = [...svg.matchAll(/<rect width="\d+" height="\d+"( rx="\d+")? fill="#[0-9a-f]+"\/>/g)];
	assert.equal(rects.length, 2);
	assert.equal(rects[0][1], undefined, "base rect has no rounding");
	assert.ok(rects[1][1], "second rect is the rounded page");
});

test("over-long descriptions are truncated with a warning", () => {
	const { svg, warnings } = renderSVG(
		sheet({ sections: [{ name: "x", maps: [{ desc: "d".repeat(400), keys: "<leader>abc" }] }] }),
	);
	assert.ok(warnings.length >= 1);
	assert.match(warnings[0], /truncated/);
	assert.match(svg, /…/);
});
