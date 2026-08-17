import { createFileRoute } from "@tanstack/react-router";

import { LoginCard } from "@/components/auth/LoginCard";
import { fetchCenterBySlug } from "@/lib/data-functions.server";

/**
 * SUPABASE_MIGRATION_SPEC.md §11-ب — the link handed to a real client, instead of the
 * generic `/`. Resolved server-side via `loader` so the branding is already in the initial
 * HTML (SSR), not a client-side flash after a loading state.
 */
export const Route = createFileRoute("/login/$slug")({
  loader: ({ params }) => fetchCenterBySlug({ data: { slug: params.slug } }),
  head: () => ({
    meta: [
      { title: "تسجيل الدخول — منصة إدارة السناتر التعليمية" },
      { name: "description", content: "بوابة دخول آمنة، بدون تسجيل ذاتي." },
    ],
  }),
  component: LoginBySlug,
});

function LoginBySlug() {
  const center = Route.useLoaderData();
  return <LoginCard branding={center ? { name: center.name, accentColor: center.accent_color } : null} />;
}
