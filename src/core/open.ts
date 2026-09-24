import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/**
 * Opens `target` (a file path or URL) in the OS default handler. Uses execFile with an argv
 * array, not a shell string, so a repo path containing spaces or shell metacharacters can't be
 * misinterpreted. Returns false on failure so callers can print a manual fallback instead of
 * throwing — this is a nice-to-have, not something worth failing the command over.
 */
export async function openInBrowser(target: string): Promise<boolean> {
  try {
    if (process.platform === "win32") {
      // The empty string is the window title `start` expects before the target argument.
      await execFileAsync("cmd", ["/c", "start", "", target]);
    } else if (process.platform === "darwin") {
      await execFileAsync("open", [target]);
    } else {
      await execFileAsync("xdg-open", [target]);
    }
    return true;
  } catch {
    return false;
  }
}
