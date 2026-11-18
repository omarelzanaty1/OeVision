# PHASE 1 — Authentication Security Report (analysis only)

- Branch: `portfolio-setup` (HEAD 7a13c54) · Supabase project: `bgstnfahasiynbjdqgpz` · Date: 2026-11-18
- Source of truth: the Security & Stability Audit (SEC-01…SEC-14, STB-01…STB-05). This report covers its Authentication items: SEC-02, SEC-03, SEC-05, SEC-08.
- **Nothing was changed.** No code, schema, migration, data, Storage, deploy or merge. No credentials or tokens appear in this file.
- Evidence sources: code review of the repo; read-only SQL against `auth.*` (counts and booleans only, no emails/PII); Supabase advisors. The Supabase Auth dashboard/API settings are **not readable from here** (the sandbox cannot reach `supabase.co`, and the connected tools expose no Auth-config reader). Every dashboard setting is therefore marked **NOT VERIFIED** unless a database fact proves it.

## 0. Correction to the earlier audit
SEC-02 said the admin logs in with email + password. The data shows otherwise: **the only admin account has Google as its only identity and has no password set.** The admin reaches the Dashboard by signing in with Google on the public site, then opening `admin.html` (the password form in `admin.html` is effectively unused today, and its own hint says to sign in with Google). The MFA conclusion of SEC-02 still stands, and the finding is sharpened in §3: Google's own 2-Step Verification is invisible to Supabase, so the session is always **AAL1**.

## 1. Current implementation

### 1.1 Facts from the database (read-only, verified)
| Fact | Value |
|---|---|
| Users in `auth.users` | 3, all email-confirmed |
| Identities | 3, all `google` (no email/password users exist yet) |
| Admins | 1 (the app allows max 2 via `grant_admin`), Google-only, **no password** |
| MFA factors | **0** total, 0 for the admin |
| `is_admin()` | `exists (select 1 from public.admins where user_id = auth.uid())`, SECURITY DEFINER, empty `search_path` |
| Policies that mention `aal` | **0** — nothing in RLS or Storage requires MFA |

### 1.2 Client code (verified in repo)
- `db.js`: supabase-js 2.45.4, `flowType: "pkce"`, default storage (localStorage), `persistSession` and `autoRefreshToken` on (library defaults). Refuses a service_role key. Anon key only in `config.js`.
- `app.js` (public site):
  - Google: `signInWithOAuth({provider:"google", options:{redirectTo: base()}})` where `base() = location.origin + location.pathname`.
  - Email: `signInWithPassword`; `signUp` with `emailRedirectTo: base()`. Generic error on bad sign-in (no account enumeration). The password input has `minlength="6"` (also applied in sign-in mode).
  - `onAuthStateChange` updates `USER`, runs `applyPending()` and `checkAdmin()`; it **returns early when the user id did not change** (`app.js:273`), which would also swallow a `PASSWORD_RECOVERY` event for an already-known user.
  - Dashboard link is shown only if `rpc("is_admin")` is true (UI convenience only).
  - **No** `resetPasswordForEmail`, no `PASSWORD_RECOVERY` handling, no MFA API calls anywhere (`grep mfa|aal|reset` = nothing).
- `admin.js` / `admin.html` (same origin ⇒ same session as the public site):
  - `start()`: `getSession()` → `rpc("is_admin")` → show dashboard. No AAL check.
  - `guard()` is the single choke point used by `builder.js` (3 sites) and `siteeditor.js` (3 sites) and by the project/request actions in `admin.js`: it re-reads the session and re-calls `is_admin()` (cached 60 s for autosave/uploads, always fresh for manual actions). The `rpc` hits the server, so the JWT is validated server-side; RLS remains the real enforcement.
  - Sign-out: `sb.auth.signOut()` (supabase-js default scope signs out all sessions).
- `supabase/docs/AUTH-SETUP.md` is a manual checklist; it recommends ≥ 8 characters (needs ≥ 10), mentions "Vercel" as host (see §2.1), and claims password reset "works automatically" (true on the Supabase side only). `ADMIN-SETUP.md` still says "admins = 0" (stale).

### 1.3 Session handling review
| Topic | Result |
|---|---|
| Token storage | localStorage (library default). Acceptable only together with CSP/SRI (SEC-01/06). |
| Refresh | Automatic; refresh-token rotation default — NOT VERIFIED in dashboard. |
| Server validation | Done by `rpc("is_admin")` on every guarded action. `getSession()` alone is only a local read and is never trusted on its own. |
| Expiry handling | Admin: `guard()` shows the login view when the session is gone. Public site: no explicit handling of a failed refresh (the user just appears signed out). Low. |
| Time-box / inactivity timeout | Dashboard feature (paid plans) — NOT VERIFIED. Recommended for the admin (e.g. 12 h time-box). |
| JWT expiry | Default 3600 s — NOT VERIFIED. Keep ≤ 1 h. |
| Shared session | Public site and admin share one origin ⇒ one session. Fine, but means AAL2 must be established once and then stays in the same session. |
| Client vs admin | Same Auth system; separation is purely `public.admins` + RLS. Regular clients never see the Website Editor (UI gated by `is_admin()`, writes blocked by RLS — verified in the audit). |

## 2. Dashboard settings checklist (all NOT VERIFIED — to be ticked by the owner)

> "Verified" can only come from the dashboard or the Management API. Please confirm each line and send screenshots/answers; do not send keys or secrets.

### 2.1 URL Configuration (Authentication → URL Configuration)
- [ ] **Site URL** = the exact production origin, `https://<PRODUCTION-DOMAIN>` — **the production domain is not known from the repo.** The docs say Vercel, the repo has `.nojekyll` (GitHub Pages style) and the git remote is GitHub. *Needed from you: the real production URL (and its sub-path if any).*
- [ ] **Redirect URLs** — exact entries, **no wildcards** (`**`, `*.vercel.app`, `*.github.io`):
  1. `https://<PRODUCTION-DOMAIN>/` — what `base()` returns when the site is opened at the root.
  2. `https://<PRODUCTION-DOMAIN>/index.html` — what `base()` returns when opened with the file name. (If the site lives in a sub-path, e.g. `/oevision/`, use that path.) The simplest permanent fix is to add a `SITE_URL` constant in `config.js` and use it instead of `location.origin + location.pathname`, so only **one** URL is needed.
  3. `http://localhost:<PORT>/` — **development only**; remove it from the production project (or use a separate dev project).
  4. No entry is needed for `admin.html` (no redirect-based flow starts there).
- [ ] Remove any leftover test/preview URLs and any `localhost` URL before launch.

### 2.2 Email provider (Authentication → Providers → Email)
- [ ] Email provider enabled (do **not** disable it; the spec forbids disabling existing methods).
- [ ] **Confirm email = ON.** This matters for the admin specifically: `grant_admin` is keyed by email and the admin's identity is Google. With confirmation OFF, someone could pre-register the admin's address with a password before the admin's first Google login. (Current data: all 3 users confirmed, so no exposure yet.)
- [ ] **Secure email change = ON**, **Secure password change = ON** (recent login required).
- [ ] Allow anonymous sign-ins = **OFF** (data shows 0 anonymous users; the site does not use them).
- [ ] Manual identity linking = OFF unless needed.

### 2.3 Password policy (Authentication → Policies / Sign In-Up)
- [ ] **Minimum password length = 10** (default is 6). Also tick lower + upper + digits (+ symbols) requirements.
- [ ] Leaked-password protection (HaveIBeenPwned): currently reported **OFF** by the advisor (confirmed). Enable if the plan allows; otherwise rely on length ≥ 10 and, for the admin, MFA.
- Note: no existing user has a password (all Google-only), so raising the minimum affects nobody today.

### 2.4 Google OAuth (Authentication → Providers → Google) — enabled in practice (3 Google identities exist), details NOT VERIFIED
- [ ] Client ID / Client Secret set (Secret only inside Supabase; never in the repo).
- [ ] In Google Cloud: Authorized redirect URI = `https://bgstnfahasiynbjdqgpz.supabase.co/auth/v1/callback`; Authorized JavaScript origins = the production origin (and `localhost` for dev only).
- [ ] OAuth consent screen **published** (not "Testing", otherwise only listed test users can sign in and tokens expire), with the correct app name, support email and privacy-policy link.
- [ ] "Skip nonce checks" = OFF. Scopes: `email`, `profile` only.
- [ ] Do not turn off Google; it is the admin's only login method.

### 2.5 SMTP (Authentication → SMTP Settings)
- [ ] Custom SMTP configured (Resend/Brevo/etc.), with SPF + DKIM (+ DMARC) on the sending domain. The built-in sender is heavily rate-limited and unsuitable for production confirmations and resets.
- [ ] Sender name/address = the O.E brand; email templates reviewed and translated (confirmation, reset, magic link, email change), with links using `{{ .ConfirmationURL }}` (no hard-coded hosts).

### 2.5b Email/MFA features
- [ ] **Multi-Factor Auth → TOTP enrolment and verification = ENABLED**. Phone MFA stays off. Set **Max verified factors ≥ 2** (so the admin can enrol a backup authenticator — see §5).

### 2.6 Rate limits & attack protection (Authentication → Rate Limits / Attack Protection)
Defaults below are from memory of Supabase's documented defaults and must be **checked** in the dashboard:
- [ ] Emails sent per hour (custom SMTP): keep low (e.g. 10–30/h) — the site sends only confirmations/resets.
- [ ] Sign-ups and sign-ins per 5 min per IP: default ≈ 30 — consider lowering (e.g. 10–15).
- [ ] Token refresh / verification and **MFA challenge/verify** limits: keep defaults or tighter.
- [ ] **CAPTCHA protection** (Turnstile or hCaptcha) enabled for sign-up, sign-in and password reset. Requires a small front-end change (token passed in `options.captchaToken`) — listed in §8.
- [ ] Leaked-password protection: see 2.3.

### 2.7 Sessions (Authentication → Sessions) — paid-plan features, NOT VERIFIED
- [ ] Time-box user sessions (suggest 12 h for everyone, or at least for admins), inactivity timeout (suggest 1–2 h), single session per user optional.
- [ ] JWT expiry 3600 s.

## 3. Confirmed issues and evidence

| ID | Sev | Status | Issue | Evidence |
|---|---|---|---|---|
| AUTH-01 | Medium | CONFIRMED | **The admin session can only ever be AAL1.** Admin has Google only, 0 MFA factors; the code never calls the MFA API; no RLS/Storage policy mentions `aal`. A stolen/hijacked Google session or token = full admin (projects, both public buckets, site content, client requests and attachments). | SQL: `mfa_factors_admin = 0`, `aal_in_policies = 0`; `grep mfa\|aal` in all `.js` = none. |
| AUTH-02 | Medium | CONFIRMED | **No password-reset flow, and adding one changes the admin's risk.** Today the admin has no password. A standard "forgot password" on a Google-only account lets whoever controls the mailbox create a password, i.e. a second credential path that skips Google's 2-Step Verification. | `grep resetPasswordForEmail` = none; `has_password=false` for admin. |
| AUTH-03 | Low | CONFIRMED | Signup form `minlength="6"` (also on sign-in), docs recommend 8; requirement is ≥ 10. The server-side minimum (dashboard) is NOT VERIFIED and is what actually enforces it. | `app.js` password input; `AUTH-SETUP.md` item 1. |
| AUTH-04 | Medium | CONFIRMED (design) | **Redirects are derived from `location.origin + location.pathname`.** Safe only with an exact allowlist; two different URLs (`/` and `/index.html`) can be produced, and wildcard allowlists would be exploitable. | `app.js:200,221,226`. |
| AUTH-05 | Low | CONFIRMED | `onAuthStateChange` ignores events when the user id is unchanged, so a `PASSWORD_RECOVERY` (or `MFA_CHALLENGE_VERIFIED`) event would be dropped. Must be handled before the id filter when those features are added. | `app.js:273`. |
| AUTH-06 | Low | CONFIRMED | Docs are stale/inaccurate: "Vercel" host unverified, 8-char minimum, "reset works automatically", "admins = 0". | `AUTH-SETUP.md`, `ADMIN-SETUP.md`. |
| AUTH-07 | Low | CONFIRMED | Leaked-password protection OFF (advisor). | Supabase advisors. |
| AUTH-08 | Info | CONFIRMED | Positive: all 3 accounts confirmed; no anonymous users; generic sign-in errors; `grant_admin`/`revoke_admin` not callable by clients; server-side re-check (`is_admin()`) before every admin action. | SQL + code. |
| AUTH-09 | — | NOT VERIFIED | Everything in §2 (Site URL, Redirect URLs, Confirm email, password minimum, Google consent screen, SMTP, rate limits, CAPTCHA, session time-box, MFA toggle). | No access to dashboard/API from this environment. |

## 4. MFA (TOTP) implementation proposal — **not implemented**

### 4.1 Principles
- Works for Google-signed-in admins: Supabase MFA is per user, independent of how the user signed in. After TOTP the same session is upgraded from **AAL1 to AAL2** (`getAuthenticatorAssuranceLevel()` → `currentLevel`/`nextLevel`).
- UI checks alone are not security (a tampered client can skip them). Real enforcement must be in the database (RLS/Storage) using the JWT claim `aal`. Therefore three stages, each reversible, and **mandatory MFA only at the last stage and only after the recovery path is tested.**

### 4.2 Stages
**Stage A — Optional enrolment (no lockout risk).**
- New `mfa.js` UI used by `admin.html`: "Security" panel to enrol TOTP (`mfa.enroll` → show QR + secret → `challenge` → `verify` with the 6-digit code), list factors (`mfa.listFactors`), remove a factor (`mfa.unenroll`, which Supabase itself only allows at AAL2).
- Enrol **two** factors (primary authenticator + a second device/app) — see recovery.
- `start()` in `admin.js`: if the admin has a verified factor and the session is AAL1 → show a "Enter your code" challenge view (`challenge` + `verify`) before the dashboard. If no factor exists, the dashboard still opens (with a visible "MFA not enabled" banner).

**Stage B — UI step-up for sensitive operations (`guard()`).**
- Extend `guard()` (already the single choke point) to also require `currentLevel === "aal2"` once the admin has a verified factor, for: publish / un-publish / restore of site content, project create/update/delete/publish toggle, uploads to `project-images`/`site-drafts`, changing a request status, opening client attachments, managing MFA factors. If AAL1 → show the code prompt, then retry the action.
- Still client-side only, so it protects against honest mistakes and session sharing, not a malicious client.

**Stage C — Database enforcement (separate migration, needs its own review + transaction dry-run like the Website Editor one).**
- Add `public.is_admin_strict()` (does **not** change `is_admin()`): admin **and** `(select auth.jwt() ->> 'aal') = 'aal2'`, **or** admin with *no verified factor* (conditional mode = Supabase's documented "enforce only for users who enrolled" pattern). Verified factors are read from `auth.mfa_factors` via SECURITY DEFINER with empty `search_path`.
- Swap it into the **write/sensitive** policies only: `projects` (insert/update/delete), `site_content_*` (all), `request` status update/delete, `contact_messages` select/delete, `request_attachments`/`client-attachments` admin paths, `project-images` + `site-drafts` insert/update/delete. Keep public reads and owner policies untouched. (The current 31 policies using `is_admin()` are listed in the audit; `is_admin()` itself stays as is for reads/UI.)
- Strict mode (admin **must** be AAL2 even without a factor) is the final switch (**mandatory MFA**) and is allowed only after §5 is complete and tested.

### 4.3 What would change for the admin
Sign in with Google as today → (once enrolled) enter a 6-digit code → dashboard. Public visitors and regular clients: no change.

## 5. Recovery and rollback plan

### 5.1 Recovery paths for a lost authenticator (must all be written down and one must be rehearsed before Stage C)
Supabase TOTP has **no built-in backup codes**, so recovery is designed around redundancy:
1. **Two enrolled factors** (e.g. phone authenticator + a second device or a password-manager TOTP). Max verified factors ≥ 2 (§2.5b).
2. **Break-glass via the Supabase dashboard (owner account)**, independent of the site: remove the admin's MFA factors (dashboard → Authentication → Users → the user → remove factors; or SQL `delete from auth.mfa_factors where user_id = '<admin>'`). The Supabase owner login must itself have 2FA and a recovery email. *The dashboard action name is NOT VERIFIED.*
3. **Second admin account** (the app allows two): a separately-enrolled, separately-stored admin so one lost device never blocks content management. It cannot remove the other's factor from the app, so it complements path 2, it does not replace it.
4. Document the Google account recovery (Google 2-Step backup codes) — the first factor of the admin's login.

### 5.2 Test plan before any mandatory switch (needs your approval; touches Auth users only, never `projects`/Storage)
1. Use a **temporary test admin** (a throwaway Google/email account; `grant_admin` allows a 2nd admin) — never the real admin.
2. Enrol factor 1 and factor 2; sign out/in; verify AAL2 is required (Stage B/C); verify a denied write at AAL1 (Stage C).
3. Simulate a lost device: remove factor 1 → still enter with factor 2; then remove all factors using the dashboard break-glass and confirm access returns.
4. Revoke the test admin and delete the test user. Confirm `projects`, images and both published projects are byte-identical (hash check, as done before).
5. Only then consider strict mode.

### 5.3 Rollback
- **Stage A/B (code only):** revert the commits; no data involved. Users with enrolled factors keep them (harmless).
- **Stage C (DB):** the migration ships with explicit rollback SQL that restores the original policies from the saved policy list (hash recorded before applying) and drops `is_admin_strict()`. Because `is_admin()` is never modified, rolling back cannot lock anyone out of reads. Apply only after a transaction dry-run on the real project ending in ROLLBACK, with the policies hash compared before/after.
- **Lockout emergency:** dashboard break-glass (5.1-2) or temporarily switch the policies back to `is_admin()` from the SQL editor with the saved rollback script.

## 6. Password-reset requirements (design, not implemented)
- UI (public site): "Forgot password?" in the sign-in dialog → `resetPasswordForEmail(email, {redirectTo: SITE_URL})`; always show a neutral message ("if the email exists, a link was sent") to avoid enumeration.
- Return handling: on `PASSWORD_RECOVERY` (handled **before** the "same user id" filter in `onAuthStateChange`) show a "set new password" form (`auth.updateUser({password})`, min 10, confirm field), then sign out the recovery session and ask to sign in again.
- **Required redirect URLs:** the same exact `SITE_URL` already in the allowlist (§2.1) — no extra entry needed if the recovery redirect is that URL. Do **not** add wildcard URLs for it.
- Email template for "Reset Password" reviewed and sent through custom SMTP (§2.5); CAPTCHA and rate limits on the reset endpoint (§2.6).
- **Admin caveat (AUTH-02):** because the admin currently has no password, enable the reset flow only together with Stage A/B at minimum, and ideally after Stage C, or restrict it so it cannot be used to create a password for the admin account (MFA AAL2 then still protects the dashboard).

## 7. Open items needing your input
1. The **production URL** (and sub-path if any) — decides Site URL and Redirect URLs.
2. Whether the plan includes custom SMTP, leaked-password protection, session time-box.
3. Dashboard confirmation of every box in §2 (screenshots without secrets).
4. Whether to create a **second admin** and which account to use for the test in §5.2.
5. Which CAPTCHA provider (Turnstile recommended).

## 8. Exact files that would need changes (once approved)
| File | Change |
|---|---|
| `config.js` | add public `window.SITE_URL` (production URL) — no secrets. |
| `app.js` | use `SITE_URL` instead of `base()`; password input `minlength` 10 (sign-up only; none on sign-in); "Forgot password" + recovery form; handle `PASSWORD_RECOVERY` before the same-id filter (`app.js:273`); optional CAPTCHA token on sign-up/sign-in/reset. |
| `mfa.js` (**new**) | TOTP enrol / challenge / verify / list / unenroll UI and AAL helpers. |
| `admin.html` | load `mfa.js` (script tag only). |
| `admin.js` | `start()` challenge step; `guard()` AAL2 step-up (Stage B); sign-out and denied views unchanged. |
| `builder.js`, `siteeditor.js` | **no change** (they call `ctx.guard`); only add handling for an "AAL2 required" error message from RLS in Stage C. |
| `style.css` | small styles for the MFA panel/QR. |
| `supabase/migrations/<date>_admin_mfa.sql` (**new, Stage C only**) | `is_admin_strict()` + policy swaps + rollback block; to be dry-run in a transaction first. **No change to `is_admin()`, `projects`, or existing buckets.** |
| `supabase/docs/AUTH-SETUP.md`, `ADMIN-SETUP.md`, `SECURITY-POLICIES.md` | correct the stale items (§3 AUTH-06), add the final checklist, MFA, and recovery. |
| tests (kept in repo, new) | extend the stub with `auth.mfa.*`; cover enrol, challenge, step-up, denied-at-AAL1, reset flow, and the "no lockout" path. |

## 9. Not done / not tested
- No dashboard setting could be read or changed (NOT VERIFIED).
- No real Google sign-in, no real email delivery, no real TOTP enrolment, and no AAL2 behaviour were exercised: they need the live dashboard, a real browser, and test accounts.
- No MFA or reset code has been written. **Waiting for your approval** before any implementation, and mandatory MFA stays blocked until §5.2 passes.
