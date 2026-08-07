import { Plugin } from 'obsidian';
import type DiarySettings from './settings';

/**
 * 日记本插件入口。
 * 装配细节在 settings/装配 ticket（09）完成；此处为可加载的最小骨架。
 */
export default class DiaryNotebookPlugin extends Plugin {
  settings: DiarySettings | null = null;

  async onload() {
    // 装配（ticket 09）：设置加载、ribbon、命令、面板初始化、文件监听
  }

  async onunload() {
    // 清理（ticket 09）：DOM、ESC 监听、命令、文件监听
  }
}
