export function esc(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const CSS = `
:root {
  --bg: #f2efe6;
  --panel: #faf8f1;
  --card: #ffffff;
  --ink: #1b1a14;
  --muted: #736d5c;
  --hair: #ded7c6;
  --navy: #101f3f;
  --navy-hover: #1a2d55;
  --blue: #2b54e0;
  --blue-soft: #e4e9fb;
  --danger: #a83a32;
  --mono: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  background: var(--bg);
  color: var(--ink);
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 15px;
  line-height: 1.45;
}
a { color: inherit; }
button, input, textarea { font: inherit; color: inherit; }

.shell { display: flex; min-height: 100vh; }
.sidebar {
  width: 208px; flex-shrink: 0;
  padding: 28px 20px;
  display: flex; flex-direction: column; gap: 4px;
  border-right: 1px solid var(--hair);
  position: sticky; top: 0; height: 100vh;
}
.logo {
  font-size: 17px; font-weight: 600; letter-spacing: -0.01em;
  margin-bottom: 28px; text-decoration: none; display: inline-block;
}
.logo .tag {
  background: var(--blue); color: #fff;
  border-radius: 4px; padding: 1px 5px;
  font-size: 13px; font-weight: 700;
}
.nav-item {
  display: block; text-decoration: none; color: var(--muted);
  padding: 7px 12px; border-radius: 7px; font-size: 14.5px;
}
.nav-item:hover { color: var(--ink); background: #eae6d8; }
.nav-item.active { background: var(--blue); color: #fff; }
.sidebar .spacer { flex: 1; }
.nav-item.logout { color: var(--muted); }

.main { flex: 1; padding: 44px 48px; max-width: 1200px; }
.page-head { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 6px; }
h1 { font-size: 34px; font-weight: 650; letter-spacing: -0.02em; }
h1 .tag { background: var(--blue); color: #fff; border-radius: 5px; padding: 0 7px; font-size: 30px; }
.sub { color: var(--muted); margin-bottom: 28px; }
.kbd-hint {
  font-family: var(--mono); font-size: 11px; color: var(--muted);
  border: 1px solid var(--hair); border-radius: 999px; padding: 5px 12px;
  background: var(--panel); white-space: nowrap;
}

.card {
  background: var(--card); border: 1px solid var(--hair);
  border-radius: 10px;
}

.cols { display: grid; grid-template-columns: 1fr 300px; gap: 20px; align-items: start; }

.editor-card { overflow: hidden; }
.editor-tabs {
  display: flex; gap: 2px; padding: 10px 14px 0;
  border-bottom: 1px solid var(--hair); align-items: center;
}
.etab {
  border: 1px solid transparent; background: none; cursor: pointer;
  font-family: var(--mono); font-size: 11px; color: var(--muted);
  padding: 5px 12px; border-radius: 6px 6px 0 0; margin-bottom: -1px;
}
.etab.active { color: var(--ink); background: var(--card); border-color: var(--hair); border-bottom-color: var(--card); }
.editor-hint { margin-left: auto; font-family: var(--mono); font-size: 10.5px; color: var(--muted); padding-bottom: 4px; }
textarea#html {
  display: block; width: 100%; min-height: 380px; border: 0; resize: vertical;
  padding: 16px 18px; font-family: var(--mono); font-size: 12.5px; line-height: 1.65;
  background: var(--card); outline: none; tab-size: 2;
}
.upload-pane { display: none; padding: 40px 24px; text-align: center; border-top: 0; }
.upload-pane.on { display: block; }
.upload-zone {
  border: 1.5px dashed var(--hair); border-radius: 8px; padding: 44px 20px;
  color: var(--muted); cursor: pointer;
}
.upload-zone:hover { border-color: var(--blue); color: var(--ink); }

.meta-row { display: flex; gap: 10px; margin-top: 14px; align-items: center; }
.url-prefix {
  font-family: var(--mono); font-size: 12.5px; color: var(--muted);
  padding: 10px 0 10px 14px;
}
input.slug, input[type=text], input[type=password] {
  border: 1px solid var(--hair); border-radius: 7px;
  padding: 10px 13px; background: var(--card); outline: none; font-size: 14px;
}
input.slug { font-family: var(--mono); font-size: 12.5px; flex: 1; border-radius: 7px; }
input:focus { border-color: var(--blue); }
.slug-wrap { display: flex; align-items: stretch; flex: 1; border: 1px solid var(--hair); border-radius: 7px; background: var(--card); overflow: hidden; }
.slug-wrap:focus-within { border-color: var(--blue); }
.slug-wrap input { border: 0; }
.btn {
  display: inline-block; border: 0; cursor: pointer; text-decoration: none;
  background: var(--navy); color: #fff; border-radius: 8px;
  padding: 10px 22px; font-weight: 550; font-size: 14px;
}
.btn:hover { background: var(--navy-hover); }
.btn.blue { background: var(--blue); }
.btn.blue:hover { background: #2446bd; }
.btn.danger { background: none; color: var(--danger); padding: 6px 10px; font-weight: 500; }
.btn.danger:hover { background: #f6e9e7; }
.btn.small { padding: 7px 14px; font-size: 13px; }
.btn:disabled { opacity: 0.5; cursor: default; }

.side-card { padding: 20px 22px; margin-bottom: 18px; }
.side-card h3 { font-size: 14.5px; margin: 14px 0 10px; }
.side-card h3:first-child { margin-top: 0; }
.side-card ul { list-style: none; }
.side-card li {
  font-size: 13px; color: var(--muted); padding-left: 16px; position: relative;
  margin-bottom: 8px; line-height: 1.5;
}
.side-card li::before { content: ""; position: absolute; left: 0; top: 8px; width: 5px; height: 5px; border-radius: 50%; background: var(--blue); }
.side-card .eyebrow { font-family: var(--mono); font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); margin-bottom: 10px; }
.side-card code { font-family: var(--mono); font-size: 11.5px; background: var(--blue-soft); padding: 1px 5px; border-radius: 4px; }
.dark-card {
  background: var(--navy); color: #d9deeb; border-radius: 10px;
  padding: 22px 24px;
}
.dark-card .eyebrow { font-family: var(--mono); font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; color: #8b96b5; margin-bottom: 12px; }
.dark-card h3 { color: #fff; font-size: 17px; margin-bottom: 8px; }
.dark-card p { font-size: 13px; line-height: 1.55; color: #aab3cb; margin-bottom: 14px; }
.dark-card a { color: #8fb0ff; font-size: 13.5px; text-decoration: none; }
.dark-card a:hover { text-decoration: underline; }
.dark-card pre {
  font-family: var(--mono); font-size: 11px; background: #0b1730;
  border-radius: 6px; padding: 12px 14px; overflow-x: auto; color: #c4cde4;
  margin-bottom: 12px; white-space: pre-wrap; word-break: break-all;
}

table.pages { width: 100%; border-collapse: collapse; background: var(--card); border: 1px solid var(--hair); border-radius: 10px; overflow: hidden; }
table.pages th {
  text-align: left; font-family: var(--mono); font-size: 10.5px; letter-spacing: 0.08em;
  text-transform: uppercase; color: var(--muted); font-weight: 500;
  padding: 12px 16px; border-bottom: 1px solid var(--hair); background: var(--panel);
}
table.pages td { padding: 13px 16px; border-bottom: 1px solid #ece7da; font-size: 14px; vertical-align: middle; }
table.pages tr:last-child td { border-bottom: 0; }
table.pages td.slug { font-family: var(--mono); font-size: 12.5px; }
table.pages td.slug a { color: var(--blue); text-decoration: none; font-weight: 500; }
table.pages td.slug a:hover { text-decoration: underline; }
table.pages td.title { color: var(--muted); max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
table.pages td.num { font-family: var(--mono); font-size: 12px; color: var(--muted); white-space: nowrap; }
table.pages td.actions { text-align: right; white-space: nowrap; }
.empty {
  padding: 64px 24px; text-align: center; color: var(--muted);
  background: var(--card); border: 1px solid var(--hair); border-radius: 10px;
}
.empty p { margin-bottom: 16px; }
.flash {
  background: #e7f3e4; border: 1px solid #c4dcb9; color: #2e5c26;
  padding: 11px 16px; border-radius: 8px; margin-bottom: 20px; font-size: 14px;
}
.flash.err { background: #f6e9e7; border-color: #e3c2bd; color: var(--danger); }

.center-wrap { min-height: 100vh; display: grid; place-items: center; padding: 24px; }
.auth-card { width: 100%; max-width: 400px; padding: 34px 34px 30px; }
.auth-card .logo { margin-bottom: 8px; }
.auth-card h1 { font-size: 22px; margin-bottom: 6px; }
.auth-card p { color: var(--muted); font-size: 14px; margin-bottom: 20px; }
.auth-card input { width: 100%; margin-bottom: 14px; }
.auth-card .btn { width: 100%; }
.auth-card .client { font-weight: 600; }
.auth-card .scopes { font-family: var(--mono); font-size: 11.5px; color: var(--muted); margin: -6px 0 18px; }
footer { margin-top: 60px; font-family: var(--mono); font-size: 10.5px; color: var(--muted); }
@media (max-width: 900px) {
  .cols { grid-template-columns: 1fr; }
  .sidebar { width: 64px; padding: 24px 10px; }
  .sidebar .label { display: none; }
  .main { padding: 32px 20px; }
}
`;

function page(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${esc(title)} · Share HTML</title>
<style>${CSS}</style>
</head>
<body>${body}</body>
</html>`;
}

function shell(active: string, body: string): string {
  const item = (id: string, href: string, label: string) =>
    `<a class="nav-item${active === id ? " active" : ""}" href="${href}"><span class="label">${label}</span></a>`;
  return `<div class="shell">
<nav class="sidebar">
  <a class="logo" href="/admin">Share&nbsp;<span class="tag">HTML</span></a>
  ${item("new", "/admin/new", "+ New page")}
  ${item("pages", "/admin", "Pages")}
  ${item("mcp", "/admin/mcp", "MCP")}
  <div class="spacer"></div>
  <form method="post" action="/admin/logout"><button class="nav-item logout" style="border:0;background:none;cursor:pointer;width:100%;text-align:left" type="submit"><span class="label">Log out</span></button></form>
</nav>
<main class="main">${body}<footer>self-hosted · cloudflare workers + r2</footer></main>
</div>`;
}

export function loginPage(error?: string): string {
  return page(
    "Log in",
    `<div class="center-wrap"><div class="card auth-card">
  <a class="logo" href="/admin">Share <span class="tag">HTML</span></a>
  <h1>Log in</h1>
  <p>Enter your admin password to manage pages.</p>
  ${error ? `<div class="flash err">${esc(error)}</div>` : ""}
  <form method="post" action="/admin/login">
    <input type="password" name="password" placeholder="Password" autofocus required>
    <button class="btn blue" type="submit">Log in</button>
  </form>
</div></div>`,
  );
}

export function authorizePage(opts: {
  clientName: string;
  scopes: string[];
  needsPassword: boolean;
  error?: string;
}): string {
  return page(
    "Authorize",
    `<div class="center-wrap"><div class="card auth-card">
  <a class="logo" href="/admin">Share <span class="tag">HTML</span></a>
  <h1>Authorize <span class="client">${esc(opts.clientName)}</span></h1>
  <p>An MCP client wants full access to your pages.${opts.needsPassword ? " Enter your admin password to allow it." : ""}</p>
  ${opts.scopes.length ? `<div class="scopes">scopes: ${esc(opts.scopes.join(" "))}</div>` : ""}
  ${opts.error ? `<div class="flash err">${esc(opts.error)}</div>` : ""}
  <form method="post">
    ${opts.needsPassword ? `<input type="password" name="password" placeholder="Admin password" autofocus required>` : ""}
    <button class="btn blue" type="submit">${opts.needsPassword ? "Authorize" : "Approve"}</button>
  </form>
</div></div>`,
  );
}

export interface PageRow {
  slug: string;
  title: string | null;
  size: number;
  created: string;
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export function pagesListPage(
  origin: string,
  pages: PageRow[],
  flash?: { kind: "ok" | "err"; text: string },
): string {
  const rows = pages
    .map(
      (p) => `<tr>
  <td class="slug"><a href="/${esc(p.slug)}" target="_blank" rel="noopener">/${esc(p.slug)}</a></td>
  <td class="title">${esc(p.title ?? "—")}</td>
  <td class="num">${fmtSize(p.size)}</td>
  <td class="num">${esc(p.created.slice(0, 10))}</td>
  <td class="actions">
    <form method="post" action="/admin/pages/${encodeURIComponent(p.slug)}/delete" style="display:inline" onsubmit="return confirm('Delete /${esc(p.slug)}?')">
      <button class="btn danger" type="submit">Delete</button>
    </form>
  </td>
</tr>`,
    )
    .join("");

  const body = `
<div class="page-head"><h1>Pages</h1><a class="btn small blue" href="/admin/new">+ New page</a></div>
<p class="sub">${pages.length} page${pages.length === 1 ? "" : "s"} published on ${esc(origin)}</p>
${flash ? `<div class="flash${flash.kind === "err" ? " err" : ""}">${esc(flash.text)}</div>` : ""}
${
  pages.length === 0
    ? `<div class="empty"><p>No pages yet.</p><a class="btn blue" href="/admin/new">Publish your first page</a></div>`
    : `<table class="pages"><thead><tr><th>Page</th><th>Title</th><th>Size</th><th>Published</th><th></th></tr></thead><tbody>${rows}</tbody></table>`
}`;
  return page("Pages", shell("pages", body));
}

const SAMPLE_HTML = `<!doctype html>
<html>
  <body style="font-family:system-ui;padding:40px;">
    <h1>Hello from Share HTML</h1>
    <p>Replace this with your own HTML and click Publish.</p>
  </body>
</html>`;

export function editorPage(origin: string, error?: string): string {
  const body = `
<div class="page-head"><h1>New <span class="tag">page</span></h1><span class="kbd-hint">&#8984; + ENTER TO PUBLISH</span></div>
<p class="sub">Paste HTML or upload a file. Get a URL.</p>
${error ? `<div class="flash err">${esc(error)}</div>` : ""}
<div class="cols">
  <div>
    <form id="pub" method="post" action="/admin/pages">
      <div class="card editor-card">
        <div class="editor-tabs">
          <button type="button" class="etab active" id="tab-paste">Paste</button>
          <button type="button" class="etab" id="tab-upload">Upload</button>
          <span class="editor-hint">&#8984;+Enter to publish</span>
        </div>
        <textarea id="html" name="html" spellcheck="false">${esc(SAMPLE_HTML)}</textarea>
        <div class="upload-pane" id="upload-pane">
          <div class="upload-zone" id="drop">
            <p style="font-size:15px;margin-bottom:6px">Drop an .html file here</p>
            <p style="font-size:12.5px">or click to browse — contents load into the editor</p>
          </div>
          <input type="file" id="file" accept=".html,.htm,text/html" hidden>
        </div>
      </div>
      <div class="meta-row">
        <div class="slug-wrap">
          <span class="url-prefix">${esc(origin)}/</span>
          <input class="slug" type="text" name="slug" placeholder="optional-slug" autocomplete="off" spellcheck="false" style="flex:1">
        </div>
        <button class="btn blue" type="submit">Publish &rarr;</button>
      </div>
    </form>
  </div>
  <aside>
    <div class="card side-card">
      <div class="eyebrow">Quick tips</div>
      <h3>Make it sing.</h3>
      <ul>
        <li>Up to <strong>25 MB</strong> of HTML, CSS, and inline JS per page.</li>
        <li>Leave the slug empty for a random one, or pick something memorable like <code>my-deck</code>.</li>
        <li>Publishing an existing slug from the dashboard asks first — MCP <code>update_page</code> overwrites directly.</li>
      </ul>
    </div>
    <div class="dark-card">
      <div class="eyebrow">Need it scripted?</div>
      <h3>Publish from code.</h3>
      <p>Same pages over MCP — create, read, update, delete — secured with OAuth.</p>
      <pre>${esc(origin)}/mcp</pre>
      <a href="/admin/mcp">MCP setup &rarr;</a>
    </div>
  </aside>
</div>
<script>
const ta = document.getElementById('html');
const pane = document.getElementById('upload-pane');
const tPaste = document.getElementById('tab-paste');
const tUpload = document.getElementById('tab-upload');
const file = document.getElementById('file');
const drop = document.getElementById('drop');
const form = document.getElementById('pub');
function show(which) {
  const paste = which === 'paste';
  ta.style.display = paste ? 'block' : 'none';
  pane.classList.toggle('on', !paste);
  tPaste.classList.toggle('active', paste);
  tUpload.classList.toggle('active', !paste);
}
tPaste.onclick = () => show('paste');
tUpload.onclick = () => { show('upload'); };
drop.onclick = () => file.click();
drop.ondragover = e => { e.preventDefault(); };
drop.ondrop = e => { e.preventDefault(); if (e.dataTransfer.files[0]) readFile(e.dataTransfer.files[0]); };
file.onchange = () => { if (file.files[0]) readFile(file.files[0]); };
function readFile(f) {
  const r = new FileReader();
  r.onload = () => { ta.value = r.result; show('paste'); };
  r.readAsText(f);
}
form.addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); form.requestSubmit(); }
});
ta.addEventListener('keydown', e => {
  if (e.key === 'Tab') { e.preventDefault();
    const s = ta.selectionStart, t = ta.selectionEnd;
    ta.value = ta.value.slice(0, s) + '  ' + ta.value.slice(t);
    ta.selectionStart = ta.selectionEnd = s + 2; }
});
</script>`;
  return page("New page", shell("new", body));
}

export function mcpInfoPage(origin: string): string {
  const body = `
<div class="page-head"><h1>MCP</h1></div>
<p class="sub">Full CRUD on your pages from any MCP client, secured with OAuth.</p>
<div class="cols">
  <div class="card side-card">
    <h3>Endpoint</h3>
    <ul><li><code>${esc(origin)}/mcp</code> — Streamable HTTP transport</li></ul>
    <h3>Tools</h3>
    <ul>
      <li><code>list_pages</code> — every published page</li>
      <li><code>get_page</code> — read a page's HTML</li>
      <li><code>create_page</code> — publish new HTML</li>
      <li><code>update_page</code> — replace a page's HTML</li>
      <li><code>delete_page</code> — remove a page</li>
    </ul>
    <h3>Auth</h3>
    <ul>
      <li>OAuth 2.1 with PKCE — your client opens <code>/authorize</code>, you approve with the admin password.</li>
      <li>Tokens expire; refresh tokens keep clients connected.</li>
    </ul>
  </div>
  <aside>
    <div class="dark-card">
      <div class="eyebrow">Client config</div>
      <h3>Claude / Cursor</h3>
      <p>Point a client that supports remote MCP at the endpoint and complete the OAuth prompt.</p>
      <pre>{
  "mcpServers": {
    "share-html": {
      "type": "http",
      "url": "${esc(origin)}/mcp"
    }
  }
}</pre>
      <a href="https://modelcontextprotocol.io" rel="noopener">About MCP &rarr;</a>
    </div>
  </aside>
</div>`;
  return page("MCP", shell("mcp", body));
}
