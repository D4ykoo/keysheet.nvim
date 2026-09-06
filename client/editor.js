// keysheet editor — vanilla JS, no build step.
//
// The browser holds the sheet model as the single source of truth and
// re-renders through the server's /api/render, so the SVG renderer stays the
// one authority on layout. Sections below: state, API, a tiny DOM helper, the
// editor builders, upload, and exports.

// ---- state --------------------------------------------------------------
let model = { title: "keymaps", columns: 2, sections: [] };
let palette = {};
let lastSVG = "";

// ---- API + live render --------------------------------------------------
const api = {
	sheet: () => fetch("/api/sheet").then((r) => r.json()),
	render: (m) => fetch("/api/render", { method: "POST", body: JSON.stringify(m) }).then((r) => r.json()),
	extract: (files) => fetch("/api/extract", { method: "POST", body: JSON.stringify(files) }).then((r) => r.json()),
	html: (m) => fetch("/api/export/html", { method: "POST", body: JSON.stringify(m) }).then((r) => r.text()),
	save: (m) => fetch("/api/save", { method: "POST", body: JSON.stringify(m) }).then((r) => r.json()),
};

let renderTimer = null;
function scheduleRender() {
	clearTimeout(renderTimer);
	renderTimer = setTimeout(render, 180);
}
async function render() {
	const { svg, warnings } = await api.render(model);
	lastSVG = svg;
	document.getElementById("preview").innerHTML = svg;
	document.getElementById("warnbar").textContent = (warnings || []).join("\n");
}

// ---- DOM helper ---------------------------------------------------------
// el("input", { class, value, oninput, ... }, kids). "on*" keys become
// listeners; value/checked set properties; everything else is an attribute.
function el(tag, props = {}, kids = []) {
	const n = document.createElement(tag);
	for (const [k, v] of Object.entries(props)) {
		if (k === "class") n.className = v;
		else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
		else if (k === "value") n.value = v;
		else if (k === "checked") n.checked = v;
		else n.setAttribute(k, v);
	}
	for (const c of [].concat(kids)) n.append(c);
	return n;
}

// A full rebuild re-reads the model into the DOM. Cheap here, and it keeps the
// pill swatches / section indices in sync after structural edits. Per-keystroke
// text edits call scheduleRender() instead so the focused input isn't rebuilt.
function rebuild() {
	build();
	scheduleRender();
}

// ---- toasts -------------------------------------------------------------
// In-page notifications instead of native alert() — themed, non-blocking, and
// (unlike alert/confirm) they can't be suppressed by the browser's dialog
// blocker. kind: "info" | "success" | "error". ms=0 keeps it until clicked.
function toast(message, kind = "info", ms = 5000) {
	const wrap = document.getElementById("toasts");
	if (!wrap) return; // defensive: no-op if the container isn't present
	const t = el("div", { class: `toast toast-${kind}`, role: "status" });
	t.textContent = message;
	const remove = () => {
		t.classList.add("leaving");
		setTimeout(() => t.remove(), 180);
	};
	t.addEventListener("click", remove);
	wrap.append(t);
	if (ms) setTimeout(remove, ms);
}

// ---- editor builders ----------------------------------------------------
function build() {
	const root = document.getElementById("editor");
	root.innerHTML = "";
	root.append(globalsRow());
	root.append(
		el("div", { class: "hint" },
			"Drag your nvim folder anywhere onto this page to auto-generate sections (no browser prompt), or use the buttons above. Every change previews live; Save writes back to the JSON."),
	);
	model.sections.forEach((s, si) => root.append(sectionCard(s, si)));
	root.append(el("button", { class: "section-add", onclick: addSection }, "+ add section"));
}

function globalsRow() {
	return el("div", { class: "globals" }, [
		el("input", {
			type: "text", value: model.title || "", placeholder: "sheet title",
			oninput: (e) => { model.title = e.target.value; scheduleRender(); },
		}),
		el("span", {}, "cols"),
		el("input", {
			type: "text", class: "num", value: String(model.columns || 2),
			oninput: (e) => { model.columns = Math.max(1, parseInt(e.target.value) || 1); rebuild(); },
		}),
	]);
}

function colorSelect(s) {
	const sel = el("select", { class: "color", onchange: (e) => { s.color = e.target.value; rebuild(); } });
	for (const name of Object.keys(palette)) {
		const o = el("option", { value: name }, name);
		if (s.color === name) o.selected = true;
		sel.append(o);
	}
	// Preserve a custom named/hex color that isn't in the palette.
	if (s.color && !palette[s.color] && !s.color.startsWith("#")) {
		const o = el("option", { value: s.color }, s.color);
		o.selected = true;
		sel.append(o);
	}
	return sel;
}

function sectionCard(s, si) {
	const head = el("div", { class: "sec-head" }, [
		el("span", { class: "pill", style: "background:" + (palette[s.color] || s.color || "#8fd0dd") }),
		el("input", {
			class: "name", type: "text", value: s.name || "",
			oninput: (e) => { s.name = e.target.value; scheduleRender(); },
		}),
		colorSelect(s),
		el("input", {
			class: "col", type: "text", value: s.column ? String(s.column) : "",
			title: "pin to column (blank = auto)",
			oninput: (e) => { const v = parseInt(e.target.value); s.column = v > 0 ? v : undefined; scheduleRender(); },
		}),
		el("button", { class: "ghost", title: "move up", onclick: () => moveSection(si, -1) }, "\u2191"),
		el("button", { class: "ghost", title: "move down", onclick: () => moveSection(si, 1) }, "\u2193"),
		el("button", { class: "ghost", title: "delete section", onclick: () => { model.sections.splice(si, 1); rebuild(); } }, "\u00d7"),
	]);

	const rows = el("div", { class: "rows" });
	s.maps.forEach((m, mi) => rows.append(rowEl(s, m, mi)));
	rows.append(el("button", { class: "addrow", onclick: () => { s.maps.push({ desc: "", keys: "" }); rebuild(); } }, "+ add row"));

	return el("div", { class: "section" }, [head, rows]);
}

function rowEl(s, m, mi) {
	return el("div", { class: "row" }, [
		el("input", {
			class: "desc", type: "text", value: m.desc || "", placeholder: "description",
			oninput: (e) => { m.desc = e.target.value; scheduleRender(); },
		}),
		el("input", {
			class: "keys", type: "text", value: m.keys || "", placeholder: "keys",
			oninput: (e) => { m.keys = e.target.value; scheduleRender(); },
		}),
		el("label", { class: "m" }, [
			el("input", { type: "checkbox", checked: !!m.muted, onchange: (e) => { m.muted = e.target.checked; scheduleRender(); } }),
			"dim",
		]),
		el("button", { class: "rm", title: "delete row", onclick: () => { s.maps.splice(mi, 1); rebuild(); } }, "\u00d7"),
	]);
}

function addSection() {
	const names = Object.keys(palette);
	model.sections.push({
		name: "new section",
		color: names[model.sections.length % names.length],
		maps: [{ desc: "", keys: "" }],
	});
	rebuild();
}

function moveSection(i, d) {
	const j = i + d;
	if (j < 0 || j >= model.sections.length) return;
	[model.sections[i], model.sections[j]] = [model.sections[j], model.sections[i]];
	rebuild();
}

// ---- upload / open ------------------------------------------------------
// Three ways in: drag a folder onto the page (best), the "config folder" /
// ".lua files" buttons (EXTRACT from Lua), or "open .json" (LOAD a sheet).

async function toRawFiles(fileList) {
	const files = [];
	for (const f of fileList) {
		if (!f.name.endsWith(".lua")) continue;
		files.push({ path: f.webkitRelativePath || f.name, content: await f.text() });
	}
	return files;
}

// Extract a sheet from raw {path, content} .lua files and load it.
async function extractInto(files) {
	if (files.length === 0) {
		toast("No .lua files found here. This button extracts from a Neovim config — use \u201copen .json\u201d to load an existing sheet.", "error");
		return;
	}
	let extracted;
	try {
		extracted = await api.extract(files);
	} catch (err) {
		console.error("extract failed:", err);
		toast(`Couldn't extract keymaps: ${err && err.message ? err.message : err}`, "error");
		return;
	}
	// The folder pick / drop is itself the intent, so replace directly rather
	// than gating on a confirm() — a browser that has "block dialogs" enabled
	// makes confirm() return false and would silently swallow the action.
	model = extracted;
	build();
	render();
}

async function handleUpload(fileList) {
	await extractInto(await toRawFiles(fileList));
}

// "open .json" LOADS an existing sheet file (e.g. one exported earlier). No
// extraction — the JSON already is the model format, so it's parsed locally.
async function openJSON(fileList) {
	const file = [...fileList].find((f) => f.name.endsWith(".json"));
	if (!file) {
		toast("Please choose a .json file.", "error");
		return;
	}
	let sheet;
	try {
		sheet = JSON.parse(await file.text());
	} catch (err) {
		toast("That file isn't valid JSON: " + err.message, "error");
		return;
	}
	if (!sheet || !Array.isArray(sheet.sections)) {
		toast("That JSON isn't a keysheet file (no \"sections\" array).", "error");
		return;
	}
	model = sheet;
	build();
	render();
}

// ---- folder drag-and-drop ----------------------------------------------
// Reading a dropped folder uses the (non-promise) Entries API: readEntries
// returns results in batches, so pump it until it comes back empty.
function readAllEntries(reader) {
	return new Promise((resolve, reject) => {
		const all = [];
		const pump = () =>
			reader.readEntries((batch) => {
				if (batch.length === 0) resolve(all);
				else {
					all.push(...batch);
					pump();
				}
			}, reject);
		pump();
	});
}

async function collectLua(entry, files, base = "") {
	if (entry.isFile) {
		if (!entry.name.endsWith(".lua")) return;
		const file = await new Promise((res, rej) => entry.file(res, rej));
		files.push({ path: base + entry.name, content: await file.text() });
	} else if (entry.isDirectory) {
		for (const child of await readAllEntries(entry.createReader())) {
			await collectLua(child, files, base + entry.name + "/");
		}
	}
}

async function handleDrop(dt) {
	try {
		// Prefer directory entries (a dropped folder); fall back to plain files.
		const entries = [...dt.items].map((i) => i.webkitGetAsEntry && i.webkitGetAsEntry()).filter(Boolean);
		if (entries.length) {
			const files = [];
			for (const e of entries) await collectLua(e, files);
			if (files.length) return extractInto(files);
		}
		const dropped = [...dt.files];
		if (dropped.some((f) => f.name.endsWith(".lua"))) return extractInto(await toRawFiles(dropped));
		const json = dropped.find((f) => f.name.endsWith(".json"));
		if (json) return openJSON([json]);
		toast("Nothing usable there — drop your nvim folder, .lua files, or a keysheet .json.", "error");
	} catch (err) {
		console.error("drop failed:", err);
		toast(`Couldn't read that drop: ${err && err.message ? err.message : err}`, "error");
	}
}

// ---- exports ------------------------------------------------------------
function download(blob, name) {
	const a = document.createElement("a");
	a.href = URL.createObjectURL(blob);
	a.download = name;
	a.click();
	setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// Run an export, surfacing any failure instead of dying silently — a silent
// throw (e.g. a failed /api round-trip) is indistinguishable from "export is
// broken", so make it visible.
async function runExport(label, fn) {
	try {
		await fn();
	} catch (err) {
		console.error(label + " export failed:", err);
		toast(`${label} export failed: ${err && err.message ? err.message : err}`, "error");
	}
}

async function exportSVG() {
	await render();
	download(new Blob([lastSVG], { type: "image/svg+xml" }), "keysheet.svg");
}

async function exportPNG(scale) {
	await render();
	await new Promise((resolve, reject) => {
		const url = URL.createObjectURL(new Blob([lastSVG], { type: "image/svg+xml" }));
		const img = new Image();
		img.onload = () => {
			try {
				const c = document.createElement("canvas");
				c.width = img.width * scale;
				c.height = img.height * scale;
				c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
				c.toBlob((b) => {
					if (!b) return reject(new Error("canvas produced no image"));
					download(b, `keysheet@${scale}x.png`);
					URL.revokeObjectURL(url);
					resolve();
				}, "image/png");
			} catch (e) {
				reject(e);
			}
		};
		img.onerror = () => reject(new Error("could not rasterize the SVG"));
		img.src = url;
	});
}

async function exportHTML() {
	download(new Blob([await api.html(model)], { type: "text/html" }), "keysheet.html");
}

async function exportPDF() {
	// Open the tab synchronously (while the click gesture is still "live") so
	// popup blockers don't kill it; fill it in once the HTML arrives.
	const w = window.open("", "_blank");
	if (!w) {
		toast("Pop-up blocked. Allow pop-ups for this site, or use the HTML export and print that.", "error", 8000);
		return;
	}
	w.document.write("<!doctype html><title>keysheet</title><p style='font:14px system-ui;padding:24px'>Preparing print view…</p>");
	const html = await api.html(model);
	w.document.open();
	w.document.write(html);
	w.document.close();
	setTimeout(() => w.print(), 400);
}

function exportJSON() {
	download(new Blob([JSON.stringify(model, null, "\t")], { type: "application/json" }), "keymaps.json");
}

async function save() {
	try {
		const { ok } = await api.save(model);
		toast(ok ? "Saved \u2713" : "Save failed", ok ? "success" : "error");
	} catch (err) {
		toast(`Save failed: ${err && err.message ? err.message : err}`, "error");
	}
}

// ---- wiring + boot ------------------------------------------------------
function wire() {
	document.getElementById("up-dir").addEventListener("change", (e) => handleUpload(e.target.files));
	document.getElementById("up-files").addEventListener("change", (e) => handleUpload(e.target.files));
	document.getElementById("up-json").addEventListener("change", (e) => openJSON(e.target.files));
	const on = (id, fn) => document.getElementById(id).addEventListener("click", fn);
	on("exp-svg", () => runExport("SVG", exportSVG));
	on("exp-png1", () => runExport("PNG", () => exportPNG(1)));
	on("exp-png2", () => runExport("PNG", () => exportPNG(2)));
	on("exp-png4", () => runExport("PNG", () => exportPNG(4)));
	on("exp-html", () => runExport("HTML", exportHTML));
	on("exp-pdf", () => runExport("PDF", exportPDF));
	on("exp-json", () => runExport("JSON", exportJSON));
	on("save", () => save());

	// Folder drag-and-drop over the whole window, with a visible overlay.
	const zone = document.getElementById("dropzone");
	let depth = 0; // dragenter/leave fire per child; count to avoid flicker
	const hasFiles = (e) => [...(e.dataTransfer?.types || [])].includes("Files");
	window.addEventListener("dragenter", (e) => {
		if (!hasFiles(e)) return;
		e.preventDefault();
		if (depth++ === 0) zone.classList.add("show");
	});
	window.addEventListener("dragover", (e) => {
		if (hasFiles(e)) e.preventDefault();
	});
	window.addEventListener("dragleave", (e) => {
		if (!hasFiles(e)) return;
		if (--depth <= 0) {
			depth = 0;
			zone.classList.remove("show");
		}
	});
	window.addEventListener("drop", (e) => {
		if (!hasFiles(e)) return;
		e.preventDefault();
		depth = 0;
		zone.classList.remove("show");
		handleDrop(e.dataTransfer);
	});
}

(async () => {
	wire();
	const data = await api.sheet();
	model = data.sheet;
	palette = data.palette;
	build();
	render();
})();
