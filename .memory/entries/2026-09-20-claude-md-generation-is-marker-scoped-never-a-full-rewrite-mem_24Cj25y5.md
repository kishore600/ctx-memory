---
id: mem_24Cj25y5
title: 'CLAUDE.md generation is marker-scoped, never a full rewrite'
date: '2026-09-20'
author: kishore.knaresh07@gmail.com
tags:
  - architecture
  - generation
refs:
  - src/generators/agentsFile.ts#upsertMemorySection
supersedes: null
status: superseded
commit: 67a6efe5f752993bfe0c44c5cd9d2f1f47555065
fingerprint:
  src/generators/agentsFile.ts#upsertMemorySection:
    hash: 64973373e31049e4
    kind: symbol
last_checked: null
---
upsertMemorySection only replaces the text between <!-- ctx-memory:start --> and <!-- ctx-memory:end -->, so hand-written instructions elsewhere in CLAUDE.md/AGENTS.md survive every regeneration. Without this, 'memory generate' would be destructive and nobody would wire it into a hook.
