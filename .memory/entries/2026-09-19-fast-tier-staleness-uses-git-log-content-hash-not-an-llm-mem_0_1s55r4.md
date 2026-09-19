---
id: mem_0_1s55r4
title: 'Fast-tier staleness uses git log + content hash, not an LLM'
date: '2026-09-19'
author: kishore.knaresh07@gmail.com
tags:
  - architecture
  - staleness
refs:
  - src/core/staleness.ts#checkRef
supersedes: mem_bRW4nIut
status: active
commit: df30769ef4f797001b55b0bcee3402d61257d39f
fingerprint:
  src/core/staleness.ts#checkRef:
    hash: 5890e79ed5079155
    kind: symbol
last_checked: null
---
memory check re-hashes each ref's symbol/file and counts commits touching that file since capture (src/core/staleness.ts). A hash mismatch is a high-confidence flag; commits with no hash change is low-confidence. Symbol extraction now searches up to 50 lines ahead for the opening brace (src/core/fingerprint.ts) so multi-line signatures fingerprint the whole body, not just the declaration line.
