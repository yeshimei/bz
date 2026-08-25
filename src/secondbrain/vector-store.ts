/**
 * 第二大脑 VectorStore（ticket 103；对齐 QA 闪念.js L442-745）
 * meta v8 + secondbrain_vectors.vec（uint32LE dim 头 + float32 平铺；行序 = meta.notes 键序 × chunks）。
 *
 * 对齐要点：
 * - VP-Tree 构建缓存（{dim,count,noteCount} 键）+ 归一化一次性预存；检索 cos = max(0, 1 − d²/2)，score^0.35 锐化；
 * - refresh 批量嵌入走 parallelMap 自适应并发（起始并发 3，EMA 爬坡上限 60），批量失败回退逐条；
 * - 移动端三级降级 remote→tfidf→text；TF-IDF 以 chunk 为文档单位且构建后复用（不再随查询重建）。
 *
 * 保留 bz 改进：MobileBuffer 写入避 Node Buffer 池偏移、Ollama 统一 30s 超时、检索异常降级文本。
 * ticket 103 修复 QA/bz 同源缺陷两处（Q3=B 用户拍板，冻结描述随 ADR 修订）：
 * ① 仅删除文件时提前 return 跳过落盘 → 删除也持久化（紧凑重排后重写 meta+vec；白名单清空同样生效）；
 * ② 旧向量段偏移按「删除前」完整键序计算（原实现用删除后键序拷贝删除前布局，非末尾删除会错位）。
 */
import type { App } from 'obsidian';
import { buildConfig, IS_MOBILE } from './config';
import { MobileBuffer } from './binary';
import { CHUNK_SIZE, smartChunk } from './chunk';
import { euclideanSq, normalizeVec, vptree_build, vptree_search, VPNode, Vec } from './vptree';
import { parallelMap } from './parallel';
import { TFIDF } from './tfidf';
import { searchTextIndex } from './text-search';
import { checkRemoteOllama, EMBED_BATCH_SIZE, getEmbedding, getEmbeddingsBatch } from './ollama';

const VECTOR_STORE_VERSION = 8;

export interface NoteEntry {
  mtime: number;
  chunks: { text: string }[];
}

export interface SecondBrainMeta {
  version: number;
  notes: Record<string, NoteEntry>;
  _dim: number;
}

export interface SearchHit {
  path: string;
  chunk: string;
  score: number;
}

interface ChunkTask {
  filePath: string;
  chunkIdx: number;
  text: string;
  embedding?: Float32Array;
}

export class VectorStore {
  app: App;
  meta: SecondBrainMeta = { version: VECTOR_STORE_VERSION, notes: {}, _dim: 0 };
  vectors: Float32Array = new Float32Array(0);
  dim = 0;
  tfidf = new TFIDF();
  searchMode: 'remote' | 'tfidf' | 'text' = 'text';
  updateProgress: (msg: string) => void = () => {};

  /** VP 索引缓存：树 + 归一化向量 + 缓存键 + 来源数组身份（内容变更即失效） */
  private vpTree: VPNode | null = null;
  private vpVecs: Float32Array[] | null = null;
  private vpMetaKey: string | null = null;
  private vpSrc: Float32Array | null = null;

  constructor(app: App) {
    this.app = app;
  }

  get notes(): Record<string, NoteEntry> {
    return this.meta.notes;
  }

  async load(): Promise<void> {
    const CONFIG = buildConfig();
    try {
      const parsed = JSON.parse(await this.app.vault.adapter.read(CONFIG.META_PATH));
      if (parsed.version !== VECTOR_STORE_VERSION) {
        // 版本不符整库重建（QA 同语义；v7→v8 首载触发一次性全量重嵌）
        console.log(`[secondbrain] 向量库版本升级: ${parsed.version || 0} → ${VECTOR_STORE_VERSION}，触发重建`);
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
      this.vectors = new Float32Array(payload.buffer, payload.byteOffset, payload.byteLength >> 2);
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
    await this.app.vault.adapter.writeBinary(CONFIG.VEC_PATH, data._data.buffer as ArrayBuffer);
  }

  async saveStore(): Promise<void> {
    const CONFIG = buildConfig();
    await this.app.vault.adapter.write(CONFIG.META_PATH, JSON.stringify(this.meta));
  }

  /**
   * 按 meta.notes 当前键序紧凑重排向量段并落盘。
   * @param srcOffsets 删除前布局的 path→行偏移；无源偏移的条目（理论不出现在删除-only 路径）跳过其向量段。
   */
  private async compactAndSave(srcOffsets: Map<string, number>): Promise<void> {
    const dim = this.dim;
    if (dim > 0) {
      let total = 0;
      for (const note of Object.values(this.meta.notes)) total += note.chunks.length;
      const merged = new Float32Array(total * dim);
      let offset = 0;
      for (const [path, note] of Object.entries(this.meta.notes)) {
        const srcRow = srcOffsets.get(path);
        if (srcRow === undefined) continue;
        const count = note.chunks.length;
        merged.set(this.vectors.subarray(srcRow * dim, srcRow * dim + count * dim), offset);
        offset += count * dim;
      }
      this.vectors = merged;
      await this.saveVectors();
    }
    await this.saveStore();
  }

  /** 增量重建向量库 */
  async refresh(updateProgress?: (msg: string) => void): Promise<void> {
    if (updateProgress) this.updateProgress = updateProgress;
    const CONFIG = buildConfig();

    // 白名单过滤
    const allowPaths = CONFIG.ALLOW_PATHS || [];
    const allFiles = this.app.vault.getMarkdownFiles();
    const files = allFiles.filter((f) => {
      if (allowPaths.length === 0) return true;
      for (const allow of allowPaths) {
        if (f.path.startsWith(allow + '/') || f.path === allow) return true;
      }
      return false;
    });
    console.log(`[secondbrain] 全库 ${allFiles.length} 篇，白名单 [${allowPaths}] → 过滤后 ${files.length} 篇`);

    // 记录「删除前」完整键序的源偏移（修复②：拷贝旧段必须按源布局寻址）
    const srcOffsets = new Map<string, number>();
    let srcOff = 0;
    for (const [path, note] of Object.entries(this.meta.notes)) {
      srcOffsets.set(path, srcOff);
      srcOff += note.chunks.length;
    }

    // 白名单清空：全库清空并落盘（修复①在空集场景的延伸）
    if (files.length === 0) {
      if (Object.keys(this.meta.notes).length > 0) {
        this.meta.notes = {};
        this.vectors = new Float32Array(0);
        this.dim = 0;
        this.meta._dim = 0;
        await this.saveVectors();
        await this.saveStore();
        this.updateProgress('✅ 向量库已清空（白名单为空）');
      } else {
        this.updateProgress('⚠️ 没有符合条件的文件');
      }
      return;
    }

    // 删除已不存在文件的 meta 条目
    const filePaths = new Set(files.map((f) => f.path));
    let deleted = 0;
    for (const path of Object.keys(this.meta.notes)) {
      if (!filePaths.has(path)) {
        delete this.meta.notes[path];
        deleted++;
      }
    }

    let vectors = this.vectors;
    let dim = this.meta._dim || this.dim || 0;
    if (srcOff === 0) {
      vectors = new Float32Array(0);
      dim = 0;
    }

    // 待处理：新文件或 mtime 变化
    const toProcess = files.filter((f) => {
      const entry = this.meta.notes[f.path];
      return !entry || entry.mtime !== (f.stat as any).mtime;
    });

    // 修复①：无变更但有删除 → 也必须落盘
    if (toProcess.length === 0) {
      if (deleted > 0) {
        await this.compactAndSave(srcOffsets);
        this.updateProgress(`✅ 向量库已最新（清理 ${deleted} 个失效条目）`);
      } else {
        this.updateProgress('✅ 向量库已最新');
      }
      return;
    }

    // 读取 + 分块
    const minChunk = CONFIG.CHUNK_MIN_LENGTH || 50;
    const fileChunksMap = new Map<string, (ChunkTask | null)[]>();
    const globalTasks: ChunkTask[] = [];
    for (const file of toProcess) {
      try {
        const content = await this.app.vault.read(file);
        const chunks = smartChunk(content, minChunk);
        if (chunks.length === 0 && content.trim().length > 0) chunks.push(content.trim().slice(0, CHUNK_SIZE));
        fileChunksMap.set(file.path, chunks.map(() => null));
        chunks.forEach((text, idx) => globalTasks.push({ filePath: file.path, chunkIdx: idx, text }));
      } catch (err) {
        console.error(`[secondbrain] 读取失败 [${file.path}]`, err);
        delete this.meta.notes[file.path];
      }
    }
    if (globalTasks.length === 0) {
      this.updateProgress('✅ 向量化完成（无新内容）');
      return;
    }

    // 批量嵌入：EMBED_BATCH_SIZE 分批 → parallelMap 自适应并发（起始 3，QA 同参）
    const batches: ChunkTask[][] = [];
    for (let i = 0; i < globalTasks.length; i += EMBED_BATCH_SIZE) {
      batches.push(globalTasks.slice(i, i + EMBED_BATCH_SIZE));
    }
    let processed = 0;
    const total = toProcess.length;
    await parallelMap(batches, 3, async (batch) => {
      try {
        const embeddings = await getEmbeddingsBatch(batch.map((t) => t.text));
        for (let j = 0; j < batch.length; j++) {
          fileChunksMap.get(batch[j].filePath)![batch[j].chunkIdx] = batch[j];
          batch[j].embedding = new Float32Array(embeddings[j]);
        }
        processed += batch.length;
        this.updateProgress(
          `向量化: ${processed}/${globalTasks.length} chunks (${total} 篇文件, ${Math.round((processed / globalTasks.length) * 100)}%)`
        );
      } catch (err) {
        console.warn('[secondbrain] 批量向量化失败，回退逐条处理', err);
        for (const task of batch) {
          try {
            const embedding = await getEmbedding(task.text, false);
            // 回填槽位与登记口径一致（QA L598 同构）：否则 chunks 与向量数错位、合并越界
            fileChunksMap.get(task.filePath)![task.chunkIdx] = task;
            task.embedding = new Float32Array(embedding);
            processed++;
          } catch (e) {
            console.warn(`[secondbrain] 段落向量化失败 [${task.filePath}]`, e);
          }
        }
      }
    });

    // 登记新 meta 条目（meta 只存 text，向量只进 .vec——QA L610-619 同构）
    const newChunksPerFile = new Map<string, Float32Array[]>();
    for (const file of toProcess) {
      const tasks = globalTasks.filter((t) => t.filePath === file.path);
      const vecs = tasks.map((t) => t.embedding).filter(Boolean) as Float32Array[];
      if (vecs.length === 0) {
        delete this.meta.notes[file.path];
        continue;
      }
      if (dim === 0) dim = vecs[0].length;
      const keptTexts = (fileChunksMap.get(file.path)!.filter(Boolean) as ChunkTask[]).map((c) => ({ text: c.text }));
      this.meta.notes[file.path] = { mtime: (file.stat as any).mtime, chunks: keptTexts };
      newChunksPerFile.set(file.path, vecs);
    }

    // 合并写回：未变文件按源偏移拷贝旧段，新文件写新向量（QA L621-639，偏移已修）
    if (dim > 0) {
      let totalVecs = 0;
      for (const note of Object.values(this.meta.notes)) totalVecs += note.chunks.length;
      const merged = new Float32Array(totalVecs * dim);
      let offset = 0;
      for (const [path, note] of Object.entries(this.meta.notes)) {
        const srcRow = srcOffsets.get(path);
        if (!newChunksPerFile.has(path) && srcRow !== undefined) {
          const srcStart = srcRow * dim;
          merged.set(vectors.subarray(srcStart, srcStart + note.chunks.length * dim), offset);
          offset += note.chunks.length * dim;
        } else if (newChunksPerFile.has(path)) {
          for (const v of newChunksPerFile.get(path)!) {
            merged.set(v, offset);
            offset += v.length;
          }
        }
      }
      this.vectors = merged;
      this.dim = dim;
      this.meta._dim = dim;
      await this.saveVectors();
    }
    await this.saveStore();
    console.log(`[secondbrain] 向量库已保存: ${Object.keys(this.meta.notes).length} 个文件, dim=${dim}`);
    this.updateProgress(`✅ 向量化完成：${total} 篇文件，${globalTasks.length} 个段落`);
  }

  /** VP 索引缓存（QA L645-654）：键含 dim/count/noteCount，另加来源数组身份校验（内容变即重建） */
  private buildVPIndex(vecs: Float32Array[]): void {
    const metaKey = JSON.stringify({ dim: this.meta._dim, count: vecs.length, hash: Object.keys(this.meta.notes).length });
    if (this.vpMetaKey === metaKey && this.vpSrc === this.vectors && this.vpTree && this.vpVecs) return;
    const normalized = vecs.map((v) => normalizeVec(v));
    this.vpTree = vptree_build(
      normalized,
      normalized.map((_, i) => i)
    );
    this.vpVecs = normalized.map((v) => Float32Array.from(v));
    this.vpMetaKey = metaKey;
    this.vpSrc = this.vectors;
    console.log(`[secondbrain] VP-Tree built: ${normalized.length} vecs`);
  }

  /** 向量检索：查询嵌入 → VP-Tree topK×3 候选 → cos=1−d²/2 → 去重 → topK → score^0.35（QA L655-691） */
  async vectorSearch(query: string, topK = 20, baseUrl?: string): Promise<SearchHit[]> {
    const queryEmbedding = await getEmbedding(query, true, baseUrl);
    if (!queryEmbedding) return [];
    const dim = this.meta._dim || this.dim;
    if (!dim || this.vectors.length === 0) return [];

    const vecs: Float32Array[] = [];
    for (let i = 0; i < this.vectors.length; i += dim) {
      vecs.push(this.vectors.subarray(i, i + dim));
    }
    this.buildVPIndex(vecs);

    const k = Math.min(topK * 3, vecs.length);
    const queryNorm = normalizeVec(queryEmbedding);
    const candidates = vptree_search(this.vpTree, this.vpVecs!, queryNorm, k);

    const paths = Object.keys(this.meta.notes);
    const hits: SearchHit[] = candidates.map((r) => {
      let vecIdx = r.idx;
      let accPath = paths[0] ?? '';
      for (const p of paths) {
        const count = this.meta.notes[p].chunks.length;
        if (vecIdx < count) {
          accPath = p;
          break;
        }
        vecIdx -= count;
      }
      const cosSim = Math.max(0, 1 - r.dist / 2);
      return { path: accPath, chunk: this.meta.notes[accPath]?.chunks[vecIdx]?.text || '', score: cosSim };
    });

    const seen = new Set<string>();
    const deduped: SearchHit[] = [];
    for (const item of hits) {
      const key = item.path + '::' + item.chunk;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(item);
    }
    const topResults = deduped.sort((a, b) => b.score - a.score).slice(0, topK);
    for (const r of topResults) r.score = Math.pow(r.score, 0.35);
    return topResults;
  }

  /** 桌面检索：向量优先，异常降级文本；移动端直走文本索引（QA L694-699 + bz 降级改进） */
  async search(query: string, topK = 20): Promise<SearchHit[]> {
    if (IS_MOBILE) return searchTextIndex(query, this.meta.notes, topK);
    try {
      return await this.vectorSearch(query, topK);
    } catch (e) {
      console.warn('[secondbrain] 向量检索失败，降级为文本检索', e);
      return searchTextIndex(query, this.meta.notes, topK);
    }
  }

  searchText(query: string, topK = 20): SearchHit[] {
    return searchTextIndex(query, this.meta.notes, topK);
  }

  /** 移动端三级检索：远程向量 → TF-IDF（复用已建索引）→ 文本（QA L704-718） */
  async searchMobile(query: string, topK = 20): Promise<SearchHit[]> {
    const CONFIG = buildConfig();
    if (this.searchMode === 'remote' && CONFIG.OLLAMA_REMOTE_URL) {
      try {
        const results = await this.vectorSearch(query, topK, CONFIG.OLLAMA_REMOTE_URL);
        if (results.length) return results;
      } catch (e) {
        console.warn('[secondbrain] 远程向量检索失败，降级', e);
      }
    }
    if (this.searchMode === 'tfidf' && this.tfidf.N > 0) {
      return this.tfidf.search(query, topK);
    }
    return this.searchText(query, topK);
  }

  /** 移动端初始化：探活远程 Ollama，否则建 chunk 粒度 TF-IDF 索引（构建一次，检索期复用） */
  async initMobile(): Promise<string> {
    const CONFIG = buildConfig();
    if (CONFIG.OLLAMA_REMOTE_URL) {
      const ok = await checkRemoteOllama(CONFIG.OLLAMA_REMOTE_URL);
      if (ok) {
        this.searchMode = 'remote';
        console.log(`[secondbrain][移动端] 远程 Ollama 就绪: ${CONFIG.OLLAMA_REMOTE_URL}`);
        return '✅ 远程 Ollama 已连接';
      }
    }
    const docs: { path: string; text: string }[] = [];
    for (const [path, note] of Object.entries(this.meta.notes)) {
      for (const chunk of note.chunks) {
        if (chunk.text) docs.push({ path, text: chunk.text });
      }
    }
    this.tfidf.build(docs);
    if (this.tfidf.N > 0) {
      this.searchMode = 'tfidf';
      console.log(`[secondbrain][移动端] TF-IDF 就绪: ${this.tfidf.N} docs`);
      return `✅ TF-IDF 就绪（${this.tfidf.N} 段）`;
    }
    this.searchMode = 'text';
    console.log('[secondbrain][移动端] TF-IDF 无数据，使用文本匹配');
    return '⚠️ 没有符合条件的文件';
  }
}
