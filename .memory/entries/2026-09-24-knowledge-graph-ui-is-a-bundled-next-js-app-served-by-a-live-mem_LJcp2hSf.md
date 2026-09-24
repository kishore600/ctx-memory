---
id: mem_LJcp2hSf
title: >-
  Knowledge graph UI is a bundled Next.js app served by a live local server, not
  static HTML
date: '2026-09-24'
author: kishore.knaresh07@gmail.com
tags:
  - architecture
  - mcp
  - visualization
refs:
  - src/commands/viewgraph.ts
  - graph-app/app/api/graph/route.ts
  - graph-app/components/GraphView.tsx
  - graph-app/next.config.mjs
  - package.json
supersedes: mem_Tm5iijX0
status: active
commit: 07357e98d956e783b74a73a524bedeae631ff1e8
fingerprint:
  src/commands/viewgraph.ts:
    hash: fb8843ef6ba98447
    kind: file
  graph-app/app/api/graph/route.ts:
    hash: e508dbda0691665d
    kind: file
  graph-app/components/GraphView.tsx:
    hash: 352999e95ccbb514
    kind: file
  graph-app/next.config.mjs:
    hash: e692bf58456786ce
    kind: file
  package.json:
    hash: 704f230fca1fc42e
    kind: file
last_checked: null
---
Superseded by an explicit user request: 'use next.js on it end to end' with a 'modern' UI, after the first cut (mem_Tm5iijX0) shipped a dependency-free static HTML file. Two follow-up choices were asked and answered explicitly: (1) delivery model - a live local server (whyanchor viewgraph spawns 'next start' as a child process via src/commands/viewgraph.ts, not a static export), so the page can poll GET /api/graph and show newly captured memories without regenerating anything; (2) dependency placement - next/react/react-dom/react-force-graph-2d are direct 'dependencies' of the published whyanchor package (not an isolated workspace), so a single 'npm install whyanchor' is still enough, matching the existing zero-extra-setup philosophy even though the dependency count itself grew a lot. This does step away from the README's 'no server' framing - that line now needs updating to describe an opt-in local server started only by 'viewgraph', not a change to the MCP/CLI's own behavior. Key implementation details worth knowing before touching this again: graph-app/ is a separate Next app (own tsconfig, own next.config.mjs) that is NOT part of the root tsc build (root tsconfig only includes src/); 'npm run build' runs tsc then 'next build graph-app' in that order because graph-app/app/api/graph/route.ts imports the already-compiled ../../../dist/core/{store,graph}.js rather than ../src - importing compiled JS sidesteps any question of whether Next's bundler resolves the CLI's NodeNext-style '.js'-suffixed TS imports, and enforces build order. The published npm package ships graph-app/.next (prebuilt) plus graph-app/next.config.mjs via package.json 'files'; since '.next' is gitignored, an .npmignore (which fully replaces .gitignore for npm's packing purposes) was added so publishing still includes it. viewgraph.ts finds a free port (tries 4317 first), spawns next start as a child process with WHYANCHOR_REPO_ROOT in its env (the API route reads that env var directly, no other IPC needed since it's one machine/one env), waits for /api/graph to respond, opens the browser, and keeps the CLI process alive until the child exits or Ctrl+C. Caught in browser testing: ForceGraph2D's own container auto-sizing fell back to window dimensions inside this flex layout (a classic flex-item-content-overflow issue, fixed with min-w-0 on the flex-1 container) and even after that fix, its ResizeObserver-based sizing didn't fire promptly in one embedding context - fixed by measuring the container synchronously with useLayoutEffect on mount instead of waiting on the observer's first async callback.
