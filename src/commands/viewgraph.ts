import { type ChildProcess, spawn } from "node:child_process";
import { createServer } from "node:net";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getRepoRoot } from "../core/git.js";
import { openInBrowser } from "../core/open.js";
import { storeExists } from "../core/store.js";

const require = createRequire(import.meta.url);

export interface ViewgraphOptions {
  tag?: string;
  port?: number;
  open?: boolean;
}

const DEFAULT_PORT = 4317;
const READY_TIMEOUT_MS = 20_000;

/** dist/commands/viewgraph.js -> the package root, two levels up. */
function packageRoot(): string {
  return path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
}

function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = createServer();
    probe.once("error", () => resolve(false));
    probe.listen(port, () => probe.close(() => resolve(true)));
  });
}

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, () => {
      const address = probe.address();
      const port = typeof address === "object" && address ? address.port : 0;
      probe.close(() => resolve(port));
    });
  });
}

async function waitUntilReady(url: string, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.status < 500) return true;
    } catch {
      // Server isn't accepting connections yet — keep polling.
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

function waitForChildExit(child: ChildProcess): Promise<void> {
  return new Promise((resolve) => {
    const stop = () => {
      child.kill();
      resolve();
    };
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
    child.once("exit", () => resolve());
  });
}

export async function runViewgraph(cwd: string, opts: ViewgraphOptions): Promise<void> {
  const repoRoot = (await getRepoRoot(cwd)) ?? cwd;

  if (!(await storeExists(repoRoot))) {
    console.error("✖ No memory store found. Run `whyanchor init` first.");
    process.exitCode = 1;
    return;
  }

  const appDir = path.join(packageRoot(), "graph-app");
  const port = opts.port ?? ((await isPortFree(DEFAULT_PORT)) ? DEFAULT_PORT : await getFreePort());
  const nextBin = require.resolve("next/dist/bin/next");

  const child = spawn(process.execPath, [nextBin, "start", appDir, "-p", String(port)], {
    env: { ...process.env, WHYANCHOR_REPO_ROOT: repoRoot },
    stdio: "inherit",
  });

  const urlPath = opts.tag ? `/?tag=${encodeURIComponent(opts.tag)}` : "/";
  const url = `http://localhost:${port}${urlPath}`;

  console.log(`Starting the knowledge graph server…`);
  const ready = await waitUntilReady(`http://localhost:${port}/api/graph`, READY_TIMEOUT_MS);

  if (ready) {
    console.log(`✔ Knowledge graph running at ${url}`);
    console.log("Press Ctrl+C to stop.");
    if (opts.open !== false) {
      const opened = await openInBrowser(url);
      if (!opened) console.log(`Open it yourself: ${url}`);
    }
  } else {
    console.warn(`⚠ The server did not respond within ${READY_TIMEOUT_MS / 1000}s — check the output above for errors.`);
  }

  await waitForChildExit(child);
}
