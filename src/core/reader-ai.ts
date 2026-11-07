/**
 * 阅读器门面（ADR-0294）：第二大脑对**跨插件消费方**（bz-reader）开放的笔记库检索与嵌入能力。
 *
 * 为什么另起一个门面而不是塞进 `plugin.knowledge`（ADR-0215）：
 *   知识盒门面是「录入交给你、内容归我」，检索与嵌入是**只读算力**，归属第二大脑域，
 *   两者生命周期也不同（知识盒随命令懒初始化、第二大脑随启动布局就绪初始化）。混在一个对象里，
 *   调用方探测「能不能检索」会拿到一个永远存在的函数——探测就失去意义。
 *
 * 叶子模块（范式同 `secondbrain/readonly.ts`）：只 `import type`，运行时零依赖——
 * 消费方值导入本模块不会把第二大脑的 UI 栈（panel / chat / link-agent）拖进构建闭包。
 * 注册方在 `secondbrain/reader-ai-bridge.ts`，卸载置 null；未注册时取到 null，
 * 调用方按「这台 bz 支持但域未就绪」降级，不报错、不自动建索引。
 */

/** 一条笔记检索命中。字段只留消费方要显示的，不暴露 VectorStore 的内部结构 */
export interface ReaderNoteHit {
  /** 笔记在库里的相对路径 */
  path: string;
  /** 笔记标题（去目录去 .md 的文件名，仅供显示） */
  title: string;
  /** 命中的片段原文 */
  chunk: string;
  /** 余弦相关度 0..1（阈值判定与显示同一把尺，见 ADR-0185） */
  score: number;
}

export interface ReaderAiApi {
  /** 第二大脑索引是否就绪（未建 / 已降级 → false；调用方据此提示「先建索引」，不自动建） */
  isIndexReady(): boolean;
  /** 当前嵌入模型名。调用方把它连同向量一起存进自己的文件，模型变了要重建（维度不同不可比） */
  embeddingModel(): string;
  /** 按问题检索笔记库；索引未就绪时返回空数组（不抛） */
  searchNotes(query: string, topK?: number): Promise<ReaderNoteHit[]>;
  /** 批量嵌入**文档块**（不加查询指令）；批失败逐条回退，`signal` 是取消通道 */
  embedDocuments(texts: string[], signal?: AbortSignal): Promise<number[][]>;
  /** 嵌入**一句问题**（按模型加检索指令前缀，与建库侧同一口径） */
  embedQuery(text: string, signal?: AbortSignal): Promise<number[]>;
}

let source: ReaderAiApi | null = null;

/** 注册/撤销（第二大脑域 ensure 时注册、unload 时传 null） */
export function setReaderAi(api: ReaderAiApi | null): void {
  source = api;
}

/** 取门面；未注册返回 null */
export function getReaderAi(): ReaderAiApi | null {
  return source;
}
