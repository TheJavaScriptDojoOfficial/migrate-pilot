/**
 * Runtime feature/config flags. Read once at startup; keep tiny.
 *
 * Do NOT use this module for stateful values - it must only describe
 * static, compile-time decisions or values read from import.meta.env.
 */
export interface RuntimeConfig {
  readonly isTauri: boolean;
  readonly isDev: boolean;
  readonly logLevel: 'debug' | 'info' | 'warn' | 'error';
}

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export const runtimeConfig: RuntimeConfig = {
  isTauri,
  isDev: import.meta.env.DEV,
  logLevel: (import.meta.env['VITE_LOG_LEVEL'] as RuntimeConfig['logLevel']) ?? 'info',
};
