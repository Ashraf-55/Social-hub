# Social Hub — Unified Social Media Automation & Customer Messaging Platform

منصة واحدة لإدارة رسائل WhatsApp Business وFacebook Messenger وInstagram وTikTok من Dashboard واحدة، مع Automation عبر n8n وAI اختياري.

## Quick Start (Local, Mock Mode)

Mock Mode يشغّل النظام بالكامل (Auth, Inbox, Automations, AI) بدون أي حسابات منصات حقيقية.

```bash
cp .env.example .env
# عدّل DATABASE_URL على قاعدة Postgres محلية أو استخدم docker-compose (أدناه)

npm install
npx prisma migrate dev --name init
npm run db:seed        # ينشئ admin@example.com / password123
npm run dev
```

افتح http://localhost:3000 وسجّل الدخول، ثم من صفحة **Inbox** اضغط أزرار Mock Mode لمحاكاة رسائل واردة من كل منصة، ومن **Integrations** اضغط "Connect (Mock)" لكل منصة.

## Quick Start (Docker)

```bash
cp .env.example .env
docker compose up --build
```

يشغّل هذا التطبيق + PostgreSQL + n8n معًا. راجع `DEPLOYMENT.md` لملاحظات الإنتاج (لا تستخدم Postgres الخاص بـ Docker في Production — استخدم Managed Database).

## التبديل إلى Live Mode (حسابات حقيقية)

في `.env`:

```env
APP_MODE=live
```

ثم املأ credentials كل منصة تريد ربطها فعليًا (راجع `INTEGRATIONS.md`). أي منصة بدون credentials تبقى ببساطة "Not Connected" وباقي النظام يستمر في العمل طبيعيًا (هذا سلوك مقصود، ليس خطأ).

## المستندات

- `ARCHITECTURE.md` — البنية العامة، Adapter Pattern، Unified Message Model
- `DATABASE.md` — شرح Prisma Schema
- `API.md` — كل الـ API Endpoints
- `INTEGRATIONS.md` — خطوات ربط كل منصة (WhatsApp/Messenger/Instagram/TikTok) بالتفصيل
- `N8N.md` — إعداد n8n وربطه بالنظام
- `AI.md` — إعداد الـ AI Module الاختياري
- `DEPLOYMENT.md` — النشر في Production
- `SECURITY.md` — الإجراءات الأمنية المطبقة

## حالة المشروع (صريحة)

هذا الأساس (Phase 1-3 من خطة التنفيذ الأصلية، بالإضافة إلى هياكل الـ Webhooks/Adapters لكل المنصات) **حقيقي وقابل للتشغيل فعليًا في Mock Mode**. راجع الـ Final Report المُرسل في المحادثة لمعرفة بالضبط أي أجزاء تعمل end-to-end الآن، وأيها Scaffold يحتاج استكمالًا (خصوصًا: UI polish إضافي، تغطية اختبارات أوسع، وربط TikTok الفعلي الذي يحتاج تأكيد endpoints من توثيق TikTok الرسمي لحسابك تحديدًا).
