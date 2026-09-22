import {
  fields,
  type ContactField,
  type ScalarField,
  type ContactEntry,
  type ContactState,
  type ContactPreset,
} from "./model.ts";
import type { ApiResponses, ShareRequest } from "./types.ts";

type Elements = {
  status: HTMLDivElement;
  result: HTMLDivElement;
  preview: HTMLDivElement;
  fields: HTMLDivElement;
  choices: HTMLDivElement;
  countdown: HTMLParagraphElement;
  save: HTMLButtonElement;
  generate: HTMLButtonElement;
  delete: HTMLButtonElement;
  add: HTMLButtonElement;
  copy: HTMLButtonElement;
  preset: HTMLSelectElement;
  "share-preset": HTMLSelectElement;
  duration: HTMLSelectElement;
  "preset-name": HTMLInputElement;
  "preset-notes": HTMLTextAreaElement;
  editor: HTMLFieldSetElement;
  sharing: HTMLFieldSetElement;
  qr: HTMLImageElement;
  link: HTMLAnchorElement;
} & { [K in `check-${ContactField}`]: HTMLInputElement } & {
  [K in `field-${ContactField}`]: HTMLInputElement | HTMLTextAreaElement;
};

function client(labels: typeof fields) {
  const $ = <K extends keyof Elements>(id: K): Elements[K] => {
    const element = document.getElementById(id);
    if (!element) {
      throw new Error(`Missing element: ${id}`);
    }
    return element as Elements[K];
  };
  const keys = Object.keys(labels) as ScalarField[];
  let state: ContactState;
  let selected = "",
    dirty = false,
    blobUrl: string | undefined,
    expiresAt = 0;
  const message = (text: string, error = false) => {
    $("status").textContent = text;
    $("status").dataset.error = String(error);
  };

  async function api<K extends keyof ApiResponses>(
    path: K,
    method = "GET",
    value?: ContactState | ShareRequest,
  ): Promise<ApiResponses[K]> {
    const res = await fetch("/admin/api/" + path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: value === undefined ? undefined : JSON.stringify(value),
      redirect: "error",
    });
    if (!res.ok) {
      let text = "Request failed. Reload to sign in again if your session expired.";
      try {
        text = (await res.json()).error || text;
      } catch {}
      throw Error(text);
    }
    return res.json();
  }

  function markDirty() {
    $("result").hidden = true;
    dirty = true;
    $("save").disabled = false;
    $("generate").disabled = true;
    message("Unsaved changes. Save before sharing.");
  }

  function drawPresets() {
    for (const id of ["preset", "share-preset"] as const) {
      const select = $(id);
      const previous = id === "preset" ? selected : select.value;
      select.replaceChildren();
      for (const p of state.presets) select.add(new Option(p.name, p.id));
      select.value = state.presets.some((p) => p.id === previous)
        ? previous
        : state.presets[0]?.id || "";
    }
    selected = $("preset").value;
    const preset = state.presets.find((p) => p.id === selected);
    $("preset-name").value = preset?.name || "";
    $("preset-name").disabled = !preset;
    $("preset-notes").value = preset?.notes || "";
    $("preset-notes").disabled = !preset;
    $("delete").disabled = !preset;
    drawChoices();
    $("generate").disabled = dirty || !state.presets.length;
    preview();
  }

  function preview() {
    const preset = state.presets.find((p) => p.id === $("share-preset").value);
    $("preview").replaceChildren();
    for (const option of options().filter(
      (o) => preset?.fields.includes(o.key) && !(o.key === "notes" && preset.notes.trim()),
    )) {
      const row = document.createElement("div");
      const label = document.createElement("strong");
      label.textContent = option.label + ": ";
      row.append(label, document.createTextNode(option.value || "(empty)"));
      $("preview").append(row);
    }
    if (preset?.notes.trim()) {
      const row = document.createElement("div");
      const label = document.createElement("strong");
      label.textContent = "Notes: ";
      row.append(label, document.createTextNode(preset.notes.trim()));
      $("preview").append(row);
    }
  }

  function options(): { key: ContactField; label: string; value: string }[] {
    return [
      ...keys.map((key) => ({
        key,
        label: labels[key],
        value: state.profile[key],
      })),
      ...(["emails", "websites"] as const).flatMap((kind) =>
        state.profile[kind].map((e) => ({
          key: `${kind === "emails" ? "email" : "website"}:${e.id}` as ContactField,
          label: `${e.type === "home" ? "Home" : "Work"} ${kind === "emails" ? "email" : "website"}`,
          value: e.value,
        })),
      ),
    ];
  }

  function drawChoices() {
    const preset = state.presets.find((p) => p.id === selected);
    $("choices").replaceChildren();
    for (const option of options()) {
      const label = document.createElement("label");
      const check = document.createElement("input");
      check.type = "checkbox";
      check.id = `check-${option.key}`;
      check.checked = !!preset?.fields.includes(option.key);
      check.disabled = !preset;
      check.addEventListener("change", () => {
        if (!preset) return;
        preset.fields = check.checked
          ? [...preset.fields, option.key]
          : preset.fields.filter((k) => k !== option.key);
        markDirty();
        preview();
      });
      label.append(
        check,
        document.createTextNode(
          option.label + (option.key.includes(":") ? ` — ${option.value || "(empty)"}` : ""),
        ),
      );
      $("choices").append(label);
    }
  }

  function drawEntries() {
    for (const kind of ["emails", "websites"] as const) {
      const container = document.getElementById(kind)!;
      container.replaceChildren();
      for (const entry of state.profile[kind]) {
        const row = document.createElement("div");
        row.className = "entry";
        const label = document.createElement("label");
        label.textContent = "Label";
        const select = document.createElement("select");
        select.add(new Option("Home", "home"));
        select.add(new Option("Work", "work"));
        select.value = entry.type;
        select.addEventListener("change", () => {
          entry.type = select.value as ContactEntry["type"];
          markDirty();
          drawChoices();
          preview();
        });
        label.append(select);
        const valueLabel = document.createElement("label");
        valueLabel.textContent = kind === "emails" ? "Email address" : "Website URL";
        const input = document.createElement("input");
        input.type = kind === "emails" ? "email" : "url";
        input.value = entry.value;
        input.maxLength = 1000;
        input.addEventListener("input", () => {
          entry.value = input.value;
          markDirty();
          drawChoices();
          preview();
        });
        valueLabel.append(input);
        const remove = document.createElement("button");
        remove.type = "button";
        remove.textContent = "Remove";
        remove.setAttribute(
          "aria-label",
          `Remove ${kind === "emails" ? "email" : "website"} ${entry.value}`,
        );
        remove.addEventListener("click", () => {
          state.profile[kind] = state.profile[kind].filter((e) => e.id !== entry.id);
          const key = `${kind === "emails" ? "email" : "website"}:${entry.id}`;
          for (const preset of state.presets)
            preset.fields = preset.fields.filter((k) => k !== key);
          markDirty();
          drawEntries();
          drawChoices();
          preview();
        });
        row.append(label, valueLabel, remove);
        container.append(row);
      }
      const add = document.createElement("button");
      add.type = "button";
      add.textContent = kind === "emails" ? "Add email" : "Add website";
      add.disabled = state.profile[kind].length >= 20;
      add.addEventListener("click", () => {
        state.profile[kind].push({
          id: crypto.randomUUID(),
          type: "home",
          value: "",
        });
        markDirty();
        drawEntries();
        drawChoices();
      });
      container.append(add);
    }
  }

  for (const key of keys) {
    const label = labels[key];
    const wrapper = document.createElement("label");
    wrapper.textContent = label;
    const input = document.createElement(key === "notes" ? "textarea" : "input");
    input.id = "field-" + key;
    input.maxLength = 1000;
    input.autocomplete = "off";
    input.addEventListener("input", () => {
      state.profile[key] = input.value;
      markDirty();
      preview();
    });
    wrapper.append(input);
    $("fields").append(wrapper);
  }
  $("preset").addEventListener("change", () => {
    selected = $("preset").value;
    drawPresets();
  });
  $("share-preset").addEventListener("change", () => {
    $("result").hidden = true;
    preview();
  });
  $("duration").addEventListener("change", () => {
    $("result").hidden = true;
  });
  $("preset-name").addEventListener("input", () => {
    const p = state.presets.find((p) => p.id === selected);
    if (!p) return;
    p.name = $("preset-name").value;
    for (const id of ["preset", "share-preset"] as const)
      for (const option of $(id).options)
        if (option.value === p.id) option.textContent = p.name || "Untitled";
    markDirty();
  });
  $("preset-notes").addEventListener("input", () => {
    const preset = state.presets.find((p) => p.id === selected);
    if (!preset) return;
    preset.notes = $("preset-notes").value;
    markDirty();
    preview();
  });
  $("add").addEventListener("click", () => {
    if (state.presets.length >= 30) return message("You can save up to 30 presets.", true);
    const preset: ContactPreset = {
      id: crypto.randomUUID(),
      name: "New preset",
      notes: "",
      fields: ["givenName", "familyName"],
    };
    state.presets.push(preset);
    selected = preset.id;
    markDirty();
    drawPresets();
    $("preset-name").focus();
  });
  $("delete").addEventListener("click", () => {
    state.presets = state.presets.filter((p) => p.id !== selected);
    selected = "";
    markDirty();
    drawPresets();
  });
  $("save").addEventListener("click", async () => {
    $("editor").disabled = true;
    $("sharing").disabled = true;
    try {
      state = await api("state", "PUT", state);
      dirty = false;
      $("save").disabled = true;
      drawEntries();
      drawPresets();
      message("Profile and presets saved.");
    } catch (e) {
      message(e instanceof Error ? e.message : "Request failed.", true);
    } finally {
      $("editor").disabled = false;
      $("sharing").disabled = false;
    }
  });
  $("generate").addEventListener("click", async () => {
    $("sharing").disabled = true;
    try {
      const preset = state.presets.find((p) => p.id === $("share-preset").value);
      if (!preset) throw new Error("Select a saved preset first.");
      const share = await api("share", "POST", {
        presetId: preset.id,
        fields: preset.fields,
        notes: preset.notes,
        ttl: Number($("duration").value),
      });
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      blobUrl = URL.createObjectURL(new Blob([share.svg], { type: "image/svg+xml" }));
      $("qr").src = blobUrl;
      $("link").href = share.url;
      $("link").textContent = "Open contact download";
      $("copy").dataset.url = share.url;
      expiresAt = share.expiresAt;
      $("result").hidden = false;
      tick();
      message(
        "QR ready. Anyone with this code can save the selected information until it expires.",
      );
    } catch (e) {
      message(e instanceof Error ? e.message : "Request failed.", true);
    } finally {
      $("sharing").disabled = false;
    }
  });
  $("copy").addEventListener("click", async () => {
    try {
      const url = $("copy").dataset.url;
      if (!url) throw new Error("No share link.");
      await navigator.clipboard.writeText(url);
      message("Link copied.");
    } catch {
      message("Could not copy. Use the contact download link.", true);
    }
  });
  function tick() {
    if (!expiresAt) return;
    const seconds = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
    $("countdown").textContent = seconds
      ? `Expires in ${Math.floor(seconds / 60)}m ${seconds % 60}s`
      : "Expired — generate a new QR to share again.";
    $("qr").hidden = !seconds;
    $("link").hidden = !seconds;
    $("copy").disabled = !seconds;
  }
  setInterval(tick, 1000);
  window.addEventListener("beforeunload", (e) => {
    if (dirty) {
      e.preventDefault();
      e.returnValue = "";
    }
  });
  api("state")
    .then((value) => {
      state = value;
      for (const key of keys) $(`field-${key}`).value = state.profile[key];
      $("editor").disabled = false;
      $("sharing").disabled = false;
      drawEntries();
      drawPresets();
      message("Your profile is private until you create a sharing link.");
    })
    .catch((e) => message(e instanceof Error ? e.message : "Request failed.", true));
}
export function adminPage(nonce: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Contact sharing · aakside</title>
<style nonce="${nonce}">
:root{font-family:system-ui,sans-serif;color:#182d28;background:#f3f5ef;font-size:16px}*{box-sizing:border-box}body{margin:0}main{max-width:1120px;margin:auto;padding:38px 22px 70px}nav{display:flex;gap:18px;flex-wrap:wrap}#sharing{scroll-margin-top:20px}header{display:flex;align-items:center;justify-content:space-between;gap:20px}h1{font-size:clamp(2rem,5vw,3.3rem);letter-spacing:-.06em;margin:12px 0}h2{margin:0 0 12px;font-size:1.25rem}p{line-height:1.6;color:#52655c}.eyebrow{font-size:.75rem;letter-spacing:.16em;font-weight:700;text-transform:uppercase;color:#52655c}a{color:#245941}button,input,select,textarea{font:inherit}button{border:1px solid #b7c7bd;border-radius:9px;padding:11px 16px;background:white;color:#183d2d;cursor:pointer}button.primary{background:#205d43;color:white;border-color:#205d43}button:disabled{opacity:.5;cursor:default}button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible,a:focus-visible{outline:3px solid #b18b37;outline-offset:3px}fieldset{border:0;padding:0;margin:0;min-width:0}.layout{display:grid;grid-template-columns:1.25fr 1fr;gap:22px}.card{background:#fff;border:1px solid #dce3da;border-radius:18px;padding:25px;margin-bottom:20px}.fields{display:grid;grid-template-columns:1fr 1fr;gap:16px}label{display:block;font-size:.88rem;font-weight:600}input:not([type=checkbox]),select,textarea{display:block;width:100%;margin-top:7px;padding:11px;border:1px solid #b7c7bd;border-radius:8px;background:#fcfdfb;color:inherit}textarea{resize:vertical;min-height:80px}.choices{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:20px 0}.choices label{display:flex;gap:9px;align-items:center;overflow-wrap:anywhere;min-width:0}.choices input{flex-shrink:0}.entry{display:grid;grid-template-columns:90px minmax(0,1fr);gap:12px}.entry button{justify-self:start;grid-column:2}.entry label{min-width:0}input[type=checkbox]{width:18px;height:18px;accent-color:#205d43}.actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}.stack>*+*{margin-top:18px}.preset-name{margin-top:18px}#status{min-height:48px;padding:12px 0;line-height:1.5}#status[data-error=true]{color:#a32727}#preview{background:#f3f5ef;border-radius:10px;padding:15px;font-size:.9rem;line-height:1.8;overflow-wrap:anywhere;white-space:pre-wrap}#result{text-align:center;margin-top:24px;border-top:1px solid #dce3da;padding-top:20px}#qr{width:100%;max-width:310px;aspect-ratio:1;background:white}#result .actions{justify-content:center}.small{font-size:.85rem}#countdown{font-variant-numeric:tabular-nums;font-weight:600}@media(max-width:760px){.layout{grid-template-columns:1fr}.fields{grid-template-columns:1fr}.card{padding:20px}header{align-items:flex-start}}
</style></head><body><main><header><div><h1>Contact sharing</h1></div><nav aria-label="Page actions"><a href="#sharing">Generate QR</a><a href="/cdn-cgi/access/logout">Sign out</a></nav></header><p>Keep your details in one place. Choose what to share, then let someone scan.</p><div id="status" role="status" aria-live="polite">Loading your private profile…</div><div class="layout"><fieldset id="editor" disabled><section class="card"><h2>Your contact details</h2><p class="small">Only selected fields are included in a sharing link.</p><div id="fields" class="fields"></div><h3>Emails</h3><div id="emails" class="stack"></div><h3>Websites</h3><div id="websites" class="stack"></div></section><section class="card"><h2>Sharing presets</h2><label>Choose a preset<select id="preset"></select></label><div class="actions"><button id="add" type="button">Add preset</button><button id="delete" type="button">Delete preset</button></div><label class="preset-name">Preset name<input id="preset-name" maxlength="80"></label><div class="choices" id="choices"></div><label>Preset contact notes<textarea id="preset-notes" maxlength="1000"></textarea></label><button class="primary" id="save" disabled type="button">Save profile & presets</button></section></fieldset><fieldset id="sharing" disabled><section class="card stack"><h2>Share a contact</h2><label>Preset<select id="share-preset"></select></label><div id="preview" aria-label="Selected contact fields"></div><label>Link stays active for<select id="duration"><option value="300">5 minutes</option><option value="900" selected>15 minutes</option><option value="3600">1 hour</option><option value="86400">24 hours</option><option value="432000">5 days</option></select></label><button class="primary" id="generate" type="button">Generate new QR</button><p class="small">New codes do not revoke previous ones. Each link expires on its own. Saved contacts remain on the recipient’s phone.</p><div id="result" hidden><img id="qr" alt="Scan to save the selected contact information"><p id="countdown"></p><a id="link" rel="noreferrer">Open contact download</a><div class="actions"><button id="copy" type="button">Copy link</button></div></div></section></fieldset></div></main><script nonce="${nonce}">(${client.toString()})(${JSON.stringify(fields)});</script></body></html>`;
}
