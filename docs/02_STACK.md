# الستاك التقني (مهم — مختلف عن الافتراضات الشائعة)

- **TanStack Start** (ليس Next.js وليس Vite+React SPA عادي) — فريمورك SSR كامل.
- **TanStack Router**: file-based routing حسب اسم الملف (`owner.index.tsx` → `/owner`،
  `teacher.session.tsx` → `/teacher/session`).
- **React 19** + TanStack Query (مُجهّز في `router.tsx` لكن غير مُستخدم فعلياً بعد).
- **Tailwind CSS v4** (نظام توكينز `@theme inline` مختلف عن v3 — راجع `src/styles.css`).
- **shadcn/ui** (style: new-york, prefix فارغ, alias `@/*` → `src/*`).
- **Vite 8** + بلجن Lovable (`@lovable.dev/vite-tanstack-config`) — لا تضف بلجنز يدوياً
  فوق البلجن ده، فيه تحذير صريح في `vite.config.ts` إنه هيكسر التطبيق (duplicate plugins).
- **Package manager: bun** (`bun.lock` موجود، مفيش `package-lock.json` أو `yarn.lock`).
- `dir="rtl"` و`lang="ar"` مضبوطين على مستوى `<html>` في `routes/__root.tsx` — الواجهة
  كلها RTL.

## أوامر التشغيل

```bash
bun i
bun run dev      # أو: npm run dev
bun run build
bun run lint
```

قاعدة عدم كسر `bun run dev` بعد أي تعديل موجودة في `docs/07_RULES.md`.
