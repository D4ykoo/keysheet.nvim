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

// ---- editor builders ----------------------------------------------------
function build() {
	const root = document.getElementById("editor");
	root.innerHTML = "";
	root.append(globalsRow());
	root.append(
		el("div", { class: "hint" },
			"Upload your nvim config (folder or .lua files) to auto-generate sections, then edit below. Every change previews live; Save writes back to the JSON."),
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
// "upload config" / ".lua files" EXTRACT a sheet from a Neovim Lua config.
async function handleUpload(fileList) {
	const files = [];
	for (const f of fileList) {
		if (!f.name.endsWith(".lua")) continue;
		files.push({ path: f.webkitRelativePath || f.name, content: await f.text() });
	}
	if (files.length === 0) {
		alert("No .lua files found here.\n\nThis button extracts keymaps from a Neovim config. To load an existing keysheet .json, use \u201copen .json\u201d instead.");
		return;
	}
	const extracted = await api.extract(files);
	if (model.sections.length && !confirm(`Replace current sheet with ${extracted.sections.length} extracted sections?`)) return;
	model = extracted;
	build();
	render();
}

// "open .json" LOADS an existing sheet file (e.g. one exported earlier). No
// extraction — the JSON already is the model format, so it's parsed locally.
async function openJSON(fileList) {
	const file = [...fileList].find((f) => f.name.endsWith(".json"));
	if (!file) {
		alert("Please choose a .json file.");
		return;
	}
	let sheet;
	try {
		sheet = JSON.parse(await file.text());
	} catch (err) {
		alert("That file isn't valid JSON:\n" + err.message);
		return;
	}
	if (!sheet || !Array.isArray(sheet.sections)) {
		alert("That JSON doesn't look like a keysheet file (missing a \"sections\" array).");
		return;
	}
	if (model.sections.length && !confirm(`Replace current sheet with "${sheet.title || file.name}"?`)) return;
	model = sheet;
	build();
	render();
}

// ---- exports ------------------------------------------------------------
function download(blob, name) {
	const a = document.createElement("a");
	a.href = URL.createObjectURL(blob);
	a.download = name;
	a.click();
	setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

async function exportSVG() {
	await render();
	download(new Blob([lastSVG], { type: "image/svg+xml" }), "keysheet.svg");
}

async function exportPNG(scale) {
	await render();
	const url = URL.createObjectURL(new Blob([lastSVG], { type: "image/svg+xml" }));
	const img = new Image();
	img.onload = () => {
		const c = document.createElement("canvas");
		c.width = img.width * scale;
		c.height = img.height * scale;
		c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
		c.toBlob((b) => {
			download(b, `keysheet@${scale}x.png`);
			URL.revokeObjectURL(url);
		}, "image/png");
	};
	img.src = url;
}

async function exportHTML() {
	download(new Blob([await api.html(model)], { type: "text/html" }), "keysheet.html");
}

async function exportPDF() {
	const html = await api.html(model);
	const w = window.open("", "_blank");
	w.document.write(html);
	w.document.close();
	setTimeout(() => w.print(), 400);
}

function exportJSON() {
	download(new Blob([JSON.stringify(model, null, "\t")], { type: "application/json" }), "keymaps.json");
}

async function save() {
	const { ok } = await api.save(model);
	const s = document.getElementById("saved");
	s.textContent = ok ? "saved \u2713" : "save failed";
	setTimeout(() => (s.textContent = ""), 2000);
}

// ---- wiring + boot ------------------------------------------------------
function wire() {
	document.getElementById("up-dir").addEventListener("change", (e) => handleUpload(e.target.files));
	document.getElementById("up-files").addEventListener("change", (e) => handleUpload(e.target.files));
	document.getElementById("up-json").addEventListener("change", (e) => openJSON(e.target.files));
	const on = (id, fn) => document.getElementById(id).addEventListener("click", fn);
	on("exp-svg", () => exportSVG());
	on("exp-png1", () => exportPNG(1));
	on("exp-png2", () => exportPNG(2));
	on("exp-png4", () => exportPNG(4));
	on("exp-html", () => exportHTML());
	on("exp-pdf", () => exportPDF());
	on("exp-json", () => exportJSON());
	on("save", () => save());
}

(async () => {
	wire();
	const data = await api.sheet();
	model = data.sheet;
	palette = data.palette;
	build();
	render();
})();
