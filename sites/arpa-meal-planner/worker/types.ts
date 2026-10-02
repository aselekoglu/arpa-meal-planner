/// <reference types="@cloudflare/workers-types" />
export interface SitesEnv {
  DB: D1Database;
  BUCKET: R2Bucket;
  ASSETS?: { fetch(request: Request): Promise<Response> };
  GEMINI_API_KEY?: string;
  GEMINI_VAULT_KEY?: string;
  AI_GEMINI_TEXT_MODEL?: string;
  AI_GEMINI_IMAGE_MODEL?: string;
  ARPA_OWNER_EMAIL: string;
  MIGRATION_TOKEN?: string;
}
