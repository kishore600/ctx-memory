import prompts from "prompts";
import { computeFingerprints } from "../core/fingerprint.js";
import { getCurrentCommit, getGitAuthor, getRepoRoot } from "../core/git.js";
import { findEntryById, storeExists, updateEntryFrontmatter, writeEntry } from "../core/store.js";

export interface CaptureOptions {
  title?: string;
  message?: string;
  refs?: string[];
  tags?: string[];
  supersedes?: string;
}

function splitList(input?: string[]): string[] {
  if (!input) return [];
  return input
    .flatMap((s) => s.split(","))
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function runCapture(cwd: string, opts: CaptureOptions): Promise<void> {
  const repoRoot = (await getRepoRoot(cwd)) ?? cwd;

  if (!(await storeExists(repoRoot))) {
    console.error("✖ No memory store found. Run `memory init` first.");
    process.exitCode = 1;
    return;
  }

  let title = opts.title;
  let message = opts.message;
  let refs = splitList(opts.refs);
  let tags = splitList(opts.tags);

  const interactive = !title || !message;
  if (interactive) {
    const answers = await prompts(
      [
        { type: title ? null : "text", name: "title", message: "One-line title for this memory:" },
        {
          type: message ? null : "text",
          name: "message",
          message: "What should future you (or another dev) know? (a few sentences)",
        },
        {
          type: refs.length ? null : "text",
          name: "refs",
          message: "Files/symbols this is anchored to (comma-separated, e.g. src/billing.ts#calculateTax):",
          initial: "",
        },
        {
          type: tags.length ? null : "text",
          name: "tags",
          message: "Tags (comma-separated, optional):",
          initial: "",
        },
      ],
      { onCancel: () => process.exit(1) }
    );
    title = title ?? answers.title;
    message = message ?? answers.message;
    if (!refs.length && answers.refs) refs = splitList([answers.refs]);
    if (!tags.length && answers.tags) tags = splitList([answers.tags]);
  }

  if (!title || !message) {
    console.error("✖ A title and message are required.");
    process.exitCode = 1;
    return;
  }

  if (opts.supersedes) {
    const prior = await findEntryById(repoRoot, opts.supersedes);
    if (!prior) {
      console.error(`✖ No memory entry found with id "${opts.supersedes}".`);
      process.exitCode = 1;
      return;
    }
  }

  const [author, commit] = await Promise.all([getGitAuthor(repoRoot), getCurrentCommit(repoRoot)]);
  const fingerprints = await computeFingerprints(repoRoot, refs);

  const entry = await writeEntry(
    repoRoot,
    {
      title,
      author,
      tags,
      refs,
      supersedes: opts.supersedes ?? null,
      status: "active",
      commit,
      fingerprint: fingerprints,
      last_checked: null,
    },
    message
  );

  if (opts.supersedes) {
    const prior = await findEntryById(repoRoot, opts.supersedes);
    if (prior) {
      await updateEntryFrontmatter(prior, { status: "superseded" });
      console.log(`✔ Marked ${opts.supersedes} as superseded.`);
    }
  }

  console.log(`✔ Captured "${title}" → ${entry.filePath}`);
  if (refs.length) {
    const missing = refs.filter((r) => fingerprints[r]?.kind === "missing");
    if (missing.length) {
      console.warn(`⚠ Could not resolve ${missing.length} ref(s), captured anyway: ${missing.join(", ")}`);
    }
  }
  console.log("Run `memory generate` to reflect this in CLAUDE.md / AGENTS.md.");
}
