import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPair, exportJWK, createLocalJWKSet, SignJWT } from "jose";
import { createWorker } from "../src/worker.ts";
import { validateState, vcard } from "../src/model.ts";
import type { ContactStore, ShareResponse, Env } from "../src/types.ts";
const { privateKey, publicKey } = await generateKeyPair("RS256");
const jwk = await exportJWK(publicKey);
jwk.kid = "test";
const worker = createWorker(() => createLocalJWKSet({ keys: [jwk] }));
const origin = "https://contacts.example.com";
const issuer = "https://test.cloudflareaccess.com";
async function jwt(
  email = "aakside@gmail.com",
  options: { issuer?: string; aud?: string; exp?: string | number } = {},
) {
  return new SignJWT({ email })
    .setProtectedHeader({ alg: "RS256", kid: "test" })
    .setSubject("user")
    .setIssuedAt()
    .setIssuer(options.issuer || issuer)
    .setAudience(options.aud || "contacts")
    .setExpirationTime(options.exp || "5m")
    .sign(privateKey);
}
function environment() {
  const data = new Map<string, string>();
  const writes: { key: string; options?: { expirationTtl: number } }[] = [];
  return {
    CONTACT_ORIGIN: origin,
    ACCESS_TEAM_DOMAIN: issuer,
    ACCESS_AUD: "contacts",
    data,
    writes,
    CONTACTS: {
      get: async <T>(key: string): Promise<T | null> =>
        data.has(key) ? (JSON.parse(data.get(key)!) as T) : null,
      put: async (key: string, value: string, options?: { expirationTtl: number }) => {
        data.set(key, value);
        writes.push({ key, options });
      },
    } satisfies ContactStore,
  };
}
function request(
  path: string,
  token?: string,
  method = "GET",
  value?: unknown,
  requestOrigin = origin,
) {
  return new Request(origin + path, {
    method,
    headers: {
      ...(token ? { "Cf-Access-Jwt-Assertion": token } : {}),
      Origin: requestOrigin,
      "Content-Type": "application/json",
    },
    body: value === undefined ? undefined : JSON.stringify(value),
  });
}
const state = () =>
  validateState({
    profile: {
      givenName: "Test",
      familyName: "Person",
      email: "private@example.com",
      phone: "5551234",
    },
    presets: [{ id: "work", name: "Work", fields: ["givenName", "email"] }],
  });
test("fails closed without config, on alternate host, and without auth", async () => {
  assert.equal((await worker.fetch(request("/admin/"), {})).status, 503);
  assert.equal(
    (await worker.fetch(new Request("https://preview.workers.dev/admin/"), environment())).status,
    404,
  );
  assert.equal((await worker.fetch(request("/admin/"), environment())).status, 401);
  assert.equal(
    (await worker.fetch(request("/admin/api/state", "fake"), environment())).status,
    401,
  );
});
test("validates signature, expiry, issuer, audience, and exact owner", async () => {
  const env = environment();
  for (const token of [await jwt("someone@gmail.com"), await jwt("AAKSIDE@gmail.com")])
    assert.equal((await worker.fetch(request("/admin/", token), env)).status, 403);
  for (const options of [
    { issuer: "https://other.cloudflareaccess.com" },
    { aud: "other" },
    { exp: 1 },
  ])
    assert.equal(
      (await worker.fetch(request("/admin/", await jwt(undefined, options)), env)).status,
      401,
    );
  const token = await jwt();
  assert.equal(
    (await worker.fetch(request("/admin/", token.slice(0, -10) + "aaaaaaaaaa"), env)).status,
    401,
  );
  const res = await worker.fetch(request("/admin/", token), env);
  assert.equal(res.status, 200);
  assert.match(res.headers.get("Content-Security-Policy")!, /frame-ancestors 'none'/);
});
test("rejects CSRF, invalid schemas, oversized requests and unsupported TTL", async () => {
  const env = environment(),
    token = await jwt();
  assert.equal(
    (
      await worker.fetch(
        request("/admin/api/state", token, "PUT", state(), "https://evil.example"),
        env,
      )
    ).status,
    403,
  );
  for (const value of [
    { profile: {}, presets: [{ id: "x", name: "X", fields: ["password"] }] },
    { big: "x".repeat(33000) },
  ])
    assert.equal(
      (await worker.fetch(request("/admin/api/state", token, "PUT", value), env)).status,
      400,
    );
  assert.equal(
    (await worker.fetch(request("/admin/api/share", token, "POST", { ttl: 1 }), env)).status,
    400,
  );
});
test("saves presets, generates a QR, serves only selected fields, and expires at request time", async () => {
  const env = environment(),
    token = await jwt();
  assert.equal(
    (await worker.fetch(request("/admin/api/state", token, "PUT", state()), env)).status,
    200,
  );
  const res = await worker.fetch(
    request("/admin/api/share", token, "POST", {
      ttl: 900,
      presetId: "work",
      fields: ["givenName", "email:legacy"],
    }),
    env,
  );
  assert.equal(res.status, 200);
  const share = (await res.json()) as ShareResponse;
  assert.match(share.svg, /^<svg/);
  assert.match(share.url, /\/c\/[a-f0-9]{64}$/);
  assert.equal(env.writes.at(-1)?.options?.expirationTtl, 900);
  let card = await worker.fetch(new Request(share.url), env);
  assert.equal(card.status, 200);
  assert.equal(card.headers.get("Cache-Control"), "no-store");
  assert.match(card.headers.get("Content-Type")!, /text\/vcard/);
  let text = await card.text();
  assert.match(text, /private@example.com/);
  assert.doesNotMatch(text, /5551234|Person/);
  const changed = state();
  changed.profile.emails[0].value = "updated@example.com";
  changed.presets[0].fields.push("phone");
  env.data.set("state", JSON.stringify(changed));
  text = await (await worker.fetch(new Request(share.url), env)).text();
  assert.match(text, /updated@example.com/);
  assert.doesNotMatch(text, /5551234/);
  const key = env.writes.at(-1)!.key,
    record = JSON.parse(env.data.get(key)!);
  record.expiresAt = Date.now() - 1;
  env.data.set(key, JSON.stringify(record));
  assert.equal((await worker.fetch(new Request(share.url), env)).status, 404);
  assert.equal((await worker.fetch(request("/c/guess"), env)).status, 404);
});
test("vCard escapes injection and folds UTF-8 safely", () => {
  const text = vcard(
    {
      givenName: "名字".repeat(40),
      notes: "Hello\r\nTEL:injected;comma,back\\slash",
    },
    ["givenName", "notes"],
  );
  assert.ok(text.split("\r\n").every((line) => Buffer.byteLength(line) <= 75));
  const unfolded = text.replace(/\r\n /g, "");
  assert.match(unfolded, /NOTE:Hello\\nTEL:injected\\;comma\\,back\\\\slash/);
  assert.ok(!unfolded.includes("\r\nTEL:"));
  assert.ok(text.endsWith("END:VCARD\r\n"));
});

test("configuration errors name the failing setting without exposing values", async () => {
  for (const key of ["CONTACTS", "CONTACT_ORIGIN", "ACCESS_TEAM_DOMAIN", "ACCESS_AUD"] as const) {
    const env: Env = environment();
    delete env[key];
    const result = await worker.fetch(request("/admin/"), env);
    assert.equal(result.status, 503);
    assert.match(await result.text(), new RegExp(`missing ${key}`));
  }
  for (const domain of ["test.cloudflareaccess.com", issuer + "/", " " + issuer]) {
    const env = { ...environment(), ACCESS_TEAM_DOMAIN: domain };
    const result = await worker.fetch(request("/admin/"), env);
    assert.equal(result.status, 503);
    const text = await result.text();
    assert.match(text, /invalid ACCESS_TEAM_DOMAIN/);
    assert.ok(!text.includes(domain));
    assert.equal(result.headers.get("Cache-Control"), "no-store");
  }
});

test("multiple labeled emails and websites are selected individually and use vCard 4 URI encoding", () => {
  const saved = validateState({
    profile: {
      emails: [
        { id: "personal", type: "home", value: "personal@example.com" },
        { id: "business", type: "work", value: "work@example.com" },
      ],
      websites: [
        {
          id: "personal",
          type: "home",
          value: "https://example.com/a;b?q=1,2",
        },
        { id: "business", type: "work", value: "https://work.example.com" },
      ],
    },
    presets: [
      {
        id: "work",
        name: "Work",
        fields: ["email:business", "website:business"],
      },
    ],
  });
  const card = vcard(saved.profile, saved.presets[0].fields);
  assert.match(card, /VERSION:4\.0/);
  assert.match(card, /EMAIL;TYPE=work:work@example.com/);
  assert.match(card, /URL;TYPE=work:https:\/\/work.example.com/);
  assert.doesNotMatch(card, /personal@example.com|TYPE=home/);
  const all = vcard(saved.profile, [
    "email:personal",
    "email:business",
    "website:personal",
    "website:business",
  ]);
  assert.match(all, /EMAIL;TYPE=home:personal@example.com/);
  assert.match(all, /URL;TYPE=home:https:\/\/example.com\/a;b\?q=1,2\r\n/);
  assert.equal((all.match(/EMAIL;/g) || []).length, 2);
  assert.equal((all.match(/URL;/g) || []).length, 2);
});

test("legacy state and active share selectors migrate without including new entries", async () => {
  const env = environment();
  env.data.set(
    "state",
    JSON.stringify({
      profile: { email: "old@example.com", website: "https://old.example.com" },
      presets: [{ id: "old", name: "Old", fields: ["email", "website"] }],
    }),
  );
  const result = await worker.fetch(request("/admin/api/state", await jwt()), env);
  const migrated = validateState(await result.json());
  assert.deepEqual(migrated.presets[0].fields, ["email:legacy", "website:legacy"]);
  migrated.profile.emails.push({
    id: "new",
    type: "work",
    value: "new@example.com",
  });
  env.data.set("state", JSON.stringify(migrated));
  const token = "a".repeat(64);
  env.data.set(
    `share:${token}`,
    JSON.stringify({
      fields: ["email", "website"],
      expiresAt: Date.now() + 60000,
    }),
  );
  const card = await (await worker.fetch(request(`/c/${token}`), env)).text();
  assert.match(card, /old@example.com/);
  assert.doesNotMatch(card, /new@example.com/);
  migrated.profile.emails = migrated.profile.emails.filter((e) => e.id !== "legacy");
  migrated.presets[0].fields = ["website:legacy"];
  env.data.set("state", JSON.stringify(migrated));
  const removed = await (await worker.fetch(request(`/c/${token}`), env)).text();
  assert.doesNotMatch(removed, /EMAIL/);
});

test("rejects invalid labels, unknown entry references, duplicate IDs, unsafe URLs and line injection", () => {
  const entry = { id: "one", type: "home", value: "https://example.com" };
  for (const websites of [
    [{ ...entry, type: "portfolio" }],
    [entry, entry],
    [{ ...entry, value: "javascript:alert(1)" }],
    [{ ...entry, value: "https://example.com\r\nEMAIL:secret" }],
  ])
    assert.throws(() => validateState({ profile: { websites }, presets: [] }));
  assert.throws(() =>
    validateState({
      profile: {},
      presets: [{ id: "x", name: "X", fields: ["email:missing"] }],
    }),
  );
  const oldEmpty = validateState({
    profile: { email: "", website: "" },
    presets: [{ id: "x", name: "X", fields: ["email", "website"] }],
  });
  assert.doesNotMatch(vcard(oldEmpty.profile, oldEmpty.presets[0].fields), /EMAIL|URL/);
});

test("preset notes override only their own shares and stay frozen in existing links", async () => {
  const env = environment(),
    token = await jwt();
  const saved = state();
  saved.profile.notes = "Private profile note";
  saved.presets[0].notes = "Met at conference\nFollow up; next week";
  saved.presets.push({
    id: "personal",
    name: "Personal",
    fields: ["givenName", "notes"],
    notes: "",
  });
  env.data.set("state", JSON.stringify(saved));
  const makeShare = (presetId: string, fields: string[], notes: string) =>
    worker.fetch(
      request("/admin/api/share", token, "POST", {
        presetId,
        fields,
        notes,
        ttl: 900,
      }),
      env,
    );
  assert.equal((await makeShare("work", saved.presets[0].fields, "stale")).status, 409);
  const result = await makeShare("work", saved.presets[0].fields, saved.presets[0].notes);
  assert.equal(result.status, 200);
  const share = (await result.json()) as ShareResponse;
  saved.presets[0].notes = "Changed later";
  env.data.set("state", JSON.stringify(saved));
  const card = await (await worker.fetch(new Request(share.url), env)).text();
  assert.match(card, /NOTE:Met at conference\\nFollow up\\; next week/);
  assert.doesNotMatch(card, /Private profile note|Changed later/);
  const personal = (await (
    await makeShare("personal", ["givenName", "notes"], "")
  ).json()) as ShareResponse;
  assert.match(
    await (await worker.fetch(new Request(personal.url), env)).text(),
    /NOTE:Private profile note/,
  );
  assert.doesNotMatch(vcard(saved.profile, ["givenName"]), /NOTE:/);
  assert.throws(() =>
    validateState({
      ...saved,
      presets: [{ ...saved.presets[0], notes: "x".repeat(1001) }],
    }),
  );
  const legacy = validateState({
    profile: {},
    presets: [{ id: "old", name: "Old", fields: ["givenName"] }],
  });
  assert.equal(legacy.presets[0].notes, "");
});

test("five-day links set both KV TTL and runtime expiration", async () => {
  const env = environment();
  const saved = state();
  env.data.set("state", JSON.stringify(saved));
  const before = Date.now();
  const result = await worker.fetch(
    request("/admin/api/share", await jwt(), "POST", {
      presetId: "work",
      fields: saved.presets[0].fields,
      ttl: 432000,
    }),
    env,
  );
  assert.equal(result.status, 200);
  const share = (await result.json()) as ShareResponse;
  assert.equal(env.writes.at(-1)?.options?.expirationTtl, 432000);
  assert.ok(share.expiresAt >= before + 432000000 && share.expiresAt <= Date.now() + 432000000);
});
