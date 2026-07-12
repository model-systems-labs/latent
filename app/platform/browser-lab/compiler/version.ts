/**
 * Stable host-side version for createCompileJob(). Keep this synchronized with
 * the pinned esbuild-wasm package; the worker also verifies its runtime version
 * and refuses a mismatch.
 */
export const BROWSER_LAB_COMPILER_VERSION = "esbuild-wasm-0.28.1" as const;

