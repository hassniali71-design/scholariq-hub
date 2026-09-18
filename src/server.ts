import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

/**
 * تتبّعنا مصدر unenv (المكتبة اللي بتوفّر process.env جوه Cloudflare Workers):
 * الـproxy بتاعها بتقرأ من globalThis.__env__ أولاً قبل أي حاجة تانية
 * (node_modules/unenv/dist/runtime/node/internal/process/env.mjs). نيترو نفسه
 * بيضبط globalThis.__env__ = env في المُعالِج الافتراضي بتاعه (cloudflare-module
 * preset)، لكن بما إن tanstackStart.server.entry بيوجّه لملف src/server.ts ده
 * بدل معالج نيترو الجاهز، السطر ده مبيتنفذش خالص — فـ process.env["ERP_SUPABASE_URL"]
 * بيرجع فاضي دايماً رغم إن السر مسجَّل فعلاً عند Cloudflare (تأكدنا بـ
 * `wrangler secret list`). الحل: نضبط globalThis.__env__ بنفسنا هنا بنفس
 * الطريقة بالظبط اللي نيترو كان المفروض يعملها — env هنا هو نفسه bindings
 * الـWorker الحقيقية اللي Cloudflare بيمررها لكل طلب (موثّق في التوقيع نفسه).
 */
function syncCloudflareEnvGlobal(env: unknown) {
  if (!env || typeof env !== "object") return;
  (globalThis as { __env__?: unknown }).__env__ = env;
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    syncCloudflareEnvGlobal(env);
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
