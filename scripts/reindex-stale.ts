#!/usr/bin/env bun
/**
 * Re-index job: finds documents whose indexedAt is older than the threshold
 * and re-embeds them. Schedules itself to run every hour.
 *
 * Run with: bun run scripts/reindex-stale.ts
 */
// No listVectorStores export; we keep a static registry of stores to scan.
import { InMemoryVectorStore } from "../src/vector-store/memory.js";
import type { Document, VectorStore } from "../src/vector-store/types.js";
import { MockEmbeddings, OpenAIEmbeddings, OllamaEmbeddings } from "../src/embeddings/index.js";
function pickEmbedder(): { embed: (text: string) => Promise<number[]> } {
  if (process.env.OPENAI_API_KEY) {
    return new OpenAIEmbeddings({ apiKey: process.env.OPENAI_API_KEY, model: process.env.OPENAI_EMBED_MODEL ?? "text-embedding-3-small" });
  }
  if (process.env.OLLAMA_HOST) {
    return new OllamaEmbeddings({ host: process.env.OLLAMA_HOST, model: process.env.OLLAMA_EMBED_MODEL ?? "nomic-embed-text" });
  }
  return new MockEmbeddings();
}

const STALE_MS = Number(process.env.REINDEX_STALE_MS ?? 24 * 60 * 60 * 1000); // 24h
const TICK_MS = Number(process.env.REINDEX_TICK_MS ?? 60 * 60 * 1000); // 1h

interface StaleDoc {
  store: VectorStore;
  doc: Document;
}

// Module-level registry so multiple stores can register themselves. For now we
// rely on env-stored handles; in production this would be replaced by a DI container.
const STORES: VectorStore[] = [];
export function registerStore(s: VectorStore) { STORES.push(s); }
async function findStale(): Promise<StaleDoc[]> {
  const stores = STORES;
  const out: StaleDoc[] = [];
  const cutoff = Date.now() - STALE_MS;
  for (const s of stores) {
    // Vector stores don't expose iteration by default; we re-upsert no-op
    // candidates by reading and checking indexedAt. Memory store only for now.
    if (s.type !== "memory") continue;
    const sample = (s as unknown as { docs?: Map<string, Document> }).docs;
    if (!sample) continue;
    for (const d of sample.values()) {
      if (new Date(d.indexedAt).getTime() < cutoff) {
        out.push({ store: s, doc: d });
      }
    }
  }
  return out;
}

async function reindexBatch(): Promise<{ reembedded: number; failed: number }> {
  const stale = await findStale();
  if (stale.length === 0) return { reembedded: 0, failed: 0 };
  const embedder = pickEmbedder();
  let reembedded = 0;
  let failed = 0;
  for (const { store, doc } of stale) {
    try {
      const vec = await embedder.embed(doc.text);
      const next: Document = { ...doc, vector: vec, indexedAt: new Date().toISOString() };
      await store.upsert(next);
      reembedded++;
    } catch (e) {
      failed++;
      console.error("[reindex] failed for doc", doc.id, (e as Error).message);
    }
  }
  return { reembedded, failed };
}

async function tick() {
  const started = Date.now();
  try {
    const r = await reindexBatch();
    console.log(`[reindex] reembedded=${r.reembedded} failed=${r.failed} durationMs=${Date.now() - started}`);
  } catch (e) {
    console.error("[reindex] tick error", (e as Error).message);
  }
}

if (import.meta.main) {
  // One immediate run, then on the TICK_MS interval.
  await tick();
  setInterval(tick, TICK_MS);
}
