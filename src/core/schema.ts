import { z } from "zod";

export const StatusEnum = z.enum(["active", "stale", "superseded"]);
export type Status = z.infer<typeof StatusEnum>;

export const FingerprintEntrySchema = z.object({
  hash: z.string(),
  kind: z.enum(["symbol", "file", "missing"]),
});
export type FingerprintEntry = z.infer<typeof FingerprintEntrySchema>;

export const MemoryFrontmatterSchema = z.object({
  id: z.string(),
  title: z.string(),
  date: z.string(),
  author: z.string(),
  tags: z.array(z.string()).default([]),
  refs: z.array(z.string()).default([]),
  supersedes: z.string().nullable().default(null),
  status: StatusEnum.default("active"),
  commit: z.string().nullable().default(null),
  fingerprint: z.record(z.string(), FingerprintEntrySchema).default({}),
  last_checked: z.string().nullable().default(null),
});
export type MemoryFrontmatter = z.infer<typeof MemoryFrontmatterSchema>;

export interface MemoryEntry {
  frontmatter: MemoryFrontmatter;
  body: string;
  /** Absolute path to the entry's .md file on disk. */
  filePath: string;
}

export const CONFIG_SCHEMA_VERSION = 1;

export interface StoreConfig {
  schemaVersion: number;
  createdAt: string;
}
