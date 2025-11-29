/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CLI_VERSION: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
