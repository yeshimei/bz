/**
 * 影视 Q3 海报整理（ticket 14，源码 L63-153 逐字移植）
 */
import type { App, TFile } from 'obsidian';
import { Notice } from 'obsidian';
let initialized = false;

/** 测试/重建用：允许重新注册 */
export function resetQ3(): void {
  initialized = false;
}

/** 防抖工具（300ms） */
function debounce<T extends (...args: any[]) => void>(fn: T, wait: number): T {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const wrapped = (...args: any[]) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
  return wrapped as T;
}

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'svg', 'webp'];

/** 注册 Q3 海报整理（enableQ3 时调用，防重复注册） */
export function initQ3(app: App, folderPath: string, posterFolder: string): void {
  if (initialized) return;
  initialized = true;

  const PROCESSING_FILES = new Set<string>();
  const CONFIG_FOLDER = posterFolder;

  async function processNote(noteFile: TFile): Promise<void> {
    if (PROCESSING_FILES.has(noteFile.path)) return;
    if (!noteFile.path.startsWith(folderPath + '/')) return;

    const cache = app.metadataCache.getFileCache(noteFile);
    if (!cache || !cache.frontmatter) return;

    const content = await app.vault.read(noteFile);
    const imageMatch = content.match(/!\[\[([^\]]+)\]\]/);
    if (!imageMatch) return;

    const imagePath = imageMatch[1];
    const imageFile = app.metadataCache.getFirstLinkpathDest(imagePath, noteFile.path);
    if (!imageFile) return;

    const ext = (imageFile.extension || '').toLowerCase();
    if (!IMAGE_EXTENSIONS.includes(ext)) return;

    PROCESSING_FILES.add(noteFile.path);
    try {
      // 已在目标文件夹：仅更新 frontmatter 海报字段
      if (imageFile.parent && imageFile.parent.path === CONFIG_FOLDER) {
        await app.fileManager.processFrontMatter(noteFile, (fm: Record<string, any>) => {
          fm['海报'] = imageFile.path;
        });
        return;
      }

      // 确保目标文件夹存在
      await app.vault.createFolder(CONFIG_FOLDER).catch(() => {});

      // 重名处理
      let newName = imageFile.name;
      const targetPath = `${CONFIG_FOLDER}/${imageFile.name}`;
      const existing = app.vault.getAbstractFileByPath(targetPath);
      if (existing) {
        newName = `${imageFile.basename}_${Date.now()}.${imageFile.extension}`;
      }

      // 移动海报到目标文件夹
      const newPath = `${CONFIG_FOLDER}/${newName}`;
      await app.vault.rename(imageFile, newPath);

      // 更新笔记内引用
      const newContent = content.replace(`![[${imagePath}]]`, `![[${newName}]]`);
      if (newContent !== content) {
        await app.vault.modify(noteFile, newContent);
      }

      // 写 frontmatter 海报字段
      await app.fileManager.processFrontMatter(noteFile, (fm: Record<string, any>) => {
        fm['海报'] = newPath;
      });

      new Notice(`${noteFile.basename} 的电影海报已更新！`);
    } finally {
      PROCESSING_FILES.delete(noteFile.path);
    }
  }

  // vault modify 防抖监听 + file-open 监听
  const debouncedModify = debounce((file: TFile) => {
    processNote(file);
  }, 300);

  app.vault.on('modify', debouncedModify as any);
  app.workspace.on('file-open', (leaf: any) => {
    if (leaf?.view?.file) processNote(leaf.view.file);
  });

  // 启动时处理当前打开的笔记
  const activeFile = app.workspace.getActiveFile();
  if (activeFile) {
    setTimeout(() => processNote(activeFile), 1000);
  }
}
