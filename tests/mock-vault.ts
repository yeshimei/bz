/**
 * 内存 vault mock：可读写的虚拟文件树（UI/数据层测试复用）。
 */
export class MockVault {
  files = new Map<string, string>();
  /** 二进制附件文件树（encrypt 域等用；与 files 分离，避免污染既有 string 型断言） */
  binaryFiles = new Map<string, Uint8Array>();
  /** 显式注册的空目录（区分"空目录"与"目录不存在"） */
  dirs = new Set<string>();
  modifiedPaths: string[] = [];

  /** 内存文件系统 adapter（Obsidian 式 read/write，数据层日志/配置读写用） */
  adapter = {
    read: async (path: string): Promise<string> => {
      const v = this.files.get(path);
      if (v === undefined) throw new Error('file not found: ' + path);
      return v;
    },
    write: async (path: string, content: string): Promise<void> => {
      this.files.set(path, content);
      this.modifiedPaths.push(path);
    },
    exists: async (path: string): Promise<boolean> => this.files.has(path) || this.binaryFiles.has(path) || this.dirs.has(path),
    remove: async (path: string): Promise<void> => {
      this.files.delete(path);
      this.binaryFiles.delete(path);
      this.modifiedPaths.push(path);
    },
    mkdir: async (path: string): Promise<void> => {
      this.dirs.add(path);
    },
    rename: async (oldPath: string, newPath: string): Promise<void> => {
      const v = this.files.get(oldPath);
      if (v !== undefined) {
        this.files.delete(oldPath);
        this.files.set(newPath, v);
        this.modifiedPaths.push(newPath);
        return;
      }
      const b = this.binaryFiles.get(oldPath);
      if (b !== undefined) {
        this.binaryFiles.delete(oldPath);
        this.binaryFiles.set(newPath, b);
        this.modifiedPaths.push(newPath);
      }
    },
    list: async (path: string): Promise<{ files: string[]; folders: string[] }> => {
      const prefix = path.endsWith('/') ? path : path + '/';
      const files = [...this.files.keys()].filter((p) => p.startsWith(prefix) && !p.slice(prefix.length).includes('/'));
      const folders = [...this.files.keys()]
        .filter((p) => p.startsWith(prefix) && p.slice(prefix.length).includes('/'))
        .map((p) => prefix + p.slice(prefix.length).split('/')[0]);
      return { files, folders: [...new Set(folders)] };
    },
  };

  getAbstractFileByPath(path: string): any {
    if (this.files.has(path) || this.binaryFiles.has(path)) return this.file(path);
    // 目录：收集以 path/ 开头的直接子文件
    const prefix = path.endsWith('/') ? path : path + '/';
    const children = [
      ...[...this.files.keys(), ...this.binaryFiles.keys()]
        .filter((p) => p.startsWith(prefix) && !p.slice(prefix.length).includes('/')),
    ].map((p) => this.file(p));
    if (children.length || this.dirs.has(path)) {
      return { path, children, isFolder: true };
    }
    return null;
  }

  file(path: string): any {
    const content = this.files.get(path) ?? (this.binaryFiles.has(path) ? '<binary>' : undefined);
    const basename = path.split('/').pop()!.replace(/\.[^./]+$/, '');
    const parentPath = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '/';
    return {
      path,
      basename,
      extension: path.includes('.') ? path.split('.').pop() : '',
      name: path.split('/').pop()!,
      parent: { path: parentPath },
      stat: Promise.resolve({ ctime: Date.UTC(2024, 0, 1, 12, 0), birthtime: Date.UTC(2024, 0, 1, 12, 0) }),
      content,
    };
  }

  async read(file: any): Promise<string> {
    return this.files.get(file.path) ?? '';
  }

  async readBinary(file: any): Promise<ArrayBuffer> {
    const bytes = this.binaryFiles.get(file.path);
    if (bytes) {
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    }
    const v = this.files.get(file.path);
    if (v === undefined) throw new Error('file not found: ' + file.path);
    const enc = new TextEncoder().encode(v);
    return enc.buffer.slice(enc.byteOffset, enc.byteOffset + enc.byteLength) as ArrayBuffer;
  }

  async create(path: string, content: string): Promise<any> {
    this.files.set(path, content);
    this.modifiedPaths.push(path);
    return this.file(path);
  }

  async createBinary(path: string, data: ArrayBuffer): Promise<any> {
    this.binaryFiles.set(path, new Uint8Array(data));
    this.modifiedPaths.push(path);
    return this.file(path);
  }

  async writeBinary(file: any, data: ArrayBuffer): Promise<void> {
    this.binaryFiles.set(file.path, new Uint8Array(data));
    this.modifiedPaths.push(file.path);
  }

  async modify(file: any, content: string): Promise<void> {
    this.files.set(file.path, content);
    this.modifiedPaths.push(file.path);
  }

  async rename(file: any, newPath: string): Promise<void> {
    const old = file.path;
    if (!this.files.has(old)) return;
    const content = this.files.get(old)!;
    this.files.delete(old);
    this.files.set(newPath, content);
    this.modifiedPaths.push(newPath);
  }

  async delete(file: any): Promise<void> {
    this.files.delete(file.path);
    this.binaryFiles.delete(file.path);
    this.modifiedPaths.push(file.path);
  }

  async createFolder(path: string): Promise<void> {
    this.dirs.add(path);
  }

  getFiles(): any[] {
    return [...new Set([...this.files.keys(), ...this.binaryFiles.keys()])].map((p) => this.file(p));
  }

  getMarkdownFiles(): any[] {
    return [...this.files.keys()].filter((p) => p.endsWith('.md')).map((p) => this.file(p));
  }

  /** 事件模拟（create/modify/delete），供监听类测试 emit */
  listeners: Record<string, Function[]> = {};
  on(event: string, cb: (...args: any[]) => void): any {
    (this.listeners[event] ||= []).push(cb);
    return { event, cb };
  }
  off(): void {}
  /** 按 on() 返回值移除监听（真实 offref 语义） */
  offref(ref: any): void {
    if (!ref || !ref.event) return;
    const arr = this.listeners[ref.event] || [];
    const idx = arr.indexOf(ref.cb);
    if (idx >= 0) arr.splice(idx, 1);
  }
  emit(event: string, ...args: any[]): void {
    for (const cb of this.listeners[event] || []) cb(...args);
  }
}

/** 解析 frontmatter（简易 YAML 子集：key: value 行 + `  - ` 列表项） */
export function parseFrontmatter(content: string): Record<string, any> | null {
  const m = content.match(/^---\n([\s\S]*?)\n---\s*(?:\n|$)/);
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
          .map((s: string) => s.trim())
          .map((s: string) => {
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
    } else if (/^\s*-\s+/.test(line)) {
      // YAML 列表项（tags:\n- 电影），挂到最后一个 key 上
      const lastKey = Object.keys(fm).pop();
      if (lastKey && !Array.isArray(fm[lastKey])) fm[lastKey] = [];
      if (lastKey) {
        let v: any = line.replace(/^\s*-\s+/, '').trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
        if (/^-?\d+(\.\d+)?$/.test(v)) v = Number(v);
        fm[lastKey].push(v);
      }
    }
  }
  return fm;
}

/** 构造带 frontmatter 解析的测试 app */
export function mockAppWithVault(vault: MockVault) {
  return {
    vault,
    metadataCache: (() => {
      const listeners: Record<string, Function[]> = {};
      return {
        getFileCache: (f: any) => {
          // 兼容 TFile 对象与路径字符串（encrypt 域 embeds 收集用）
          const path = typeof f === 'string' ? f : f?.path ?? '';
          const content = vault.files.get(path) ?? '';
          const fm = parseFrontmatter(content);
          // wikilink 嵌入解析（Obsidian 自带链接信息；encrypt 域附件收集的主数据源）
          const embeds: { link: string }[] = [];
          const re = /!\[\[([^\]|#]+)(?:\|[^\]]*)?\]\]/g;
          let m: RegExpExecArray | null;
          while ((m = re.exec(content)) !== null) embeds.push({ link: m[1].trim() });
          return fm || embeds.length ? { frontmatter: fm, embeds } : null;
        },
        // 事件监听（changed 等），供实时同步类测试 emit
        on: (event: string, cb: (...args: any[]) => void): any => {
          (listeners[event] ||= []).push(cb);
          return { event, cb };
        },
        offref: (ref: any): void => {
          if (!ref || !ref.event) return;
          const arr = listeners[ref.event] || [];
          const idx = arr.indexOf(ref.cb);
          if (idx >= 0) arr.splice(idx, 1);
        },
        emit: (event: string, ...args: any[]): void => {
          for (const cb of listeners[event] || []) cb(...args);
        },
      };
    })(),
    workspace: {
      getActiveViewOfType: () => null,
      openLinkText: async () => {},
      on: () => ({ ref: 'mock-ws-ref' }),
      off: () => {},
      offref: () => {},
      getActiveFile: () => null,
    },
    fileManager: {
      /** processFrontMatter：读文件 → 回调改 fm → 序列化写回（保留正文；数组用 [] 简式） */
      processFrontMatter: async (file: any, cb: (fm: Record<string, any>) => void) => {
        const path = typeof file === 'string' ? file : file.path;
        const content = vault.files.get(path) ?? '';
        const body = content.replace(/^---\n[\s\S]*?\n---\n?/, '');
        const fm = parseFrontmatter(content) ?? {};
        cb(fm);
        const lines = ['---'];
        for (const [k, v] of Object.entries(fm)) {
          if (Array.isArray(v)) lines.push(`${k}: [${v.join(', ')}]`);
          else lines.push(`${k}: ${v}`);
        }
        lines.push('---');
        vault.files.set(path, lines.join('\n') + (body ? '\n' + body : ''));
      },
    },
    commands: (() => {
      const registered: any[] = [];
      return {
        registered,
        addCommand: (c: any) => {
          registered.push(c);
        },
        removeCommand: () => {},
      };
    })(),
  } as any;
}
