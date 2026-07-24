import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("product source keeps parent approval and child playback separated", async () => {
  const homePage = await readFile(
    new URL("../app/page.tsx", import.meta.url),
    "utf8",
  );
  const parentPage = await readFile(
    new URL("../app/parent/page.tsx", import.meta.url),
    "utf8",
  );
  const kidsPage = await readFile(
    new URL("../app/kids/page.tsx", import.meta.url),
    "utf8",
  );
  const gitignore = await readFile(
    new URL("../.gitignore", import.meta.url),
    "utf8",
  );
  const envExample = await readFile(
    new URL("../.env.example", import.meta.url),
    "utf8",
  );

  assert.match(homePage, /href="\/parent"/);
  assert.match(homePage, /href="\/kids"/);
  assert.match(parentPage, /家長手機/);
  assert.match(parentPage, /已核准 \{control\.approvedVideos\.length\}\/3/);
  assert.match(kidsPage, /酸菜觀看頁/);
  assert.match(kidsPage, /youtube-nocookie\.com/);
  assert.match(kidsPage, /sandbox="allow-scripts allow-same-origin allow-presentation"/);
  assert.match(kidsPage, /fs=0/);
  assert.doesNotMatch(kidsPage, /YouTube 搜尋審核/);
  assert.match(gitignore, /^\.env\*$/m);
  assert.match(gitignore, /^!\.env\.example$/m);
  assert.match(envExample, /^YOUTUBE_API_KEY=$/m);
  assert.doesNotMatch(envExample, /=\S/);
});
