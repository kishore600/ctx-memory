---
id: mem_Tm5iijX0
title: >-
  Knowledge graph and search stay local: no embeddings, no bundled viz library,
  no server
date: '2026-09-24'
author: kishore.knaresh07@gmail.com
tags:
  - architecture
  - mcp
  - visualization
refs:
  - src/core/graph.ts
  - src/core/search.ts
  - src/generators/graphHtml.ts
  - src/mcp/server.ts
supersedes: null
status: superseded
commit: 07357e98d956e783b74a73a524bedeae631ff1e8
fingerprint:
  src/core/graph.ts:
    hash: eee211507321a869
    kind: file
  src/core/search.ts:
    hash: 845de578617dc17b
    kind: file
  src/generators/graphHtml.ts:
    hash: 3ebf9ed9605d0058
    kind: file
  src/mcp/server.ts:
    hash: 108918aeceb15c1a
    kind: file
last_checked: null
---
The viewgraph command and the new MCP relationship/search tools had to satisfy a spec asking for 'semantic search' and 'automatic relevance ranking' while the README guarantees zero network calls and rejects AI-powered checks as costly/unreliable. Resolved (user's explicit choice among presented options) by keeping everything local: search_memory now ranks with a hand-rolled TF-IDF-style scorer (src/core/search.ts) instead of embeddings, and get_related_memory (src/core/graph.ts) finds connections via shared refs/tags/supersedes instead of vector similarity. The graph itself (buildGraph) is derived from listEntries() on every call, not cached, so 'incremental updates' fall out for free with no invalidation logic. viewgraph's interactive page (src/generators/graphHtml.ts) is a hand-rolled force-directed layout in vanilla JS embedded as a template string, not d3/vis-network, so the generated HTML has zero external script tags and whyanchor gains zero new npm dependencies. Rejected: cloud embeddings (breaks 'no network calls'), a bundled local embedding model (adds a heavy dependency + first-run download to a 6-dependency tool), and a CDN-loaded graph library (breaks offline use and the self-contained-file guarantee). Also caught in browser testing: the page's initial fitToView() must tolerate a zero-size SVG rect on first frame (retried via requestAnimationFrame) and re-fit on window resize until the user manually pans/zooms/drags — otherwise the graph can render at scale(0) and look blank depending on when the browser finishes layout.
