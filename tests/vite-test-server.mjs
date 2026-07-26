import { fileURLToPath } from "node:url";
import { createServer as createViteServer, mergeConfig } from "vite";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));

export function createServer(config = {}) {
  return createViteServer(mergeConfig({
    resolve: {
      alias: {
        "@": repositoryRoot,
      },
    },
  }, config));
}
