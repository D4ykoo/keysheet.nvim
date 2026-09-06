import { test } from "node:test";
import assert from "node:assert/strict";
import { extractFromSource, extractFromFiles, sectionName } from "../src/extract.ts";

test("extracts vim.keymap.set with explicit desc", () => {
	const src = `vim.keymap.set("n", "<leader>f", fn, { desc = "Format" })`;
	assert.deepEqual(extractFromSource(src), [{ desc: "Format", keys: "<leader>f" }]);
});

test("infers desc from rhs when none is given", () => {
	const src = `vim.keymap.set("n", "grn", vim.lsp.buf.rename)`;
	assert.deepEqual(extractFromSource(src), [{ desc: "rename symbol", keys: "grn" }]);
});

test("kickstart map(lhs, rhs, desc) helper is picked up", () => {
	const src = `map("grr", builtin.lsp_references, "Goto References")`;
	assert.deepEqual(extractFromSource(src), [{ desc: "Goto References", keys: "grr" }]);
});

test("lazy keys block is parsed but dependency/cmd tables are not", () => {
	const src = `
		return {
			"me/plugin",
			cmd = { "NvimTreeToggle", "NvimTreeOpen" },
			dependencies = { "nvim-tree/nvim-web-devicons" },
			keys = {
				{ "<leader>e", "<cmd>NvimTreeToggle<cr>", desc = "Toggle" },
				{ "<leader>r", "<cmd>NvimTreeRefresh<cr>", desc = "Refresh" },
			},
		}`;
	const entries = extractFromSource(src);
	assert.deepEqual(entries, [
		{ desc: "Toggle", keys: "<leader>e" },
		{ desc: "Refresh", keys: "<leader>r" },
	]);
});

test("duplicate lhs+desc pairs are de-duplicated", () => {
	const src = `vim.keymap.set("n", "x", f, { desc = "D" })\nvim.keymap.set("v", "x", f, { desc = "D" })`;
	assert.equal(extractFromSource(src).length, 1);
});

test("sectionName strips config_/plugins_ prefixes and the extension", () => {
	assert.equal(sectionName("config_keymaps.lua"), "keymaps");
	assert.equal(sectionName("plugins/harpoon.lua"), "harpoon");
	assert.equal(sectionName("theme.lua"), "theme");
});

test("extractFromFiles makes one colored section per file with maps", () => {
	const sheet = extractFromFiles([
		{ path: "a.lua", content: `map("x", f, "X")` },
		{ path: "b.lua", content: `-- no maps here` },
		{ path: "c.lua", content: `map("y", g, "Y")` },
	]);
	assert.equal(sheet.sections.length, 2); // b.lua dropped (no maps)
	assert.equal(sheet.sections[0].name, "a");
	assert.ok(sheet.sections[0].color, "section gets a palette color");
});
