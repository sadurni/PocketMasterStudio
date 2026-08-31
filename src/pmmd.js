// pmmd.js — port of md2html.py (stdlib-only Markdown -> HTML for the docs tabs).
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PMMd = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Python html.escape(text, quote=False): only & < >
  const escB = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  // Python html.escape(text, quote=True): + " '
  const escQ = (t) => escB(t).replace(/"/g, "&quot;").replace(/'/g, "&#x27;");

  const LIST_RE = /^(\s*)([-*+]|\d+\.)\s+(.*)$/;

  // Python str.expandtabs(2): expand tabs to the next multiple of 2 columns.
  function expandtabs(s, ts) {
    let out = "", col = 0;
    for (const ch of s) {
      if (ch === "\t") { const n = ts - (col % ts); out += " ".repeat(n); col += n; }
      else if (ch === "\n" || ch === "\r") { out += ch; col = 0; }
      else { out += ch; col += 1; }
    }
    return out;
  }
  const leadLen = (ln) => expandtabs(ln.match(/^(\s*)/)[1], 2).length;

  function _inline(text) {
    let s = escB(text);
    const codes = [];
    s = s.replace(/`([^`]+)`/g, (m, g1) => { codes.push("<code>" + g1 + "</code>"); return "\x00" + (codes.length - 1) + "\x00"; });
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label, url) => {
      const ext = url.startsWith("http");
      const attr = ext ? ' target="_blank" rel="noopener"' : "";
      return '<a href="' + url + '"' + attr + ">" + label + "</a>";
    });
    // <url> autolinks — after escB the angle brackets are &lt; &gt;; consume them so the closing
    // bracket doesn't get swallowed into the href.
    s = s.replace(/&lt;(https?:\/\/[^\s<>&]+)&gt;/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
    s = s.replace(/(?<!["(>])\b(https?:\/\/[^\s<)]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/__([^_]+)__/g, "<strong>$1</strong>");
    s = s.replace(/(?<![*\w])\*([^*\n]+?)\*(?!\*)/g, "<em>$1</em>");
    s = s.replace(/(?<![_\w])_([^_\n]+?)_(?!\w)/g, "<em>$1</em>");
    s = s.replace(/\x00(\d+)\x00/g, (m, g1) => codes[parseInt(g1, 10)]);
    return s;
  }

  const _is_block_start = (line) => (
    /^\s*```/.test(line) ||
    /^\s*#{1,6}\s/.test(line) ||
    /^\s*>/.test(line) ||
    /^\s*([-*_])(\s*\1){2,}\s*$/.test(line) ||
    LIST_RE.test(line)
  );

  function _cells(row) {
    row = row.trim().replace(/^\|/, "").replace(/\|$/, "");
    return row.split("|").map((c) => c.trim());
  }
  function _align_of(spec) {
    spec = spec.trim();
    if (spec.startsWith(":") && spec.endsWith(":")) return ' style="text-align:center"';
    if (spec.endsWith(":")) return ' style="text-align:right"';
    return "";
  }

  function _render_list(lines, start, base_indent) {
    const items = [];
    let ordered = null;
    let i = start;
    while (i < lines.length) {
      const m = lines[i].match(LIST_RE);
      if (!m || leadLen(m[1]) !== base_indent) break;
      if (ordered === null) ordered = /^\d+\./.test(m[2]);
      const body = [m[3]];
      i += 1;
      while (i < lines.length) {
        const ln = lines[i];
        if (ln.trim() === "") { body.push(""); i += 1; continue; }
        const ind = leadLen(ln);
        if (ind > base_indent) { body.push(ln); i += 1; continue; }
        break;
      }
      while (body.length && body[body.length - 1].trim() === "") body.pop();
      const ded = base_indent + 2;
      const dedRe = new RegExp("^\\s{1," + ded + "}");
      const dedented = [body[0]].concat(body.slice(1).map((b) => (b ? b.replace(dedRe, "") : b)));
      let inner = _render_blocks(dedented);
      const mm = inner.match(/^<p>([\s\S]*)<\/p>$/);
      if (mm && !mm[1].includes("<p>") && !mm[1].includes("<pre>")) inner = mm[1];
      items.push("<li>" + inner + "</li>");
    }
    const tag = ordered ? "ol" : "ul";
    return ["<" + tag + ">" + items.join("") + "</" + tag + ">", i];
  }

  function _render_blocks(lines) {
    const out = [];
    let i = 0; const n = lines.length;
    while (i < n) {
      const line = lines[i];
      let m = line.match(/^\s*```(.*)$/);
      if (m) {
        const lang = m[1].trim();
        i += 1;
        const buf = [];
        while (i < n && !/^\s*```\s*$/.test(lines[i])) { buf.push(lines[i]); i += 1; }
        i += 1;
        const cls = lang ? ' class="language-' + escQ(lang) + '"' : "";
        out.push("<pre><code" + cls + ">" + escQ(buf.join("\n")) + "</code></pre>");  // Python html.escape default quote=True
        continue;
      }
      if (line.trim() === "") { i += 1; continue; }
      m = line.match(/^\s*(#{1,6})\s+(.*?)\s*#*\s*$/);
      if (m) { const lvl = m[1].length; out.push("<h" + lvl + ">" + _inline(m[2]) + "</h" + lvl + ">"); i += 1; continue; }
      if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { out.push("<hr>"); i += 1; continue; }
      if (/^\s*>/.test(line)) {
        const buf = [];
        while (i < n && /^\s*>/.test(lines[i])) { buf.push(lines[i].replace(/^\s*>\s?/, "")); i += 1; }
        out.push("<blockquote>" + _render_blocks(buf) + "</blockquote>");
        continue;
      }
      if (line.includes("|") && i + 1 < n && lines[i + 1].includes("---") &&
          /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1])) {
        const header = _cells(line);
        const al = _cells(lines[i + 1]).map(_align_of);
        i += 2;
        const body = [];
        while (i < n && lines[i].includes("|") && lines[i].trim()) { body.push(_cells(lines[i])); i += 1; }
        const th = header.map((c, j) => "<th" + (j < al.length ? al[j] : "") + ">" + _inline(c) + "</th>").join("");
        const rows = body.map((r) =>
          "<tr>" + r.map((c, j) => "<td" + (j < al.length ? al[j] : "") + ">" + _inline(c) + "</td>").join("") + "</tr>").join("");
        out.push("<table><thead><tr>" + th + "</tr></thead><tbody>" + rows + "</tbody></table>");
        continue;
      }
      if (LIST_RE.test(line)) {
        const base = leadLen(line.match(LIST_RE)[1]);
        const [html_list, ni] = _render_list(lines, i, base);
        out.push(html_list); i = ni; continue;
      }
      const buf = [line]; i += 1;
      while (i < n && lines[i].trim() !== "" && !_is_block_start(lines[i])) { buf.push(lines[i]); i += 1; }
      out.push("<p>" + _inline(buf.map((x) => x.trim()).join(" ")) + "</p>");
    }
    return out.join("\n");
  }

  function to_html(md) {
    md = md.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    return _render_blocks(md.split("\n"));
  }

  const _CSS =
    ":root{color-scheme:light dark}" +
    "*{box-sizing:border-box}" +
    "body{margin:0;padding:26px 20px 64px;max-width:860px;margin:0 auto;" +
    'font:16px/1.65 system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;' +
    "color:#1a1d21;background:#fff;-webkit-text-size-adjust:100%}" +
    "h1,h2,h3,h4{line-height:1.25;letter-spacing:-.01em;margin:1.6em 0 .5em}" +
    "h1{font-size:1.7rem;margin-top:.2em}h2{font-size:1.35rem;padding-bottom:.25em;border-bottom:1px solid #e4e7ec}" +
    "h3{font-size:1.12rem}h4{font-size:1rem}" +
    "p{margin:.7em 0}" +
    "a{color:#2d6cdf;text-decoration:none}a:hover{text-decoration:underline}" +
    "code{background:#f0f1f4;padding:.12em .4em;border-radius:5px;font-size:.9em;" +
    "font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}" +
    "pre{background:#f6f8fa;border:1px solid #e4e7ec;padding:14px 16px;border-radius:10px;overflow:auto}" +
    "pre code{background:none;padding:0;font-size:.86em;line-height:1.5}" +
    "blockquote{margin:1em 0;padding:.4em 1em;border-left:4px solid #c0392b;" +
    "background:rgba(192,57,43,.06);border-radius:0 8px 8px 0}" +
    "blockquote p{margin:.4em 0}" +
    "table{border-collapse:collapse;width:100%;margin:1.1em 0;font-size:.92em;display:block;overflow-x:auto}" +
    "th,td{border:1px solid #e4e7ec;padding:7px 11px;text-align:left;vertical-align:top}" +
    "th{background:rgba(127,127,127,.10);font-weight:600}" +
    "tr:nth-child(even) td{background:rgba(127,127,127,.04)}" +
    "ul,ol{margin:.6em 0;padding-left:1.5em}li{margin:.25em 0}" +
    "li>ul,li>ol{margin:.25em 0}" +
    "hr{border:0;border-top:1px solid #e4e7ec;margin:2em 0}" +
    "img{max-width:100%}" +
    "@media(prefers-color-scheme:dark){" +
    "body{color:#e8ebef;background:#0f1216}" +
    "a{color:#5b8def}" +
    "h2{border-bottom-color:#252c36}" +
    "code{background:#1b212b}" +
    "pre{background:#161b22;border-color:#252c36}" +
    "blockquote{border-left-color:#e05a48;background:rgba(224,90,72,.10)}" +
    "th,td{border-color:#252c36}th{background:rgba(255,255,255,.06)}" +
    "tr:nth-child(even) td{background:rgba(255,255,255,.03)}" +
    "hr{border-top-color:#252c36}}";

  function to_document(md, title = "") {
    const body = to_html(md);
    return '<!DOCTYPE html><html><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width,initial-scale=1">' +
      (title ? "<title>" + escQ(title) + "</title>" : "") +
      "<style>" + _CSS + "</style></head><body>" + body + "</body></html>";
  }

  return { to_html, to_document };
});
