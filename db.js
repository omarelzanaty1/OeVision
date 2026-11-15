/* Supabase client. Loads only a public key (anon/publishable) and refuses anything that looks like a secret key. */
(() => {
  const url = String(window.SUPABASE_URL || "").trim(), key = String(window.SUPABASE_ANON_KEY || "").trim();
  const isSecret = k => {
    if (/^sb_secret_/.test(k)) return true;
    try { return JSON.parse(atob(k.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).role === "service_role"; } catch (e) { return false; }
  };
  window.sb = null;
  if (!window.supabase || !url || !key) return;
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url)) { console.error("SUPABASE_URL is not a valid Supabase project URL."); return; }
  if (isSecret(key)) { console.error("A secret/service_role key was detected in config.js. Refusing to use it. Use the anon/publishable key only."); return; }
  window.sb = window.supabase.createClient(url, key, { auth: { flowType: "pkce" } });
})();
