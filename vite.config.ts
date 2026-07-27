import vinext from "vinext";
import { resolve } from "node:path";
import { defineConfig } from "vite";
import { sites } from "#sites-vite-plugin";

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";
const githubPagesBasePath = process.env.LATENT_GITHUB_PAGES_BASE_PATH?.trim() || "";
const productHome = process.env.LATENT_PRODUCT_HOME === "framework"
  ? "products/framework/home.ts"
  : "products/courses/home.ts";

const localBindingConfig = {
  main: "./worker/index.ts",
  compatibility_flags: ["nodejs_compat"],
};

export default defineConfig(async () => {
  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import("@cloudflare/vite-plugin");

  return {
    define: {
      "process.env.LATENT_PRODUCT_HOME": JSON.stringify(
        process.env.LATENT_PRODUCT_HOME ?? "courses",
      ),
    },
    resolve: {
      alias: {
        "@/products/product-home": resolve(process.cwd(), productHome),
        "@": resolve(process.cwd()),
      },
    },
    // Consent-gated and editor-only features are dynamically imported. Explicitly
    // prebundle their static client boundaries so the first click cannot request
    // a dependency chunk Vite never prepared in the RSC development graph.
    optimizeDeps: {
      include: ["@huggingface/transformers", "@codemirror/lang-python"],
    },
    server: {
      watch: {
        // predev builds workspace packages before Vite starts. A later production
        // build must not hot-reload the app while those generated files are emitted.
        ignored: ["**/packages/*/dist/**"],
        ...(isCodexSeatbeltSandbox
          ? { useFsEvents: false, usePolling: true }
          : {}),
      },
    },
    plugins: [
      vinext(),
      {
        name: "github-pages-base-path",
        enforce: "post",
        config() {
          if (!githubPagesBasePath) return {};
          return {
            base: `${githubPagesBasePath}/`,
            define: {
              "process.env.__NEXT_ROUTER_BASEPATH": JSON.stringify(githubPagesBasePath),
            },
          };
        },
      },
      sites(),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        config: localBindingConfig,
      }),
    ],
  };
});
