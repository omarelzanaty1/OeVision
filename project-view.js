/* Shared project renderer: used by the PUBLIC project page (app.js) and by the admin PREVIEW (builder.js),
   so the preview is, by construction, the same markup and the same CSS as the public details page. */
(() => {
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const num = (v, d, lo, hi) => { v = Number(v); return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d; };
const httpsUrl = u => { try { const x = new URL(String(u || "").trim()); return x.protocol === "https:" ? x.href : ""; } catch (e) { return ""; } };
const dim = o => (o && +o.w > 0 && +o.h > 0 ? ` width="${Math.round(+o.w)}" height="${Math.round(+o.h)}"` : "");
const GAP = ["none", "sm", "md", "lg"], SIZE = ["sm", "md", "lg"], ALIGN = ["start", "center", "end", "justify"], VAR = ["h1", "h2", "p"];
const pick = (v, list, d) => (list.includes(v) ? v : d);

/* YouTube / Vimeo are embedded (privacy-friendly domains); any other https link becomes a safe external link card. */
function embedInfo(url) {
  let u; try { u = new URL(String(url || "").trim()); } catch (e) { return null; }
  if (u.protocol !== "https:") return null;
  const h = u.hostname.replace(/^(www|m)\./, ""); let id = "", m;
  if (h === "youtu.be") id = u.pathname.slice(1).split("/")[0];
  else if (h === "youtube.com" || h === "youtube-nocookie.com") {
    if (u.pathname === "/watch") id = u.searchParams.get("v") || "";
    else if ((m = u.pathname.match(/^\/(?:embed|shorts|live)\/([\w-]+)/))) id = m[1];
  }
  if (id && /^[\w-]{6,20}$/.test(id)) return { provider: "youtube", src: `https://www.youtube-nocookie.com/embed/${id}` };
  if (h === "vimeo.com" || h === "player.vimeo.com") {
    m = u.pathname.match(/^\/(?:video\/)?(\d{5,12})(?:\/([a-z0-9]+))?/i);
    if (m) return { provider: "vimeo", src: `https://player.vimeo.com/video/${m[1]}` + (m[2] ? `?h=${m[2]}` : u.searchParams.get("h") ? `?h=${encodeURIComponent(u.searchParams.get("h"))}` : "") };
  }
  return { provider: "link", src: u.href, host: h };
}

/* Blocks in display order. Legacy projects (no content_blocks) fall back to gallery_images so nothing disappears. */
function blocksOf(p) {
  if (Array.isArray(p.blocks) && p.blocks.length) return p.blocks;
  return (p.images || []).map(u => ({ type: "image", url: u }));
}
/* Cover framing: non-destructive (the original file is never cropped). */
function coverStyle(f) {
  const x = num(f && f.x, 50, 0, 100), y = num(f && f.y, 50, 0, 100), z = num(f && f.zoom, 1, 1, 3);
  return `object-position:${x}% ${y}%;transform:scale(${z});transform-origin:${x}% ${y}%`;
}

function block(b, i, o) {
  const P = o.P, title = esc(P(o.title) || "");
  const img = (x, eager) => {
    const u = httpsUrl(x.url); if (!u) return "";
    return `<img src="${esc(u)}" alt="${esc(P(x.caption) || P(o.title) || "")}"${dim(x)} ${eager ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"'} decoding="async">`;
  };
  switch (b && b.type) {
    case "image": {
      const im = img(b, i === 0); if (!im) return "";
      const cap = P(b.caption);
      return `<figure class="pv-img">${im}${cap ? `<figcaption>${esc(cap)}</figcaption>` : ""}</figure>`;
    }
    case "text": {
      const t = P(b.text); if (!t) return "";
      const v = pick(b.variant, VAR, "p"), al = "al-" + pick(b.align, ALIGN, "start");
      return v === "h1" ? `<h2 class="pv-h1 ${al}">${esc(t)}</h2>` : v === "h2" ? `<h3 class="pv-h2 ${al}">${esc(t)}</h3>` : `<p class="pv-p ${al}">${esc(t)}</p>`;
    }
    case "grid": {
      const cols = pick(+b.cols, [2, 3, 4], 2), gap = pick(b.gap, GAP, "md"), ims = (b.images || []).map(x => img(x, false)).filter(Boolean);
      return ims.length ? `<div class="pv-grid c${cols} g-${gap}">${ims.map(x => `<figure>${x}</figure>`).join("")}</div>` : "";
    }
    case "embed": {
      const e = embedInfo(b.url); if (!e) return "";
      const cap = P(b.caption);
      if (e.provider === "link") return `<div class="pv-linkrow"><a class="btn gh" target="_blank" rel="noopener noreferrer" href="${esc(e.src)}">${esc(e.host)} ↗</a></div>`;
      return `<figure class="pv-embed"><div class="pv-frame"><iframe src="${esc(e.src)}" title="${title}" loading="lazy" allowfullscreen referrerpolicy="strict-origin-when-cross-origin" allow="encrypted-media; picture-in-picture; fullscreen"></iframe></div>${cap ? `<figcaption>${esc(cap)}</figcaption>` : ""}</figure>`;
    }
    case "divider": {
      const s = pick(b.size, SIZE, "md");
      return b.style === "space" ? `<div class="pv-sp s-${s}" aria-hidden="true"></div>` : `<hr class="pv-hr s-${s}">`;
    }
  }
  return "";
}

/* p: {title:{ar,en}, description:{ar,en}, category, field, tags[], tools[], client, date, year, url, blocks[], images[]}
   o: {L(ar,en), P(obj), backHref} */
function render(p, o) {
  const L = o.L, P = o.P; o = { ...o, title: p.title };
  const cat = p.category === "web" ? "Website Development" : "Graphic Design";
  const when = p.date ? String(p.date).slice(0, 10) : p.year ? String(p.year) : "";
  const chips = [cat, p.field, when, p.client ? `${L("العميل", "Client")}: ${p.client}` : "", ...(p.tools || []), ...(p.tags || []).map(t => "#" + t)].filter(Boolean);
  const url = httpsUrl(p.url), desc = P(p.description), back = o.backHref || "#/work";
  const bl = blocksOf(p).map((b, i) => block(b, i, o)).filter(Boolean);
  return `<div class="pv"><a class="mu pv-back" href="${esc(back)}">← ${L("الأعمال", "Work")}</a>
  <header class="pv-head"><h1>${esc(P(p.title))}</h1><div class="chips">${chips.map(c => `<span class="chip">${esc(c)}</span>`).join("")}</div>${desc ? `<p class="pv-desc mu">${esc(desc)}</p>` : ""}</header>
  <div class="pv-body">${bl.join("")}</div>
  <footer class="pv-foot">${url ? `<a class="btn or" target="_blank" rel="noopener noreferrer" href="${esc(url)}">${L("معاينة المشروع", "Live preview")}</a>` : ""}<a class="btn gh" href="${esc(back)}">← ${L("العودة لمعرض الأعمال", "Back to Work")}</a></footer></div>`;
}

window.PV = { render, embedInfo, blocksOf, coverStyle, httpsUrl, esc };
})();
