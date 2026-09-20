---
id: mem_JzWAzwRj
title: 'CLAUDE.md generation is marker-scoped, never a full rewrite'
date: '2026-09-20'
author: kishore.knaresh07@gmail.com
tags:
  - architecture
  - generation
refs:
  - src/generators/agentsFile.ts#upsertMemorySection
supersedes: mem_24Cj25y5
status: superseded
commit: 67a6efe5f752993bfe0c44c5cd9d2f1f47555065
fingerprint:
  src/generators/agentsFile.ts#upsertMemorySection:
    hash: 34dfb26289ea40d4
    kind: symbol
last_checked: null
---
upsertMemorySection only replaces the text between <!-- ctx-memory:start --> and <!-- ctx-memory:end -->, so hand-written instructions elsewhere in CLAUDE.md/AGENTS.md survive every regeneration. Marker lookup now matches only lines that are exactly the marker, not any substring — the original indexOf-based search matched the literal marker text when an entry's own body mentioned it (e.g. this entry describing the marker itself), truncating the file mid-sentence and duplicating content on every regenerate. Caught by dogfooding: capturing this exact entry corrupted CLAUDE.md the first time.
