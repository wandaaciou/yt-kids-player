import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("product source keeps parent approval and child playback separated", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const gitignore = await readFile(
    new URL("../.gitignore", import.meta.url),
    "utf8",
  );
  const envExample = await readFile(
    new URL("../.env.example", import.meta.url),
    "utf8",
  );

  assert.match(page, /家長手機/);
  assert.match(page, /酸菜平板/);
  assert.match(page, /已核准 \{approvedVideos\.length\}\/3/);
  assert.match(gitignore, /^\.env\*$/m);
  assert.match(gitignore, /^!\.env\.example$/m);
  assert.match(envExample, /^YOUTUBE_API_KEY=$/m);
  assert.doesNotMatch(envExample, /=\S/);
});
