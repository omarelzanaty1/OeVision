/* Project Builder (admin only). Authoring UI for projects: Canvas of ordered Blocks + Settings.
   Security: this file only builds the UI. Every write goes through Supabase and is enforced by RLS (public.is_admin());
   ctx.guard() additionally re-verifies the session/admin role before each sensitive operation. */
(() => {
const BUCKET = "project-images", CUR = "oe.bd.current", KEY = id => "oe.bd." + id;
const IMG_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"], MAX_FILE = 8 * 1048576, MAX_RAW = 40 * 1048576, MAX_W = 2800;
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const uid = () => crypto.randomUUID();
const LS = { get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }, del(k) { try { localStorage.removeItem(k); } catch (e) {} } };
const TL = { image: "صورة", text: "نص", grid: "شبكة صور", embed: "فيديو / Embed", divider: "فاصل" };
const NEW = {
  image: () => ({ id: uid(), type: "image", url: "", w: 0, h: 0, caption: { ar: "", en: "" } }),
  text: () => ({ id: uid(), type: "text", variant: "p", align: "start", text: { ar: "", en: "" } }),
  grid: () => ({ id: uid(), type: "grid", cols: 2, gap: "md", images: [] }),
  embed: () => ({ id: uid(), type: "embed", url: "", caption: { ar: "", en: "" } }),
  divider: () => ({ id: uid(), type: "divider", style: "line", size: "md" })
};
const FIELDS_SUGGEST = ["Branding", "Graphic Design", "Web Design", "Web Development", "UI/UX", "Social Media", "Packaging", "Illustration", "Photography", "Motion Graphics"];
const slugify = t => String(t || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const pathOf = u => { const m = String(u || "").split(`/object/public/${BUCKET}/`)[1]; return m ? decodeURIComponent(m.split("?")[0]) : null; };
const urlsOfBlocks = bl => (bl || []).flatMap(b => b && b.type === "image" ? [b.url] : b && b.type === "grid" ? (b.images || []).map(i => i.url) : []).filter(Boolean);
const urlsOf = r => [r.cover_image, ...(r.gallery_images || []), ...urlsOfBlocks(r.content_blocks)].filter(Boolean);

let ctx, S = null, $ = s => document.querySelector(s);

/* ---------- state ---------- */
const blankSet = () => ({ title_ar: "", title_en: "", description_ar: "", description_en: "", category: "graphic", creative_field: "", tags: [], tools: [], client_name: "", project_date: "", project_url: "", slug: "", published: false, cover: "", focus: { x: 50, y: 50, zoom: 1 }, slugTouched: false });
function fromRow(r) {
  const f = r.cover_focus || {};
  let blocks = Array.isArray(r.content_blocks) && r.content_blocks.length ? JSON.parse(JSON.stringify(r.content_blocks))
    : (r.gallery_images || []).map(u => ({ ...NEW.image(), url: u }));   /* legacy project: gallery_images become image blocks */
  blocks.forEach(b => { if (!b.id) b.id = uid(); });
  return { id: r.id, isNew: false, savedPublished: !!r.is_published, blocks, set: {
    title_ar: r.title_ar || "", title_en: r.title_en || "", description_ar: r.description_ar || "", description_en: r.description_en || "",
    category: r.category || "graphic", creative_field: r.creative_field || "", tags: [...(r.tags || [])], tools: [...(r.tools || [])], client_name: r.client_name || "",
    project_date: r.project_date || "", project_url: r.project_url || "", slug: r.slug || "", published: !!r.is_published, cover: r.cover_image || "",
    focus: { x: Number.isFinite(+f.x) && f.x !== null ? +f.x : 50, y: Number.isFinite(+f.y) && f.y !== null ? +f.y : 50, zoom: +f.zoom >= 1 ? +f.zoom : 1 }, slugTouched: !!r.slug } };
}
function fresh() { return { id: uid(), isNew: true, savedPublished: false, blocks: [], set: blankSet() }; }
const runtime = s => Object.assign(s, { rev: 0, dirty: false, saving: false, up: 0, active: null, pendingRemove: new Set(), uploaded: new Set(), chain: Promise.resolve(), tLocal: 0, tAuto: 0, lastSaved: "" });

/* ---------- local persistence (survives refresh) ---------- */
function persistLocal() {
  if (!S) return; clearTimeout(S.tLocal);
  const blocks = cleanBlocks();
  LS.set(KEY(S.id), { t: Date.now(), dirty: S.dirty, s: { id: S.id, isNew: S.isNew, savedPublished: S.savedPublished, blocks, set: S.set } });
  LS.set(CUR, S.id);
}

/* ---------- opening / closing ---------- */
function open(c, row, o = {}) {
  ctx = c; let s = o.state || (row ? fromRow(row) : fresh()), restored = !!o.state;
  const loc = o.state ? null : LS.get(KEY(s.id));
  if (loc && loc.dirty && loc.s && (o.silentRestore || !row || (loc.t > Date.parse(row.updated_at || 0) && confirm("توجد تعديلات محلية غير محفوظة أحدث من النسخة المحفوظة. هل تريد استعادتها؟")))) { s = loc.s; restored = true; }
  S = runtime(s); if (restored) { S.dirty = true; S.rev = 1; }
  ctx.app.classList.add("wide"); mount(restored && o.silentRestore ? "تم استرجاع عملك بعد تحديث الصفحة." : restored ? "تم استرجاع التعديلات المحلية." : "");
  persistLocal(); window.onbeforeunload = () => (S && S.dirty ? "توجد تغييرات غير محفوظة." : undefined); window.onpagehide = () => { if (S) persistLocal(); };
}
async function restoreCurrent(c) {
  const id = LS.get(CUR); if (!id) return false; const loc = LS.get(KEY(id));
  if (!loc || !loc.dirty || !loc.s) { LS.del(CUR); return false; }
  if (loc.s.isNew) { open(c, null, { state: loc.s, silentRestore: true }); return true; }
  const { data } = await c.sb.from("projects").select("*").eq("id", id).maybeSingle();
  if (!data) { LS.del(CUR); LS.del(KEY(id)); return false; }
  open(c, data, { silentRestore: true }); return true;
}
function leave(note, silent) {
  window.onbeforeunload = null; window.onpagehide = null; ["onclick", "oninput", "onchange", "onkeydown", "onfocusout", "ondragstart", "ondragend", "ondragover", "ondragleave", "ondrop", "onpointerdown"].forEach(k => { ctx.app[k] = null; }); clearTimeout(S.tLocal); clearTimeout(S.tAuto); ctx.app.classList.remove("wide"); LS.del(CUR);
  S = null; document.querySelector("#bd-prev")?.remove(); document.body.style.overflow = ""; if (!silent) ctx.exit(note);
}
async function beforeLeave() {
  if (S.dirty && !confirm("هناك تغييرات غير محفوظة في قاعدة البيانات (محفوظة محليًا على هذا الجهاز فقط). هل تريد الخروج؟")) return false;
  const s = S;
  if (!s.dirty) LS.del(KEY(s.id));
  else if (s.isNew) { LS.del(KEY(s.id)); const paths = [...s.uploaded].map(pathOf).filter(Boolean); if (paths.length) await ctx.sb.storage.from(BUCKET).remove(paths); }
  return true;
}
async function exit() { if (await beforeLeave()) leave(); }
/* used by the dashboard tabs: returns true when it is safe to navigate away from the builder */
async function canLeave() { if (!S) return true; if (!await beforeLeave()) return false; leave(undefined, true); return true; }

/* ---------- save ---------- */
const hasTitle = () => !!(S.set.title_ar.trim() || S.set.title_en.trim());
const hasContent = () => hasTitle() && (S.blocks.length || S.set.cover || S.set.description_ar || S.set.description_en || !S.isNew);
function cleanBlocks() {
  return S.blocks.map(b => {
    const c = JSON.parse(JSON.stringify(b, (k, v) => (k === "up" ? undefined : v)));
    if (c.type === "image" && /^blob:/.test(c.url || "")) c.url = "";
    if (c.type === "grid") c.images = (c.images || []).filter(i => i.url && !/^blob:/.test(i.url));
    return c;
  });
}
function toRow(publish) {
  const s = S.set, blocks = cleanBlocks(), imgs = urlsOfBlocks(blocks).slice(0, 40), d = s.project_date, y = d ? +d.slice(0, 4) : null;
  return { title_ar: s.title_ar.trim(), title_en: s.title_en.trim(), description_ar: s.description_ar.trim(), description_en: s.description_en.trim(), category: s.category,
    creative_field: s.creative_field.trim() || null, tags: s.tags, tools: s.tools, client_name: s.client_name.trim() || null, project_date: d || null, year: y && y >= 2000 && y <= 2100 ? y : null,
    project_url: s.project_url.trim() || null, slug: s.slug.trim() || null, is_published: publish, cover_image: s.cover || null,
    cover_focus: { x: Math.round(s.focus.x), y: Math.round(s.focus.y), zoom: +(+s.focus.zoom).toFixed(2) }, content_blocks: blocks, gallery_images: imgs };
}
function friendly(e) {
  const m = String(e && e.message || e);
  if (/duplicate key|projects_slug_key/i.test(m) && /slug/i.test(m)) return "رابط المشروع (slug) مستخدم في مشروع آخر. غيّره ثم احفظ.";
  if (/projects_check|violates check constraint "projects_check"/i.test(m)) return "أدخل عنوانًا للمشروع (عربي أو إنجليزي).";
  if (/projects_slug_chk/i.test(m)) return "صيغة slug غير صالحة (حروف إنجليزية صغيرة وأرقام وشرطات فقط).";
  if (/content_blocks|cover_focus|creative_field|client_name|project_date|\btags\b|\bslug\b/i.test(m) && /column|schema cache|does not exist/i.test(m)) return "migration المحرر غير مطبّقة على قاعدة البيانات بعد (supabase/migrations/20261116_project_builder.sql).";
  return m;
}
function setState(t, bad) { const el = $("#bd-state"); if (el) { el.textContent = t; el.className = bad ? "err" : "mu"; } }
function stateText() {
  if (!S) return;
  if (S.saving) return setState("جارٍ الحفظ…");
  if (!S.dirty) return setState(S.lastSaved ? "تم الحفظ ✓ " + S.lastSaved : (S.isNew ? "مشروع جديد" : "محفوظ"));
  if (S.isNew && !hasTitle()) return setState("اكتب عنوانًا ليبدأ الحفظ التلقائي (التعديلات محفوظة محليًا الآن)");
  if (S.savedPublished) return setState("تعديلات غير منشورة — محفوظة محليًا. اضغط Save Changes");
  setState("سيُحفظ تلقائيًا كمسودة…");
}
async function save(o = {}) { S.chain = S.chain.then(() => doSave(o)).catch(() => false); return S.chain; }
async function doSave(o) {
  if (!S) return false;
  if (S.up > 0) { if (!o.auto) setState("انتظر اكتمال رفع الصور ثم أعد المحاولة.", 1); else scheduleAuto(); return false; }
  const publish = o.publish !== undefined ? o.publish : (o.auto ? false : S.savedPublished && S.set.published);
  if (!hasTitle()) { if (!o.auto) setState("أدخل عنوانًا للمشروع (عربي أو إنجليزي).", 1); return false; }
  if (S.set.slug && !SLUG_RE.test(S.set.slug)) { if (!o.auto) setState("صيغة slug غير صالحة (حروف إنجليزية صغيرة وأرقام وشرطات فقط).", 1); return false; }
  if (publish && !S.set.cover) { setState("صورة الغلاف مطلوبة قبل النشر.", 1); return false; }
  if (o.auto && S.savedPublished) return false;                       /* autosave never touches a published project */
  if (!await ctx.guard(o.auto ? { cache: true } : undefined)) return false;
  const rev = S.rev; S.saving = true; stateText();
  const row = toRow(publish), sb = ctx.sb;
  let { error } = S.isNew ? await sb.from("projects").insert({ id: S.id, ...row }) : await sb.from("projects").update(row).eq("id", S.id);
  if (error && S.isNew && /projects_pkey|duplicate key/i.test(error.message || "") && !/slug/i.test(error.message || "")) ({ error } = await sb.from("projects").update(row).eq("id", S.id));
  S.saving = false;
  if (error) { setState("تعذّر الحفظ: " + friendly(error), 1); return false; }
  S.isNew = false; S.savedPublished = publish; S.set.published = publish; S.dirty = S.rev !== rev;
  S.lastSaved = new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
  const keep = new Set([...urlsOfBlocks(S.blocks), S.set.cover]), dead = [...S.pendingRemove].filter(u => !keep.has(u)).map(pathOf).filter(Boolean);
  S.pendingRemove.clear(); if (dead.length) await sb.storage.from(BUCKET).remove(dead);
  const ps = $('[data-f="published"]'); if (ps) ps.value = publish ? "1" : "0";
  persistLocal(); renderBar(); stateText(); return true;
}
function scheduleAuto() { clearTimeout(S.tAuto); if (S.savedPublished || !hasContent()) return; S.tAuto = setTimeout(() => save({ auto: true }), 2500); }
function dirty() { S.rev++; S.dirty = true; persistLocal(); scheduleAuto(); stateText(); }

/* ---------- images ---------- */
async function prepare(file) {
  if (!IMG_TYPES.includes(file.type)) throw new Error("نوع الصورة غير مسموح (JPEG/PNG/WebP/GIF فقط): " + file.name);
  if (file.size > MAX_RAW) throw new Error("الصورة كبيرة جدًا (أكثر من 40MB): " + file.name);
  let bmp; try { bmp = await createImageBitmap(file); } catch (e) { throw new Error("تعذّر قراءة الصورة: " + file.name); }
  const w = bmp.width, h = bmp.height; let out = file, ow = w, oh = h;
  if (file.type !== "image/gif") {
    const scale = Math.min(1, MAX_W / w), cw = Math.round(w * scale), ch = Math.round(h * scale);
    if ((scale < 1 || file.size > 2.5 * 1048576) && ch <= 16000) {          /* resize only when needed; ratio is always preserved */
      const cv = document.createElement("canvas"); cv.width = cw; cv.height = ch; const g = cv.getContext("2d"); g.imageSmoothingQuality = "high"; g.drawImage(bmp, 0, 0, cw, ch);
      const blob = await new Promise(r => cv.toBlob(r, "image/webp", 0.9));
      if (blob && blob.type === "image/webp" && (scale < 1 || blob.size < file.size * 0.95)) { out = new File([blob], file.name.replace(/\.\w+$/, "") + ".webp", { type: "image/webp" }); ow = cw; oh = ch; }
    }
  }
  if (bmp.close) bmp.close();
  if (out.size > MAX_FILE) throw new Error("حجم الصورة بعد التحسين يتجاوز 8MB: " + file.name);
  return { file: out, w: ow, h: oh };
}
async function uploadImage(file) {
  const p = await prepare(file), ext = { "image/webp": "webp", "image/png": "png", "image/gif": "gif" }[p.file.type] || "jpg", path = `${S.id}/${uid()}.${ext}`;
  const { error } = await ctx.sb.storage.from(BUCKET).upload(path, p.file, { contentType: p.file.type, upsert: false, cacheControl: "31536000" });
  if (error) throw error;
  const url = ctx.sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl; S.uploaded.add(url);
  return { url, w: p.w, h: p.h };
}
async function withUpload(fn) {
  S.up++; let failed = false;
  try { await fn(); } catch (e) { failed = true; setState("تعذّر رفع الصورة: " + (e.message || e), 1); } finally { if (S) { S.up--; if (!failed) stateText(); } }
  return !failed;
}
const findB = id => S.blocks.find(b => b.id === id);
async function setImage(b, file) {
  if (!await ctx.guard({ cache: true })) return;
  const tmp = URL.createObjectURL(file), old = b.url; b.url = tmp; b.up = true; renderCanvas();
  const ok = await withUpload(async () => { try { const r = await uploadImage(file); if (old && !/^blob:/.test(old)) S.pendingRemove.add(old); b.url = r.url; b.w = r.w; b.h = r.h; } catch (e) { b.url = old && !/^blob:/.test(old) ? old : ""; throw e; } finally { b.up = false; URL.revokeObjectURL(tmp); } });
  renderCanvas(); if (ok) dirty();
}
async function addGridImages(b, files) {
  if (!await ctx.guard({ cache: true })) return;
  let any = false;
  for (const f of files) {
    const im = { url: URL.createObjectURL(f), w: 0, h: 0, up: true }; b.images.push(im); renderCanvas();
    if (await withUpload(async () => { try { const r = await uploadImage(f); URL.revokeObjectURL(im.url); Object.assign(im, r, { up: false }); } catch (e) { b.images.splice(b.images.indexOf(im), 1); throw e; } })) any = true;
  }
  renderCanvas(); if (any) dirty();
}
async function setCover(file) {
  if (!await ctx.guard({ cache: true })) return;
  const ok = await withUpload(async () => { const r = await uploadImage(file); if (S.set.cover) S.pendingRemove.add(S.set.cover); S.set.cover = r.url; });
  renderCover(); if (ok) dirty();
}

/* ---------- rendering ---------- */
function mount(notice) {
  ctx.app.innerHTML = `<div class="bd">
  <div class="bd-bar"><button type="button" class="btn gh sm" data-bd="exit">← الأعمال</button><span id="bd-state" class="mu" role="status"></span><span class="grow"></span><span id="bd-btns" class="row" style="margin:0"></span></div>
  <div class="bd-tools"><b class="mu">إضافة:</b>${Object.keys(NEW).map(t => `<button type="button" class="btn gh sm" data-act="add" data-type="${t}">＋ ${TL[t]}</button>`).join("")}</div>
  <div class="bd-grid"><section id="bd-cv" class="bd-cv" aria-label="Project Canvas"></section><aside id="bd-set" class="bd-set" aria-label="Project Settings"></aside></div></div>`;
  renderBar(); renderCanvas(); renderSettings(); stateText(); if (notice) setState(notice);
  bind();
}
function renderBar() {
  const pub = S.savedPublished;
  $("#bd-btns").innerHTML = `<button type="button" class="btn gh sm" data-bd="draft">${pub ? "Save Changes" : "Save Draft"}</button><button type="button" class="btn gh sm" data-bd="preview">Preview Project</button>${pub ? `<button type="button" class="btn gh sm" data-bd="unpublish">Unpublish</button>` : `<button type="button" class="btn or sm" data-bd="publish">Publish Project</button>`}`;
}
const opt = (v, cur, t) => `<option value="${v}" ${String(cur) === String(v) ? "selected" : ""}>${t}</option>`;
function bkHead(b, i, n) {
  return `<div class="bk-h"><span class="bk-hd" draggable="true" data-drag="b:${b.id}" title="اسحب لإعادة الترتيب" aria-label="اسحب لإعادة الترتيب">⠿</span><b>${TL[b.type]}</b><span class="grow"></span>
  <button type="button" class="ib" data-act="up" data-b="${b.id}" ${i === 0 ? "disabled" : ""} aria-label="تحريك لأعلى">↑</button><button type="button" class="ib" data-act="down" data-b="${b.id}" ${i === n - 1 ? "disabled" : ""} aria-label="تحريك لأسفل">↓</button>
  <button type="button" class="ib" data-act="dup" data-b="${b.id}" aria-label="تكرار">⧉</button><button type="button" class="ib dng" data-act="del" data-b="${b.id}" aria-label="حذف">✕</button></div>`;
}
const ACC = IMG_TYPES.join(",");
function bkBody(b) {
  const id = b.id;
  if (b.type === "image") return b.url
    ? `<div class="bk-img"><img src="${esc(b.url)}" alt="" draggable="false">${b.up ? '<div class="up">جارٍ الرفع…</div>' : ""}</div><div class="row"><label class="btn gh sm">استبدال الصورة<input type="file" hidden accept="${ACC}" data-b="${id}" data-role="image"></label><button type="button" class="btn gh sm" data-act="img-clear" data-b="${id}">حذف الصورة</button></div>
       <div class="two"><label>Caption (عربي)<input data-b="${id}" data-k="caption.ar" value="${esc(b.caption?.ar)}"></label><label>Caption (English)<input dir="ltr" data-b="${id}" data-k="caption.en" value="${esc(b.caption?.en)}"></label></div>`
    : `<label class="drop" data-drop="image" data-b="${id}">⬆ اسحب صورة هنا أو اضغط للاختيار<input type="file" hidden accept="${ACC}" data-b="${id}" data-role="image"></label>`;
  if (b.type === "text") return `<div class="row bk-tb"><select data-b="${id}" data-k="variant" aria-label="النوع">${opt("h1", b.variant, "عنوان رئيسي")}${opt("h2", b.variant, "عنوان فرعي")}${opt("p", b.variant, "فقرة")}</select>
    <span class="seg">${[["start", "بداية"], ["center", "وسط"], ["end", "نهاية"], ["justify", "ضبط"]].map(([a, t]) => `<button type="button" class="ib ${b.align === a ? "on" : ""}" data-act="al" data-b="${id}" data-v="${a}">${t}</button>`).join("")}</span></div>
    <div class="two"><label>النص (عربي)<textarea class="v-${b.variant}" dir="rtl" data-b="${id}" data-k="text.ar">${esc(b.text?.ar)}</textarea></label><label>Text (English)<textarea class="v-${b.variant}" dir="ltr" data-b="${id}" data-k="text.en">${esc(b.text?.en)}</textarea></label></div>`;
  if (b.type === "grid") return `<div class="row bk-tb"><label>التخطيط<select data-b="${id}" data-k="cols">${opt(2, b.cols, "عمودان")}${opt(3, b.cols, "3 أعمدة")}${opt(4, b.cols, "4 أعمدة")}</select></label>
    <label>المسافات<select data-b="${id}" data-k="gap">${opt("none", b.gap, "بدون")}${opt("sm", b.gap, "صغيرة")}${opt("md", b.gap, "متوسطة")}${opt("lg", b.gap, "كبيرة")}</select></label></div>
    <div class="gts">${(b.images || []).map((im, i) => `<div class="gt" data-drag="g:${id}:${i}" draggable="true" data-b="${id}" data-i="${i}"><span class="n">${i + 1}</span><img src="${esc(im.url)}" alt="" draggable="false">${im.up ? '<div class="up">…</div>' : ""}<div class="gtc"><button type="button" class="ib" data-act="g-back" data-b="${id}" data-i="${i}" aria-label="تقديم">←</button><button type="button" class="ib" data-act="g-fwd" data-b="${id}" data-i="${i}" aria-label="تأخير">→</button><button type="button" class="ib dng" data-act="g-del" data-b="${id}" data-i="${i}" aria-label="حذف">✕</button></div></div>`).join("")}
    <label class="drop sm" data-drop="grid" data-b="${id}">＋ إضافة صور<input type="file" hidden multiple accept="${ACC}" data-b="${id}" data-role="grid"></label></div>`;
  if (b.type === "embed") return `<label>رابط YouTube أو Vimeo (أو رابط خارجي https)<input dir="ltr" type="url" placeholder="https://www.youtube.com/watch?v=…" data-b="${id}" data-k="url" value="${esc(b.url)}"></label><div class="mu" id="hint-${id}">${embedHint(b.url)}</div>
    <div class="two"><label>Caption (عربي)<input data-b="${id}" data-k="caption.ar" value="${esc(b.caption?.ar)}"></label><label>Caption (English)<input dir="ltr" data-b="${id}" data-k="caption.en" value="${esc(b.caption?.en)}"></label></div>`;
  return `<div class="row bk-tb"><label>النوع<select data-b="${id}" data-k="style">${opt("line", b.style, "خط فاصل")}${opt("space", b.style, "مسافة فقط")}</select></label><label>الحجم<select data-b="${id}" data-k="size">${opt("sm", b.size, "صغير")}${opt("md", b.size, "متوسط")}${opt("lg", b.size, "كبير")}</select></label></div>`;
}
function embedHint(u) { if (!String(u || "").trim()) return ""; const e = PV.embedInfo(u); return !e ? "رابط غير صالح (https فقط)" : e.provider === "youtube" ? "YouTube ✓" : e.provider === "vimeo" ? "Vimeo ✓" : `رابط خارجي ✓ (${esc(e.host)}) — سيظهر كزر`; }
const insZone = at => `<div class="ins"><button type="button" class="ib ins-b" data-act="ins" data-at="${at}" aria-label="إضافة هنا">＋</button><div class="ins-m" hidden>${Object.keys(NEW).map(t => `<button type="button" class="btn gh sm" data-act="addat" data-type="${t}" data-at="${at}">${TL[t]}</button>`).join("")}</div></div>`;
function renderCanvas() {
  const n = S.blocks.length, el = $("#bd-cv"); if (!el) return;
  el.innerHTML = (n ? "" : `<div class="empty">ابدأ ببناء المشروع: أضف صورة أو نصًا أو شبكة صور أو فيديو من الشريط أعلاه.</div>`) + S.blocks.map((b, i) => insZone(i) + `<div class="bk ${S.active === b.id ? "act" : ""}" data-b="${b.id}">${bkHead(b, i, n)}<div class="bk-b">${bkBody(b)}</div></div>`).join("") + insZone(n);
}
function renderTags(name) { const el = $(`[data-tg="${name}"]`); if (el) el.innerHTML = S.set[name].map((t, i) => `<span class="chip">${esc(t)} <button type="button" class="x" data-act="tg-del" data-tg="${name}" data-i="${i}" aria-label="حذف">×</button></span>`).join("") + `<input data-tgin="${name}" placeholder="${name === "tags" ? "Tag ثم Enter" : "أداة ثم Enter"}">`; }
function coverStyle() { return PV.coverStyle(S.set.focus); }
function renderCover() {
  const f = S.set.focus, el = $("#bd-cover"); if (!el) return;
  el.innerHTML = `<div class="cvbox cv" data-drop="cover">${S.set.cover ? `<img id="cvimg" src="${esc(S.set.cover)}" style="${coverStyle()}" alt="" draggable="false">` : `<span class="mu">لا توجد صورة غلاف</span>`}</div>
  <div class="row"><label class="btn gh sm">${S.set.cover ? "تغيير الغلاف" : "رفع صورة الغلاف"}<input type="file" hidden accept="${ACC}" id="cvfile"></label>${S.set.cover ? `<button type="button" class="btn gh sm" data-act="cover-del">إزالة</button>` : ""}</div>
  ${S.set.cover ? `<label>الموضع الأفقي<input type="range" min="0" max="100" value="${f.x}" data-fx="x"></label><label>الموضع الرأسي<input type="range" min="0" max="100" value="${f.y}" data-fx="y"></label><label>التكبير<input type="range" min="100" max="300" step="5" value="${Math.round(f.zoom * 100)}" data-fx="zoom"></label><small class="mu">يمكنك أيضًا سحب الصورة داخل الإطار. الصورة الأصلية لا تُقص أبدًا.</small>` : ""}`;
}
function renderSettings() {
  const s = S.set;
  $("#bd-set").innerHTML = `<div class="panel"><h3>Project Settings</h3>
  <label>Project Title (عربي)<input data-f="title_ar" maxlength="200" value="${esc(s.title_ar)}"></label><label>Project Title (English)<input dir="ltr" data-f="title_en" maxlength="200" value="${esc(s.title_en)}"></label>
  <label>Project Description (عربي)<textarea data-f="description_ar" maxlength="5000">${esc(s.description_ar)}</textarea></label><label>Project Description (English)<textarea dir="ltr" data-f="description_en" maxlength="5000">${esc(s.description_en)}</textarea></label>
  <div><b>Cover Image</b><div id="bd-cover"></div></div>
  <label>Category<select data-f="category">${opt("graphic", s.category, "Graphic Design")}${opt("web", s.category, "Website Development")}</select></label>
  <label>Creative Field<input dir="ltr" list="bd-fields" data-f="creative_field" maxlength="120" value="${esc(s.creative_field)}"><datalist id="bd-fields">${FIELDS_SUGGEST.map(x => `<option value="${x}">`).join("")}</datalist></label>
  <div><b>Project Tags</b><div class="tg" data-tg="tags"></div></div><div><b>Tools Used</b><div class="tg" data-tg="tools"></div></div>
  <label>Client Name<input data-f="client_name" maxlength="200" value="${esc(s.client_name)}"></label><label>Project Date<input type="date" data-f="project_date" value="${esc(s.project_date)}"></label>
  <label>Project URL<input dir="ltr" type="url" placeholder="https://" data-f="project_url" value="${esc(s.project_url)}"></label>
  <label>رابط المشروع الثابت (slug)<input dir="ltr" data-f="slug" maxlength="80" value="${esc(s.slug)}"><small class="mu">/#/work/${esc(s.slug || S.id)}</small></label>
  <label>حالة المشروع<select data-f="published">${opt("0", s.published ? 1 : 0, "Draft (مسودة)")}${opt("1", s.published ? 1 : 0, "Published (منشور)")}</select><small class="mu">للنشر استخدم زر Publish Project.</small></label></div>`;
  renderCover(); renderTags("tags"); renderTags("tools");
}

/* ---------- block operations ---------- */
function move(from, to) { if (from === to || from < 0 || to < 0 || to >= S.blocks.length) return; const [x] = S.blocks.splice(from, 1); S.blocks.splice(to, 0, x); renderCanvas(); dirty(); }
function addBlock(type, at) {
  const b = NEW[type](); const i = at === undefined ? (S.active ? S.blocks.findIndex(x => x.id === S.active) + 1 : S.blocks.length) : at;
  S.blocks.splice(Math.max(0, Math.min(i, S.blocks.length)), 0, b); S.active = b.id; renderCanvas(); dirty();
  document.querySelector(`.bk[data-b="${b.id}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" });
}
function dropRef(b) { const urls = b.type === "image" ? [b.url] : b.type === "grid" ? (b.images || []).map(i => i.url) : []; urls.filter(u => u && !/^blob:/.test(u)).forEach(u => S.pendingRemove.add(u)); }
function setPath(b, path, v) { const p = path.split("."); let o = b; while (p.length > 1) { const k = p.shift(); o[k] = o[k] || {}; o = o[k]; } o[p[0]] = v; }

/* ---------- events ---------- */
function bind() {
  const root = ctx.app;
  root.onclick = async e => {
    const bd = e.target.closest("[data-bd]"); if (bd) return topAction(bd.dataset.bd);
    const a = e.target.closest("[data-act]"); const bk = e.target.closest(".bk[data-b]"); if (bk) S.active = bk.dataset.b;
    if (!a) return;
    const act = a.dataset.act, id = a.dataset.b, b = id && findB(id), i = +a.dataset.i;
    if (act === "add") return addBlock(a.dataset.type);
    if (act === "ins") { const m = a.parentElement.querySelector(".ins-m"); document.querySelectorAll(".ins-m").forEach(x => x !== m && (x.hidden = true)); m.hidden = !m.hidden; return; }
    if (act === "addat") return addBlock(a.dataset.type, +a.dataset.at);
    if (act === "tg-del") { S.set[a.dataset.tg].splice(i, 1); renderTags(a.dataset.tg); return dirty(); }
    if (act === "cover-del") { if (S.set.cover) S.pendingRemove.add(S.set.cover); S.set.cover = ""; renderCover(); return dirty(); }
    if (!b) return;
    const idx = S.blocks.indexOf(b);
    if (act === "up") move(idx, idx - 1); else if (act === "down") move(idx, idx + 1);
    else if (act === "dup") { const c = JSON.parse(JSON.stringify(b, (k, v) => (k === "up" ? undefined : v))); c.id = uid(); S.blocks.splice(idx + 1, 0, c); renderCanvas(); dirty(); }
    else if (act === "del") { if (!confirm("حذف هذا العنصر؟")) return; dropRef(b); S.blocks.splice(idx, 1); renderCanvas(); dirty(); }
    else if (act === "img-clear") { dropRef(b); b.url = ""; b.w = 0; b.h = 0; renderCanvas(); dirty(); }
    else if (act === "al") { b.align = a.dataset.v; renderCanvas(); dirty(); }
    else if (act === "g-del") { const [x] = b.images.splice(i, 1); if (x && x.url && !/^blob:/.test(x.url)) S.pendingRemove.add(x.url); renderCanvas(); dirty(); }
    else if (act === "g-back" || act === "g-fwd") { const j = i + (act === "g-back" ? -1 : 1); if (j >= 0 && j < b.images.length) { [b.images[i], b.images[j]] = [b.images[j], b.images[i]]; renderCanvas(); dirty(); } }
  };
  root.oninput = e => {
    const t = e.target, f = t.dataset.f, k = t.dataset.k, fx = t.dataset.fx;
    if (k && t.dataset.b) { const b = findB(t.dataset.b); if (!b) return; if (t.tagName === "SELECT") return; setPath(b, k, t.value); if (k === "url") { const h = $("#hint-" + b.id); if (h) h.innerHTML = embedHint(t.value); } return dirty(); }
    if (fx) { S.set.focus[fx] = fx === "zoom" ? +t.value / 100 : +t.value; const im = $("#cvimg"); if (im) im.setAttribute("style", coverStyle()); return dirty(); }
    if (f && f !== "published" && f !== "category") {
      S.set[f] = t.value;
      if (f === "title_en" && !S.set.slugTouched) { S.set.slug = slugify(t.value); const sl = $('[data-f="slug"]'); if (sl) sl.value = S.set.slug; }
      if (f === "slug") { S.set.slugTouched = true; S.set.slug = t.value.trim().toLowerCase(); }
      if (f === "slug" || f === "title_en") { const sm = $('[data-f="slug"]')?.parentElement.querySelector("small"); if (sm) sm.textContent = "/#/work/" + (S.set.slug || S.id); }
      dirty();
    }
  };
  root.onchange = async e => {
    const t = e.target, k = t.dataset.k, f = t.dataset.f;
    if (k && t.dataset.b && t.tagName === "SELECT") { const b = findB(t.dataset.b); setPath(b, k, k === "cols" ? +t.value : t.value); renderCanvas(); return dirty(); }
    if (f === "category") { S.set.category = t.value; return dirty(); }
    if (f === "published") { S.set.published = t.value === "1"; return dirty(); }
    if (t.id === "cvfile" && t.files[0]) { const fl = t.files[0]; t.value = ""; return setCover(fl); }
    if (t.type === "file" && t.dataset.b) {
      const b = findB(t.dataset.b), files = [...t.files]; t.value = ""; if (!b || !files.length) return;
      if (t.dataset.role === "image") return setImage(b, files[0]); return addGridImages(b, files);
    }
  };
  root.onkeydown = e => {
    const t = e.target; if (!t.dataset.tgin) return;
    if (e.key === "Enter" || e.key === "," || e.key === "،") { e.preventDefault(); addTag(t); }
  };
  root.onfocusout = e => { if (e.target.dataset && e.target.dataset.tgin) addTag(e.target); };
  /* drag & drop: reorder blocks / grid images, and drop image files onto dropzones */
  let drag = null;
  root.ondragstart = e => { const h = e.target.closest("[data-drag]"); if (!h) return; drag = h.dataset.drag; e.dataTransfer.setData("text/plain", drag); e.dataTransfer.effectAllowed = "move"; const bk = h.closest(".bk"); if (bk && h.classList.contains("bk-hd")) { try { e.dataTransfer.setDragImage(bk, 16, 16); } catch (x) {} bk.classList.add("dragging"); } };
  root.ondragend = () => { drag = null; document.querySelectorAll(".dragging,.over").forEach(x => x.classList.remove("dragging", "over")); };
  root.ondragover = e => {
    const files = e.dataTransfer && [...(e.dataTransfer.types || [])].includes("Files");
    const dz = e.target.closest("[data-drop]"); if (files && dz) { e.preventDefault(); dz.classList.add("over"); return; }
    if (!drag) return; const tgt = drag.startsWith("b:") ? e.target.closest(".bk[data-b]") : e.target.closest(".gt[data-b]");
    if (tgt) { e.preventDefault(); document.querySelectorAll(".over").forEach(x => x !== tgt && x.classList.remove("over")); tgt.classList.add("over"); }
  };
  root.ondragleave = e => { const x = e.target.closest && e.target.closest(".over"); if (x && !x.contains(e.relatedTarget)) x.classList.remove("over"); };
  root.ondrop = e => {
    const dz = e.target.closest("[data-drop]"), files = e.dataTransfer ? [...e.dataTransfer.files].filter(f => f.type.startsWith("image/")) : [];
    if (dz && files.length) { e.preventDefault(); dz.classList.remove("over"); const k = dz.dataset.drop; if (k === "cover") return setCover(files[0]); const b = findB(dz.dataset.b); return k === "image" ? setImage(b, files[0]) : addGridImages(b, files); }
    if (!drag) return; const d = drag; drag = null;
    if (d.startsWith("b:")) { const tgt = e.target.closest(".bk[data-b]"); if (!tgt) return; e.preventDefault(); const from = S.blocks.findIndex(x => x.id === d.slice(2)), to = S.blocks.findIndex(x => x.id === tgt.dataset.b); move(from, to); }
    else { const [, bid, i] = d.split(":"), tgt = e.target.closest(".gt[data-b]"); if (!tgt || tgt.dataset.b !== bid) return; e.preventDefault(); const b = findB(bid), from = +i, to = +tgt.dataset.i; if (from !== to) { const [x] = b.images.splice(from, 1); b.images.splice(to, 0, x); renderCanvas(); dirty(); } }
  };
  /* cover: drag the image inside the frame to choose the visible part */
  root.onpointerdown = e => {
    const im = e.target.closest("#cvimg"); if (!im) return; e.preventDefault();
    const box = im.parentElement.getBoundingClientRect(), f = S.set.focus, x0 = e.clientX, y0 = e.clientY, fx = f.x, fy = f.y;
    const mv = ev => { f.x = Math.max(0, Math.min(100, fx - (ev.clientX - x0) / box.width * 100 / f.zoom)); f.y = Math.max(0, Math.min(100, fy - (ev.clientY - y0) / box.height * 100 / f.zoom)); im.setAttribute("style", coverStyle()); };
    const up = () => { document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); renderCover(); dirty(); };
    document.addEventListener("pointermove", mv); document.addEventListener("pointerup", up);
  };
}
function addTag(input) {
  const name = input.dataset.tgin, v = input.value.replace(/[,،]/g, "").trim().slice(0, 40); input.value = ""; if (!v) return;
  const arr = S.set[name]; if (arr.includes(v) || arr.length >= (name === "tags" ? 30 : 40)) return; arr.push(v); renderTags(name); $(`[data-tgin="${name}"]`)?.focus(); dirty();
}
async function topAction(a) {
  if (a === "exit") return exit();
  if (a === "preview") return preview();
  if (a === "draft") { const ok = await save({}); if (ok) setState((S.savedPublished ? "تم حفظ التعديلات ✓ " : "تم حفظ المسودة ✓ ") + S.lastSaved); return; }
  if (a === "publish") { const ok = await save({ publish: true }); if (ok) setState("تم النشر ✓ — المشروع ظاهر الآن في معرض الأعمال."); return; }
  if (a === "unpublish") { if (!confirm("إلغاء نشر المشروع وإخفاؤه عن الزوار؟")) return; const ok = await save({ publish: false }); if (ok) setState("أُلغي النشر — المشروع الآن مسودة."); }
}

/* ---------- preview: same renderer + same CSS as the public project page; admin only (lives inside the guarded dashboard) ---------- */
function model() {
  const s = S.set;
  return { id: S.id, slug: s.slug, title: { ar: s.title_ar, en: s.title_en }, description: { ar: s.description_ar, en: s.description_en }, category: s.category, field: s.creative_field, tags: s.tags, tools: s.tools, client: s.client_name,
    date: s.project_date, year: s.project_date ? +s.project_date.slice(0, 4) : "", url: s.project_url, blocks: cleanBlocks(), images: [] };
}
function preview() {
  let lang = "ar"; document.querySelector("#bd-prev")?.remove();
  const ov = document.createElement("div"); ov.id = "bd-prev"; ov.className = "bd-prev"; document.body.appendChild(ov); document.body.style.overflow = "hidden";
  const draw = () => {
    const L = (a, e) => (lang === "ar" ? a : e), P = o => (o && (o[lang] || o.en || o.ar)) || "";
    ov.dir = lang === "ar" ? "rtl" : "ltr"; ov.scrollTop = 0;
    ov.innerHTML = `<div class="bd-pbar"><button type="button" class="btn or sm" data-pv="close">← العودة للتحرير</button><span class="mu">معاينة (للأدمن فقط — ${S.savedPublished ? "المنشور" : "مسودة"})</span><span class="grow"></span><button type="button" class="btn gh sm" data-pv="lang">${lang === "ar" ? "EN" : "AR"}</button></div>${PV.render(model(), { L, P, backHref: "#" })}`;
  };
  const close = () => { ov.remove(); document.body.style.overflow = ""; document.removeEventListener("keydown", key); };
  const key = e => { if (e.key === "Escape") close(); };
  ov.onclick = e => { const b = e.target.closest("[data-pv]"); if (b) { if (b.dataset.pv === "close") close(); else { lang = lang === "ar" ? "en" : "ar"; draw(); } return; } if (e.target.closest("a.pv-back, .pv-foot a.gh")) { e.preventDefault(); close(); } };
  document.addEventListener("keydown", key); draw();
}

/* Reused by the Website Editor: same optimizer + same admin-only bucket, under the "site/" prefix (no storage policy change). */
async function uploadPrepared(c, p, bucket) {
  bucket = bucket || BUCKET;
  const ext = { "image/webp": "webp", "image/png": "png", "image/gif": "gif" }[p.file.type] || "jpg", path = `site/${uid()}.${ext}`;
  const { error } = await c.sb.storage.from(bucket).upload(path, p.file, { contentType: p.file.type, upsert: false, cacheControl: "31536000" });
  if (error) throw error;
  return { url: bucket === BUCKET ? c.sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl : "", w: p.w, h: p.h, path };   /* private buckets never get a public URL */
}
window.Builder = { open, restoreCurrent, canLeave, urlsOf, pathOf, BUCKET, prepare, uploadPrepared };
})();
