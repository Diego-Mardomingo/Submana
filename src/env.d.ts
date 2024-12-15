/// <reference path="../.astro/types.d.ts" />

interface ImportMetaEnv {
  readonly SUPABASE_URL: string
  readonly SUPABASE_KEY: string
  readonly REDIRECT_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
