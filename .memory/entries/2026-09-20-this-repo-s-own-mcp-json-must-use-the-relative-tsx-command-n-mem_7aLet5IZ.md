---
id: mem_7aLet5IZ
title: >-
  This repo's own .mcp.json must use the relative tsx command, not connect's
  default
date: '2026-09-20'
author: kishore.knaresh07@gmail.com (via agent)
tags:
  - setup
  - gotcha
refs:
  - src/commands/connect.ts#resolveCliPath
  - .mcp.json
supersedes: null
status: active
commit: 643e17d9f68de69ca99a8990b634793c769a5801
fingerprint:
  src/commands/connect.ts#resolveCliPath:
    hash: e9ee6ea00f7668a7
    kind: symbol
  .mcp.json:
    hash: 55c1c1085a1d62ff
    kind: file
last_checked: null
---
`memory connect` defaults to registering the absolute path of the running CLI, which is correct for a consuming project (works regardless of install method) but wrong for this repo, whose .mcp.json is committed and self-referencing — an absolute path would hardcode one machine's Documents folder and break for anyone who clones. Re-run as `memory connect --command "npx tsx src/cli.ts mcp"` after any connect here. Discovered by running plain `memory connect` in this repo and watching it rewrite the portable config to a local absolute path.
