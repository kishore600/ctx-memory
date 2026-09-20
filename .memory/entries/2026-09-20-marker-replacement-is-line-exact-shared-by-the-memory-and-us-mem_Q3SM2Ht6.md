---
id: mem_Q3SM2Ht6
title: 'Marker replacement is line-exact, shared by the memory and usage blocks'
date: '2026-09-20'
author: kishore.knaresh07@gmail.com
tags:
  - architecture
  - generation
refs:
  - src/generators/agentsFile.ts#upsertMarkedSection
supersedes: mem_JzWAzwRj
status: active
commit: 643e17d9f68de69ca99a8990b634793c769a5801
fingerprint:
  src/generators/agentsFile.ts#upsertMarkedSection:
    hash: bf35230544fc063f
    kind: symbol
last_checked: null
---
upsertMarkedSection replaces only the text between a start and end marker, matching each marker as a full line rather than a substring — an entry's rendered body can legitimately contain the literal marker text, and indexOf matched that instead of the real closing marker, truncating CLAUDE.md mid-sentence. Both CLAUDE.md blocks use it: the generated memory block (ctx-memory:start) and the agent usage block written by memory connect (ctx-memory:usage:start), which is why they can coexist and survive each other's regeneration. upsertMemorySection is now a thin wrapper kept for the existing call sites.
