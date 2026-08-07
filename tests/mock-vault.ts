/**
 * 内存 vault mock：可读写的虚拟文件树（UI/数据层测试复用）。
 */
export class MockVault {
  files = new Map<string, string>();
  /** 显式注册的空目录（区分"空目录"与"目录不存在"） */
  dirs = new Set<string>();
  modifiedPaths: string[] = [];

  getAbstractFileByPath(path: string): any {
    if (this.files.has(path)) return this.file(path);
    // 目录：收集以 path/ 开头的直接子文件
    const prefix = path.endsWith('/') ? path : path + '/';
    const children = [...this.files.keys()]
      .filter((p) => p.startsWith(prefix) && !p.slice(prefix.length).includes('/'))
      .map((p) => this.file(p));
    if (children.length || this.dirs.has(path)) {
      return { path, children, isFolder: true };
    }
    return null;
  }

  file(path: string) {
    const content = this.files.get(path)!;
    const basename = path.split('/').pop()!.replace(/\.md$/, '');
    return {
      path,
      basename,
      extension: path.endsWith('.md') ? 'md' : '',
      name: path.split('/').pop()!,
      stat: Promise.resolve({ ctime: Date.UTC(2024, 0, 1, 12, 0), birthtime: Date.UTC(2024, 0, 1, 12, 0) }),
      content,
    };
  }

  async read(file: any): Promise<string> {
    return this.files.get(file.path) ?? '';
  }

  async create(path: string, content: string): Promise<any> {
    this.files.set(path, content);
    this.modifiedPaths.push(path);
    return this.file(path);
  }

  async modify(file: any, content: string): Promise<void> {
    this.files.set(file.path, content);
    this.modifiedPaths.push(file.path);
  }

  async delete(file: any): Promise<void> {
    this.files.delete(file.path);
    this.modifiedPaths.push(file.path);
  }

  async createFolder(path: string): Promise<void> {
    this.dirs.add(path);
  }

  getFiles(): any[] {
    return [...this.files.keys()].map((p) => this.file(p));
  }

  getMarkdownFiles(): any[] {
    return [...this.files.keys()].filter((p) => p.endsWith('.md')).map((p) => this.file(p));
  }

  /** 事件模拟（create/modify/delete），供监听类测试 emit */
  listeners: Record<string, Function[]> = {};
  on(event: string, cb: (...args: any[]) => void): any {
    (this.listeners[event] ||= []).push(cb);
    return { ref: `mock-ref-${event}` };
  }
  off(): void {}
  offref(): void {}
  emit(event: string, ...args: any[]): void {
    for (const cb of this.listeners[event] || []) cb(...args);
  }
}

/** 解析 frontmatter（简易 YAML 子集：key: value 行） */
export function parseFrontmatter(content: string): Record<string, any> | null {
  const m = content.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) return null;
  const fm: Record<string, any> = {};
  for (const line of m[1].split('\n')) {
    const idx = line.indexOf(':');
    if (idx > 0) {
      const key = line.slice(0, idx).trim();
      let value: any = line.slice(idx + 1).trim();
      // 简单数组解析 [电影]
      const arrMatch = value.match(/^\[(.*)\]$/);
      if (arrMatch) {
        value = arrMatch[1]
          .split(',')
          .map((s) => s.trim())
          .map((s) => {
            if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) return s.slice(1, -1);
            return s;
          })
          .filter(Boolean);
      } else if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1); // 与 Obsidian parseFrontmatter 一致：剥引号
      } else if (/^-?\d+(\.\d+)?$/.test(value)) {
        value = Number(value); // 与 Obsidian parseFrontmatter 一致：数字
      } else if (value === 'true') {
        value = true;
      }
      fm[key] = value;
    }
  }
  return fm;
}

/** 构造带 frontmatter 解析的测试 app */
export function mockAppWithVault(vault: MockVault) {
  return {
    vault,
    metadataCache: {
      getFileCache: (f: any) => {
        const content = vault.files.get(f.path) ?? '';
        const fm = parseFrontmatter(content);
        return fm ? { frontmatter: fm } : null;
      },
    },
    workspace: {
      getActiveViewOfType: () => null,
      openLinkText: async () => {},
    },
    commands: {
      addCommand: () => {},
      removeCommand: () => {},
    },
  } as any;
}
