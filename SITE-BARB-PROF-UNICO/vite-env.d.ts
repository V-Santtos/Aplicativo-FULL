/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_ADMIN_API_TOKEN?: string;
  readonly VITE_OWNER_EMAIL?: string;
  readonly VITE_OWNER_PASSWORD?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}