(() => {
const sb = window.sb, app = document.querySelector("#app"), esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const BUCKET = "project-images", ATT = "client-attachments"; let rows = [], cur = null;
if (!sb) { app.innerHTML = '<div class="empty">اضبط SUPABASE_URL و SUPABASE_ANON_KEY في config.js</div>'; return; }
const msg = (t, bad) => `<div class="${bad ? "err" : "mu"}">${esc(t)}</div>`;

async function start() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return loginView();
  const { data, error } = await sb.rpc("is_admin");
  if (error) return deniedView("تعذّر التحقق من الصلاحيات.");
  if (data !== true) return deniedView("هذا الحساب ليس حساب مدير.");
  document.querySelector("#out").hidden = false; document.querySelector("#tabs").hidden = false; listView();
}
/* Non-admin (or unverifiable) session: show nothing of the dashboard and DO NOT sign the user out of the public site. */
function deniedView(t) {
  document.querySelector("#out").hidden = true; document.querySelector("#tabs").hidden = true;
  app.innerHTML = `<div class="panel" style="max-width:420px;margin:40px auto;text-align:center"><h2>${esc(t)}</h2><div class="row" style="justify-content:center"><a class="btn" href="index.html">العودة للموقع</a><button class="btn gh" id="so">تسجيل الخروج</button></div></div>`;
  document.querySelector("#so").onclick = async () => { await sb.auth.signOut(); loginView(); };
}
/* Re-verify the session and admin role (server side, via is_admin()) before every sensitive operation. RLS remains the real enforcement. */
async function guard() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { loginView("انتهت الجلسة، سجّل الدخول مرة أخرى."); return false; }
  const { data, error } = await sb.rpc("is_admin");
  if (error || data !== true) { deniedView(error ? "تعذّر التحقق من الصلاحيات." : "هذا الحساب ليس حساب مدير."); return false; }
  return true;
}
function loginView(e = "") {
  document.querySelector("#out").hidden = true; document.querySelector("#tabs").hidden = true;
  app.innerHTML = `<form id="lf" style="max-width:420px;margin:40px auto"><h2>تسجيل دخول المدير</h2><label>Email<input name="e" type="email" required autocomplete="username"></label><label>Password<input name="p" type="password" required autocomplete="current-password"></label>${e ? msg(e, 1) : ""}<button class="btn">دخول</button><a class="mu" href="index.html" style="font-size:13px">للدخول بحساب Google: سجّل الدخول من الموقع الرئيسي ثم افتح Dashboard من شريط التنقل.</a></form>`;
  document.querySelector("#lf").onsubmit = async ev => {
    ev.preventDefault(); const f = new FormData(ev.target);
    const { error } = await sb.auth.signInWithPassword({ email: f.get("e"), password: f.get("p") });
    error ? loginView("بيانات الدخول غير صحيحة.") : start();
  };
}
document.querySelector("#out").onclick = async () => { await sb.auth.signOut(); loginView(); };

async function listView(note = "") {
  const { data, error } = await sb.from("projects").select("*").order("created_at", { ascending: false });
  if (error) { app.innerHTML = msg("تعذّر تحميل المشاريع: " + error.message, 1); return; }
  rows = data;
  app.innerHTML = `<div class="row" style="justify-content:space-between;align-items:center;margin:0 0 20px"><h2 style="margin:0">إدارة الأعمال</h2><button class="btn or" id="add">+ إضافة عمل جديد</button></div>${note ? msg(note) : ""}
  ${rows.length ? rows.map(r => `<div class="arow"><img src="${esc(r.cover_image || "")}" alt=""><div class="grow"><b>${esc(r.title_ar || r.title_en)}</b><div class="mu" style="font-size:13px">${r.category === "web" ? "Website Development" : "Graphic Design"} · ${esc(r.year || "")}</div></div><span class="st ${r.is_published ? "pub" : ""}">${r.is_published ? "منشور" : "مسودة"}</span>
  <button class="btn gh sm" data-a="tog" data-id="${r.id}">${r.is_published ? "إخفاء" : "نشر"}</button><button class="btn sm" data-a="edit" data-id="${r.id}">تعديل</button><button class="btn sm dng" data-a="del" data-id="${r.id}">حذف</button></div>`).join("") : `<div class="empty">لا توجد أعمال بعد. اضغط «إضافة عمل جديد».</div>`}`;
  document.querySelector("#add").onclick = () => formView(null);
}
app.addEventListener("click", async e => {
  const b = e.target.closest("[data-a]"); if (!b) return; const r = rows.find(x => x.id === b.dataset.id);
  if (b.dataset.a === "edit") formView(r);
  if (b.dataset.a === "tog") { if (!await guard()) return; const { error } = await sb.from("projects").update({ is_published: !r.is_published }).eq("id", r.id); listView(error ? error.message : "تم التحديث."); }
  if (b.dataset.a === "del" && confirm("حذف المشروع نهائيًا مع صوره؟")) {
    if (!await guard()) return;
    const paths = [r.cover_image, ...(r.gallery_images || [])].map(pathOf).filter(Boolean);
    const { error } = await sb.from("projects").delete().eq("id", r.id);
    if (!error && paths.length) await sb.storage.from(BUCKET).remove(paths);
    listView(error ? error.message : "تم الحذف.");
  }
});
const pathOf = u => { const m = String(u || "").split(`/object/public/${BUCKET}/`)[1]; return m ? decodeURIComponent(m) : null; };

function formView(r) {
  cur = { id: r?.id, cover: r?.cover_image || null, coverFile: null, imgs: (r?.gallery_images || []).map(u => ({ url: u })), removed: [] };
  const v = k => esc(r?.[k] ?? "");
  app.innerHTML = `<form id="pf"><h2>${r ? "تعديل مشروع" : "إضافة عمل جديد"}</h2>
  <div class="two"><label>اسم المشروع (عربي)<input name="title_ar" value="${v("title_ar")}"></label><label>Project name (English)<input name="title_en" value="${v("title_en")}"></label></div>
  <div class="two"><label>الوصف (عربي)<textarea name="description_ar">${v("description_ar")}</textarea></label><label>Description (English)<textarea name="description_en">${v("description_en")}</textarea></label></div>
  <div class="two"><label>التصنيف<select name="category"><option value="graphic" ${r?.category === "graphic" ? "selected" : ""}>Graphic Design</option><option value="web" ${r?.category === "web" ? "selected" : ""}>Website Development</option></select></label>
  <label>سنة التنفيذ<input name="year" type="number" min="2000" max="2100" value="${v("year")}"></label></div>
  <div class="two"><label>الأدوات (افصل بفاصلة)<input name="tools" value="${esc((r?.tools || []).join(", "))}"></label><label>رابط المعاينة (اختياري)<input name="project_url" type="url" value="${v("project_url")}"></label></div>
  <label>الحالة<select name="status"><option value="draft" ${!r?.is_published ? "selected" : ""}>مسودة</option><option value="published" ${r?.is_published ? "selected" : ""}>منشور</option></select></label>
  <label>صورة الغلاف<input type="file" id="cov" accept="image/*"></label><div id="covp"></div>
  <label>صور إضافية (ترتيبها هنا هو ترتيب ظهورها)<input type="file" id="more" accept="image/*" multiple></label><div class="thumbs" id="th"></div>
  <div id="fe"></div><div class="row"><button type="button" class="btn gh" id="cancel">إلغاء</button><button class="btn" id="save">حفظ</button></div></form>`;
  paint();
  document.querySelector("#cov").onchange = e => { cur.coverFile = e.target.files[0] || null; paint(); };
  document.querySelector("#more").onchange = e => { [...e.target.files].forEach(f => cur.imgs.push({ file: f })); e.target.value = ""; paint(); };
  document.querySelector("#cancel").onclick = () => listView();
  document.querySelector("#pf").onsubmit = save;
}
const src = i => i.file ? URL.createObjectURL(i.file) : i.url;
function paint() {
  const c = cur.coverFile ? URL.createObjectURL(cur.coverFile) : cur.cover;
  document.querySelector("#covp").innerHTML = c ? `<img src="${esc(c)}" alt="" style="max-width:240px;border-radius:10px">` : "";
  document.querySelector("#th").innerHTML = cur.imgs.map((i, n) => `<div class="th"><img src="${esc(src(i))}" alt=""><div><button type="button" class="btn gh" data-m="-1" data-n="${n}">◀</button><button type="button" class="btn gh" data-m="1" data-n="${n}">▶</button><button type="button" class="btn gh" data-m="x" data-n="${n}">✕</button></div></div>`).join("");
  document.querySelectorAll("#th [data-m]").forEach(b => b.onclick = () => {
    const n = +b.dataset.n, m = b.dataset.m;
    if (m === "x") { const [x] = cur.imgs.splice(n, 1); if (x.url) cur.removed.push(x.url); }
    else { const k = n + +m; if (k >= 0 && k < cur.imgs.length) [cur.imgs[n], cur.imgs[k]] = [cur.imgs[k], cur.imgs[n]]; }
    paint();
  });
}
const IMG_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
async function upload(file, id) {
  if (!IMG_TYPES.includes(file.type)) throw new Error("نوع الصورة غير مسموح (JPEG/PNG/WebP/GIF فقط): " + file.name);
  if (file.size > 8388608) throw new Error("حجم الصورة يتجاوز 8MB: " + file.name);
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `${id}/${crypto.randomUUID()}.${ext}`;
  const { error } = await sb.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}
async function save(ev) {
  ev.preventDefault(); const f = new FormData(ev.target), btn = document.querySelector("#save"), fe = document.querySelector("#fe");
  if (!f.get("title_ar").trim() && !f.get("title_en").trim()) { fe.innerHTML = msg("أدخل اسم المشروع.", 1); return; }
  if (!cur.cover && !cur.coverFile) { fe.innerHTML = msg("صورة الغلاف مطلوبة.", 1); return; }
  btn.disabled = true; fe.innerHTML = msg("جارٍ الحفظ ورفع الصور…");
  if (!await guard()) return;
  try {
    const id = cur.id || crypto.randomUUID(), oldCover = cur.coverFile ? cur.cover : null;
    const cover = cur.coverFile ? await upload(cur.coverFile, id) : cur.cover;
    const images = []; for (const i of cur.imgs) images.push(i.file ? await upload(i.file, id) : i.url);
    const row = { title_ar: f.get("title_ar").trim(), title_en: f.get("title_en").trim(), description_ar: f.get("description_ar").trim(), description_en: f.get("description_en").trim(), category: f.get("category"), year: f.get("year") ? +f.get("year") : null, tools: f.get("tools").split(",").map(x => x.trim()).filter(Boolean), project_url: f.get("project_url").trim() || null, is_published: f.get("status") === "published", cover_image: cover, gallery_images: images };
    const { error } = cur.id ? await sb.from("projects").update(row).eq("id", id) : await sb.from("projects").insert({ id, ...row });
    if (error) throw error;
    const dead = [...cur.removed, oldCover].map(pathOf).filter(Boolean); if (dead.length) await sb.storage.from(BUCKET).remove(dead);
    listView("تم الحفظ.");
  } catch (e) { fe.innerHTML = msg("فشل الحفظ: " + (e.message || e), 1); btn.disabled = false; }
}

const ST = { new: "طلب جديد", reviewing: "قيد المراجعة", in_progress: "قيد التنفيذ", completed: "مكتمل", rejected: "مرفوض" };
const SV = { logo: "Logo Design", identity: "Visual Identity", graphic: "Graphic Design", web: "Website Development" };
const dt = x => new Date(x).toLocaleString("ar-EG");
document.querySelector("#tabs").onclick = e => { const t = e.target.dataset.t; if (t === "p") listView(); if (t === "r") reqList(); };
let reqs = [];
async function reqList(note = "") {
  const { data, error } = await sb.from("project_requests").select("*, profiles(full_name,email), request_attachments(file_name,file_path)").order("created_at", { ascending: false });
  if (error) { app.innerHTML = msg("تعذّر تحميل الطلبات: " + error.message, 1); return; }
  reqs = data;
  app.innerHTML = `<h2>طلبات العملاء</h2>${note ? msg(note) : ""}${reqs.length ? reqs.map(r => `<div class="arow"><div class="grow"><b>${esc(r.profiles?.full_name || "—")}</b><div class="mu" style="font-size:13px">${esc(r.profiles?.email || "")}</div></div><div>${SV[r.service_type] || esc(r.service_type)}</div><div class="mu" style="font-size:13px">${dt(r.created_at)}</div><span class="st ${r.status === "completed" ? "pub" : ""}">${ST[r.status]}</span><button class="btn sm" data-r="${r.id}">فتح</button></div>`).join("") : `<div class="empty">لا توجد طلبات بعد.</div>`}`;
  app.querySelectorAll("[data-r]").forEach(b => b.onclick = () => reqDetail(reqs.find(x => x.id === b.dataset.r)));
}
async function reqDetail(r) {
  const urls = await Promise.all((r.request_attachments || []).map(async f => { const { data } = await sb.storage.from(ATT).createSignedUrl(f.file_path, 3600); return { name: f.file_name, url: data?.signedUrl }; }));
  app.innerHTML = `<button class="btn gh sm" id="bk">← الطلبات</button><div class="panel" style="margin-top:16px"><h2 style="margin:0">${SV[r.service_type] || esc(r.service_type)}</h2>
  <dl><dt>العميل</dt><dd>${esc(r.profiles?.full_name || "—")} · ${esc(r.profiles?.email || "")}</dd><dt>تاريخ الطلب</dt><dd>${dt(r.created_at)}</dd>${(r.brief_answers || []).map(a => `<dt>${esc(a.q?.ar || a.q?.en)}</dt><dd>${esc(a.a)}</dd>`).join("")}
  <dt>الملفات المرفقة</dt><dd>${urls.length ? urls.map(u => `<a class="chip" target="_blank" rel="noopener" href="${esc(u.url || "#")}">${esc(u.name)}</a>`).join(" ") : "—"}</dd></dl>
  <label>حالة الطلب<select id="stt">${Object.entries(ST).map(([k, v]) => `<option value="${k}" ${r.status === k ? "selected" : ""}>${v}</option>`).join("")}</select></label><div id="sm"></div><div><button class="btn" id="ss">حفظ الحالة</button></div></div>`;
  document.querySelector("#bk").onclick = () => reqList();
  document.querySelector("#ss").onclick = async () => { if (!await guard()) return; const { error } = await sb.from("project_requests").update({ status: document.querySelector("#stt").value }).eq("id", r.id); document.querySelector("#sm").innerHTML = msg(error ? error.message : "تم تحديث الحالة.", !!error); if (!error) r.status = document.querySelector("#stt").value; };
}
start();
})();
