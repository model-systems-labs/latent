import { readdir, rm, stat } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const serverAssets = resolve(root, "dist/server/ssr/assets");
const clientAssets = resolve(root, "dist/client/assets");
const families = [
  { name: "browser compiler", pattern: /^esbuild-.*\.wasm$/ },
  { name: "local model runtime", pattern: /^ort-wasm-.*\.wasm$/ },
];

const [serverFiles, clientFiles] = await Promise.all([
  readdir(serverAssets),
  readdir(clientAssets),
]);

for (const family of families) {
  const duplicated = serverFiles.filter((file) => family.pattern.test(file));
  if (duplicated.length !== 1) {
    throw new Error(
      `Expected one duplicated ${family.name} WASM asset in the SSR build; found ${duplicated.length}.`,
    );
  }

  const file = duplicated[0];
  if (!clientFiles.includes(file)) {
    throw new Error(`Refusing to prune ${file}: the browser build has no matching asset.`);
  }

  const [serverFile, clientFile] = await Promise.all([
    stat(resolve(serverAssets, file)),
    stat(resolve(clientAssets, file)),
  ]);
  if (serverFile.size !== clientFile.size) {
    throw new Error(`Refusing to prune ${file}: the browser and SSR copies differ.`);
  }

  await rm(resolve(serverAssets, file));
}

console.log("Removed duplicate browser-only WASM from the SSR deployment bundle.");
