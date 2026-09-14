/**
 * 只读检索桥（issue 318）：域外消费方（知识盒挂载树建议链路）取第二大脑向量检索的**唯一窄口**。
 *
 * 动机（2026-09-14 集成实测）：消费方若**值导入** `secondbrain/index`，会把 index 静态 import 的
 * 整条 UI 栈（panel / reference-panel / chat-panel / mobile-panel / link-agent）拖进自己的构建闭包——
 * 插件侧只是产物膨胀，原型行为产物则直接构建失败（`prototypes/knowledge` 缺 fake 的 Setting 导出）。
 * 本模块是叶子：只 `import type` SearchHit（编译期擦除），运行时零依赖，注册/取用都不引入重模块。
 *
 * 范式同 `core/link-now.ts` 的 setLinkBridge：secondbrain 在 index.ts 初始化时注册、
 * 卸载时置 null；消费方 import 本模块读取，未注册（第二大脑未初始化 / 已卸载）返回 null，
 * 调用方按「拿不到可用向量索引」降级，不报错、不自动建索引。
 */
import type { SearchHit } from './vector-store';

/** 只读检索面：不暴露 VectorStore 本体，也不提供任何写入口（refresh / rebuildAll 等） */
export interface ReadonlyVectorSearch {
  /** 索引是否就绪（未建 / 已降级 → false；调用方据此降级，不自动建索引） */
  isIndexReady(): boolean;
  /** 块级检索（桌面向量优先、异常降级文本；移动端由调用方自行降级） */
  search(query: string, topK?: number): Promise<SearchHit[]>;
}

let source: ReadonlyVectorSearch | null = null;

/** 注册/撤销只读检索面（secondbrain/index.ts 在 ensure 时就位注册、unload 时传 null） */
export function setVectorSearchSource(s: ReadonlyVectorSearch | null): void {
  source = s;
}

/** 取只读检索面；未注册返回 null（调用方按降级处理） */
export function exportVectorSearch(): ReadonlyVectorSearch | null {
  return source;
}
