/* Website Editor (admin only). Edits page JSON (Home / Work / Brief / Contact + global images & social links).
   Security: UI only. Everything is written through Supabase and enforced by RLS (public.is_admin()); ctx.guard() re-verifies the
   session/admin role before every save, publish and upload. Drafts live in site_content_drafts (admin only); visitors only ever read
   site_content_published. Images are chosen locally, previewed immediately and uploaded to the admin-only "project-images" bucket
   (prefix site/) only when the draft is saved. */
(() => {
const { esc, SOCIALS, ICONS, socialHref, normalize, defaultPage, newSection, render: renderSec, ICON, bannerRatio, focusCss, uid, T } = SEC;
const KEYS = [["home", "الرئيسية"], ["work", "الأعمال"], ["brief", "Project Brief"], ["contact", "التواصل"], ["global", "الصور والتواصل"]];
const TYPES = { profile: "رأس الملف (Profile Header)", about: "نبذة عني (About Me)", skills: "المهارات والأدوات (Skills & Tools)", experience: "الخبرات (Experience)", education: "التعليم (Education)", services: "الخدمات (Services)", projects: "معرض المشاريع (Project Gallery)", gallery: "معرض صور (Image Gallery)", text: "قسم نصي (Text)", contact: "التواصل (Contact)", custom: "قسم محتوى مخصص (Custom)", core: "قسم أساسي" };
const MAXSEC = 60, DRAFT = "site-drafts";
/* Draft images live in the PRIVATE admin-only bucket "site-drafts" and are stored as "draft:<path>". Visitors can neither read that bucket
   nor render such a reference. Publishing copies them into the public bucket and rewrites the references to public URLs. */
const isRef = u => typeof u === "string" && u.startsWith("draft:");
const refsIn = o => [...new Set(J(o).match(/draft:[^"]+/g) || [])];
let ctx, root = null, S = null, tPrev = 0;
const clone = o => JSON.parse(JSON.stringify(o));
const J = o => JSON.stringify(o);
const ru = u => (isRef(u) ? (S.signed[u] || "") : u);
const resolveDeep = o => JSON.parse(J(o).replace(/draft:[^"]+/g, m => S.signed[m] || ""));
const getp = (o, p) => p.split(".").reduce((a, k) => (a == null ? a : a[k]), o);
function setp(o, p, v) { const a = p.split("."); while (a.length > 1) { const k = a.shift(); if (o[k] == null || typeof o[k] !== "object") o[k] = /^\d+$/.test(a[0]) ? [] : {}; o = o[k]; } o[a[0]] = v; }
const dflt = k => (k === "global" ? SEC.defaultGlobal(window.SITE) : defaultPage(k, window.SITE));
const isMissing = e => e && /does not exist|schema cache|relation .*site_content|42P01|PGRST205/i.test(e.message || "");

/* ---------- state ---------- */
async function load() {
  const [d, p] = await Promise.all([ctx.sb.from("site_content_drafts").select("key,content"), ctx.sb.from("site_content_published").select("key,content")]);
  if (d.error || p.error) { const e = d.error || p.error; return { missing: isMissing(e), error: e.message }; }
  const st = { key: S ? S.key : "home", signed: {}, tried: {}, showVer: false, vers: [], W: {}, saved: {}, pub: {}, hasPub: {}, sel: null, view: "d", plang: "ar", pend: {}, busy: false, big: false };
  const dm = Object.fromEntries((d.data || []).map(x => [x.key, x.content])), pm = Object.fromEntries((p.data || []).map(x => [x.key, x.content]));
  for (const [k] of KEYS) {
    st.hasPub[k] = !!pm[k]; st.pub[k] = J(normalize(k, pm[k], window.SITE));
    const base = normalize(k, dm[k] || pm[k], window.SITE); st.W[k] = clone(base); st.saved[k] = J(base);
  }
  return st;
}
const dirty = k => J(S.W[k]) !== S.saved[k];
const unpub = k => J(S.W[k]) !== (S.hasPub[k] ? S.pub[k] : J(dflt(k)));
const anyDirty = () => S && !S.missing && KEYS.some(([k]) => dirty(k));
const page = () => S.W[S.key];

/* ---------- messages ---------- */
function say(t, bad) { if (S) S.msg = { t, bad }; const el = root && root.querySelector("#we-msg"); if (el) { el.textContent = t; el.className = "we-msg " + (bad ? "we-bad" : "we-good"); } }
const friendly = e => { const m = String((e && e.message) || e || ""); return isMissing(e) ? "جداول Website Editor لم تُطبَّق على قاعدة البيانات بعد." : /row-level security|permission denied/i.test(m) ? "ليس لديك صلاحية الكتابة (للمدير المعتمد فقط)." : /check constraint/i.test(m) ? "المحتوى يتجاوز الحدود المسموحة (الحجم/عدد الأقسام)." : m; };

/* ---------- field helpers ---------- */
const val = (o, p) => { const v = getp(o, p); return v == null ? "" : v; };
const inp = (lab, p, o, a = {}) => `<label>${lab}<input data-p="${p}" value="${esc(val(o, p))}" ${a.type ? `type="${a.type}"` : ""} ${a.ph ? `placeholder="${esc(a.ph)}"` : ""} ${a.dir ? `dir="${a.dir}"` : ""} ${a.min != null ? `min="${a.min}" max="${a.max}"` : ""}></label>`;
const bi = (lab, p, o, ta) => `<div class="we-bi"><b>${lab}</b><div class="two">${["ar", "en"].map(l => `<label><small>${l === "ar" ? "العربية" : "English"}</small>${ta ? `<textarea data-p="${p}.${l}" dir="${l === "ar" ? "rtl" : "ltr"}">${esc(val(o, p + "." + l))}</textarea>` : `<input data-p="${p}.${l}" dir="${l === "ar" ? "rtl" : "ltr"}" value="${esc(val(o, p + "." + l))}">`}</label>`).join("")}</div></div>`;
const sel = (lab, p, o, opts) => `<label>${lab}<select data-p="${p}">${opts.map(([v, t]) => `<option value="${v}" ${String(val(o, p)) === String(v) ? "selected" : ""}>${t}</option>`).join("")}</select></label>`;
const chk = (lab, p, o, inv) => `<label class="we-chk"><input type="checkbox" data-p="${p}" ${inv ? "data-inv=1" : ""} ${(inv ? !getp(o, p) : getp(o, p)) ? "checked" : ""}> ${lab}</label>`;
const imgF = (lab, p, o, str) => { const u = ru(str ? val(o, p) : val(o, p + ".url")), d = !str && getp(o, p + ".w") ? `${getp(o, p + ".w")}×${getp(o, p + ".h")} px` : ""; return `<div class="we-img"><b>${lab}</b><div class="we-img-r">${SEC.safeImg(u) ? `<img src="${esc(SEC.safeImg(u))}" alt="">` : `<span class="we-noimg">لا توجد صورة</span>`}<div><input type="file" accept="image/jpeg,image/png,image/webp,image/gif" data-${str ? "ups" : "up"}="${p}" aria-label="${esc(lab)}">${d ? `<small class="mu">الأبعاد: ${d}</small>` : ""}${u ? `<button type="button" class="btn gh sm" data-act="img-clear" data-p="${p}" data-s="${str ? 1 : 0}">إزالة الصورة</button>` : ""}</div></div></div>`; };
const ICON_OPTS = [["", "— بدون —"], ...Object.keys(ICONS).map(k => [k, k])];

/* repeating items (add / delete / reorder / hide) */
const ITEM_NEW = {
  "skills.items": () => ({ id: uid(), name: T("", ""), icon: "", image: "", desc: T("", ""), category: "", hidden: false }),
  "experience.items": () => ({ id: uid(), title: T("", ""), org: T("", ""), start: "", end: "", present: false, desc: T("", ""), hidden: false }),
  "education.items": () => ({ id: uid(), title: T("", ""), org: T("", ""), start: "", end: "", present: false, desc: T("", ""), hidden: false }),
  "services.items": () => ({ id: uid(), title: T("", ""), desc: T("", ""), href: "#/brief", icon: "" }),
  "gallery.images": () => ({ id: uid(), url: "", w: 0, h: 0, caption: T("", ""), hidden: false }),
  "custom.buttons": () => ({ id: uid(), label: T("", ""), href: "", style: "or" }), "contact.buttons": () => ({ id: uid(), label: T("", ""), href: "", style: "or" }), "profile.buttons": () => ({ id: uid(), label: T("", ""), href: "", style: "or" })
};
function items(s, list, label, row, o = {}) {
  const arr = s.data[list] || [], base = `d.${list}`;
  return `<div class="we-items"><div class="we-items-h"><b>${label}</b><button type="button" class="btn sm" data-act="item-add" data-l="${list}">+ إضافة</button></div>
  ${arr.length ? arr.map((x, i) => `<div class="we-item ${x.hidden ? "off" : ""}" data-i="${i}"><div class="we-item-h"><span class="mu">#${i + 1}</span><span class="grow"></span>
    <button type="button" class="btn gh sm" data-act="item-up" data-l="${list}" data-i="${i}" ${i ? "" : "disabled"} aria-label="أعلى">↑</button><button type="button" class="btn gh sm" data-act="item-dn" data-l="${list}" data-i="${i}" ${i < arr.length - 1 ? "" : "disabled"} aria-label="أسفل">↓</button>
    ${o.nohide ? "" : `<button type="button" class="btn gh sm" data-act="item-hide" data-l="${list}" data-i="${i}">${x.hidden ? "إظهار" : "إخفاء"}</button>`}<button type="button" class="btn gh sm dng" data-act="item-del" data-l="${list}" data-i="${i}">حذف</button></div>
    <div class="we-item-b">${row(x, `${base}.${i}`)}</div></div>`).join("") : `<div class="mu we-empty">لا توجد عناصر بعد. القسم لن يظهر للزوار وهو فارغ.</div>`}</div>`;
}

function form(s) {
  const R = { d: s.data };     /* paths below are "d.<field>" relative to {d: data} */
  const t = (l, p) => bi(l, "d." + p, R), I = (l, p, a) => inp(l, "d." + p, R, a), SL = (l, p, o) => sel(l, "d." + p, R, o);
  const bt = list => items(s, list, "الأزرار", (x, b) => `${bi("نص الزر", b + ".label", R)}${inp("الرابط (#/work أو https://…)", b + ".href", R, { dir: "ltr" })}${sel("الشكل", b + ".style", R, [["or", "برتقالي"], ["gh", "بحدود"]])}`, { nohide: 1 });
  switch (s.type) {
    case "profile": return `${t("الاسم", "name")}${t("العنوان الوظيفي", "headline")}${t("الموقع", "location")}${bt("buttons")}<p class="mu">البانر والشعار والصورة الشخصية من تبويب «الصور والتواصل».</p>`;
    case "about": return `${t("العنوان", "title")}${bi("النص (افصل الفقرات بسطر فارغ؛ الأولى تظهر بخط أكبر)", "d.body", R, 1)}`;
    case "skills": return `${t("العنوان", "title")}${items(s, "items", "المهارات والأدوات", (x, b) => `${bi("الاسم", b + ".name", R)}${sel("الأيقونة", b + ".icon", R, ICON_OPTS)}${imgF("أو صورة بدل الأيقونة", b + ".image", R, 1)}${inp("التصنيف (اختياري)", b + ".category", R)}${bi("وصف (اختياري)", b + ".desc", R)}`)}`;
    case "experience": case "education": return `${t("العنوان", "title")}${items(s, "items", s.type === "experience" ? "الخبرات" : "التعليم", (x, b) => `${bi(s.type === "experience" ? "المسمى الوظيفي" : "الشهادة / التخصص", b + ".title", R)}${bi(s.type === "experience" ? "الشركة / المؤسسة" : "المؤسسة التعليمية", b + ".org", R)}<div class="two">${inp("البداية", b + ".start", R, { ph: "2022" })}${inp("النهاية", b + ".end", R, { ph: "2024" })}</div>${chk("حتى الآن", b + ".present", R)}${bi("التفاصيل", b + ".desc", R, 1)}`)}`;
    case "services": return `${t("العنوان", "title")}${items(s, "items", "الخدمات", (x, b) => `${bi("اسم الخدمة", b + ".title", R)}${bi("وصف (اختياري)", b + ".desc", R)}${inp("الرابط", b + ".href", R, { dir: "ltr" })}${sel("الأيقونة", b + ".icon", R, ICON_OPTS)}`, { nohide: 1 })}`;
    case "projects": return `${t("العنوان", "title")}<div class="two">${I("عدد المشاريع المعروضة", "limit", { type: "number", min: 1, max: 24 })}${SL("التصنيف", "category", [["all", "الكل"], ["graphic", "Graphic Design"], ["web", "Website Development"]])}</div>${chk("إظهار زر «عرض كل الأعمال»", "d.showAll", R)}<p class="mu">تُعرض المشاريع المنشورة فقط، وتُدار من تبويب «الأعمال».</p>`;
    case "gallery": return `${t("العنوان", "title")}${SL("عدد الأعمدة", "cols", [[1, "1"], [2, "2"], [3, "3"], [4, "4"]])}${items(s, "images", "الصور", (x, b) => `${imgF("الصورة", b, R)}${bi("وصف (اختياري)", b + ".caption", R)}`)}`;
    case "text": return `${t("العنوان", "title")}${bi("النص", "d.body", R, 1)}`;
    case "contact": return `${t("العنوان", "title")}${bt("buttons")}<p class="mu">روابط التواصل (Facebook / Instagram / WhatsApp / Email / Behance) من تبويب «الصور والتواصل».</p>`;
    case "custom": return `${t("العنوان", "title")}${bi("النص", "d.body", R, 1)}${imgF("صورة (اختياري)", "d.image", R)}${SL("موضع الصورة", "imageSide", [["start", "البداية"], ["end", "النهاية"]])}${bt("buttons")}`;
    case "core": return `<p class="mu">قسم أساسي يحافظ على وظيفة الصفحة (لا يُحذف ولا يُخفى). يمكنك تغيير عنوانه ووصفه وإضافة أقسام قبله أو بعده.</p>${t("العنوان", "title")}${bi("وصف (اختياري)", "d.desc", R, 1)}`;
  }
  return "";
}
/* the editor binds paths as "d.<x>"; sections store data in s.data, so translate on read/write */
const secPath = p => p.replace(/^d\./, "data.");

/* ---------- global (banner / logo / photo / social links) ---------- */
function cropBox(b, w, m) {
  const r = bannerRatio(b), u = SEC.safeImg(ru(b.url));
  return `<div class="we-crop" style="--cr:${m ? r.m : r.d};${m ? "width:min(100%,220px)" : ""}" data-crop="${m ? "m" : "d"}">${u ? `<img src="${esc(u)}" style="${focusCss(b.focus)}" alt="" draggable="false">` : ""}</div>`;
}
function globalForm() {
  const g = page(), A = g.assets, b = A.banner, lg = A.logo, av = A.avatar, R = g;
  const dims = o => o && o.w ? `${o.w}×${o.h} px` : "غير معروفة (الملف الافتراضي)";
  const ass = (k, title, rec, extra) => `<div class="we-card"><h3>${title}</h3><p class="mu">${rec}</p><p>الأبعاد الحالية: <b dir="ltr" data-dim="${k}">${dims(A[k])}</b></p>${imgF("اختر ملفًا جديدًا (معاينة قبل الحفظ)", `assets.${k}`, R)}${extra || ""}</div>`;
  const slid = (lab, p, mn, mx, st) => `<label>${lab}<input type="range" data-p="${p}" data-num="1" min="${mn}" max="${mx}" step="${st}" value="${val(R, p) === "" ? mn : val(R, p)}"></label>`;
  return `<div class="we-card"><h3>البانر (Banner)</h3><p class="mu">المقاس الموصى به: <b dir="ltr">1920×480 px</b> (نسبة 4:1) أو أكبر بنفس النسبة. الأنواع: JPEG / PNG / WebP حتى 8MB (تُحسَّن تلقائيًا دون تغيير النسبة). اترك النسبة «تلقائي» لعرض الصورة كاملة.</p>
    <p>الأبعاد الحالية: <b dir="ltr" data-dim="banner">${dims(b)}</b></p>${imgF("ملف البانر (معاينة قبل الحفظ)", "assets.banner", R)}
    <div class="two">${sel("نسبة العرض", "assets.banner.ratio", R, [["auto", "تلقائي (الصورة كاملة)"], ["4/1", "4:1"], ["3/1", "3:1"], ["2/1", "2:1"]])}${slid("التكبير (Zoom)", "assets.banner.focus.zoom", 1, 3, 0.05)}</div>
    <div class="two">${slid("الموضع الأفقي", "assets.banner.focus.x", 0, 100, 1)}${slid("الموضع الرأسي", "assets.banner.focus.y", 0, 100, 1)}</div>
    <div class="we-crops"><div><small class="mu">Desktop — اسحب الصورة لضبط الموضع</small><div id="crop-d">${cropBox(b)}</div></div><div><small class="mu">Mobile</small><div id="crop-m">${cropBox(b, 0, 1)}</div></div></div></div>
  ${ass("logo", "شعار O.E", "يُعرض كاملًا بنسبته الأصلية دون قص أو إطار دائري. الملف الأصلي SVG محفوظ؛ لاستبداله ارفع PNG/WebP بخلفية شفافة (SVG غير مسموح في التخزين الحالي).", `<button type="button" class="btn gh sm" data-act="logo-reset">استعادة الشعار الأصلي</button>`)}
  ${ass("avatar", "الصورة الشخصية (اختيارية)", "صورة مستقلة تظهر بجوار الشعار في رأس الصفحة (مربعة تقريبًا، 800×800 px أو أكبر). لا تظهر إلا إذا رفعت صورة.", `<div class="two">${slid("الموضع الأفقي", "assets.avatar.focus.x", 0, 100, 1)}${slid("الموضع الرأسي", "assets.avatar.focus.y", 0, 100, 1)}</div>`)}
  <div class="we-card"><h3>وسائل التواصل</h3><p class="mu">تظهر في قسم التواصل بالرئيسية وفي صفحة Contact. لا تُعرض أي وسيلة بدون رابط صالح أو مخفية. روابط Facebook/Instagram/Behance يجب أن تكون https على الموقع الرسمي. لم أضف رابط Behance: أدخله بنفسك.</p>
    <div class="we-soc">${SOCIALS.map(([k, n]) => { const l = g.links[k] || {}, ok = !!socialHref(k, l.url); return `<div class="we-soc-r"><span class="we-ic">${ICON[k]}</span><b>${n}</b><input data-p="links.${k}.url" dir="ltr" value="${esc(l.url || "")}" placeholder="${k === "email" ? "name@example.com" : k === "whatsapp" ? "https://wa.me/20… أو رقم" : k === "behance" ? "https://www.behance.net/username" : "https://…"}" aria-label="${n}"><label class="we-chk"><input type="checkbox" data-p="links.${k}.visible" ${l.visible === false ? "" : "checked"}> إظهار</label><span class="we-v ${ok ? "good" : ""}" data-v="${k}">${!String(l.url || "").trim() ? "فارغ — لن يظهر" : ok ? "رابط صالح ✓" : "رابط غير صالح — لن يظهر"}</span></div>`; }).join("")}</div></div>`;
}

/* ---------- preview ---------- */
function previewHtml(k) {
  const pk = k === "global" ? "home" : k, lang = S.plang, Lf = (a, e) => (lang === "ar" ? a : e), Pf = o => (o && (o[lang] || o.en || o.ar)) || "";
  const g = normalize("global", resolveDeep(S.W.global), window.SITE), pg = normalize(pk, resolveDeep(S.W[pk]), window.SITE);
  const ph = `<div class="grid wk uni">${[1, 2, 3].map(i => `<article class="card pc"><div class="cv"><span class="no">0${i}</span></div><div class="p"><b>${Lf("مشروع منشور", "Published project")}</b></div></article>`).join("")}</div>`;
  const ctx2 = { L: Lf, P: Pf, projectsReady: () => true, projectList: () => [1], projects: () => ph,
    core: (n, d) => `<div class="wrap"><h2>${esc(Pf(d.title) || ({ work: Lf("الأعمال", "Work"), brief: "Project Brief", contact: Lf("تواصل معي", "Contact") }[n]))}</h2>${Pf(d.desc) ? `<p class="mu">${esc(Pf(d.desc))}</p>` : ""}${n === "contact" ? SEC.socHtml(SEC.socialLinks(g)) : ""}<div class="empty">${Lf("المحتوى الوظيفي للصفحة (" + n + ") يظهر هنا", "Functional " + n + " content appears here")}</div></div>` };
  return `<!doctype html><html lang="${lang}" dir="${lang === "ar" ? "rtl" : "ltr"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base href="${esc(location.href.replace(/[^/]*$/, ""))}"><link rel="stylesheet" href="style.css"><link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;800&family=Outfit:wght@400;600;800&display=swap" rel="stylesheet"><style>main{animation:none}</style></head><body><main>${renderSec(pk, pg, g, ctx2)}</main></body></html>`;
}
function fit() {
  const box = root && root.querySelector("#we-pv"); if (!box) return;
  const w = S.view === "m" ? 390 : 1200, host = box.parentElement, k = Math.min(1, (host.clientWidth - 2) / w), h = S.big ? Math.max(500, innerHeight - 140) : 640;
  box.style.cssText = `width:${w}px;height:${h}px;transform:scale(${k});transform-origin:${document.documentElement.dir === "rtl" ? "top right" : "top left"}`;
  host.style.height = Math.round(h * k) + 2 + "px";
}
function preview() { const f = root && root.querySelector("#we-pv"); if (!f) return; f.srcdoc = previewHtml(S.key); fit(); }
const prevSoon = () => { clearTimeout(tPrev); tPrev = setTimeout(preview, 220); };

/* signed (1h) preview URLs for draft images; never public */
function signMissing() {
  if (!S || S.missing || S.fail) return;
  const need = KEYS.flatMap(([k]) => refsIn(S.W[k])).filter((r, i, a) => a.indexOf(r) === i && !S.signed[r] && !S.tried[r]);
  if (!need.length) return;
  need.forEach(r => { S.tried[r] = 1; });
  Promise.all(need.map(async r => { try { const { data } = await ctx.sb.storage.from(DRAFT).createSignedUrl(r.slice(6), 3600); if (data && data.signedUrl) S.signed[r] = data.signedUrl; } catch (e) {} })).then(() => { if (S && root) mount(); });
}
/* ---------- drawing ---------- */
function bar() {
  return `<div class="we-bar"><div class="we-tabs" role="tablist">${KEYS.map(([k, n]) => `<button type="button" role="tab" class="btn gh sm ${S.key === k ? "on" : ""}" data-key="${k}" aria-selected="${S.key === k}">${n}${dirty(k) ? ' <i class="we-dot" title="تعديلات غير محفوظة"></i>' : unpub(k) ? ' <i class="we-dot pub" title="غير منشور"></i>' : ""}</button>`).join("")}</div>
  <div class="we-act"><span id="we-state" class="mu">${stateText()}</span><button type="button" class="btn gh sm" data-act="revert">استعادة آخر نسخة منشورة</button><button type="button" class="btn gh sm" data-act="versions">الإصدارات السابقة</button><button type="button" class="btn gh sm dng" data-act="unpublish" ${S.hasPub[S.key] && !S.busy ? "" : "disabled"}>إلغاء النشر</button><button type="button" class="btn sm" data-act="save" ${S.busy ? "disabled" : ""}>حفظ مسودة</button><button type="button" class="btn or sm" data-act="publish" ${S.busy ? "disabled" : ""}>نشر</button></div></div>`;
}
const stateText = () => dirty(S.key) ? "تعديلات غير محفوظة" : unpub(S.key) ? "مسودة محفوظة — غير منشورة (لا يراها الزوار)" : "منشور ✓";
function list() {
  const p = page();
  return `<div class="we-list"><div class="we-lh"><b>الأقسام</b><span class="mu">${p.sections.length}/${MAXSEC}</span></div>
  <div class="we-add"><select id="we-addt" aria-label="نوع القسم">${Object.entries(TYPES).filter(([k]) => k !== "core").map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select><button type="button" class="btn sm" data-act="add">+ إضافة قسم</button></div>
  <div class="we-ss">  ${p.sections.map((s, i) => `<div class="we-s ${S.sel === s.id ? "sel" : ""} ${s.hidden ? "off" : ""}" draggable="true" data-sid="${esc(s.id)}" data-i="${i}"><span class="we-grip" aria-hidden="true">⠿</span><button type="button" class="we-sn" data-act="select" data-sid="${esc(s.id)}"><b>${esc(secTitle(s))}</b><small class="mu">${TYPES[s.type]}${s.hidden ? " · مخفي" : ""}</small></button>
    <div class="we-sb"><button type="button" class="btn gh sm" data-act="up" data-i="${i}" ${i ? "" : "disabled"} aria-label="أعلى">↑</button><button type="button" class="btn gh sm" data-act="dn" data-i="${i}" ${i < p.sections.length - 1 ? "" : "disabled"} aria-label="أسفل">↓</button>
    <button type="button" class="btn gh sm" data-act="hide" data-i="${i}" ${s.type === "core" ? "disabled" : ""}>${s.hidden ? "إظهار" : "إخفاء"}</button><button type="button" class="btn gh sm" data-act="dup" data-i="${i}" ${s.type === "core" ? "disabled" : ""}>تكرار</button><button type="button" class="btn gh sm dng" data-act="del" data-i="${i}" ${s.type === "core" ? "disabled" : ""}>حذف</button></div></div>`).join("")}
  </div></div>`;
}
const secTitle = s => { const d = s.data || {}, t = d.title || (d.name); return (t && (t.ar || t.en)) || TYPES[s.type]; };
function editor() {
  if (S.key === "global") return globalForm();
  const s = page().sections.find(x => x.id === S.sel);
  return s ? `<div class="we-card" data-ed="${esc(s.id)}"><h3>${TYPES[s.type]}</h3>${form(s)}</div>` : `<div class="empty">اختر قسمًا من القائمة لتعديله، أو أضف قسمًا جديدًا.</div>`;
}
function mount() {
  if (S.missing) { root.innerHTML = `<div class="panel"><h2>Website Editor</h2><p>جداول المحرر لم تُطبَّق على Supabase بعد. الموقع يعمل حاليًا بالمحتوى الافتراضي.</p><p class="mu">الملف الجاهز للمراجعة: <code dir="ltr">supabase/migrations/20261117_website_editor.sql</code> — لم يُطبَّق.</p>${S.error ? `<div class="err">${esc(S.error)}</div>` : ""}</div>`; return; }
  if (S.fail) { root.innerHTML = `<div class="panel"><h2>Website Editor</h2><div class="err">تعذّر تحميل المحتوى: ${esc(S.error)}</div><div class="row"><button class="btn" data-act="reload">إعادة المحاولة</button></div></div>`; return; }
  root.innerHTML = `<div class="we"><h2 class="we-h">Website Editor</h2>${bar()}<div id="we-msg" class="we-msg" role="status"></div>${verPanel()}
  <div class="we-grid ${S.key === "global" ? "g" : ""}"><div class="we-l">${S.key === "global" ? "" : list()}<div id="we-e">${editor()}</div></div>
  <div class="we-p"><div class="we-ph"><div class="seg"><button type="button" class="btn gh sm ${S.view === "d" ? "on" : ""}" data-view="d">Desktop</button><button type="button" class="btn gh sm ${S.view === "m" ? "on" : ""}" data-view="m">Mobile</button></div><div class="seg"><button type="button" class="btn gh sm ${S.plang === "ar" ? "on" : ""}" data-pl="ar">AR</button><button type="button" class="btn gh sm ${S.plang === "en" ? "on" : ""}" data-pl="en">EN</button><button type="button" class="btn gh sm" data-act="big">${S.big ? "تصغير" : "تكبير"}</button></div></div>
  <div class="we-fr"><iframe id="we-pv" title="معاينة" sandbox="allow-same-origin"></iframe></div><small class="mu">المعاينة تعرض ما سيراه الزوار بعد النشر، بعرض الشاشة الفعلي (media queries حقيقية).</small></div></div></div>`;
  root.querySelector(".we").classList.toggle("big", S.big); if (S.msg) say(S.msg.t, S.msg.bad); preview(); signMissing();
}
const verPanel = () => !S.showVer ? "" : `<div class="we-card we-ver"><h3>الإصدارات السابقة — ${esc((KEYS.find(x => x[0] === S.key) || [])[1])}</h3><p class="mu">تُحفظ نسخة تلقائيًا قبل كل نشر وقبل إلغاء النشر (للقراءة والإضافة فقط). الاستعادة تضع الإصدار في المسودة ولا تغيّر الموقع قبل أن تنشر.</p>${S.vers.length ? S.vers.map(v => `<div class="we-vr"><span dir="ltr">${esc(new Date(v.created_at).toLocaleString("ar-EG"))}</span><span class="mu">${esc(v.note || "")}</span><button type="button" class="btn gh sm" data-act="ver-restore" data-id="${esc(v.id)}">استعادة في المسودة</button></div>`).join("") : `<div class="mu we-empty">لا توجد إصدارات سابقة لهذه الصفحة بعد.</div>`}</div>`;
async function loadVersions() { const r = await ctx.sb.from("site_content_versions").select("id,created_at,note").eq("key", S.key).order("created_at", { ascending: false }).limit(30); if (r.error) { say("تعذّر تحميل الإصدارات: " + friendly(r.error), 1); S.vers = []; } else S.vers = r.data || []; }
const redrawBar = () => { const b = root.querySelector(".we-bar"); if (b) b.outerHTML = bar(); };

/* ---------- actions ---------- */
const sec = id => page().sections.find(x => x.id === id);
function deepNewIds(o) { if (Array.isArray(o)) o.forEach(deepNewIds); else if (o && typeof o === "object") { if (typeof o.id === "string") o.id = uid(); Object.values(o).forEach(deepNewIds); } return o; }
function listAct(a, b) {
  const s = sec(S.sel); if (!s) return; const l = b.dataset.l, i = +b.dataset.i; s.data[l] = s.data[l] || [];
  const arr = s.data[l];
  if (a === "item-add") { const f = ITEM_NEW[s.type + "." + l]; if (f) arr.push(f()); }
  if (a === "item-del" && confirm("حذف هذا العنصر؟")) arr.splice(i, 1);
  if (a === "item-up" && i > 0) [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]];
  if (a === "item-dn" && i < arr.length - 1) [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]];
  if (a === "item-hide") arr[i].hidden = !arr[i].hidden;
  root.querySelector("#we-e").innerHTML = editor(); redrawBar(); preview();
}
function secAct(a, b) {
  const p = page(), i = +b.dataset.i, arr = p.sections, s = arr[i];
  if (a === "add") {
    const type = root.querySelector("#we-addt").value;
    if (arr.length >= MAXSEC) return say("الحد الأقصى " + MAXSEC + " قسمًا.", 1);
    if (type === "profile" && arr.some(x => x.type === "profile")) return say("يوجد قسم Profile Header بالفعل في هذه الصفحة.", 1);
    const n = newSection(type); arr.push(n); S.sel = n.id; say("تمت إضافة القسم — عدّل محتواه ثم احفظ المسودة.");
  }
  if (a === "del") { if (!s || s.type === "core") return; if (!confirm("حذف القسم «" + secTitle(s) + "»؟ (لن يُحذف شيء من الموقع قبل النشر)")) return; arr.splice(i, 1); if (S.sel === s.id) S.sel = null; say("تم حذف القسم من المسودة."); }
  if (a === "hide" && s && s.type !== "core") { s.hidden = !s.hidden; say(s.hidden ? "القسم مخفي." : "القسم ظاهر."); }
  if (a === "dup" && s && s.type !== "core") { if (arr.length >= MAXSEC) return say("الحد الأقصى " + MAXSEC + " قسمًا.", 1); if (s.type === "profile") return say("لا يمكن تكرار Profile Header.", 1); const c = deepNewIds(clone(s)); arr.splice(i + 1, 0, c); S.sel = c.id; say("تم تكرار القسم."); }
  if (a === "up" && i > 0) [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]];
  if (a === "dn" && i < arr.length - 1) [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]];
  if (a === "select") S.sel = b.dataset.sid;
  mount();
}
function moveTo(from, to) { const arr = page().sections; if (from === to || from < 0 || to < 0 || to >= arr.length) return; const [x] = arr.splice(from, 1); arr.splice(to, 0, x); mount(); say("تم تغيير الترتيب."); }

/* images: local preview now, upload at save */
async function pickImage(input) {
  const f = input.files && input.files[0]; if (!f) return; const str = input.dataset.ups != null, path = str ? input.dataset.ups : input.dataset.up;
  let p; try { p = await Builder.prepare(f); } catch (e) { input.value = ""; return say(e.message || String(e), 1); }
  const blob = URL.createObjectURL(p.file); S.pend[blob] = p;
  const tgt = secOrGlobal(path); if (!tgt) return;
  if (str) setp(tgt.o, tgt.p, blob); else { const cur = getp(tgt.o, tgt.p) || {}; setp(tgt.o, tgt.p, { ...cur, url: blob, w: p.w, h: p.h }); }
  say(`تم اختيار الصورة (${p.w}×${p.h} px). هذه معاينة فقط — اضغط «حفظ مسودة» لرفعها.`);
  if (S.key === "global") { root.querySelector("#we-e").innerHTML = editor(); } else root.querySelector("#we-e").innerHTML = editor();
  redrawBar(); preview();
}
function secOrGlobal(path) {
  if (S.key === "global") return { o: page(), p: path };
  const s = sec(S.sel); return s ? { o: s, p: secPath(path) } : null;
}
async function uploadPending() {
  const str = J(S.W[S.key]), blobs = [...new Set(str.match(/blob:[^"]+/g) || [])];
  if (!blobs.length) return true;
  let out = str;
  for (const u of blobs) {
    const p = S.pend[u]; if (!p) { say("تعذّر العثور على ملف الصورة المحلي؛ اخترها مرة أخرى.", 1); return false; }
    try { const r = await Builder.uploadPrepared(ctx, p, DRAFT); out = out.split(u).join("draft:" + r.path); } catch (e) { say("فشل رفع الصورة: " + friendly(e), 1); return false; }
  }
  S.W[S.key] = JSON.parse(out); blobs.forEach(u => { try { URL.revokeObjectURL(u); } catch (e) {} delete S.pend[u]; });
  return true;
}
async function saveDraft(quiet) {
  if (S.busy) return false; if (!await ctx.guard()) return false;
  S.busy = true; redrawBar(); const k = S.key;
  try {
    if (!await uploadPending()) return false;
    const content = S.W[k], { error } = await ctx.sb.from("site_content_drafts").upsert({ key: k, content }, { onConflict: "key" });
    if (error) { say("تعذّر حفظ المسودة: " + friendly(error), 1); return false; }
    S.saved[k] = J(content); if (!quiet) say("تم حفظ المسودة. لا يراها الزوار قبل النشر."); return true;
  } finally { S.busy = false; mount(); }
}
async function snapshot(k, note) {   /* keep the currently published copy before it is replaced/removed; abort the caller on failure */
  const cur = await ctx.sb.from("site_content_published").select("content").eq("key", k);
  if (cur.error) return cur.error;
  if (cur.data && cur.data[0]) { const v = await ctx.sb.from("site_content_versions").insert({ key: k, content: cur.data[0].content, note }); if (v.error) return v.error; }
  return null;
}
async function publish() {
  if (!confirm("نشر هذه الصفحة للزوار الآن؟ (تُحفظ نسخة من المنشور الحالي أولًا)")) return;
  if (!await saveDraft(true)) return;
  if (!await ctx.guard()) return; const k = S.key; S.busy = true; redrawBar();
  try {
    let str = J(S.W[k]);
    for (const r of refsIn(S.W[k])) {   /* promote draft images to the public bucket (copy: the draft copy is kept) */
      const path = r.slice(6), { error } = await ctx.sb.storage.from(DRAFT).copy(path, path, { destinationBucket: Builder.BUCKET });
      if (error && !/already exists|duplicate/i.test(error.message || "")) return say("تعذّر نشر إحدى الصور — لم يتم النشر: " + friendly(error), 1);
      str = str.split(r).join(ctx.sb.storage.from(Builder.BUCKET).getPublicUrl(path).data.publicUrl);
    }
    const content = JSON.parse(str), se = await snapshot(k, "قبل النشر");
    if (se) return say("تعذّر حفظ نسخة من المنشور الحالي — لم يتم النشر: " + friendly(se), 1);
    const { error } = await ctx.sb.from("site_content_published").upsert({ key: k, content, published_at: new Date().toISOString() }, { onConflict: "key" });
    if (error) return say("تعذّر النشر: " + friendly(error), 1);
    S.W[k] = content; S.hasPub[k] = true; S.pub[k] = J(content);
    const d = await ctx.sb.from("site_content_drafts").upsert({ key: k, content }, { onConflict: "key" }); if (!d.error) S.saved[k] = J(content);
    if (S.showVer) await loadVersions();
    say("تم النشر ✓ — التعديلات ظاهرة الآن للزوار.");
  } finally { S.busy = false; mount(); }
}
async function unpublish() {
  const k = S.key; if (!S.hasPub[k]) return;
  if (!confirm("إلغاء نشر هذه الصفحة؟ سيعود الموقع للمحتوى الافتراضي لها. تُحفظ نسخة من المنشور الحالي، وتبقى المسودة والمشاريع كما هي.")) return;
  if (!await ctx.guard()) return; S.busy = true; redrawBar();
  try {
    const se = await snapshot(k, "قبل إلغاء النشر"); if (se) return say("تعذّر حفظ نسخة من المنشور الحالي — لم يُلغَ النشر: " + friendly(se), 1);
    const { error } = await ctx.sb.from("site_content_published").delete().eq("key", k); if (error) return say("تعذّر إلغاء النشر: " + friendly(error), 1);
    S.hasPub[k] = false; S.pub[k] = J(dflt(k)); if (S.showVer) await loadVersions();
    say("تم إلغاء النشر — الموقع يعرض المحتوى الافتراضي لهذه الصفحة. المسودة محفوظة ويمكنك نشرها لاحقًا.");
  } finally { S.busy = false; mount(); }
}
async function restoreVersion(id) {
  const r = await ctx.sb.from("site_content_versions").select("content").eq("id", id);
  if (r.error || !r.data || !r.data[0]) return say("تعذّر تحميل الإصدار.", 1);
  S.W[S.key] = clone(normalize(S.key, r.data[0].content, window.SITE)); S.sel = null; mount(); say("تم تحميل الإصدار في المسودة (غير محفوظ). راجعه ثم احفظ أو انشر.");
}

/* ---------- events ---------- */
function bind() {
  root.onclick = async e => {
    const b = e.target.closest("[data-act],[data-key],[data-view],[data-pl]"); if (!b) return;
    if (b.dataset.key) { S.key = b.dataset.key; S.sel = null; if (S.key !== "global") { const p = page().sections; S.sel = (p.find(x => x.type !== "core") || p[0] || {}).id || null; } return mount(); }
    if (b.dataset.view) { S.view = b.dataset.view; root.querySelectorAll("[data-view]").forEach(x => x.classList.toggle("on", x === b)); return fit(); }
    if (b.dataset.pl) { S.plang = b.dataset.pl; root.querySelectorAll("[data-pl]").forEach(x => x.classList.toggle("on", x === b)); return preview(); }
    const a = b.dataset.act;
    if (["add", "del", "hide", "dup", "up", "dn", "select"].includes(a)) return secAct(a, b);
    if (a.startsWith("item-")) return listAct(a, b);
    if (a === "save") return saveDraft();
    if (a === "unpublish") return unpublish();
    if (a === "versions") { S.showVer = !S.showVer; if (S.showVer) await loadVersions(); return mount(); }
    if (a === "ver-restore") return restoreVersion(b.dataset.id);
    if (a === "publish") return publish();
    if (a === "reload") { await open(ctx); return; }
    if (a === "big") { S.big = !S.big; root.querySelector(".we").classList.toggle("big", S.big); b.textContent = S.big ? "تصغير" : "تكبير"; return fit(); }
    if (a === "revert") { if (!confirm("تجاهل التعديلات الحالية واستعادة آخر نسخة منشورة؟")) return; S.W[S.key] = JSON.parse(S.hasPub[S.key] ? S.pub[S.key] : J(dflt(S.key))); S.sel = null; mount(); return say("تمت استعادة آخر نسخة منشورة في المحرر (لم يُحفظ بعد)."); }
    if (a === "img-clear") { const tgt = secOrGlobal(b.dataset.p); if (!tgt) return; if (b.dataset.s === "1") setp(tgt.o, tgt.p, ""); else setp(tgt.o, tgt.p, { url: "", w: 0, h: 0 }); root.querySelector("#we-e").innerHTML = editor(); redrawBar(); return preview(); }
    if (a === "logo-reset") { page().assets.logo = { url: "assets/logo.svg" }; root.querySelector("#we-e").innerHTML = editor(); redrawBar(); preview(); return say("تمت استعادة الشعار الأصلي في المسودة."); }
  };
  const field = e => {
    const t = e.target;
    if (t.dataset.up != null || t.dataset.ups != null) return;
    const p = t.dataset.p; if (!p) return;
    const tgt = S.key === "global" ? { o: page(), p } : (() => { const s = sec(S.sel); return s ? { o: s, p: secPath(p) } : null; })(); if (!tgt) return;
    let v = t.type === "checkbox" ? (t.dataset.inv ? !t.checked : t.checked) : t.dataset.num || t.type === "number" ? Number(t.value) : t.value;
    setp(tgt.o, tgt.p, v);
    if (S.key === "global") { cropRefresh(); const m = p.match(/^links\.(\w+)\.url$/); if (m) { const el = root.querySelector(`[data-v="${m[1]}"]`), ok = !!socialHref(m[1], t.value); el.textContent = !t.value.trim() ? "فارغ — لن يظهر" : ok ? "رابط صالح ✓" : "رابط غير صالح — لن يظهر"; el.classList.toggle("good", ok); } }
    if (p.endsWith(".title.ar") || p.endsWith(".title.en") || p.endsWith(".name.ar")) { const row = root.querySelector(`.we-s[data-sid="${S.sel}"] .we-sn b`), s = sec(S.sel); if (row && s) row.textContent = secTitle(s); }
    redrawBar(); prevSoon();
  };
  root.oninput = field; root.onchange = e => { if (e.target.type === "file") pickImage(e.target); else if (e.target.tagName === "SELECT" || e.target.type === "checkbox") field(e); };
  /* drag & drop: section reorder */
  let from = -1;
  root.ondragstart = e => { const r = e.target.closest && e.target.closest(".we-s"); if (!r) return; from = +r.dataset.i; e.dataTransfer.effectAllowed = "move"; try { e.dataTransfer.setData("text/plain", String(from)); } catch (x) {} r.classList.add("drag"); };
  root.ondragover = e => { if (from >= 0 && e.target.closest(".we-s")) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; } };
  root.ondrop = e => { const r = e.target.closest(".we-s"); if (from >= 0 && r) { e.preventDefault(); const f = from; from = -1; moveTo(f, +r.dataset.i); } };
  root.ondragend = () => { from = -1; root.querySelectorAll(".we-s.drag").forEach(x => x.classList.remove("drag")); };
  /* banner crop: drag the image inside the preview to set the focus point */
  let dr = null;
  root.onpointerdown = e => { const c = e.target.closest("[data-crop=d]"); if (!c || S.key !== "global") return; const f = page().assets.banner.focus; dr = { x: e.clientX, y: e.clientY, fx: +f.x, fy: +f.y, w: c.clientWidth, h: c.clientHeight }; c.setPointerCapture && c.setPointerCapture(e.pointerId); };
  root.onpointermove = e => { if (!dr) return; const f = page().assets.banner.focus, z = Math.max(1, +f.zoom || 1); f.x = Math.round(Math.min(100, Math.max(0, dr.fx - (e.clientX - dr.x) / dr.w * 100 / z))); f.y = Math.round(Math.min(100, Math.max(0, dr.fy - (e.clientY - dr.y) / dr.h * 100 / z))); root.querySelectorAll('[data-p="assets.banner.focus.x"]').forEach(i => i.value = f.x); root.querySelectorAll('[data-p="assets.banner.focus.y"]').forEach(i => i.value = f.y); cropRefresh(); redrawBar(); prevSoon(); };
  root.onpointerup = () => { dr = null; };
}
window.addEventListener("resize", () => { if (S && root) fit(); });
function cropRefresh() { const b = page().assets.banner; const d = root.querySelector("#crop-d"), m = root.querySelector("#crop-m"); if (d) d.innerHTML = cropBox(b); if (m) m.innerHTML = cropBox(b, 0, 1); }

async function open(c, note) {
  ctx = c; if (!await c.guard()) return;
  c.app.classList.add("wide"); c.app.innerHTML = `<div id="we-root"></div>`; root = c.app.querySelector("#we-root"); root.innerHTML = `<div class="empty">…</div>`;
  const st = await load();
  if (st.missing || st.error) { S = { missing: !!st.missing, fail: !st.missing, error: st.error, key: "home" }; mount(); bind(); return; }
  S = st; S.msg = note ? { t: note } : null; const p = S.W.home.sections; S.sel = (p.find(x => x.type !== "core") || p[0] || {}).id || null;
  mount(); bind();
}
async function canLeave() { if (!anyDirty()) return true; return confirm("لديك تعديلات غير محفوظة في Website Editor. تجاهلها؟"); }
function close() { if (ctx && ctx.app) ctx.app.classList.remove("wide"); S = null; root = null; }
window.SiteEditor = { open, canLeave, close, isOpen: () => !!S };
})();
