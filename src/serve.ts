import { createServer, type IncomingMessage } from "node:http";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import type { Sheet } from "./types.ts";
import { renderSVG } from "./svg.ts";
import { renderHTML } from "./html.ts";
import { extractFromFiles, type RawFile } from "./extract.ts";
import { PALETTE } from "./theme.ts";
import { editorHTML, editorCSS, editorJS } from "./assets.ts";

// ---------------------------------------------------------------------------
// Interactive editor server. node:http only, so `bun run` and `node` behave
// identically. The browser holds the sheet model; every edit re-renders via
// /api/render (svg.ts stays the one renderer). "Save" persists to the config
// file. Routes are declared as a small table for readability.
// ---------------------------------------------------------------------------

const EMPTY_SHEET: Sheet = { title: "keymaps", columns: 2, sections: [] };

function readBody(req: IncomingMessage): Promise<string> {
	return new Promise((resolve, reject) => {
		const chunks: Buffer[] = [];
		req.on("data", (c) => chunks.push(c as Buffer));
		req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
		req.on("error", reject);
	});
}

interface Reply {
	type: string;
	body: string;
}
const json = (v: unknown): Reply => ({ type: "application/json", body: JSON.stringify(v) });
const html = (s: string): Reply => ({ type: "text/html", body: s });

type Handler = (ctx: { configPath: string; body: string }) => Reply | Promise<Reply>;

// method + path -> handler
const routes: Record<string, Handler> = {
	"GET /": ({ configPath }) => html(editorHTML(configPath)),
	"GET /editor.css": () => ({ type: "text/css", body: editorCSS() }),
	"GET /editor.js": () => ({ type: "text/javascript", body: editorJS() }),

	"GET /api/sheet": ({ configPath }) => {
		const sheet = existsSync(configPath) ? JSON.parse(readFileSync(configPath, "utf8")) : EMPTY_SHEET;
		return json({ sheet, palette: PALETTE });
	},
	"POST /api/render": ({ body }) => {
		const { svg, warnings, width, height } = renderSVG(JSON.parse(body));
		return json({ svg, warnings, width, height });
	},
	"POST /api/extract": ({ body }) => json(extractFromFiles(JSON.parse(body) as RawFile[])),
	"POST /api/export/html": ({ body }) => html(renderHTML(JSON.parse(body))),
	"POST /api/save": ({ configPath, body }) => {
		const sheet: Sheet = JSON.parse(body);
		writeFileSync(configPath, JSON.stringify(sheet, null, "\t") + "\n");
		return json({ ok: true, path: configPath });
	},
};

export function serve(configPath: string, port: number) {
	const server = createServer(async (req, res) => {
		const key = `${req.method} ${(req.url ?? "/").split("?")[0]}`;
		const handler = routes[key];
		try {
			if (!handler) {
				res.writeHead(404, { "content-type": "text/plain" }).end("not found");
				return;
			}
			const body = req.method === "POST" ? await readBody(req) : "";
			const reply = await handler({ configPath, body });
			res.writeHead(200, { "content-type": reply.type }).end(reply.body);
		} catch (err) {
			res.writeHead(500, { "content-type": "text/plain" }).end(String(err));
		}
	});
	// Bind to HOST if set (use 0.0.0.0 in containers so the port is reachable
	// from outside); otherwise Node's default binding is fine for local use.
	const host = process.env.HOST;
	server.listen(port, host, () => {
		console.log(`keysheet editor → http://${host ?? "localhost"}:${port}`);
		console.log(
			existsSync(configPath)
				? `  loaded ${configPath}`
				: `  ${configPath} not found yet — upload a config or start fresh`,
		);
	});
}
