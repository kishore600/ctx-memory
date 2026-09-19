import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

async function git(cwd: string, args: string[]): Promise<string> {
  try {
    const { stdout } = await execFileAsync("git", args, { cwd });
    return stdout.trim();
  } catch {
    return "";
  }
}

export async function isGitRepo(cwd: string): Promise<boolean> {
  const out = await git(cwd, ["rev-parse", "--is-inside-work-tree"]);
  return out === "true";
}

export async function getRepoRoot(cwd: string): Promise<string | null> {
  const out = await git(cwd, ["rev-parse", "--show-toplevel"]);
  return out || null;
}

export async function getGitAuthor(cwd: string): Promise<string> {
  const email = await git(cwd, ["config", "user.email"]);
  if (email) return email;
  const name = await git(cwd, ["config", "user.name"]);
  return name || "unknown";
}

export async function getCurrentCommit(cwd: string): Promise<string | null> {
  const out = await git(cwd, ["rev-parse", "HEAD"]);
  return out || null;
}

/** Number of commits that touched `filePath` between `sinceCommit` (exclusive) and HEAD (inclusive). */
export async function countCommitsSince(
  cwd: string,
  sinceCommit: string | null,
  filePath: string
): Promise<number> {
  const range = sinceCommit ? `${sinceCommit}..HEAD` : "HEAD";
  const out = await git(cwd, ["log", "--oneline", range, "--", filePath]);
  if (!out) return 0;
  return out.split("\n").filter(Boolean).length;
}
