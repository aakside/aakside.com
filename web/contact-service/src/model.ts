export const fields = {
  givenName: "First name",
  familyName: "Last name",
  organization: "Company",
  title: "Job title",
  phone: "Phone",
  notes: "Notes",
} as const;

export type ScalarField = keyof typeof fields;
export type ContactField = ScalarField | `email:${string}` | `website:${string}`;

export interface ContactEntry {
  id: string;
  type: "home" | "work";
  value: string;
}

export type ContactProfile = Record<ScalarField, string> & {
  emails: ContactEntry[];
  websites: ContactEntry[];
};

export interface ContactPreset {
  notes: string;
  id: string;
  name: string;
  fields: ContactField[];
}

export interface ContactState {
  profile: ContactProfile;
  presets: ContactPreset[];
}

export const fieldKeys = Object.keys(fields) as ScalarField[];
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const validId = (value: unknown): value is string =>
  typeof value === "string" && /^[a-zA-Z0-9-]{1,64}$/.test(value);

export const emptyState = (): ContactState => ({
  profile: {
    ...(Object.fromEntries(fieldKeys.map((k) => [k, ""])) as Record<ScalarField, string>),
    emails: [],
    websites: [],
  },
  presets: [],
});

function text(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length > 1000 ||
    /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value)
  )
    throw Error("Invalid contact field.");
  return value.trim();
}

function entries(value: unknown, legacy: unknown, kind: "email" | "website"): ContactEntry[] {
  // Stable IDs preserve existing presets and live links without widening their scope.
  if (value === undefined)
    value = typeof legacy === "string" ? [{ id: "legacy", type: "home", value: legacy }] : [];
  if (!Array.isArray(value) || value.length > 20) throw Error("At most 20 entries per field.");
  const ids = new Set<string>();
  return value.map((entry) => {
    if (
      !isRecord(entry) ||
      !validId(entry.id) ||
      ids.has(entry.id) ||
      !["home", "work"].includes(String(entry.type))
    )
      throw Error("Invalid contact entry.");
    ids.add(entry.id);
    const clean = text(entry.value);
    if (/[\r\n]/.test(clean)) throw Error("Enter a value for each email or website.");
    if (clean && kind === "email" && !/^[^\s@]+@[^\s@]+$/.test(clean))
      throw Error("Enter a valid email address.");
    if (clean && kind === "website") {
      let url: URL;
      try {
        url = new URL(clean);
      } catch {
        throw Error("Enter a valid website URL.");
      }
      if (!["https:", "http:"].includes(url.protocol) || /\s/.test(clean))
        throw Error("Website must be an http:// or https:// URL without whitespace.");
    }
    return { id: entry.id, type: entry.type as "home" | "work", value: clean };
  });
}

export function selectionKey(key: string): string {
  return key === "email" ? "email:legacy" : key === "website" ? "website:legacy" : key;
}

export function contactOptions(
  profile: ContactProfile,
): { key: ContactField; label: string; value: string }[] {
  return [
    ...fieldKeys.map((key) => ({
      key,
      label: fields[key],
      value: profile[key],
    })),
    ...profile.emails.map((e) => ({
      key: `email:${e.id}` as const,
      label: `${e.type === "home" ? "Home" : "Work"} email`,
      value: e.value,
    })),
    ...profile.websites.map((e) => ({
      key: `website:${e.id}` as const,
      label: `${e.type === "home" ? "Home" : "Work"} website`,
      value: e.value,
    })),
  ];
}

export function validateState(value: unknown): ContactState {
  if (
    !isRecord(value) ||
    !isRecord(value.profile) ||
    !Array.isArray(value.presets) ||
    value.presets.length > 30
  ) {
    throw Error("Invalid profile or presets (maximum 30).");
  }
  const profile = emptyState().profile;

  for (const key of fieldKeys) {
    profile[key] = text(value.profile[key] ?? "");
  }

  profile.emails = entries(value.profile.emails, value.profile.email, "email");
  profile.websites = entries(value.profile.websites, value.profile.website, "website");
  const options = new Set<string>(contactOptions(profile).map((o) => o.key));
  const ids = new Set<string>();
  const presets = value.presets.map((p) => {
    if (
      !isRecord(p) ||
      !validId(p.id) ||
      ids.has(p.id) ||
      typeof p.name !== "string" ||
      !p.name.trim() ||
      p.name.length > 80 ||
      !Array.isArray(p.fields) ||
      !p.fields.length ||
      p.fields.some((k) => typeof k !== "string" || !options.has(selectionKey(k)))
    ) {
      throw Error("Invalid preset. Select at least one existing field.");
    }

    ids.add(p.id);
    return {
      id: p.id,
      name: p.name.trim(),
      notes: text(p.notes ?? ""),
      fields: [...new Set(p.fields.map((k) => selectionKey(k) as ContactField))],
    };
  });
  return { profile, presets };
}
const escape = (value: string) =>
  value
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
// vCard physical lines are at most 75 UTF-8 octets, including continuation space.
function fold(line: string) {
  const encoder = new TextEncoder();
  let current = "",
    size = 0;
  const lines = [];
  for (const char of line) {
    const length = encoder.encode(char).length;
    if (size + length > 75) {
      lines.push(current);
      current = " ";
      size = 1;
    }
    current += char;
    size += length;
  }

  return [...lines, current].join("\r\n");
}

export function vcard(
  profile: Partial<ContactProfile>,
  selected: readonly string[],
  presetNotes = "",
) {
  const allowed = new Set(selected.map(selectionKey));
  const p = Object.fromEntries(
    fieldKeys.filter((k) => allowed.has(k)).map((k) => [k, profile[k] || ""]),
  );

  if (presetNotes) {
    p.notes = presetNotes;
  }

  const name = [p.givenName, p.familyName].filter(Boolean).join(" ") || p.organization || "Contact";
  const lines = [
    "BEGIN:VCARD",
    "VERSION:4.0",
    `N:${escape(p.familyName || "")};${escape(p.givenName || "")};;;`,
    `FN:${escape(name)}`,
  ];

  for (const [key, tag] of Object.entries({
    organization: "ORG",
    title: "TITLE",
    phone: "TEL;VALUE=text",
    notes: "NOTE",
  })) {
    if (p[key]) {
      lines.push(`${tag}:${escape(p[key])}`);
    }
  }

  for (const entry of profile.emails || []) {
    if (entry.value && allowed.has(`email:${entry.id}`))
      lines.push(`EMAIL;TYPE=${entry.type}:${escape(entry.value)}`);
  }

  for (const entry of profile.websites || []) {
    // URL is a URI value: do not text-escape valid URI commas or semicolons.
    if (entry.value && allowed.has(`website:${entry.id}`))
      lines.push(`URL;TYPE=${entry.type}:${entry.value}`);
  }

  return [...lines, "END:VCARD"].map(fold).join("\r\n") + "\r\n";
}
