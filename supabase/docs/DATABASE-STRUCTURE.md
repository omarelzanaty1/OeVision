# هيكل قاعدة البيانات
المشروع: `bgstnfahasiynbjdqgpz` (eu-west-1) — Migration: `portfolio_backend_core`. كان المشروع فارغًا تمامًا قبل التنفيذ، ولم يُحذف أو يُعدَّل أي شيء موجود.

## الجداول (schema: public)
| الجدول | الغرض | ملاحظات |
|---|---|---|
| `profiles` | ملف كل مستخدم | `id` = `auth.users.id`. الأعمدة: full_name, email, avatar_url, role (`client`/`admin`), created_at, updated_at. يُنشأ تلقائيًا عند التسجيل. |
| `admins` | قائمة المديرين | `id`, `user_id` (فريد), `created_at`. **حد أقصى حسابان** بقيد في قاعدة البيانات. |
| `projects` | الأعمال | title_ar/en, description_ar/en, category (`graphic`/`web`), cover_image, project_url, gallery_images[], is_published, display_order, created_at, updated_at. |
| `project_requests` | طلبات العملاء | user_id, service_type (`logo`/`identity`/`graphic`/`web`), project_name, brief_answers (jsonb), additional_notes, status (`new`/`reviewing`/`in_progress`/`completed`/`rejected`). |
| `request_attachments` | مرفقات الطلبات | request_id, user_id, file_name, file_path, file_type, file_size (حتى 10MB). |
| `contact_messages` | رسائل صفحة Contact | user_id (اختياري), name, email, message. |

**عمودان إضافيان في `projects` عن قائمتك:** `tools` (الأدوات المستخدمة) و`year` (سنة التنفيذ)، لأن الموقع الحالي يعرضهما. لم أنشئ أي جداول مساعدة.

## القيود
أطوال النصوص محدودة، `brief_answers` حتى ~100KB، المعرض حتى 40 صورة، المرفقات حتى 10 لكل طلب، وكل عميل حتى 20 طلبًا كل 24 ساعة، وصيغة البريد في الرسائل مفحوصة.

## الفهارس
projects (is_published, display_order, created_at)، project_requests (user_id) و(status, created_at)، request_attachments (request_id) و(user_id)، contact_messages (created_at) و(user_id). كل المفاتيح الأجنبية مفهرسة.

## الدوال والـ Triggers
- `handle_new_user`: ينشئ Profile بدور client عند كل تسجيل. `handle_user_email_change`: يزامن البريد.
- `is_admin()`: تتحقق من جدول admins عبر `auth.uid()` (لا شيء يأتي من الواجهة).
- `admins_guard` (حد حسابين + منع التعديل)، `sync_profile_role` (يضبط role تلقائيًا من admins)، `profiles_guard` (يمنع تغيير role أو id).
- `touch_updated_at`، `requests_guard`، `attachments_guard`.
- `grant_admin(email)` و`revoke_admin(email)`: للتنفيذ من SQL Editor فقط (انظر ADMIN-SETUP.md).
