---
id: mem_53Kpli0Y
title: 'Memory entries are markdown files with YAML frontmatter, one per file'
date: '2026-09-19'
author: kishore.knaresh07@gmail.com
tags:
  - architecture
  - storage
refs:
  - src/core/schema.ts#MemoryFrontmatterSchema
supersedes: null
status: superseded
commit: da746d6bf843c3e6742adf61efaa0c3c50af7c0f
fingerprint:
  src/core/schema.ts#MemoryFrontmatterSchema:
    hash: af7e849722501787
    kind: symbol
last_checked: null
---
Chosen over a single JSON/SQLite store so git handles merge/diff/blame for free, matches the append-only-files-conflict-less principle from the idea review doc, and stays human-readable/editable without tooling. Schema lives in src/core/schema.ts.
