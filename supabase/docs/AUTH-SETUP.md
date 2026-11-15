# إعداد Auth (يدويًا من لوحة Supabase)
لا أملك أداة لتعديل إعدادات Auth، فهذه الخطوات عليك. لا تفترض أن شيئًا منها مفعّل.

1. **Authentication > Providers > Email**: فعّله، وفعّل **Confirm email** (التحقق من البريد). أنصح بحد أدنى 8+ أحرف لكلمة المرور (Settings > Password).
2. **URL Configuration**: Site URL = رابط موقعك على Vercel. أضف في Redirect URLs رابط الموقع ورابط التجربة المحلي. هذا ضروري لتأكيد البريد وإعادة التعيين وGoogle.
3. **Google OAuth**:
   - Google Cloud Console > APIs & Services > Credentials > Create OAuth client ID (Web application).
   - Authorized redirect URI: `https://bgstnfahasiynbjdqgpz.supabase.co/auth/v1/callback`.
   - انسخ Client ID وClient Secret إلى Supabase > Providers > Google وفعّله. (يلزم ضبط OAuth consent screen أولًا.)
4. **Password Reset**: يعمل من Auth تلقائيًا عبر `resetPasswordForEmail` ويحتاج رابط الموقع في Redirect URLs. راجع قوالب الرسائل (Email Templates) وترجمها للعربية إن أردت.
5. **SMTP مخصص**: خدمة البريد الافتراضية محدودة جدًا ولا تصلح للإنتاج. اربط مزود SMTP (Resend/Brevo...) قبل الإطلاق.
6. **CAPTCHA** (Auth > Attack Protection): يُنصح به لحماية التسجيل.
7. **Leaked password protection** تتوفر في الخطط المدفوعة فقط.
8. الجلسات: الإعدادات الافتراضية (Refresh token rotation مفعّل) مناسبة. لا تستخدم `service_role` في الواجهة أبدًا.

لربط الواجهة لاحقًا تحتاج Project URL ومفتاح anon/publishable فقط.
