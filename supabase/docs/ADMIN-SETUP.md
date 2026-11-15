# إدارة المديرين
لم يُنشأ أي مدير بعد، ولا توجد حسابات أو بيانات دخول وهمية. العدد الحالي في جدول admins = 0.

## الخطوات (بعد أن ترسل البريدين)
1. كل مدير يسجّل في الموقع (أو بـ Google) ويؤكد بريده. التعيين يرفض أي بريد غير مؤكد.
2. أنفذ لك (أو تنفذ أنت من SQL Editor):
   `select public.grant_admin('email1@example.com');`
   `select public.grant_admin('email2@example.com');`
3. يتغير `profiles.role` تلقائيًا إلى admin. المحاولة الثالثة تُرفض.
4. السحب: `select public.revoke_admin('email@example.com');` ثم يعود role إلى client.

## الأمان
- `grant_admin` و`revoke_admin` غير قابلتين للاستدعاء من الواجهة (مغلقتان عن anon وauthenticated).
- تحقق من أن حسابا المدير محميان بكلمة مرور قوية وبريد آمن، فمن يملك البريد يملك الحساب.
- الواجهة تتعرف على المدير بقراءة `profiles.role` أو استدعاء `rpc('is_admin')`، وليس بقراءة جدول admins.
