/**
 * 影视分析报告入口（ADR-0048：独立域，自 src/movie/analysis.ts 迁出）。
 * 命令（bz-movie-report）由 main.ts 裸注册；影视主界面 📊 按钮经 movie/ui.ts 显式引用本域。
 * 数据只读 `我的/影视/*.md` frontmatter（metadataCache），与 movie 域共享 constants（纯数据，无环）。
 */
import type { App } from 'obsidian';
import { tryGetSettings } from '../core/settings-provider';
import { openAnalysisModal, closeAnalysis } from './analysis';
import { setReportFolderPath, resetMovieReportState } from './state';

let initialized = false;

/** 幂等初始化（懒加载）：解析影视目录——与 movie 域同源设置 movieFolderPath，重启生效语义一致 */
export function ensureMovieReport(): void {
  if (initialized) return;
  initialized = true;
  const s = tryGetSettings() as any;
  setReportFolderPath(s.movieFolderPath || '我的/影视');
}

/** 打开观影数据分析窗口（命令 bz-movie-report 回调；toggle 语义） */
export function openMovieReport(app: App): void {
  ensureMovieReport();
  openAnalysisModal(app);
}

/** 卸载清理（main.ts onunload 调用）：关窗 + 复位目录 */
export function unloadMovieReport(): void {
  initialized = false;
  closeAnalysis();
  resetMovieReportState();
}
