# التخزين
| المخزن | النوع | الحد | الأنواع المسموحة |
|---|---|---|---|
| `project-images` | عام (Public) | 8MB | JPEG, PNG, WebP, GIF |
| `client-attachments` | خاص | 10MB | صور، PDF، ZIP، Word (doc/docx)، TXT، Illustrator/PostScript، PSD |

## project-images
القراءة العامة عبر الرابط المباشر (لعرض الأعمال). الكتابة والتعديل والحذف للمدير فقط، والزائر لا يستطيع سرد الملفات. استخدم مسارًا بمعرّف المشروع (`<project_id>/<ملف>`). تنبيه: صور المسودات يمكن فتحها لمن يعرف رابطها بالضبط.

## client-attachments
- مسار الرفع الإلزامي: `<user_id>/<request_id>/<اسم_الملف>`.
- العميل يرفع داخل مجلده فقط، ويقرأ ملفاته فقط. المدير يقرأ الكل.
- الحذف: المدير دائمًا، والعميل لملفات طلب حالته `new` فقط (عبر Storage API).
- لا تعديل/استبدال للملفات للعملاء. للعرض استخدم Signed URL (`createSignedUrl`) بمدة قصيرة.
- جدول `request_attachments` يتحقق أيضًا أن `file_path` يطابق `<user_id>/<request_id>/%`.

لم يُستخدم Edge Function في هذه المرحلة.
