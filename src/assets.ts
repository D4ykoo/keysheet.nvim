import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// ---------------------------------------------------------------------------
// Static editor assets (client/editor.{html,css,js}) read from disk relative
// to this module, so the tool works regardless of the process's cwd (e.g. when
// installed as a global bin). Files are read once and cached.
// ---------------------------------------------------------------------------

const clientDir = join(dirname(fileURLToPath(import.meta.url)), "..", "client");

function read(name: string): string {
	return readFileSync(join(clientDir, name), "utf8");
}

const cache: Record<string, string> = {};
function cached(name: string): string {
	return (cache[name] ??= read(name));
}

/** The editor page, with the config path injected into the header. */
export function editorHTML(configPath: string): string {
	return cached("editor.html").replace("{{CONFIG_PATH}}", configPath);
}

export const editorCSS = () => cached("editor.css");
export const editorJS = () => cached("editor.js");
