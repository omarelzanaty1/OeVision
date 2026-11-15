# Omar Elzanaty — Personal Portfolio
Visual Identity Designer & Web Developer · Egypt

Static site (HTML/CSS/JS) with Supabase (Auth, Database, Storage). Arabic/English (RTL/LTR).

## Structure
- `index.html`, `app.js`, `style.css`, `assets/` — public site (Home, Work, Project Brief, Contact, My Account)
- `admin.html`, `admin.js` — admin dashboard (protected by Supabase Auth + RLS)
- `config.js` — Supabase URL + **anon/publishable key only** (never the service_role key)
- `supabase/docs/` — database, security, storage, auth, admin setup and test report

## Security
The service_role key must never be committed or placed in front-end files. All permissions are enforced by RLS in the database.
