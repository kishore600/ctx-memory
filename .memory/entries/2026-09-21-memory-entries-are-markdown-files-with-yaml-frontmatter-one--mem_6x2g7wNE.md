---
id: mem_6x2g7wNE
title: 'Memory entries are markdown files with YAML frontmatter, one per file'
date: '2026-09-21'
author: kishore.knaresh07@gmail.com
tags:
  - architecture
  - storage
refs:
  - src/core/schema.ts#MemoryFrontmatterSchema
supersedes: mem_53Kpli0Y
status: active
commit: b64e2ae3d0ef05c5d39f3ea0f7a7c76bdea52566
fingerprint:
  src/core/schema.ts#MemoryFrontmatterSchema:
    hash: af7e849722501787
    kind: symbol
last_checked: null
---
Chosen over a single JSON or SQLite store so git handles merge, diff and blame for free. Small per-entry files also conflict far less than one shared file when two people capture at the same time, and they stay readable and editable in any editor without the tool installed. The schema lives in src/core/schema.ts and every read and write is validated against it, so a hand-edited entry fails loudly instead of silently corrupting the store.
