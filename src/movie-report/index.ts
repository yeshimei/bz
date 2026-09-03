/**
 * 影视分析报告入口（ADR-0048：独立域；ADR-0087 旧 movie 域退役后仍为独立报告命令）。
 * 命令（bz-movie-report）由 main.ts 裸注册。
 * 数据只读影视目录 frontmatter（metadataCache），与 cinema 域共享 constants（纯数据，无环）。
 */
import type { App } from 'obsidian';
import { tryGetSettings } from '../core/settings-provider';
import { openAnalysisModal, closeAnalysis } from './analysis';
import { setReportFolderPath, resetMovieReportState } from './state';

let initialized = false;

/** 幂等初始化（懒加载）：解析影视目录——与 cinema 域同源设置 cinemaFolderPath，重启生效语义一致 */
export function ensureMovieReport(): void {
  if (initialized) return;
  initialized = true;
  const s = tryGetSettings() as any;
  setReportFolderPath((typeof s.cinemaFolderPath === 'string' && s.cinemaFolderPath.trim() ? s.cinemaFolderPath : '我的/影视'));
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
