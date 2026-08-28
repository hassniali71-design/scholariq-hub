<!-- DEPLOYMENT_SPEC.md — نشر المشروع على Cloudflare Workers بشكل دائم. -->

# النشر على Cloudflare — من محلي مؤقت لرابط دائم

## 0) السياق
المشروع (TanStack Start) مُجهَّز أصلاً لـ Cloudflare — نواتج `bun run build` بتولّد
`wrangler.json` تلقائياً من زمان. المطلوب هنا: تأكيد الإعداد + ربط بيانات حقيقية للحساب +
تنفيذ النشر الفعلي، مش بناء من الصفر.

## 1) لماذا Wrangler CLI بمفتاح API لا بتسجيل دخول تفاعلي
تسجيل الدخول العادي لـWrangler بيفتح متصفح لتسجيل دخول — كلود كود مش هيقدر يعمل الخطوة دي
بنفسه. الحل: **مفتاح API من Cloudflare** بيسمح بنشر مباشر من التيرمينال بدون أي تفاعل متصفح.

## 2) التحقق من إعداد Cloudflare الحالي
- افحص `vite.config.ts`/`app.config.ts`: هل بلجن `@cloudflare/vite-plugin` أو Nitro preset
  `cloudflare-module` مُفعَّل فعلاً؟ إن لم يكن، فعّله
- افحص/صحّح `wrangler.json` (أو أنشئه إن لم يكن موجوداً بشكل صريح): `name`، `main` يشير
  لنقطة دخول السيرفر الصحيحة، `compatibility_date` حديث، `compatibility_flags: ["nodejs_compat"]`،
  `assets.directory` يشير لـ`.output/public`

## 3) الأسرار (Secrets) — ليست نفس ملف .env المحلي
متغيرات Supabase الحساسة (`SUPABASE_SERVICE_ROLE_KEY` خصوصاً) **لا تُنشر أبداً كملف .env
داخل الكود المنشور**. تُضاف كـSecrets حقيقية عبر Wrangler:
```
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_ANON_KEY
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
```
كل أمر هيطلب القيمة، وتُخزَّن مشفَّرة على Cloudflare نفسها، وليست ملفاً يُقرأ من القرص.

## 4) البناء والنشر
```
bun run build
wrangler deploy
```
باستخدام `CLOUDFLARE_API_TOKEN` و`CLOUDFLARE_ACCOUNT_ID` كمتغيرات بيئة وقت التنفيذ (وليس
تسجيل دخول تفاعلي).

## 5) التحقق بعد النشر
- Cloudflare بيدّي رابطاً تلقائياً بصيغة `اسم-المشروع.اسم-الحساب.workers.dev` — يعمل فوراً
- افحص كل الروutes الأساسية (`/`, `/platform/login`, `/login/$slug`) على الرابط الجديد
- تأكد إن الاتصال بـSupabase شغال من البيئة المنشورة (ليست localhost) — جرّب تسجيل دخول حقيقي

## 6) نطاق مخصص (اختياري، بعد التأكد إن كل حاجة شغالة)
لو صاحب المشروع عنده دومين حقيقي جاهز، يُضاف لاحقاً عبر Cloudflare Dashboard → Workers &
Pages → Custom Domains. ليس شرطاً للتشغيل الأولي — رابط `workers.dev` يعمل بشكل كامل ودائم
من اليوم الأول.