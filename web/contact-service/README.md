# Private contact sharing

`npm ci`
`npm test`
`npm run build`
`npm run deploy`

## Sharing behavior

- Profile and presets persist in the `state` KV entry without expiration. Presets select fields and individual email/website entries from one profile (up to 30 presets). Emails and websites each support up to 20 entries with Home or Work labels. New entries are never automatically added to a preset.
- Each share gets 256 random bits and stores a frozen field allowlist plus `expiresAt`.
- The Worker reads the current profile to generate a vCard 4.0 response at scan time. Later profile edits can update the values returned by active links. Preset edits cannot add fields to existing links.
- Expiration is enforced in the Worker and by KV TTL. Regenerating a QR does not revoke earlier links. There is no single-use guarantee or immediate-revocation feature.
- KV is eventually consistent. Recent profile edits and new shares can take time to become visible in another region. A recipient can retry if a newly generated link is initially unavailable. Do not assume immediate global deletion or update propagation.
