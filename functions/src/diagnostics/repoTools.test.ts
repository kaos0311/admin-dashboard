import {execFileSync} from "node:child_process";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {afterEach, beforeEach, describe, expect, it} from "vitest";

import {repoRead, repoSearch, repoStatus} from "./repoTools.js";

let repoRoot: string;

function git(args: string[]): void {
  execFileSync("git", args, {
    cwd: repoRoot,
    stdio: "ignore",
    windowsHide: true,
  });
}

async function writeFixture(relativePath: string, content: string): Promise<void> {
  const absolutePath = path.join(repoRoot, ...relativePath.split("/"));
  await fsp.mkdir(path.dirname(absolutePath), {recursive: true});
  await fsp.writeFile(absolutePath, content, "utf8");
}

beforeEach(async () => {
  repoRoot = await fsp.mkdtemp(path.join(os.tmpdir(), "jarvis-diagnostics-repo-"));
  git(["init"]);
  git(["config", "user.email", "test@example.local"]);
  git(["config", "user.name", "Diagnostics Test"]);
  await writeFixture("src/app.ts", "export const marker = 'askAdminAi';\nexport const other = 'safe';\n");
  await writeFixture("functions/src/tool.ts", "export function tool() {\n  return 'diagnostic';\n}\n");
  await writeFixture(
    "src/hardcodedConfig.ts",
    [
      "export const apiKey = 'sk_test_abcdefghijklmnopqrstuvwxyz123456';",
      "export const bearer = 'Authorization: Bearer abcdefghijklmnopqrstuvwxyz123456';",
      "export const privateKey = '-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----';",
      "",
    ].join("\n"),
  );
  await writeFixture("src/.env", "SECRET=value\n");
  await writeFixture("src/serviceAccountKey.json", "{\"private_key\":\"nope\"}\n");
  git(["add", "src/app.ts", "src/hardcodedConfig.ts", "functions/src/tool.ts", "src/.env", "src/serviceAccountKey.json"]);
  git(["commit", "-m", "fixtures"]);
});

afterEach(async () => {
  await fsp.rm(repoRoot, {recursive: true, force: true});
});

describe("repo diagnostics sandbox", () => {
  it("returns fixed git status for the trusted repo", async () => {
    const result = await repoStatus({repoRoot});

    expect(result.evidence.status).toBe("VERIFIED");
    expect(result.result?.provider.providerType).toBe("LOCAL_WORKTREE");
    expect(result.result?.provider.commit).toMatch(/^[a-f0-9]{40}$/);
    expect(result.result?.branch).toBe("master");
    expect(result.result?.head).toMatch(/^[a-f0-9]{40}$/);
    expect(result.result?.clean).toBe(true);
  });

  it("rejects traversal paths", async () => {
    await expect(repoRead("../package.json", 1, 1, {repoRoot})).rejects.toThrow(
      /traversal|readable|Absolute/,
    );
  });

  it("rejects absolute path escapes", async () => {
    await expect(repoRead(path.join(repoRoot, "src/app.ts"), 1, 1, {repoRoot})).rejects.toThrow(
      /Absolute paths/,
    );
  });

  it("rejects .env access even when tracked", async () => {
    await expect(repoRead("src/.env", 1, 1, {repoRoot})).rejects.toThrow(/Sensitive/);
  });

  it("rejects service account and key access even when tracked", async () => {
    await expect(repoRead("src/serviceAccountKey.json", 1, 1, {repoRoot})).rejects.toThrow(/Sensitive/);
  });

  it("rejects oversized read windows", async () => {
    await expect(repoRead("src/app.ts", 1, 121, {repoRoot})).rejects.toThrow(/Line window exceeds/);
  });

  it("reads valid tracked source windows", async () => {
    const result = await repoRead("src/app.ts", 1, 2, {repoRoot});

    expect(result.evidence.status).toBe("VERIFIED");
    expect(result.result?.provider.providerType).toBe("LOCAL_WORKTREE");
    expect(result.result?.path).toBe("src/app.ts");
    expect(result.result?.lines).toEqual([
      {line: 1, text: "export const marker = 'askAdminAi';"},
      {line: 2, text: "export const other = 'safe';"},
    ]);
  });

  it("treats command injection strings as literal search data", async () => {
    const result = await repoSearch("askAdminAi; git status && rm -rf /", 10, {repoRoot});

    expect(result.evidence.status).toBe("VERIFIED");
    expect(result.result?.hits).toHaveLength(0);
  });

  it("redacts secret-like source content in repo_read output", async () => {
    const result = await repoRead("src/hardcodedConfig.ts", 1, 3, {repoRoot});
    const serialized = JSON.stringify(result.result?.lines);

    expect(serialized).not.toContain("sk_test_abcdefghijklmnopqrstuvwxyz123456");
    expect(serialized).not.toContain("Authorization: Bearer");
    expect(serialized).not.toContain("-----BEGIN PRIVATE KEY-----");
    expect(serialized).toContain("[REDACTED_SECRET]");
  });

  it("redacts secret-like source content in repo_search previews", async () => {
    const result = await repoSearch("apiKey", 5, {repoRoot});
    const serialized = JSON.stringify(result.result?.hits);

    expect(serialized).not.toContain("sk_test_abcdefghijklmnopqrstuvwxyz123456");
    expect(serialized).toContain("[REDACTED_SECRET]");
  });

  it("caps oversized search results", async () => {
    await writeFixture("src/many.ts", Array.from({length: 40}, (_, index) => `export const value${index} = 'needle';`).join("\n"));
    git(["add", "src/many.ts"]);
    git(["commit", "-m", "many"]);

    const result = await repoSearch("needle", 500, {repoRoot});

    expect(result.result?.hits).toHaveLength(25);
    expect(result.result?.truncated).toBe(true);
  });

  it("returns bounded valid source search hits", async () => {
    const result = await repoSearch("diagnostic", 5, {repoRoot});

    expect(result.result?.hits).toEqual([
      {
        path: "functions/src/tool.ts",
        line: 2,
        preview: "return 'diagnostic';",
      },
    ]);
  });

  it("rejects symlink escapes from tracked source paths", async () => {
    const outsideDir = await fsp.mkdtemp(path.join(os.tmpdir(), "jarvis-diagnostics-outside-"));
    const outsideFile = path.join(outsideDir, "outside.ts");
    await fsp.writeFile(outsideFile, "export const outside = true;\n", "utf8");
    const linkPath = path.join(repoRoot, "src", "linked.ts");

    try {
      await fsp.symlink(outsideFile, linkPath, "file");
    } catch {
      await fsp.rm(outsideDir, {recursive: true, force: true});
      return;
    }

    try {
      fs.lstatSync(linkPath);
      git(["add", "src/linked.ts"]);
      git(["commit", "-m", "symlink"]);
      await expect(repoRead("src/linked.ts", 1, 1, {repoRoot})).rejects.toThrow(/Symlink escapes/);
    } finally {
      await fsp.rm(outsideDir, {recursive: true, force: true});
    }
  });
});
