/* Shared page renderer (public site + Website Editor preview).
   Pages are JSON: {sections:[{id,type,hidden,data}]}; "global" is {assets:{banner,logo,avatar},links:{...}}.
   Nothing here talks to the database: it only turns content into HTML (all user text is escaped, all URLs validated). */
(() => {
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const LI = (p, c = "") => `<svg class="li ${c}" viewBox="0 0 24 24" aria-hidden="true">${p}</svg>`;
const ICN = {
  up: LI('<path d="M7 7h10v10"/><path d="M7 17 17 7"/>', "flip"),
  folder: LI('<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>'),
  pin: LI('<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>'),
  alert: LI('<circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>')
};
/* small icon set for skills / services (Lucide-style, stroke) */
const ICONS = {
  star: '<path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/>',
  code: '<path d="m16 18 6-6-6-6"/><path d="m8 6-6 6 6 6"/>',
  palette: '<circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>',
  layers: '<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
  camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
  zap: '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>',
  pen: '<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  box: '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
  monitor: '<rect width="20" height="14" x="2" y="3" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/>',
  heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
  image: '<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21"/>'
};
const ICON = {   /* social icons: same 20px box, brand colours */
  facebook: '<svg viewBox="0 0 24 24" fill="#1877f2"><path d="M14 8h3V4h-3a4 4 0 0 0-4 4v2H7v4h3v8h4v-8h3l1-4h-4V8z"/></svg>',
  instagram: '<svg viewBox="0 0 24 24" fill="none" stroke="#e4405f" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="#e4405f"/></svg>',
  whatsapp: '<svg viewBox="0 0 24 24" fill="none" stroke="#25d366" stroke-width="2"><path d="M3 21l1.6-4.7A8.5 8.5 0 1 1 8 19.5L3 21z"/><path fill="#25d366" stroke="none" d="M9 8.5c.4 2.6 2.4 4.8 5.2 5.5l1.3-1.3-2-1-.8.8c-.8-.4-1.6-1.2-2-2l.8-.8-1-2L9 8.5z"/></svg>',
  behance: '<svg viewBox="0 0 24 24" fill="#1769ff"><path d="M22 7h-7V5h7v2zm1.726 10c-.442 1.297-2.029 3-5.101 3-3.074 0-5.564-1.729-5.564-5.675 0-3.91 2.325-5.92 5.466-5.92 3.082 0 4.964 1.782 5.375 4.426.078.506.109 1.188.095 2.14H15.97c.13 3.211 3.483 3.312 4.588 2.029h3.168zm-7.686-4h4.965c-.105-1.547-1.136-2.219-2.477-2.219-1.466 0-2.277.768-2.488 2.219zm-9.574 6.988H0V5.021h6.953c5.476.081 5.58 5.444 2.72 6.906 3.461 1.26 3.577 8.061-3.207 8.061zM3 11h3.584c2.508 0 2.906-3-.312-3H3v3zm3.391 3H3v3.016h3.341c3.055 0 2.868-3.016.05-3.016z"/></svg>',
  email: '<svg viewBox="0 0 24 24" fill="none" stroke="#f79321" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 7l9 6 9-6"/></svg>'
};
const SOCIALS = [["facebook", "Facebook"], ["instagram", "Instagram"], ["whatsapp", "WhatsApp"], ["behance", "Behance"], ["email", "Email"]];
const LINK_HOSTS = { facebook: /(^|\.)(facebook\.com|fb\.com|fb\.me)$/i, instagram: /(^|\.)instagram\.com$/i, behance: /(^|\.)behance\.net$/i, whatsapp: /(^|\.)(wa\.me|whatsapp\.com)$/i };
const EMAIL_RE = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]{2,}$/;

/* a social/contact value -> a safe href, or "" when it is empty/invalid (invalid links are never rendered) */
function socialHref(k, v) {
  v = String(v || "").trim(); if (!v) return "";
  if (k === "email") { v = v.replace(/^mailto:/i, ""); return EMAIL_RE.test(v) ? "mailto:" + v : ""; }
  if (k === "whatsapp" && /^\+?\d[\d\s-]{6,18}$/.test(v)) return "https://wa.me/" + v.replace(/\D/g, "");
  let u; try { u = new URL(v); } catch (e) { return ""; }
  if (u.protocol !== "https:" || !LINK_HOSTS[k] || !LINK_HOSTS[k].test(u.hostname)) return "";
  return u.href;
}
/* buttons/links inside sections: internal routes, https, mailto, tel only */
function safeHref(u) {
  u = String(u || "").trim(); if (!u) return "";
  if (/^#\/[\w\-/]*$/.test(u)) return u;
  if (/^(mailto:|tel:)[^\s"'<>]+$/i.test(u)) return u;
  try { const x = new URL(u); return x.protocol === "https:" ? x.href : ""; } catch (e) { return ""; }
}
const safeImg = u => { u = String(u || "").trim(); return /^(https:\/\/|assets\/|blob:|data:image\/(png|jpe?g|webp|gif);base64,)/.test(u) ? u : ""; };

/* ---------- defaults (the site as it was before the editor existed; never invented content) ---------- */
const SERVICES = [["تصميم شعار", "Logo Design"], ["الهوية البصرية", "Visual Identity"], ["تطوير المواقع", "Website Development"], ["التصميم الجرافيكي", "Graphic Design"]];
let uidN = 0;
const uid = () => (window.crypto && crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : "x" + Date.now().toString(36) + (uidN++));
const T = (ar, en) => ({ ar, en });
function defaultGlobal(site) {
  const l = (site && site.links) || {}, links = {};
  SOCIALS.forEach(([k]) => { links[k] = { url: k === "email" ? (l.email || "") : (l[k] || ""), visible: true }; });
  return { assets: { banner: { url: "assets/banner.png", w: 2080, h: 696, focus: { x: 50, y: 50, zoom: 1 }, ratio: "auto" }, logo: { url: "assets/logo.svg" }, avatar: { url: "", focus: { x: 50, y: 50, zoom: 1 } } }, links };
}
function newSection(type) {
  const base = { id: uid(), type, hidden: false };
  const D = {
    profile: { name: T("Omar Elzanaty", "Omar Elzanaty"), headline: T("Visual Identity Designer & Web Developer", "Visual Identity Designer & Web Developer"), location: T("Egypt", "Egypt"), buttons: [{ id: uid(), label: T("أعمالي", "My Work"), href: "#/work", style: "or" }, { id: uid(), label: T("Project Brief", "Project Brief"), href: "#/brief", style: "gh" }] },
    about: { title: T("نبذة عني", "About Me"), body: T("", "") },
    skills: { title: T("المهارات والأدوات", "Skills & Tools"), items: [] },
    experience: { title: T("الخبرات", "Experience"), items: [] },
    education: { title: T("التعليم", "Education"), items: [] },
    services: { title: T("الخدمات", "Services"), items: [] },
    projects: { title: T("أعمال مختارة", "Selected Work"), limit: 6, category: "all", showAll: true },
    gallery: { title: T("معرض صور", "Image Gallery"), cols: 3, images: [] },
    text: { title: T("", ""), body: T("", "") },
    contact: { title: T("تواصل معي", "Contact"), buttons: [{ id: uid(), label: T("أرسل رسالة", "Send a message"), href: "#/contact", style: "or" }, { id: uid(), label: T("Project Brief", "Project Brief"), href: "#/brief", style: "gh" }] },
    custom: { title: T("", ""), body: T("", ""), image: { url: "", w: 0, h: 0 }, imageSide: "start", buttons: [] }
  };
  return { ...base, data: D[type] || {} };
}
function defaultPage(key, site) {
  site = site || {};
  if (key === "global") return defaultGlobal(site);
  if (key === "home") {
    const s = t => newSection(t), mk = (t, id, f) => { const x = s(t); x.id = id; if (f) f(x.data); return x; };
    return { sections: [
      mk("profile", "h-profile"),
      mk("about", "h-about", d => { d.body = T("أنا عمر الزناتي، مصمم هويات بصرية ومطور مواقع إلكترونية من مصر. أعمل على تحويل الأفكار إلى هويات بصرية مميزة وتجارب رقمية احترافية، من خلال الجمع بين الإبداع والتصميم والتكنولوجيا.\n\nهدفي هو مساعدة العلامات التجارية والأفراد على بناء حضور قوي ومميز، سواء من خلال تصميم هوية بصرية متكاملة أو تطوير موقع إلكتروني يعكس قيمة المشروع ويحقق أهدافه.", "I'm Omar Elzanaty, a visual identity designer and web developer from Egypt. I turn ideas into distinctive visual identities and professional digital experiences by combining creativity, design and technology.\n\nMy goal is to help brands and individuals build a strong, memorable presence, whether through a complete visual identity or a website that reflects the value of the project and achieves its goals."); }),
      mk("skills", "h-skills", d => { d.items = (site.skills || []).map(x => ({ id: uid(), name: T(x.ar || "", x.en || ""), icon: "", image: "", desc: T("", ""), category: x.group || "", hidden: false })); }),
      mk("projects", "h-projects"),
      mk("experience", "h-exp", d => { d.items = (site.experience || []).map(x => ({ id: uid(), title: x.title || T("", ""), org: x.org || T("", ""), start: x.period || "", end: "", present: false, desc: x.desc || T("", ""), hidden: false })); }),
      mk("education", "h-edu", d => { d.items = (site.education || []).map(x => ({ id: uid(), title: x.title || T("", ""), org: x.org || T("", ""), start: x.period || "", end: "", present: false, desc: x.desc || T("", ""), hidden: false })); }),
      mk("services", "h-services", d => { d.items = SERVICES.map(x => ({ id: uid(), title: T(x[0], x[1]), desc: T("", ""), href: "#/brief", icon: "" })); }),
      mk("contact", "h-contact")
    ] };
  }
  const core = { work: ["w-core", T("الأعمال", "Work")], brief: ["b-core", T("Project Brief", "Project Brief")], contact: ["c-core", T("تواصل معي", "Contact")] }[key];
  return core ? { sections: [{ id: core[0], type: "core", core: key, hidden: false, data: { title: core[1], desc: T("", "") } }] } : { sections: [] };
}
/* a stored page is only trusted when it has the expected shape; otherwise fall back to the defaults */
function normalize(key, c, site) {
  if (key === "global") { const d = defaultGlobal(site); if (!c || typeof c !== "object") return d; return { assets: { banner: { ...d.assets.banner, ...((c.assets || {}).banner || {}) }, logo: { ...d.assets.logo, ...((c.assets || {}).logo || {}) }, avatar: { ...d.assets.avatar, ...((c.assets || {}).avatar || {}) } }, links: Object.fromEntries(SOCIALS.map(([k]) => [k, { ...d.links[k], ...((c.links || {})[k] || {}) }])) }; }
  if (!c || !Array.isArray(c.sections)) return defaultPage(key, site);
  return { sections: c.sections.filter(s => s && typeof s === "object" && typeof s.type === "string").map(s => ({ ...s, id: String(s.id || uid()), hidden: !!s.hidden, data: s.data && typeof s.data === "object" ? s.data : {} })) };
}

/* ---------- rendering ---------- */
const ratioCss = r => String(r).replace("/", " / ");
function bannerRatio(b) {
  const nat = b.w && b.h ? Math.min(6, Math.max(1.5, b.w / b.h)) : 3, set = String(b.ratio || "auto");
  const d = set === "auto" ? nat : (() => { const [a, c] = set.split("/").map(Number); return a / (c || 1) || nat; })();
  return { d: d.toFixed(3), m: Math.min(d, 3).toFixed(3), nat };
}
const focusCss = f => { f = f || {}; const x = Number.isFinite(+f.x) ? +f.x : 50, y = Number.isFinite(+f.y) ? +f.y : 50, z = Number.isFinite(+f.zoom) ? +f.zoom : 1; return `object-position:${x}% ${y}%;${z > 1 ? `transform:scale(${z});transform-origin:${x}% ${y}%;` : ""}`; };
function socialLinks(G) { return SOCIALS.map(([k, n]) => { const l = (G.links || {})[k] || {}; return { k, n, href: l.visible === false ? "" : socialHref(k, l.url) }; }).filter(x => x.href); }
const socHtml = list => list.length ? `<div class="soc">${list.map(x => `<a href="${esc(x.href)}" ${x.k === "email" ? "" : 'target="_blank" rel="noopener"'} aria-label="${x.n}">${ICON[x.k]}<span>${x.n}</span></a>`).join("")}</div>` : "";

function render(key, page, G, ctx) {
  const { L, P } = ctx, T2 = o => esc(P(o)), id = { profile: "top", about: "about", skills: "skills", projects: "selected-work", experience: "experience", education: "education", services: "services", contact: "contact" };
  let n = 0;
  const btns = (arr, mt = 0) => { const b = (arr || []).map(x => ({ ...x, href: safeHref(x.href) })).filter(x => x.href && P(x.label)); return b.length ? `<div class="row"${mt ? "" : ' style="margin-top:0"'}>${b.map(x => `<a class="btn ${x.style === "gh" ? "gh" : "or"}" href="${esc(x.href)}">${T2(x.label)}</a>`).join("")}</div>` : ""; };
  const head = (num, t) => `<div class="hs-h"><span class="lbl">${num}</span>${P(t) ? `<h2>${T2(t)}</h2>` : ""}</div>`;
  const para = o => String(P(o) || "").split(/\n\s*\n/).map(x => x.trim()).filter(Boolean);
  const vis = a => (a || []).filter(x => x && !x.hidden);
  const sec = (s, inner, o = {}) => { n++; const num = String(n).padStart(2, "0"); return `<section class="hs" id="${esc(o.id || id[s.type] || "s-" + s.id)}" data-sec="${esc(s.id)}"><div class="wrap">${o.nohead ? "" : head(num, s.data.title)}${inner}</div></section>`; };
  const period = x => { const a = String(x.start || "").trim(), b = x.present ? L("حتى الآن", "Present") : String(x.end || "").trim(); return a && b ? `${esc(a)} – ${esc(b)}` : esc(a || b); };
  const tl = arr => `<ol class="tl">${arr.map(x => `<li><b>${T2(x.title)}</b><span class="mu">${[P(x.org) ? T2(x.org) : "", period(x)].filter(Boolean).join(" · ")}</span>${P(x.desc) ? `<p class="mu">${T2(x.desc)}</p>` : ""}</li>`).join("")}</ol>`;
  const out = [];
  for (const s of page.sections) {
    if (s.hidden) continue; const d = s.data || {};
    if (s.type === "profile") {
      const b = G.assets.banner, av = G.assets.avatar, lg = G.assets.logo, r = bannerRatio(b), bu = safeImg(b.url), lu = safeImg(lg.url), au = safeImg(av.url);
      out.push(`<section class="pf" id="top" data-sec="${esc(s.id)}">${bu ? `<div class="cover" style="--cr:${r.d};--crm:${r.m}"><img src="${esc(bu)}" style="${focusCss(b.focus)}" alt="" ${b.w ? `width="${+b.w}" height="${+b.h}"` : ""} fetchpriority="high" decoding="async"></div>` : `<div class="cover none"></div>`}
      <div class="wrap pf-b"><div class="pf-id">${lu ? `<img class="pf-logo" src="${esc(lu)}" alt="O.E.">` : ""}${au ? `<img class="pf-photo" src="${esc(au)}" style="${focusCss(av.focus).replace(/transform[^;]*;|transform-origin[^;]*;/g, "")}" alt="${esc(P(d.name))}">` : ""}</div>
      <div class="pf-t"><div>${P(d.name) ? `<h1>${T2(d.name)}</h1>` : ""}${P(d.headline) ? `<p class="hl" dir="ltr">${T2(d.headline)}</p>` : ""}${P(d.location) ? `<p class="loc mu">${ICN.pin}<span dir="ltr">${T2(d.location)}</span></p>` : ""}</div>${btns(d.buttons, 1)}</div></div></section>`);
    } else if (s.type === "about") {
      const ps = para(d.body); if (!ps.length) continue;
      out.push(sec(s, `<div class="about-r">${ps.map((t, i) => `<p class="${i ? "mu" : "lead"}">${esc(t)}</p>`).join("")}</div>`));
    } else if (s.type === "skills") {
      const it = vis(d.items).filter(x => P(x.name)); if (!it.length) continue;
      const cats = [...new Set(it.map(x => String(x.category || "").trim()))];
      const chip = x => { const im = safeImg(x.image); return `<span class="chip sk" title="${esc(P(x.desc))}">${im ? `<img src="${esc(im)}" alt="" width="18" height="18" loading="lazy">` : ICONS[x.icon] ? LI(ICONS[x.icon]) : ""}${T2(x.name)}</span>`; };
      out.push(sec(s, cats.length > 1 || cats[0] ? cats.map(c => `${c ? `<h3 class="cat">${esc(c)}</h3>` : ""}<div class="chips big">${it.filter(x => String(x.category || "").trim() === c).map(chip).join("")}</div>`).join("") : `<div class="chips big">${it.map(chip).join("")}</div>`));
    } else if (s.type === "experience" || s.type === "education") {
      const it = vis(d.items).filter(x => P(x.title) || P(x.org)); if (!it.length) continue; out.push(sec(s, tl(it)));
    } else if (s.type === "services") {
      const it = vis(d.items).filter(x => P(x.title)); if (!it.length) continue;
      out.push(sec(s, `<div class="svc">${it.map((x, i) => { const h = safeHref(x.href) || "#/brief"; return `<a class="svc-i" href="${esc(h)}"><span class="lbl">${ICONS[x.icon] ? LI(ICONS[x.icon]) : String(i + 1).padStart(2, "0")}</span><b>${T2(x.title)}</b>${P(x.desc) ? `<span class="mu">${T2(x.desc)}</span>` : ""}${ICN.up}</a>`; }).join("")}</div>`));
    } else if (s.type === "projects") {
      const list = ctx.projectList(d.category), more = ctx.projectsReady() && list.length && d.showAll !== false ? `<div class="row"><a class="btn gh" href="#/work">${L("عرض كل الأعمال", "View all work")} ${ICN.up}</a></div>` : "";
      out.push(sec(s, ctx.projects(list, Math.max(1, Math.min(24, +d.limit || 6)), true) + more));
    } else if (s.type === "gallery") {
      const im = vis(d.images).filter(x => safeImg(x.url)); if (!im.length) continue;
      out.push(sec(s, `<div class="gal" style="--c:${Math.max(1, Math.min(4, +d.cols || 3))}">${im.map(x => `<figure><img loading="lazy" decoding="async" src="${esc(safeImg(x.url))}" alt="${esc(P(x.caption))}" ${x.w ? `width="${+x.w}" height="${+x.h}"` : ""}>${P(x.caption) ? `<figcaption class="mu">${T2(x.caption)}</figcaption>` : ""}</figure>`).join("")}</div>`));
    } else if (s.type === "text") {
      const ps = para(d.body); if (!ps.length && !P(d.title)) continue;
      out.push(sec(s, `<div class="about-r">${ps.map((t, i) => `<p class="${i ? "mu" : "lead"}">${esc(t)}</p>`).join("")}</div>`));
    } else if (s.type === "custom") {
      const ps = para(d.body), im = safeImg((d.image || {}).url); if (!ps.length && !im && !P(d.title) && !(d.buttons || []).length) continue;
      out.push(sec(s, `<div class="cust ${im ? "has-img" : ""} ${d.imageSide === "end" ? "rev" : ""}">${im ? `<img src="${esc(im)}" alt="" loading="lazy" decoding="async" ${d.image.w ? `width="${+d.image.w}" height="${+d.image.h}"` : ""}>` : ""}<div>${ps.map((t, i) => `<p class="${i ? "mu" : "lead"}">${esc(t)}</p>`).join("")}${btns(d.buttons, 1)}</div></div>`));
    } else if (s.type === "contact") {
      out.push(sec(s, socHtml(socialLinks(G)) + btns(d.buttons)));
    } else if (s.type === "core") {
      out.push(`<div data-sec="${esc(s.id)}">${ctx.core(s.core || key, d)}</div>`);
    }
  }
  return out.join("");
}
window.SEC = { esc, ICN, ICON, ICONS, LI, SOCIALS, socialHref, safeHref, safeImg, socialLinks, socHtml, defaultPage, defaultGlobal, normalize, newSection, render, uid, T, bannerRatio, focusCss };
})();
