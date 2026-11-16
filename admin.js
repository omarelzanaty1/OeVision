(() => {
const sb = window.sb, app = document.querySelector("#app"), esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const BUCKET = "project-images", ATT = "client-attachments"; let rows = [];
if (!sb) { app.innerHTML = '<div class="empty">اضبط SUPABASE_URL و SUPABASE_ANON_KEY في config.js</div>'; return; }
const bctx = { sb, app, guard: o => guard(o), exit: note => listView(note) };
const msg = (t, bad) => `<div class="${bad ? "err" : "mu"}">${esc(t)}</div>`;

async function start() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return loginView();
  const { data, error } = await sb.rpc("is_admin");
  if (error) return deniedView("تعذّر التحقق من الصلاحيات.");
  if (data !== true) return deniedView("هذا الحساب ليس حساب مدير.");
  document.querySelector("#tabs").hidden = false;
  if (!(await Builder.restoreCurrent(bctx))) listView();
}
/* Non-admin (or unverifiable) session: show nothing of the dashboard and DO NOT sign the user out of the public site. */
function deniedView(t) {
  document.querySelector("#tabs").hidden = true;
  app.innerHTML = `<div class="panel" style="max-width:420px;margin:40px auto;text-align:center"><h2>${esc(t)}</h2><div class="row" style="justify-content:center"><a class="btn or" href="index.html#/home">العودة للموقع</a><button class="btn gh" id="so">تسجيل الخروج</button></div></div>`;
  document.querySelector("#so").onclick = async () => { await sb.auth.signOut(); loginView(); };
}
/* Re-verify the session and admin role (server side, via is_admin()) before every sensitive operation. RLS remains the real enforcement. */
let okAt = 0;
async function guard(o = {}) {
  if (o.cache && Date.now() - okAt < 60000) return true;   /* autosave / uploads: re-verify at most once a minute; manual actions always re-verify */
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { loginView("انتهت الجلسة، سجّل الدخول مرة أخرى."); return false; }
  const { data, error } = await sb.rpc("is_admin");
  if (error || data !== true) { okAt = 0; deniedView(error ? "تعذّر التحقق من الصلاحيات." : "هذا الحساب ليس حساب مدير."); return false; }
  okAt = Date.now(); return true;
}
function loginView(e = "") {
  document.querySelector("#tabs").hidden = true;
  app.innerHTML = `<form id="lf" style="max-width:420px;margin:40px auto"><h2>تسجيل دخول المدير</h2><label>Email<input name="e" type="email" required autocomplete="username"></label><label>Password<input name="p" type="password" required autocomplete="current-password"></label>${e ? msg(e, 1) : ""}<button class="btn">دخول</button><a class="mu" href="index.html" style="font-size:13px">للدخول بحساب Google: سجّل الدخول من الموقع الرئيسي ثم افتح Dashboard من شريط التنقل.</a></form>`;
  document.querySelector("#lf").onsubmit = async ev => {
    ev.preventDefault(); const f = new FormData(ev.target);
    const { error } = await sb.auth.signInWithPassword({ email: f.get("e"), password: f.get("p") });
    error ? loginView("بيانات الدخول غير صحيحة.") : start();
  };
}

async function listView(note = "") {
  const { data, error } = await sb.from("projects").select("*").order("created_at", { ascending: false });
  if (error) { app.innerHTML = msg("تعذّر تحميل المشاريع: " + error.message, 1); return; }
  rows = data;
  app.innerHTML = `<div class="row" style="justify-content:space-between;align-items:center;margin:0 0 20px"><h2 style="margin:0">إدارة الأعمال</h2><button class="btn or" id="add">+ إضافة عمل جديد</button></div>${note ? msg(note) : ""}
  ${rows.length ? rows.map(r => `<div class="arow"><img src="${esc(r.cover_image || "")}" alt=""><div class="grow"><b>${esc(r.title_ar || r.title_en || "(بدون عنوان)")}</b><div class="mu" style="font-size:13px">${r.category === "web" ? "Website Development" : "Graphic Design"} · ${esc(r.year || "")}</div></div><span class="st ${r.is_published ? "pub" : ""}">${r.is_published ? "منشور" : "مسودة"}</span>
  <button class="btn gh sm" data-a="tog" data-id="${r.id}">${r.is_published ? "إخفاء" : "نشر"}</button><button class="btn sm" data-a="edit" data-id="${r.id}">تعديل</button><button class="btn sm dng" data-a="del" data-id="${r.id}">حذف</button></div>`).join("") : `<div class="empty">لا توجد أعمال بعد. اضغط «إضافة عمل جديد».</div>`}`;
  document.querySelector("#add").onclick = () => Builder.open(bctx, null);
}
app.addEventListener("click", async e => {
  const b = e.target.closest("[data-a]"); if (!b) return; const r = rows.find(x => x.id === b.dataset.id);
  if (b.dataset.a === "edit") Builder.open(bctx, r);
  if (b.dataset.a === "tog") { if (!await guard()) return; const { error } = await sb.from("projects").update({ is_published: !r.is_published }).eq("id", r.id); listView(error ? error.message : "تم التحديث."); }
  if (b.dataset.a === "del" && confirm("حذف المشروع نهائيًا مع صوره؟")) {
    if (!await guard()) return;
    const paths = [...new Set(Builder.urlsOf(r).map(Builder.pathOf).filter(Boolean))];
    const { error } = await sb.from("projects").delete().eq("id", r.id);
    if (!error && paths.length) await sb.storage.from(BUCKET).remove(paths);
    listView(error ? error.message : "تم الحذف.");
  }
});
const ST = { new: "طلب جديد", reviewing: "قيد المراجعة", in_progress: "قيد التنفيذ", completed: "مكتمل", rejected: "مرفوض" };
const SV = { logo: "Logo Design", identity: "Visual Identity", graphic: "Graphic Design", web: "Website Development" };
const dt = x => new Date(x).toLocaleString("ar-EG");
document.querySelector("#tabs").onclick = async e => { const t = e.target.dataset.t; if (!t || !await Builder.canLeave()) return; if (t === "p") listView(); if (t === "r") reqList(); };
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
