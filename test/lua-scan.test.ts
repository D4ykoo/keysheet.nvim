import { test } from "node:test";
import assert from "node:assert/strict";
import { stripString, splitArgs, findCalls, findBraceBlocks } from "../src/lua-scan.ts";

test("stripString handles the three Lua string forms", () => {
	assert.equal(stripString('"hello"'), "hello");
	assert.equal(stripString("'world'"), "world");
	assert.equal(stripString("[[raw]]"), "raw");
	assert.equal(stripString('"a\\"b"'), 'a"b'); // escaped quote
	assert.equal(stripString("vim.lsp.buf.rename"), null); // not a literal
	assert.equal(stripString("  '<leader>f'  "), "<leader>f"); // trimmed
});

test("splitArgs respects nesting and strings", () => {
	assert.deepEqual(splitArgs('"n", "<leader>f", fn'), ['"n"', '"<leader>f"', "fn"]);
	// commas inside braces/parens/strings are not split points
	assert.deepEqual(splitArgs('"a", { x = 1, y = 2 }, f(1, 2)'), ['"a"', "{ x = 1, y = 2 }", "f(1, 2)"]);
	assert.deepEqual(splitArgs('"a,b", "c"'), ['"a,b"', '"c"']);
});

test("findCalls returns balanced inner argument text", () => {
	const src = `vim.keymap.set("n", "x", function() foo(1, 2) end, { desc = "d" })`;
	const calls = findCalls(src, "vim.keymap.set");
	assert.equal(calls.length, 1);
	assert.match(calls[0], /^"n", "x", function/);
	assert.match(calls[0], /desc = "d" \}$/);
});

test("findCalls matches dotted names and multiple calls", () => {
	const src = `map("a", f, "A")\nmap("b", g, "B")`;
	assert.equal(findCalls(src, "map").length, 2);
});

test("findBraceBlocks isolates a keys = { ... } block", () => {
	const src = `keys = { { "<leader>e", "<cmd>E<cr>", desc = "e" } }, dependencies = { "x" }`;
	const blocks = findBraceBlocks(src, /keys\s*=\s*/);
	assert.equal(blocks.length, 1);
	assert.match(blocks[0], /<leader>e/);
	assert.doesNotMatch(blocks[0], /dependencies/);
});
