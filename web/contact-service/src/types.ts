import type { ContactField, ContactState } from "./model.ts";

/** The subset of a Workers KV binding used by this service. */
export interface ContactStore {
  get<T>(key: string, type: "json"): Promise<T | null>;
  put(key: string, value: string, options?: { expirationTtl: number }): Promise<void>;
}

/** Optional because requests must fail closed before deployment is configured. */
export interface Env {
  CONTACTS?: ContactStore;
  CONTACT_ORIGIN?: string;
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
}

export interface ShareRecord {
  notes?: string;
  fields: ContactField[];
  expiresAt: number;
}

export interface ShareResponse extends ShareRecord {
  url: string;
  svg: string;
}

export interface ShareRequest {
  notes?: string;
  presetId: string;
  fields: ContactField[];
  ttl: number;
}

export interface ApiResponses {
  state: ContactState;
  share: ShareResponse;
}
