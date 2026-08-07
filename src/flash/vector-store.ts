/**
 * 闪念 VectorStore（ticket 18，源码 L443-745 语义移植）
 * meta.json v7 + vectors.vec（dim uint32 LE + float32 平铺）。
 */
import type { App } from 'obsidian';
import { buildConfig } from './config';
import { MobileBuffer, SafeBuffer } from './binary';
import { getEmbedding, getEmbeddingsBatch, checkRemoteOllama } from './ollama';
import { smartChunk } from './chunk';
import { euclideanSq, normalizeVec, vptree_build, vptree_search } from './vptree';
import { TFIDF } from './tfidf';
import { searchTextIndex, searchText, extractTerms } from './text-search';
import { EMBED_BATCH_SIZE } from './ollama';

const VECTOR_STORE_VERSION = 7;

export interface FlashDoc {
  path: string;
  text: string;
  chunks: string[];
  mtime: number;
}

export class VectorStore {
  app: App;
  meta: { version: number; notes: Record<string, { mtime: number; chunks: { text: string }[] }>; _dim: number } = { version: VECTOR_STORE_VERSION, notes: {}, _dim: 0 };
  vectors: Float32Array = new Float32Array(0);
  dim = 0;
  tfidf = new TFIDF();
  textIdx: any = null;
  mode: 'vector' | 'remote' | 'tfidf' | 'text' = 'vector';
  updateProgress: (msg: string) => void = () => {};

  constructor(app: App) {
    this.app = app;
  }

  async load(): Promise<void> {
    const CONFIG = buildConfig();
    try {
      const raw = await this.app.vault.adapter.read(CONFIG.META_PATH);
      const parsed = JSON.parse(raw);
      if (parsed.version !== VECTOR_STORE_VERSION) {
        this.meta = { version: VECTOR_STORE_VERSION, notes: {}, _dim: 0 };
        this.vectors = new Float32Array(0);
        this.dim = 0;
        return;
      }
      this.meta = parsed;
      this.dim = parsed._dim || 0;
    } catch {
      this.meta = { version: VECTOR_STORE_VERSION, notes: {}, _dim: 0 };
      this.vectors = new Float32Array(0);
      this.dim = 0;
      return;
    }
    await this.loadVectors();
  }

  async loadVectors(): Promise<void> {
    const CONFIG = buildConfig();
    try {
      const buf = await this.app.vault.adapter.readBinary(CONFIG.VEC_PATH);
      const arr = new Uint8Array(buf);
      const dim = new DataView(arr.buffer, arr.byteOffset, 4).getUint32(0, true);
      const payload = arr.slice(4);
      this.vectors = new Float32Array(payload.buffer, payload.byteOffset, (payload.byteLength) >> 2);
      this.dim = dim;
    } catch {
      this.vectors = new Float32Array(0);
      this.dim = 0;
    }
  }

  async saveVectors(): Promise<void> {
    const CONFIG = buildConfig();
    const dim = this.dim;
    // 固定用 MobileBuffer（alloc 从 0 起，避免 Node Buffer 池偏移）
    const header = MobileBuffer.alloc(4);
    header.writeUInt32LE(dim, 0);
    const payload = new Uint8Array(this.vectors.buffer, this.vectors.byteOffset, this.vectors.byteLength);
    const data = MobileBuffer.concat([header._data, payload]);
    await this.app.vault.adapter.writeBinary(CONFIG.VEC_PATH, data._data.buffer);
  }

  async saveStore(): Promise<void> {
    const CONFIG = buildConfig();
    const data = { version: VECTOR_STORE_VERSION, notes: this.meta.notes, _dim: this.dim };
    await this.app.vault.adapter.write(CONFIG.META_PATH, JSON.stringify(data));
  }

  /** 增量重建向量库 */
  async refresh(updateProgress?: (msg: string) => void): Promise<void> {
    if (updateProgress) this.updateProgress = updateProgress;
    const CONFIG = buildConfig();

    // 白名单过滤
    const allow = (p: string) => CONFIG.ALLOW_PATHS.some((a) => p.startsWith(a + '/') || p === a);
    const files = this.app.vault.getMarkdownFiles().filter((f) => allow(f.path));
    if (files.length === 0) {
      this.updateProgress('⚠️ 没有符合条件的文件');
      return;
    }

    // 删除已不存在文件条目
    const existing = new Set(files.map((f) => f.path));
    for (const path of Object.keys(this.meta.notes)) {
      if (!existing.has(path)) delete this.meta.notes[path];
    }

    // 构建现有向量索引（path → 向量段偏移）
    const existingVecIdx = new Map<string, number>();
    let offset = 0;
    for (const [path, entry] of Object.entries(this.meta.notes)) {
      existingVecIdx.set(path, offset);
      offset += entry.chunks.length;
    }

    // 待处理：mtime 变化或新文件
    const toProcess = files.filter((f) => {
      const entry = this.meta.notes[f.path];
      return !entry || entry.mtime !== (f.stat as any).mtime;
    });
    if (toProcess.length === 0) {
      this.updateProgress('✅ 向量库已最新');
      return;
    }

    // 读取 + 分块
    const fileChunksMap = new Map<string, { chunks: string[]; mtime: number }>();
    for (const file of toProcess) {
      try {
        const content = await this.app.vault.read(file);
        let chunks = smartChunk(content, CONFIG.CHUNK_MIN_LENGTH);
        if (chunks.length === 0 && content.trim()) {
          chunks = [content.trim().slice(0, 256)];
        }
        fileChunksMap.set(file.path, { chunks, mtime: (file.stat as any).mtime });
      } catch {
        delete this.meta.notes[file.path];
      }
    }

    // 分批向量化
    const globalTasks: { path: string; chunk: string }[] = [];
    for (const [path, info] of fileChunksMap) {
      for (const chunk of info.chunks) globalTasks.push({ path, chunk });
    }

    const newVecByPath = new Map<string, number[][]>();
    for (let i = 0; i < globalTasks.length; i += EMBED_BATCH_SIZE) {
      const batch = globalTasks.slice(i, i + EMBED_BATCH_SIZE);
      try {
        const vecs = await getEmbeddingsBatch(batch.map((t) => t.chunk));
        batch.forEach((t, k) => {
          if (!newVecByPath.has(t.path)) newVecByPath.set(t.path, []);
          newVecByPath.get(t.path)!.push(vecs[k] || []);
        });
      } catch {
        // 失败回退逐条
        for (const t of batch) {
          try {
            const v = await getEmbedding(t.chunk, false);
            if (!newVecByPath.has(t.path)) newVecByPath.set(t.path, []);
            newVecByPath.get(t.path)!.push(v);
          } catch {
            /* 单条失败跳过 */
          }
        }
      }
    }

    // 合并写回：未变文件拷贝旧向量段，新文件写新向量
    // 先把新条目登记进 meta.notes（否则合并循环读不到）
    for (const path of fileChunksMap.keys()) {
      if (!this.meta.notes[path]) this.meta.notes[path] = { mtime: 0, chunks: [] };
    }
    const newVectors: number[][] = [];
    for (const [path, entry] of Object.entries(this.meta.notes)) {
      if (fileChunksMap.has(path)) {
        // 更新条目
        const info = fileChunksMap.get(path)!;
        const vecs = newVecByPath.get(path) || [];
        entry.mtime = info.mtime;
        entry.chunks = info.chunks.map((text) => ({ text })); // meta 只存 text，向量进 .vec
        for (const v of vecs) newVectors.push(v);
      } else {
        // 拷贝旧段
        const start = existingVecIdx.get(path) || 0;
        const count = entry.chunks.length;
        for (let k = 0; k < count; k++) {
          const v: number[] = [];
          for (let d = 0; d < this.dim; d++) {
            v.push(this.vectors[start * this.dim + k * this.dim + d]);
          }
          newVectors.push(v);
        }
      }
    }

    this.dim = newVectors.length ? newVectors[0].length : this.dim;
    this.vectors = new Float32Array(newVectors.flat());
    await this.saveVectors();
    await this.saveStore();
    this.updateProgress(`✅ 向量化完成：${toProcess.length} 篇文件，${globalTasks.length} 个段落`);
  }

  /** 向量检索（VP-Tree） */
  async vectorSearch(query: string, topK = 20, baseUrl?: string): Promise<{ path: string; chunk: string; score: number }[]> {
    const q = await getEmbedding(query, true, baseUrl);
    const n = this.meta.notes;
    const paths = Object.keys(n);
    const vecOffsets = new Map<string, number>();
    let offset = 0;
    for (const p of paths) {
      vecOffsets.set(p, offset);
      offset += n[p].chunks.length;
    }
    const N = this.vectors.length / this.dim;
    const items: number[][] = [];
    for (let i = 0; i < N; i++) {
      const v: number[] = [];
      for (let d = 0; d < this.dim; d++) v.push(this.vectors[i * this.dim + d]);
      items.push(normalizeVec(v));
    }
    const qn = normalizeVec(q);
    const tree = vptree_build(items, items.map((_, i) => i));
    const k = Math.min(topK * 3, N);
    const hits = vptree_search(tree, items, qn, k);

    const results = new Map<string, { path: string; chunk: string; score: number }>();
    for (const hit of hits) {
      const vecIdx = hit.idx;
      // vecIdx → path + chunk
      let path = paths[0];
      let chunkIdx = 0;
      let cum = 0;
      for (const p of paths) {
        const count = n[p].chunks.length;
        if (vecIdx < cum + count) {
          path = p;
          chunkIdx = vecIdx - cum;
          break;
        }
        cum += count;
      }
      const cosSim = Math.max(0, 1 - Math.sqrt(hit.dist) / 2);
      const key = `${path}::${chunkIdx}`;
      const existing = results.get(key);
      if (!existing || cosSim > existing.score) {
        results.set(key, { path, chunk: n[path].chunks[chunkIdx].text, score: cosSim });
      }
    }
    const sorted = [...results.values()].sort((a, b) => b.score - a.score).slice(0, topK);
    sorted.forEach((r) => (r.score = Math.pow(r.score, 0.35)));
    return sorted;
  }

  /** 统一检索（IS_MOBILE → 文本索引） */
  async search(query: string, topK = 20): Promise<{ path: string; chunk: string; score: number }[]> {
    const CONFIG = buildConfig();
    const { IS_MOBILE } = await import('./config');
    if (IS_MOBILE) {
      return this.searchText(query, topK);
    }
    try {
      return await this.vectorSearch(query, topK);
    } catch (e) {
      console.warn('向量检索失败，降级为文本检索', e);
      return this.searchText(query, topK);
    }
  }

  searchText(query: string, topK = 20): { path: string; chunk: string; score: number }[] {
    const docs: { path: string; text: string }[] = [];
    for (const [path, entry] of Object.entries(this.meta.notes)) {
      entry.chunks.forEach((c) => docs.push({ path, text: c.text }));
    }
    this.textIdx = searchTextIndex(docs);
    return searchText(query, this.textIdx, topK).map((r) => ({
      path: r.path,
      chunk: this.meta.notes[r.path]?.chunks[0]?.text || '',
      score: r.score,
    }));
  }

  /** 移动端初始化（远程优先 → TF-IDF → 文本） */
  async initMobile(): Promise<string> {
    const CONFIG = buildConfig();
    const docs: { path: string; text: string }[] = [];
    for (const [path, entry] of Object.entries(this.meta.notes)) {
      docs.push({ path, text: entry.chunks.map((c) => c.text).join('') });
    }
    const remoteOk = await checkRemoteOllama(CONFIG.OLLAMA_REMOTE_URL);
    if (remoteOk) {
      this.mode = 'remote';
      return '✅ 远程 Ollama 已连接';
    }
    this.tfidf.build(docs);
    if (this.tfidf.N > 0) {
      this.mode = 'tfidf';
      return `✅ TF-IDF 就绪（${this.tfidf.N} 段）`;
    }
    this.mode = 'text';
    return '✅ 移动端模式：已加载 0 篇笔记';
  }

  /** 移动端检索 */
  async searchMobile(query: string, topK = 20): Promise<{ path: string; chunk: string; score: number }[]> {
    const CONFIG = buildConfig();
    if (this.mode === 'remote') {
      try {
        return await this.vectorSearch(query, topK, CONFIG.OLLAMA_REMOTE_URL);
      } catch (e) {
        console.warn('远程向量检索失败，降级', e);
      }
    }
    if (this.mode === 'tfidf') {
      const docs: { path: string; text: string }[] = [];
      for (const [path, entry] of Object.entries(this.meta.notes)) {
        docs.push({ path, text: entry.chunks.map((c) => c.text).join('') });
      }
      this.tfidf.build(docs);
      return this.tfidf.search(query, topK).map((r) => ({
        path: r.path,
        chunk: this.meta.notes[r.path]?.chunks[0]?.text || '',
        score: r.score,
      }));
    }
    return this.searchText(query, topK);
  }
}
