(() => {
const S = window.SITE, $ = s => document.querySelector(s), app = $("#app");
let PROJ = [], PSTATE = "idle";
async function loadProjects() {
  PSTATE = "loading";
  if (!window.sb) { PSTATE = "error"; return; }
  const { data, error } = await window.sb.from("projects").select("*").eq("status", "published").order("created_at", { ascending: false });
  if (error) { PSTATE = "error"; return; }
  PROJ = data.map(r => ({ id: r.id, title: { ar: r.title_ar, en: r.title_en }, description: { ar: r.description_ar, en: r.description_en }, category: r.category, cover: r.cover_url || (r.images || [])[0] || "", images: r.images || [], year: r.year || "", tools: r.tools || [], url: r.preview_url }));
  PSTATE = "ready";
}
let lang = "ar";
try { lang = localStorage.getItem("lang") || "ar"; } catch (e) {}
const L = (a, e) => (lang === "ar" ? a : e);
const P = o => (o && (o[lang] || o.en || o.ar)) || "";
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const ICON = {
  facebook: '<svg viewBox="0 0 24 24" fill="#1877f2"><path d="M14 8h3V4h-3a4 4 0 0 0-4 4v2H7v4h3v8h4v-8h3l1-4h-4V8z"/></svg>',
  instagram: '<svg viewBox="0 0 24 24" fill="none" stroke="#e4405f" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="#e4405f"/></svg>',
  whatsapp: '<svg viewBox="0 0 24 24" fill="none" stroke="#25d366" stroke-width="2"><path d="M3 21l1.6-4.7A8.5 8.5 0 1 1 8 19.5L3 21z"/><path fill="#25d366" stroke="none" d="M9 8.5c.4 2.6 2.4 4.8 5.2 5.5l1.3-1.3-2-1-.8.8c-.8-.4-1.6-1.2-2-2l.8-.8-1-2L9 8.5z"/></svg>',
  behance: '<svg viewBox="0 0 24 24"><text x="12" y="17" text-anchor="middle" font-size="14" font-weight="800" fill="#1769ff" font-family="Outfit,sans-serif">Bē</text></svg>',
  email: '<svg viewBox="0 0 24 24" fill="none" stroke="#ff8a00" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 7l9 6 9-6"/></svg>'
};

/* ---------- Project Brief config ---------- */
const q = (id, type, req, ar, en, opts) => ({ id, type, req, ar, en, opts });
const o = (...p) => p.map(x => ({ ar: x[0], en: x[1] }));
const SERVICES = {
  logo: { ar: "تصميم شعار", en: "Logo Design", qs: [
    q("brand", "text", 1, "اسم العلامة التجارية", "Brand name"),
    q("field", "text", 1, "مجال النشاط", "Business field"),
    q("about", "textarea", 1, "نبذة عن المشروع وجمهوره", "About the project and its audience"),
    q("style", "select", 0, "الأسلوب المفضل", "Preferred style", o(["بسيط", "Minimal"], ["عصري", "Modern"], ["كلاسيكي", "Classic"], ["جريء", "Bold"])),
    q("colors", "text", 0, "ألوان مفضلة أو مرفوضة", "Preferred or avoided colors"),
    q("refs", "file", 0, "ملفات مرجعية", "Reference files"),
    q("deadline", "text", 0, "الموعد المطلوب", "Deadline")] },
  identity: { ar: "الهوية البصرية", en: "Visual Identity", qs: [
    q("brand", "text", 1, "اسم العلامة التجارية", "Brand name"),
    q("field", "text", 1, "مجال النشاط", "Business field"),
    q("about", "textarea", 1, "نبذة عن المشروع وجمهوره", "About the project and its audience"),
    q("deliver", "multi", 1, "المطلوب تنفيذه", "Deliverables", o(["شعار", "Logo"], ["ألوان وخطوط", "Colors & fonts"], ["كروت وأوراق مكتبية", "Stationery"], ["دليل الهوية", "Brand guidelines"], ["السوشيال ميديا", "Social media kit"])),
    q("style", "select", 0, "الأسلوب المفضل", "Preferred style", o(["بسيط", "Minimal"], ["عصري", "Modern"], ["كلاسيكي", "Classic"], ["جريء", "Bold"])),
    q("refs", "file", 0, "ملفات مرجعية", "Reference files"),
    q("deadline", "text", 0, "الموعد المطلوب", "Deadline")] },
  web: { ar: "تطوير المواقع", en: "Website Development", qs: [
    q("name", "text", 1, "اسم المشروع", "Project name"),
    q("type", "select", 1, "نوع الموقع", "Website type", o(["موقع تعريفي", "Company site"], ["معرض أعمال", "Portfolio"], ["متجر إلكتروني", "Online store"], ["صفحة هبوط", "Landing page"], ["أخرى", "Other"])),
    q("goal", "textarea", 1, "هدف الموقع", "Website goal"),
    q("feat", "multi", 0, "المزايا المطلوبة", "Features", o(["لوحة تحكم", "Admin panel"], ["نموذج طلبات", "Request forms"], ["لغتان", "Bilingual"], ["دفع إلكتروني", "Online payments"], ["مدونة", "Blog"])),
    q("domain", "select", 0, "هل لديك دومين واستضافة؟", "Domain & hosting?", o(["نعم", "Yes"], ["لا", "No"], ["غير متأكد", "Not sure"])),
    q("refs", "file", 0, "مواقع أو ملفات مرجعية", "References"),
    q("deadline", "text", 0, "الموعد المطلوب", "Deadline")] },
  graphic: { ar: "التصميم الجرافيكي", en: "Graphic Design", qs: [
    q("what", "select", 1, "نوع التصميم", "Design type", o(["سوشيال ميديا", "Social media"], ["بوستر / فلاير", "Poster / flyer"], ["عبوات", "Packaging"], ["بنرات", "Banners"], ["أخرى", "Other"])),
    q("details", "textarea", 1, "تفاصيل الطلب", "Request details"),
    q("qty", "text", 0, "عدد التصميمات", "Number of designs"),
    q("fmt", "multi", 0, "صيغ التسليم", "Delivery formats", o(["PNG/JPG", "PNG/JPG"], ["PDF", "PDF"], ["ملفات مفتوحة", "Source files"])),
    q("refs", "file", 0, "ملفات مرجعية", "References"),
    q("deadline", "text", 0, "الموعد المطلوب", "Deadline")] }
};
const STAT = { new: ["طلب جديد", "New Request"], reviewing: ["قيد المراجعة", "Reviewing"], in_progress: ["قيد التنفيذ", "In Progress"], completed: ["مكتمل", "Completed"], rejected: ["مرفوض", "Rejected"] };
let USER = null, ACC = null; const sb = window.sb;
let B = { svc: null, step: 0, ans: {}, files: {}, err: "" };

/* ---------- Views ---------- */
const views = {
  home() {
    const sk = S.skills.length ? `<h2>${L("المهارات والأدوات", "Skills & Tools")}</h2><div class="chips">${S.skills.map(s => `<span class="chip">${esc(P(s))}</span>`).join("")}</div>` : "";
    return `<section class="hero"><img src="assets/banner.png" alt="Omar Elzanaty"></section>
    <div class="wrap"><img src="assets/logo.svg" alt="O.E." width="64" height="64" style="border-radius:14px;margin-bottom:16px">
    <h1>Omar <b>Elzanaty</b></h1>
    <div class="chips"><span class="chip">Visual Identity Designer &amp; Web Developer</span><span class="chip">📍 Egypt</span></div>
    <p class="mu" style="max-width:760px;margin-top:12px">${L("أنا عمر الزناتي، مصمم هويات بصرية ومطور مواقع إلكترونية من مصر. أعمل على تحويل الأفكار إلى هويات بصرية مميزة وتجارب رقمية احترافية، من خلال الجمع بين الإبداع والتصميم والتكنولوجيا.", "I'm Omar Elzanaty, a visual identity designer and web developer from Egypt. I turn ideas into distinctive visual identities and professional digital experiences by combining creativity, design and technology.")}</p>
    <p class="mu" style="max-width:760px;margin-top:12px">${L("هدفي هو مساعدة العلامات التجارية والأفراد على بناء حضور قوي ومميز، سواء من خلال تصميم هوية بصرية متكاملة أو تطوير موقع إلكتروني يعكس قيمة المشروع ويحقق أهدافه.", "My goal is to help brands and individuals build a strong, memorable presence, whether through a complete visual identity or a website that reflects the value of the project and achieves its goals.")}</p>
    <div class="row"><a class="btn" href="#/brief">${L("ابدأ مشروعك", "Start a project")}</a><a class="btn gh" href="#/work">${L("شاهد أعمالي", "View my work")}</a></div>
    <div style="margin-top:48px">${sk}</div></div>`;
  },
  work(cat = "all") {
    const list = PROJ.filter(p => cat === "all" || p.category === cat);
    const tab = (k, a, e) => `<button class="${cat === k ? "on" : ""}" data-cat="${k}">${L(a, e)}</button>`;
    const cn = c => (c === "web" ? "Website Development" : "Graphic Design");
    let body;
    if (PSTATE === "loading" || PSTATE === "idle") body = `<div class="empty">…</div>`;
    else if (PSTATE === "error") body = `<div class="empty">${L("تعذّر تحميل الأعمال حاليًا.", "Could not load projects right now.")}</div>`;
    else if (!list.length) body = `<div class="empty">${L("لا توجد أعمال منشورة حاليًا.", "No published projects yet.")}</div>`;
    else body = `<div class="grid">${list.map(p => `<article class="card"><a href="#/work/${esc(p.id)}">${p.cover ? `<img loading="lazy" src="${esc(p.cover)}" alt="${esc(P(p.title))}">` : ""}</a><div class="p"><span class="chip">${cn(p.category)}</span><b style="display:block;margin:10px 0 4px">${esc(P(p.title))}</b><p class="mu" style="font-size:14px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${esc(P(p.description))}</p><a class="btn" style="margin-top:12px;padding:8px 20px" href="#/work/${esc(p.id)}">${L("عرض التفاصيل", "View details")}</a></div></article>`).join("")}</div>`;
    return `<div class="wrap"><h2>${L("الأعمال", "Work")}</h2><div class="tabs">${tab("all", "الكل", "All")}${tab("graphic", "Graphic Design", "Graphic Design")}${tab("web", "Website Development", "Website Development")}</div>${body}</div>`;
  },
  project(id) {
    const p = PROJ.find(x => x.id === id);
    if (!p) return `<div class="wrap"><div class="empty">${L("المشروع غير موجود.", "Project not found.")}</div></div>`;
    return `<div class="wrap"><a class="mu" href="#/work">← ${L("الأعمال", "Work")}</a><h1 style="margin:12px 0">${esc(P(p.title))}</h1>
    <div class="chips"><span class="chip">${p.category === "web" ? "Website Development" : "Graphic Design"}</span><span class="chip">${esc(p.year)}</span>${(p.tools || []).map(t => `<span class="chip">${esc(t)}</span>`).join("")}</div>
    <p class="mu" style="max-width:760px;margin-bottom:28px">${esc(P(p.description))}</p>
    <div class="shots">${(p.images || []).map(i => `<img loading="lazy" src="${esc(i)}" alt="">`).join("")}</div>
    ${p.url ? `<a class="btn or" target="_blank" rel="noopener" href="${esc(p.url)}">${L("معاينة المشروع", "Live preview")}</a>` : ""}</div>`;
  },
  brief() {
    const steps = `<div class="steps">${[0, 1, 2].map(i => `<i class="${i <= B.step ? "on" : ""}"></i>`).join("")}</div>`;
    if (B.step === 0) return `<div class="wrap"><h2>Project Brief</h2>${steps}<p class="mu" style="margin-bottom:20px">${L("اختر نوع الخدمة لنبدأ. سيُطلب منك تسجيل الدخول لإرسال الطلب.", "Choose a service to begin. You'll be asked to sign in to submit your request.")}</p><div class="grid">${Object.entries(SERVICES).map(([k, s]) => `<button class="card" data-svc="${k}" style="padding:28px;font:inherit;color:inherit;text-align:start;cursor:pointer"><b style="font-size:20px">${P(s)}</b></button>`).join("")}</div></div>`;
    if (B.step === 3) return `<div class="wrap"><div class="panel" style="text-align:center;max-width:560px;margin:auto;padding:40px 24px"><div class="ok">✓</div><h2>${L("تم استلام طلبك بنجاح", "Your request was received")}</h2><p class="mu">${L("شكرًا لك! سأراجع تفاصيل مشروعك وأتواصل معك قريبًا. يمكنك متابعة حالة الطلب من حسابك.", "Thank you! I'll review your project details and get back to you soon. You can follow the request status in your account.")}</p><div class="row" style="justify-content:center"><a class="btn" href="#/account">${L("طلباتي", "My requests")}</a><a class="btn gh" href="#/home">${L("الرئيسية", "Home")}</a></div></div></div>`;
    const svc = SERVICES[B.svc];
    if (B.step === 1) return `<div class="wrap"><h2>${P(svc)}</h2>${steps}<form id="bf" novalidate>${svc.qs.map(f => field(f)).join("")}${B.err ? `<div class="err">${B.err}</div>` : ""}<div class="row"><button type="button" class="btn gh" data-act="back">${L("رجوع", "Back")}</button><button class="btn">${L("مراجعة الطلب", "Review")}</button></div></form></div>`;
    const sum = svc.qs.map(f => `<dt>${P(f)}</dt><dd>${esc(B.ans[f.id] || "—")}</dd>`).join("");
    return `<div class="wrap"><h2>${L("مراجعة الطلب", "Review your request")}</h2>${steps}<div class="panel"><dl><dt>${L("الخدمة", "Service")}</dt><dd>${P(svc)}</dd>${sum}</dl>
    ${B.err ? `<div class="err">${esc(B.err)}</div>` : ""}<div class="row"><button class="btn gh" data-act="edit">${L("تعديل", "Edit")}</button><button class="btn" data-act="submit">${L("إرسال الطلب", "Submit request")}</button><a class="btn or" target="_blank" rel="noopener" href="${S.links.whatsapp}?text=${encodeURIComponent(waText(svc))}">${L("إرسال الملخص عبر WhatsApp", "Send summary via WhatsApp")}</a></div></div></div>`;
  },
  account() {
    if (!ACC) return `<div class="wrap"><div class="empty">…</div></div>`;
    const pr = ACC.profile || {}, d = x => new Date(x).toLocaleDateString(lang === "ar" ? "ar-EG" : "en-GB");
    const reqs = ACC.reqs.length ? ACC.reqs.map(r => `<details class="panel" style="margin-bottom:12px"><summary style="cursor:pointer;display:flex;gap:12px;align-items:center;flex-wrap:wrap"><b>${esc(SERVICES[r.service] ? P(SERVICES[r.service]) : r.service)}</b><span class="mu">${d(r.created_at)}</span><span class="bd ${r.status}">${P(STAT[r.status])}</span></summary><dl style="margin-top:14px">${(r.answers || []).map(a => `<dt>${esc(P(a.q))}</dt><dd>${esc(a.a)}</dd>`).join("")}${(r.files || []).length ? `<dt>${L("الملفات المرفقة", "Attachments")}</dt><dd>${r.files.map(f => esc(f.name)).join("، ")}</dd>` : ""}</dl></details>`).join("") : `<div class="empty">${L("لا توجد طلبات بعد.", "No requests yet.")}</div>`;
    return `<div class="wrap"><h2>${L("حسابي", "My Account")}</h2><form id="af" style="margin-bottom:32px"><div class="row" style="margin:0;align-items:center">${pr.avatar_url ? `<img src="${esc(pr.avatar_url)}" alt="" width="64" height="64" style="border-radius:50%" referrerpolicy="no-referrer">` : ""}<div><b>${esc(pr.email || USER.email)}</b><div class="mu" style="font-size:13px">${L("تاريخ التسجيل", "Member since")}: ${d(pr.created_at || USER.created_at)}</div></div></div><label>${L("الاسم", "Name")}<input name="n" value="${esc(pr.full_name)}"></label><div class="row" style="margin:0"><button class="btn">${L("حفظ", "Save")}</button><button type="button" class="btn gh" data-act="logout">${L("تسجيل الخروج", "Log out")}</button></div><div id="am" class="mu"></div></form><h2>${L("طلباتي", "My requests")}</h2>${reqs}</div>`;
  },
  contact() {
    const l = S.links, items = [["facebook", "Facebook", l.facebook], ["instagram", "Instagram", l.instagram], ["whatsapp", "WhatsApp", l.whatsapp], ["behance", "Behance", l.behance], ["email", "Email", l.email && "mailto:" + l.email]].filter(x => x[2]);
    return `<div class="wrap"><h2>${L("تواصل معي", "Contact")}</h2><div class="soc">${items.map(([k, n, h]) => `<a href="${esc(h)}" ${k === "email" ? "" : 'target="_blank" rel="noopener"'}>${ICON[k]}<span>${n}</span></a>`).join("")}</div>
    <form id="cf"><label>${L("الاسم", "Name")} <span class="req">*</span><input name="n" required></label><label>${L("البريد الإلكتروني", "Email")} <span class="req">*</span><input name="e" type="email" required></label><label>${L("موضوع الرسالة", "Subject")}<input name="s"></label><label>${L("تفاصيل الطلب", "Details")} <span class="req">*</span><textarea name="d" required></textarea></label><div><button class="btn">${L("إرسال", "Send")}</button></div></form></div>`;
  }
};
function field(f) {
  const v = B.ans[f.id] || "", lab = `${P(f)} ${f.req ? '<span class="req">*</span>' : `<small>(${L("اختياري", "optional")})</small>`}`;
  if (f.type === "text") return `<label>${lab}<input name="${f.id}" value="${esc(v)}"></label>`;
  if (f.type === "textarea") return `<label>${lab}<textarea name="${f.id}">${esc(v)}</textarea></label>`;
  if (f.type === "file") return `<label>${lab}<input type="file" name="${f.id}" multiple>${B.files[f.id] ? `<small>${esc(B.files[f.id].map(x => x.name).join(", "))}</small>` : ""}</label>`;
  if (f.type === "select") return `<label>${lab}<select name="${f.id}"><option value="">—</option>${f.opts.map(x => `<option ${v === P(x) ? "selected" : ""}>${P(x)}</option>`).join("")}</select></label>`;
  return `<div><b>${lab}</b><div class="opts" style="margin-top:8px">${f.opts.map(x => `<label><input type="checkbox" name="${f.id}" value="${P(x)}" ${v.split("، ").includes(P(x)) || v.split(", ").includes(P(x)) ? "checked" : ""}>${P(x)}</label>`).join("")}</div></div>`;
}
const waText = svc => `${L("طلب جديد من الموقع", "New request from the website")}\n${L("الخدمة", "Service")}: ${P(svc)}\n` + svc.qs.filter(f => B.ans[f.id]).map(f => `${P(f)}: ${B.ans[f.id]}`).join("\n");

/* ---------- Router ---------- */
function render() {
  const h = (location.hash || "#/home").slice(2).split("/"), r = h[0] || "home";
  document.documentElement.lang = lang; document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  $("#lang").textContent = lang === "ar" ? "EN" : "AR";
  const nav = [["home", "الرئيسية", "Home"], ["work", "الأعمال", "Work"], ["brief", "Project Brief", "Project Brief"], ["contact", "تواصل", "Contact"]];
  $("#menu").innerHTML = nav.map(([k, a, e]) => `<a href="#/${k}" class="${r === k ? "on" : ""}">${L(a, e)}</a>`).join("") + (USER ? `<a href="#/account" class="${r === "account" ? "on" : ""}">${L("حسابي", "My Account")}</a>` : `<a href="#" data-login="1">${L("تسجيل الدخول", "Login")}</a>`);
  if (r === "work" && PSTATE === "idle") loadProjects().then(render);
  if (r === "account") { if (!USER) { app.innerHTML = `<div class="wrap"><div class="empty">${L("سجّل الدخول لعرض حسابك.", "Sign in to view your account.")}<div class="row" style="justify-content:center"><button class="btn" data-login="1">${L("تسجيل الدخول", "Login")}</button></div></div></div>`; return; } ACC = null; loadAccount(); }
  app.innerHTML = r === "account" ? views.account() : r === "work" && h[1] ? views.project(h[1]) : (views[r] || views.home)();
  document.title = "Omar Elzanaty — Personal Portfolio";
  window.scrollTo(0, 0);
}
function collect(form) {
  const svc = SERVICES[B.svc], d = new FormData(form); B.ans = {};
  for (const f of svc.qs) {
    if (f.type === "file") { const fl = [...form.elements[f.id].files]; if (fl.length) B.files[f.id] = fl; if (B.files[f.id]) B.ans[f.id] = B.files[f.id].map(x => x.name).join(", "); continue; }
    const val = d.getAll(f.id).filter(Boolean).join(", "); if (val.trim()) B.ans[f.id] = val.trim();
  }
  return svc.qs.filter(f => f.req && !B.ans[f.id]).length === 0;
}
document.addEventListener("click", e => {
  const t = e.target.closest("[data-cat],[data-svc],[data-act],[data-login]"); if (!t) return;
  if (t.dataset.login) { e.preventDefault(); return openAuth(); }
  if (t.dataset.cat) { app.innerHTML = views.work(t.dataset.cat); }
  if (t.dataset.svc) { if (!USER) return openAuth(t.dataset.svc); B = { svc: t.dataset.svc, step: 1, ans: {}, files: {}, err: "" }; render(); }
  if (t.dataset.act === "back") { B = { svc: null, step: 0, ans: {}, files: {}, err: "" }; render(); }
  if (t.dataset.act === "edit") { B.step = 1; B.err = ""; render(); }
  if (t.dataset.act === "submit") submitBrief(t);
});
document.addEventListener("submit", e => {
  e.preventDefault();
  if (e.target.id === "bf") { if (collect(e.target)) { B.step = 2; B.err = ""; } else B.err = L("يرجى ملء الحقول الإلزامية.", "Please fill the required fields."); render(); }
  if (e.target.id === "cf") { const d = new FormData(e.target); location.href = `mailto:${S.links.email}?subject=${encodeURIComponent(d.get("s") || "Contact")}&body=${encodeURIComponent(`${d.get("n")} <${d.get("e")}>\n\n${d.get("d")}`)}`; }
});

const base = () => location.origin + location.pathname;
function applyPending() { let p = null; try { p = sessionStorage.getItem("pend"); sessionStorage.removeItem("pend"); } catch (e) {} if (location.search.includes("code=")) history.replaceState(null, "", base() + location.hash); if (p && SERVICES[p]) { B = { svc: p, step: 1, ans: {}, files: {}, err: "" }; location.hash = "#/brief"; } }
async function loadAccount() {
  const [pr, rq] = await Promise.all([sb.from("profiles").select("*").eq("id", USER.id).maybeSingle(), sb.from("requests").select("*").eq("user_id", USER.id).order("created_at", { ascending: false })]);
  ACC = { profile: pr.data, reqs: rq.data || [] };
  if (location.hash.startsWith("#/account")) app.innerHTML = views.account();
}
function openAuth(svc) {
  try { if (svc) sessionStorage.setItem("pend", svc); } catch (e) {}
  document.querySelector("#ov")?.remove(); let mode = "in";
  const ov = document.createElement("div"); ov.className = "ov"; ov.id = "ov"; document.body.appendChild(ov);
  const draw = (msg = "") => {
    ov.innerHTML = `<div class="md" role="dialog"><button class="x" data-x aria-label="close">✕</button><h2>${mode === "in" ? L("تسجيل الدخول", "Sign in") : L("إنشاء حساب", "Create account")}</h2><p class="mu" style="font-size:14px">${L("سجّل الدخول لإرسال طلبك ومتابعته.", "Sign in to submit and track your request.")}</p>
    <button class="btn gh gbtn" data-g><b style="color:#4285f4">G</b> ${L("المتابعة باستخدام Google", "Continue with Google")}</button><div class="sep">${L("أو بالبريد الإلكتروني", "or with email")}</div>
    <form id="ef" style="padding:0;border:0;background:none">${mode === "up" ? `<label>${L("الاسم", "Name")}<input name="n" autocomplete="name"></label>` : ""}<label>${L("البريد الإلكتروني", "Email")}<input name="e" type="email" required autocomplete="email"></label><label>${L("كلمة المرور", "Password")}<input name="p" type="password" required minlength="6" autocomplete="${mode === "in" ? "current-password" : "new-password"}"></label>${msg}<button class="btn">${L("المتابعة", "Continue")}</button></form>
    <button class="btn gh" data-m style="border:0">${mode === "in" ? L("ليس لديك حساب؟ أنشئ حسابًا", "No account? Create one") : L("لديك حساب؟ سجّل الدخول", "Have an account? Sign in")}</button></div>`;
  };
  draw(sb ? "" : `<div class="err">${L("خدمة الحسابات غير مهيأة بعد.", "Accounts are not configured yet.")}</div>`);
  ov.onclick = async e => {
    if (e.target === ov || e.target.closest("[data-x]")) ov.remove();
    if (e.target.closest("[data-m]")) { mode = mode === "in" ? "up" : "in"; draw(); }
    if (e.target.closest("[data-g]") && sb) { const { error } = await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: base() } }); if (error) draw(`<div class="err">${esc(error.message)}</div>`); }
  };
  ov.onsubmit = async e => {
    e.preventDefault(); if (!sb) return; const f = new FormData(e.target), em = f.get("e"), pw = f.get("p");
    if (mode === "in") { const { error } = await sb.auth.signInWithPassword({ email: em, password: pw }); return error ? draw(`<div class="err">${L("بيانات الدخول غير صحيحة.", "Incorrect email or password.")}</div>`) : ov.remove(); }
    const { data, error } = await sb.auth.signUp({ email: em, password: pw, options: { data: { full_name: f.get("n") || "" }, emailRedirectTo: base() } });
    if (error) return draw(`<div class="err">${esc(error.message)}</div>`);
    data.session ? ov.remove() : draw(`<div class="mu">${L("أرسلنا رابط تأكيد إلى بريدك. افتحه لإكمال التسجيل.", "We sent a confirmation link to your email. Open it to finish signing up.")}</div>`);
  };
}
async function submitBrief(btn) {
  const svc = SERVICES[B.svc]; btn.disabled = true;
  try {
    const id = crypto.randomUUID(), files = [];
    for (const [fid, fl] of Object.entries(B.files)) for (const f of fl) {
      if (f.size > 10485760) throw new Error(L("حجم الملف يتجاوز 10MB: ", "File exceeds 10MB: ") + f.name);
      const path = `${USER.id}/${id}/${crypto.randomUUID()}.${(f.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "")}`;
      const { error } = await sb.storage.from("brief-files").upload(path, f, { contentType: f.type || "application/octet-stream" }); if (error) throw error;
      files.push({ name: f.name, path, field: fid });
    }
    const answers = svc.qs.filter(f => f.type !== "file" && B.ans[f.id]).map(f => ({ id: f.id, q: { ar: f.ar, en: f.en }, a: B.ans[f.id] }));
    const { error } = await sb.from("requests").insert({ id, user_id: USER.id, service: B.svc, lang, answers, files }); if (error) throw error;
    B.step = 3; render();
  } catch (e) { B.err = L("تعذّر إرسال الطلب: ", "Could not send the request: ") + (e.message || e); render(); }
}
document.addEventListener("click", async e => { const b = e.target.closest('[data-act="logout"]'); if (b) { await sb.auth.signOut(); location.hash = "#/home"; } });
document.addEventListener("submit", async e => { if (e.target.id !== "af") return; e.preventDefault(); const { error } = await sb.from("profiles").update({ full_name: new FormData(e.target).get("n").trim() }).eq("id", USER.id); $("#am").textContent = error ? error.message : L("تم الحفظ.", "Saved."); });
$("#lang").onclick = () => { lang = lang === "ar" ? "en" : "ar"; try { localStorage.setItem("lang", lang); } catch (e) {} render(); };
window.addEventListener("hashchange", render);
$("#yr").textContent = new Date().getFullYear();
if (sb) { let first = true, prev = null; sb.auth.onAuthStateChange((ev, session) => { const id = session?.user?.id || null; if (!first && id === prev) return; first = false; prev = id; USER = session?.user || null; if (USER) applyPending(); render(); }); } else render();
})();
