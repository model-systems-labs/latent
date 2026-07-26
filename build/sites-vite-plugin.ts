import { access, cp, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import type { Plugin } from "vite";

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

// Packages Sites metadata and migrations after Vite finishes compiling.
export function sites(): Plugin {
  let root = process.cwd();

  return {
    name: "sites",
    apply: "build",
    configResolved(config) {
      root = config.root;
    },
    async closeBundle() {
      const outputDirectory = resolve(root, "dist", ".openai");
      const explicitHostingConfig = process.env.LATENT_HOSTING_CONFIG;
      const hostingConfig = resolve(
        root,
        explicitHostingConfig ?? ".openai/hosting.json",
      );
      const drizzleSource = resolve(root, "drizzle");

      await rm(outputDirectory, { recursive: true, force: true });
      await mkdir(outputDirectory, { recursive: true });

      if (explicitHostingConfig && !(await exists(hostingConfig))) {
        throw new Error(
          `LATENT_HOSTING_CONFIG does not exist: ${explicitHostingConfig}`,
        );
      }
      if (await exists(hostingConfig)) {
        await cp(hostingConfig, resolve(outputDirectory, "hosting.json"));
      }
      if (explicitHostingConfig) {
        const productLlms = resolve(hostingConfig, "..", "..", "llms.txt");
        if (await exists(productLlms)) {
          await cp(productLlms, resolve(root, "dist", "client", "llms.txt"));
        }
      }
      if (await exists(drizzleSource)) {
        await cp(drizzleSource, resolve(outputDirectory, "drizzle"), {
          recursive: true,
        });
      }
    },
  };
}
