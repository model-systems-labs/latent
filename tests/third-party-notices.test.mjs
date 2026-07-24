import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const root = new URL("../", import.meta.url);

const read = (path) => readFile(new URL(path, root), "utf8");

test("checked-in browser runtimes ship their complete MIT notices", async () => {
  const [reactRuntime, sandboxRuntime, repositoryNotice, deployedNotice] = await Promise.all([
    read("public/capstone-react-runtime.js"),
    read("public/capstone-sandbox-worker.js"),
    read("THIRD_PARTY_NOTICES.md"),
    read("public/THIRD_PARTY_NOTICES.txt"),
  ]);

  assert.match(reactRuntime, /Copyright \(c\) Meta Platforms, Inc\. and affiliates\./);
  assert.match(sandboxRuntime, /quickjs-emscripten/);

  for (const notice of [repositoryNotice, deployedNotice]) {
    assert.match(notice, /Copyright \(c\) Meta Platforms, Inc\. and affiliates\./);
    assert.match(notice, /Copyright \(c\) 2019-2024 Jake Teton-Landis/);
    assert.match(notice, /Copyright \(c\) 2017-2021 Fabrice Bellard/);
    assert.match(notice, /Copyright \(c\) 2017-2021 Charlie Gordon/);
    assert.match(notice, /Permission is hereby granted, free of charge/);
  }
});
