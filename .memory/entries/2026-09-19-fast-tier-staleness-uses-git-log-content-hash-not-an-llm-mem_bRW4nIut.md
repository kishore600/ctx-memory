---
id: mem_bRW4nIut
title: 'Fast-tier staleness uses git log + content hash, not an LLM'
date: '2026-09-19'
author: kishore.knaresh07@gmail.com
tags:
  - architecture
  - staleness
refs:
  - src/core/staleness.ts#checkRef
supersedes: null
status: superseded
commit: da746d6bf843c3e6742adf61efaa0c3c50af7c0f
fingerprint:
  src/core/staleness.ts#checkRef:
    hash: baabb179a272134f
    kind: symbol
last_checked: null
---
memory check re-hashes each ref's symbol/file and counts commits touching that file since capture (src/core/staleness.ts). A hash mismatch is a high-confidence flag; commits with no hash change is low-confidence. This keeps the free tier LLM-free and matches the two-tier design in the SaaS strategy doc without needing the paid slow tier.
