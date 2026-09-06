import { test } from "node:test";
import assert from "node:assert/strict";
import { inferDesc, PLACEHOLDER } from "../src/infer.ts";

test("command strings resolve to the command name", () => {
	assert.equal(inferDesc('"<cmd>NvimTreeToggle<cr>"'), "NvimTreeToggle");
	assert.equal(inferDesc('":Oil<CR>"'), "Oil");
});

test("dotted identifiers use the known-verb table or a humanized tail", () => {
	assert.equal(inferDesc("vim.lsp.buf.rename"), "rename symbol");
	assert.equal(inferDesc("builtin.find_files"), "find files");
	assert.equal(inferDesc("vim.cmd.UndotreeToggle"), "UndotreeToggle");
});

test("harpoon chains are recognized even inside function() wrappers", () => {
	assert.equal(inferDesc("function() harpoon:list():select(1) end"), "nav file 1");
	assert.equal(inferDesc("function() harpoon:list():replace_at(3) end"), "replace file 3");
	assert.equal(inferDesc("function() harpoon:list():add() end"), "add file to menu");
	assert.equal(inferDesc("function() harpoon:list():next() end"), "next buffer");
});

test("macros and unknowns fall through to the placeholder", () => {
	assert.equal(inferDesc(undefined), PLACEHOLDER);
	assert.equal(inferDesc(`":m '>+1<CR>gv=gv"`), PLACEHOLDER);
	assert.equal(inferDesc("some_undotted_expr()"), PLACEHOLDER);
});
