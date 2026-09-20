# ctx-memory

A local-first, git-backed memory layer for AI coding agents (Claude Code, Cursor, Codex, …).

It captures decisions and context as small markdown files in `.memory/`, detects when they've
drifted from the code they describe, and surfaces them back to your agent — either injected into
`CLAUDE.md` / `AGENTS.md`, or served live over MCP, anchored to the file the agent is touching.

This is the **Free / OSS tier** scoped in [`SaaS Product Strategy.md`](./SaaS%20Product%20Strategy.md):
storage, capture, and local staleness detection. It's built to be interoperable, not a walled garden —
entries are plain markdown with YAML frontmatter, readable by any tool, versioned by git like everything
else in the repo.

For the full end-to-end picture — every feature, the workflow, architecture and sequence diagrams,
and a deep-dive on how staleness detection and symbol fingerprinting actually work — see
[`ARCHITECTURE.md`](./ARCHITECTURE.md).

## Why

Every team adding a second developer (or a second AI agent) to a codebase hits the same problem:
the *why* behind a decision lives in someone's head, a Slack thread, or a stale doc — never where the
agent can see it while it's making the next decision. See
[`Project Memory Layer — Idea & Tooling Review.md`](./Project%20Memory%20Layer%20—%20Idea%20&%20Tooling%20Review.md)
for the full problem writeup. Three principles drive the design:

- **Write friction kills memory systems.** Capture is one command (`memory capture`), never a form.
- **Untrusted memory is worse than no memory.** Every entry has a hash-based staleness check so you
  know when to stop trusting it, instead of finding out the hard way.
- **Retrieval should be anchored, not injected.** The MCP server hands an agent memory for the file
  it's touching, not the entire store on every turn — no context rot, no wasted tokens.

## Install

```bash
npm install
npm run build
npm link   # optional: makes `memory` available globally
```

Or run it straight from the repo without linking: `node dist/cli.js <command>`.

## Quickstart

```bash
memory init                 # creates .memory/ in the current git repo
memory capture               # one command, interactive prompts for title/body/refs/tags
memory generate               # writes captured entries into CLAUDE.md and AGENTS.md
memory check                  # fast-tier staleness check against the working tree
memory mcp                    # runs the MCP server over stdio
```

### Capturing non-interactively (for scripts / agent tool calls)

```bash
memory capture \
  -t "Chose Postgres over Mongo for billing" \
  -m "Needed multi-document transactions for tax reconciliation; Mongo's driver didn't support that in our deployed version." \
  -r "src/billing.ts#calculateTax" \
  --tags architecture,billing
```

Supersede a prior entry instead of leaving a stale one around:

```bash
memory capture -t "…" -m "…" --supersedes mem_bRW4nIut
```

## The memory file format

One markdown file per entry, under `.memory/entries/`:

```markdown
---
id: mem_0_1s55r4
title: Chose Postgres over Mongo for billing
date: 2026-09-19
author: kishore.k@dataflo.ai
tags: [architecture, billing]
refs: [src/billing.ts#calculateTax]
supersedes: null
status: active
commit: 8f3a1c2
fingerprint:
  src/billing.ts#calculateTax: { hash: 7ac9f1e2b3d4c5a6, kind: symbol }
last_checked: null
---

Needed multi-document transactions for tax reconciliation; Mongo's driver didn't
support that in our deployed version.
```

`refs` anchor the entry to code. `file.ts` fingerprints the whole file; `file.ts#symbolName`
fingerprints just that function/class (best-effort extraction — brace-matched for JS/TS/Go/Java-style
languages, indentation-matched for Python). `supersedes` links to the entry an author explicitly
replaced — a semantic conflict is resolved as a normal PR review, not a silent overwrite.

## Staleness detection (fast tier)

`memory check` re-fingerprints every ref and cross-checks it against git history:

| Result | Meaning |
| --- | --- |
| `[ok]` | Unchanged since capture |
| `[low]` | Commits touched the file since capture, but the referenced symbol's content is unchanged — probably fine |
| `[STALE]` | The referenced symbol/file's content changed since capture — the entry may no longer be accurate |
| `[missing]` | The referenced file or symbol can no longer be found |

```bash
memory check --fail-on-stale   # exit 1 if anything is flagged — wire into CI or a pre-commit hook
memory check --write           # persist last_checked + status back into entry frontmatter
memory check --json            # machine-readable output
```

This is the "fast tier" from the two-tier design in the strategy doc: pure hash + git-log diffing,
no LLM call, so it's free and runs on every commit. The LLM-backed "slow tier" (semantic diff → PR
comment) is scoped as a hosted/paid feature and intentionally isn't part of this local tool.

## Generating CLAUDE.md / AGENTS.md

```bash
memory generate                 # writes both
memory generate --target claude # or just one
```

Entries are grouped by tag and written between `<!-- ctx-memory:start -->` / `<!-- ctx-memory:end -->`
markers. Anything outside those markers — your own instructions, other sections — is left untouched;
running `generate` again only replaces what's between the markers.

## MCP server

```bash
memory mcp
```

Runs over stdio, exposing:

- `search_memory({ query?, tag? })` — keyword search over active entries
- `get_memory_for_file({ path })` — anchored retrieval for a file the agent is about to touch
- `get_memory_entry({ id })` — full entry content by id
- `list_stale_memory()` — entries flagged by the fast-tier check
- `capture_memory({ title, body, refs?, tags? })` — lets the agent propose a new entry; it's written
  straight to a git-tracked file for you to review at your next commit, same as anything else the
  agent writes — never committed on your behalf.

### Setting it up per agent

This repo already carries working examples of all three — `.mcp.json`, `.cursor/mcp.json`,
`.codex/config.toml` — pointing at `npx tsx src/cli.ts mcp` (runs from source, no build step).
Use the same shape in any other project, pointing `args` at wherever `ctx-memory` lives there.

**Claude Code** — project-scope `.mcp.json` at the repo root (commit it so the whole team gets
it on clone):

```json
{
  "mcpServers": {
    "ctx-memory": {
      "command": "npx",
      "args": ["tsx", "src/cli.ts", "mcp"]
    }
  }
}
```

**Cursor** — identical JSON shape, at `.cursor/mcp.json`.

**Codex CLI** — TOML, not JSON, at `.codex/config.toml`, and Codex only reads it for projects
you've marked trusted (`codex trust` on the repo once):

```toml
[mcp_servers.ctx-memory]
command = "npx"
args = ["tsx", "src/cli.ts", "mcp"]
```

### Getting an agent to actually use it

Registering the server makes the tools *available* — it doesn't make an agent reach for them.
Add a short instruction block to `CLAUDE.md`/`AGENTS.md` (above the generated marker section,
so it survives every `memory generate`) telling the agent when to call what — see the "Working
with project memory" section at the top of this repo's own `CLAUDE.md` for the exact wording
to copy. Full rationale in [ARCHITECTURE.md](./ARCHITECTURE.md) §9.

## Pre-commit hook

```bash
#!/bin/sh
memory check --fail-on-stale || {
  echo "Some memory entries look stale — run 'memory check' for details."
  exit 1
}
```

## What's deliberately not here

Per the strategy doc's own scoring: no raw session-transcript extractor (undocumented vendor
formats, poor signal-to-noise), no home-grown secret scanner (wrap gitleaks/trufflehog instead), and
no hosted control plane (dashboard, cross-repo aggregation, billing, SSO) — that's the paid layer
described in [`SaaS Product Strategy.md`](./SaaS%20Product%20Strategy.md) §5–8, deliberately out of
scope for this local-first tool.

## Development

```bash
npm run build       # tsc → dist/
npm run typecheck   # tsc --noEmit
npm test            # vitest
npm run dev -- <command>   # run the CLI from source via tsx, no build step
```
