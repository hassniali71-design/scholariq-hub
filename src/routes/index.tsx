import { createFileRoute } from "@tanstack/react-router";

import { PlatformLoginCard } from "@/components/auth/PlatformLoginCard";

/**
 * The root URL is now the platform operator's own login — not the client-facing generic
 * one (that moved to `/login`). Bookmarking the base Cloudflare URL always lands on this.
 */
export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "دخول إدارة المنصة" },
      { name: "description", content: "دخول خاص بمشغّل المنصة — ليس للعملاء." },
    ],
  }),
  component: () => <PlatformLoginCard />,
});
