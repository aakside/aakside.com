import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import QRCode from "qrcode/lib/core/qrcode.js";
import { emptyState, validateState, vcard, isRecord, contactOptions } from "./model.ts";
import { adminPage } from "./ui.ts";
import type { Env, ShareRecord } from "./types.ts";

const OWNER = "aakside@gmail.com";
const keySets = new Map<string, JWTVerifyGetKey>();
const headers = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
};

function response(body: BodyInit | null, status = 200, extra: Record<string, string> = {}) {
  return new Response(body, { status, headers: { ...headers, ...extra } });
}
const json = (value: unknown, status = 200) =>
  response(JSON.stringify(value), status, {
    "Content-Type": "application/json",
  });

function qr(text: string) {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: "M" });
  let path = "";
  for (let y = 0; y < modules.size; y++)
    for (let x = 0; x < modules.size; x++)
      if (modules.get(y, x)) path += `M${x + 4} ${y + 4}h1v1h-1z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${modules.size + 8} ${modules.size + 8}" shape-rendering="crispEdges"><path fill="white" d="M0 0h${modules.size + 8}v${modules.size + 8}H0z"/><path fill="black" d="${path}"/></svg>`;
}

async function body(request: Request): Promise<unknown> {
  if (!request.headers.get("Content-Type")?.startsWith("application/json"))
    throw Error("Expected JSON.");
  const reader = request.body?.getReader();
  if (!reader) throw Error("Missing body.");
  let size = 0;
  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 32768) {
      await reader.cancel();
      throw Error("Request too large.");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}

export function createWorker(
  resolveKeySet: (issuer: string) => JWTVerifyGetKey = (issuer) => {
    if (!keySets.has(issuer))
      keySets.set(issuer, createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`)));
    return keySets.get(issuer)!;
  },
) {
  return {
    async fetch(request: Request, env: Env): Promise<Response> {
      const url = new URL(request.url);
      if (!env.CONTACTS)
        return response("Contact sharing configuration: missing CONTACTS KV binding.", 503);
      if (!env.CONTACT_ORIGIN)
        return response("Contact sharing configuration: missing CONTACT_ORIGIN.", 503);
      if (!env.ACCESS_TEAM_DOMAIN)
        return response("Contact sharing configuration: missing ACCESS_TEAM_DOMAIN.", 503);
      if (!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(env.ACCESS_TEAM_DOMAIN))
        return response(
          "Contact sharing configuration: invalid ACCESS_TEAM_DOMAIN. Expected https://<team>.cloudflareaccess.com with no trailing slash or whitespace.",
          503,
        );
      if (!env.ACCESS_AUD)
        return response("Contact sharing configuration: missing ACCESS_AUD.", 503);
      // No production data on preview/alternate hosts, even with a valid Access JWT.
      if (url.origin !== env.CONTACT_ORIGIN) return response("Not found.", 404);
      try {
        if (url.pathname.startsWith("/c/")) {
          if (!["GET", "HEAD"].includes(request.method))
            return response("Method not allowed.", 405);
          const token = url.pathname.slice(3);
          if (!/^[a-f0-9]{64}$/.test(token))
            return response("This share is unavailable or expired.", 404);
          const share = await env.CONTACTS.get<ShareRecord>(`share:${token}`, "json");
          if (!share || !Number.isFinite(share.expiresAt) || Date.now() >= share.expiresAt)
            return response("This share is unavailable or expired.", 404);
          const stored = await env.CONTACTS.get<unknown>("state", "json");
          const state = stored ? validateState(stored) : null;
          if (!state) return response("This share is unavailable or expired.", 404);
          return response(
            request.method === "HEAD" ? null : vcard(state.profile, share.fields, share.notes),
            200,
            {
              "Content-Type": "text/vcard; charset=utf-8",
              "Content-Disposition": 'attachment; filename="contact.vcf"',
            },
          );
        }
        if (url.pathname === "/") return Response.redirect(`${url.origin}/admin/`, 302);
        if (url.pathname !== "/admin" && !url.pathname.startsWith("/admin/"))
          return response("Not found.", 404);
        let identity;
        try {
          const jwt = request.headers.get("Cf-Access-Jwt-Assertion");
          if (!jwt) return response("Sign in through Cloudflare Access to continue.", 401);
          identity = (
            await jwtVerify(jwt, resolveKeySet(env.ACCESS_TEAM_DOMAIN), {
              issuer: env.ACCESS_TEAM_DOMAIN,
              audience: env.ACCESS_AUD,
              algorithms: ["RS256"],
              requiredClaims: ["exp", "iat", "sub", "email"],
            })
          ).payload;
        } catch {
          return response("Your sign-in has expired or is invalid.", 401);
        }
        if (identity.email !== OWNER) return response("Access denied.", 403);
        if (
          !["GET", "HEAD"].includes(request.method) &&
          request.headers.get("Origin") !== env.CONTACT_ORIGIN
        )
          return response("Invalid request origin.", 403);
        if (request.method === "GET" && ["/admin", "/admin/"].includes(url.pathname)) {
          const nonce = crypto.randomUUID();
          return response(adminPage(nonce), 200, {
            "Content-Type": "text/html; charset=utf-8",
            "Content-Security-Policy": `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; img-src blob:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'`,
          });
        }
        if (url.pathname === "/admin/api/state" && request.method === "GET")
          return json(
            validateState((await env.CONTACTS.get<unknown>("state", "json")) || emptyState()),
          );
        if (url.pathname === "/admin/api/state" && request.method === "PUT") {
          let state;
          try {
            state = validateState(await body(request));
          } catch (e) {
            return json(
              {
                error: e instanceof Error ? e.message : "Invalid contact data.",
              },
              400,
            );
          }
          await env.CONTACTS.put("state", JSON.stringify(state));
          return json(state);
        }
        if (url.pathname === "/admin/api/share" && request.method === "POST") {
          let input;
          try {
            input = await body(request);
          } catch {
            return json({ error: "Invalid request." }, 400);
          }
          if (
            !isRecord(input) ||
            typeof input.ttl !== "number" ||
            ![300, 900, 3600, 86400, 432000].includes(input.ttl)
          )
            return json({ error: "Choose a supported duration." }, 400);
          const stored = await env.CONTACTS.get<unknown>("state", "json");
          const state = stored ? validateState(stored) : null;
          const preset = state?.presets.find((p) => p.id === input.presetId);
          if (
            preset &&
            ((input.notes ?? "") !== preset.notes ||
              !Array.isArray(input.fields) ||
              JSON.stringify([...input.fields].sort()) !==
                JSON.stringify([...preset.fields].sort()))
          ) {
            return json(
              {
                error:
                  "The saved preset differs from your preview. Reload or wait for the recent save to propagate before sharing.",
              },
              409,
            );
          }
          if (
            !state ||
            !preset ||
            !contactOptions(state.profile).some((o) => preset.fields.includes(o.key) && o.value)
          )
            return json(
              {
                error:
                  "Save a preset with populated fields first. A recent save may need a moment to propagate.",
              },
              400,
            );
          const token = [...crypto.getRandomValues(new Uint8Array(32))]
            .map((n) => n.toString(16).padStart(2, "0"))
            .join("");
          const expiresAt = Date.now() + input.ttl * 1000;
          // Freeze the field allowlist: editing a preset must never widen an existing share.
          await env.CONTACTS.put(
            `share:${token}`,
            JSON.stringify({
              fields: preset.fields,
              notes: preset.notes,
              expiresAt,
            }),
            { expirationTtl: input.ttl },
          );
          const link = `${env.CONTACT_ORIGIN}/c/${token}`;
          return json({
            url: link,
            expiresAt,
            svg: qr(link),
            fields: preset.fields,
          });
        }
        return response("Not found.", 404);
      } catch {
        return json({ error: "Contact storage is unavailable. Please try again." }, 503);
      }
    },
  };
}

export default createWorker();
