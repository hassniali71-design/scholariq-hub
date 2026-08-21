import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * The platform login moved to `/` (the site's root). This stays as a redirect so any
 * existing bookmark/link to the old path keeps working.
 */
export const Route = createFileRoute("/platform/login")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
});
