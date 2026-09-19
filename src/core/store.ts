import { mkdir, readdir, readFile, writeFile, access } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { nanoid } from "nanoid";
import {
  CONFIG_SCHEMA_VERSION,
  MemoryFrontmatterSchema,
  type MemoryEntry,
  type MemoryFrontmatter,
  type StoreConfig,
} from "./schema.js";

export const MEMORY_DIR = ".memory";
export const ENTRIES_DIR = "entries";
export const CONFIG_FILE = "config.json";

export function memoryDir(repoRoot: string): string {
  return path.join(repoRoot, MEMORY_DIR);
}

export function entriesDir(repoRoot: string): string {
  return path.join(memoryDir(repoRoot), ENTRIES_DIR);
}

export async function storeExists(repoRoot: string): Promise<boolean> {
  try {
    await access(memoryDir(repoRoot));
    return true;
  } catch {
    return false;
  }
}

export async function initStore(repoRoot: string): Promise<void> {
  await mkdir(entriesDir(repoRoot), { recursive: true });
  const config: StoreConfig = {
    schemaVersion: CONFIG_SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
  };
  await writeFile(path.join(memoryDir(repoRoot), CONFIG_FILE), JSON.stringify(config, null, 2) + "\n", "utf8");
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

export function entryFileName(date: string, title: string, id: string): string {
  return `${date}-${slugify(title)}-${id}.md`;
}

export function newId(): string {
  return `mem_${nanoid(8)}`;
}

export async function writeEntry(
  repoRoot: string,
  frontmatter: Omit<MemoryFrontmatter, "id" | "date"> & { id?: string; date?: string },
  body: string
): Promise<MemoryEntry> {
  const id = frontmatter.id ?? newId();
  const date = frontmatter.date ?? new Date().toISOString().slice(0, 10);
  const full: MemoryFrontmatter = MemoryFrontmatterSchema.parse({ ...frontmatter, id, date });

  const fileName = entryFileName(date, full.title, id);
  const filePath = path.join(entriesDir(repoRoot), fileName);
  const content = matter.stringify(body.trim() + "\n", full);
  await writeFile(filePath, content, "utf8");
  return { frontmatter: full, body: body.trim(), filePath };
}

export async function updateEntryFrontmatter(
  entry: MemoryEntry,
  patch: Partial<MemoryFrontmatter>
): Promise<MemoryEntry> {
  const next = MemoryFrontmatterSchema.parse({ ...entry.frontmatter, ...patch });
  const content = matter.stringify(entry.body.trim() + "\n", next);
  await writeFile(entry.filePath, content, "utf8");
  return { ...entry, frontmatter: next };
}

export async function readEntryFile(filePath: string): Promise<MemoryEntry> {
  const raw = await readFile(filePath, "utf8");
  const parsed = matter(raw);
  const frontmatter = MemoryFrontmatterSchema.parse(parsed.data);
  return { frontmatter, body: parsed.content.trim(), filePath };
}

export async function listEntries(repoRoot: string): Promise<MemoryEntry[]> {
  const dir = entriesDir(repoRoot);
  let files: string[];
  try {
    files = await readdir(dir);
  } catch {
    return [];
  }
  const mdFiles = files.filter((f) => f.endsWith(".md"));
  const entries = await Promise.all(mdFiles.map((f) => readEntryFile(path.join(dir, f))));
  entries.sort((a, b) => (a.frontmatter.date < b.frontmatter.date ? 1 : -1));
  return entries;
}

export async function findEntryById(repoRoot: string, id: string): Promise<MemoryEntry | null> {
  const entries = await listEntries(repoRoot);
  return entries.find((e) => e.frontmatter.id === id) ?? null;
}
