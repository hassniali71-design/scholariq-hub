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
 * تشخيص مؤقت أخير: الإصلاحات السابقة (نسخ process.env، ضبط globalThis.__env__)
 * اتأكدت نظرياً من كود nitro/unenv نفسه لكن لسه مش شغالة عملياً — يبقى المشكلة
 * قبل كل ده: نفس بارامتر env اللي بيوصل لـfetch هنا (أول نقطة ممكنة في الكود
 * كله) هو نفسه فاضي أو مش زي المتوقع. بنسجّل أسماء مفاتيحه هنا مباشرة (بدون
 * أي طبقة وسيطة) عشان نتأكد نهائياً هل Cloudflare بيمرر الأسرار فعلاً للدالة
 * دي ولا لأ.
 */
function recordRawEnvDebug(env: unknown) {
  const g = globalThis as { __RAW_ENV_DEBUG__?: string };
  try {
    if (env === null) {
      g.__RAW_ENV_DEBUG__ = "env === null";
    } else if (env === undefined) {
      g.__RAW_ENV_DEBUG__ = "env === undefined";
    } else if (typeof env !== "object") {
      g.__RAW_ENV_DEBUG__ = `typeof env === ${typeof env}`;
    } else {
      const keys = Object.keys(env as Record<string, unknown>);
      g.__RAW_ENV_DEBUG__ = `env keys (${keys.length}): ${keys.join(", ") || "(none)"}`;
    }
  } catch (e) {
    g.__RAW_ENV_DEBUG__ = `تعذّر فحص env: ${e instanceof Error ? e.message : String(e)}`;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    recordRawEnvDebug(env);
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
