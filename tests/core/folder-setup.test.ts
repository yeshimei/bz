// @vitest-environment jsdom
/**
 * 未配置空态「打开设置」的落地链路（2026-10-30 用户实机回归）
 *
 * 症状：日记 / 剪藏 / 影院 / 书库 / 游戏库 / 知识盒 的未配置空态那个「打开设置」按钮
 * 点下去只弹「设置面板没能打开，可以从「设置 → 包仔」进入」——面板根本没开。
 * 病因：core/folder-setup 曾用**变量拼出的**动态 import 拿设置面板
 * （`import(['..','settings-panel'].join('/'))`），CJS 产物里它退化成原生 import()，
 * 插件运行时解析不到这个相对路径，直接 reject 走进 catch。
 *
 * 现在改为 main.ts 注入通道（settings-provider 的 setSettingsPanelOpener），core 不再
 * 碰面板本体。本文件钉三件事：
 *   1. 注入后点按钮 → 面板真的被要求打开，且带着该域的 settingsId 与首个未配置键；
 *   2. 没注入（评审壳 / 测试）→ 不抛错，退回那句提示，别让按钮像坏掉；
 *   3. core 里不许再出现「计算式动态 import」或「直接 import 设置面板」——两条路都会复发病。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const notices: string[] = [];
vi.mock('../../src/core/notice', () => ({
  notice: (msg: string) => {
    notices.push(msg);
  },
}));

import { folderSetupEmpty, openFolderSettings } from '../../src/core/folder-setup';
import { requestSettingsPanel, setSettingsPanelOpener, setSettingsProvider } from '../../src/core/settings-provider';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** 空设置（各域目录都还没配） */
const EMPTY_SETTINGS = {};

beforeEach(() => {
  notices.length = 0;
  setSettingsProvider(() => EMPTY_SETTINGS as never);
  setSettingsPanelOpener(null as never);
  document.body.innerHTML = '';
});

describe('未配置空态「打开设置」', () => {
  it('每个域都带自己的 settingsId 与首个未配置键去开面板', () => {
    const cases = [
      { domain: 'diary' as const, id: 'diary', key: 'diaryDirectory' },
      { domain: 'clipbook' as const, id: 'clipping', key: 'articleDirectory' },
      { domain: 'cinema' as const, id: 'cinema', key: 'cinemaFolderPath' },
      { domain: 'bookshelf' as const, id: 'bookshelf', key: 'bookshelfFolderPath' },
      { domain: 'gameshelf' as const, id: 'gameshelf', key: 'gameshelfFolderPath' },
      { domain: 'knowledge' as const, id: 'knowledge', key: 'knowledgeDirectory' },
    ];
    for (const c of cases) {
      const calls: Array<[string | undefined, string | undefined]> = [];
      setSettingsPanelOpener((id, key) => calls.push([id, key]));
      openFolderSettings(c.domain);
      expect(calls, `${c.domain} 没把面板打开`).toEqual([[c.id, c.key]]);
      expect(notices, `${c.domain} 不该再弹兜底提示`).toEqual([]);
    }
  });

  it('点空态里的「打开设置」按钮即开面板（按钮真的接上了）', () => {
    const calls: Array<[string | undefined, string | undefined]> = [];
    setSettingsPanelOpener((id, key) => calls.push([id, key]));
    const el = folderSetupEmpty('cinema');
    const btn = [...el.querySelectorAll('button')].find((b) => b.textContent === '打开设置');
    expect(btn, '空态里没有「打开设置」按钮').toBeTruthy();
    btn!.click();
    expect(calls).toEqual([['cinema', 'cinemaFolderPath']]);
  });

  it('显式锚点优先于「首个未配置」', () => {
    const calls: Array<[string | undefined, string | undefined]> = [];
    setSettingsPanelOpener((id, key) => calls.push([id, key]));
    openFolderSettings('clipbook', 'clipbookImageFolder');
    expect(calls).toEqual([['clipping', 'clipbookImageFolder']]);
  });

  it('先收背后的引导屏，再开面板', () => {
    const order: string[] = [];
    setSettingsPanelOpener(() => order.push('open'));
    openFolderSettings('diary', undefined, () => order.push('close'));
    expect(order).toEqual(['close', 'open']);
  });

  it('没注入通道时（评审壳里）只弹提示，不抛错', () => {
    expect(() => openFolderSettings('diary')).not.toThrow();
    expect(requestSettingsPanel('diary', 'diaryDirectory')).toBe(false);
    expect(notices).toEqual(['设置面板没能打开，可以从「设置 → 包仔」进入']);
  });

  it('channel 内抛错也算没打开——落回提示，不把异常甩给点击事件', () => {
    setSettingsPanelOpener(() => {
      throw new Error('boom');
    });
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => openFolderSettings('diary')).not.toThrow();
    expect(notices).toEqual(['设置面板没能打开，可以从「设置 → 包仔」进入']);
    err.mockRestore();
  });
});

describe('源码守卫：core 不许自己去找设置面板', () => {
  /** 抹掉注释（字符串原样保留、位置等长），免得正文里聊到 `import()` 就被当成代码 */
  function stripComments(text: string): string {
    let out = '';
    let i = 0;
    while (i < text.length) {
      const c = text[i];
      const d = text[i + 1];
      if (c === '/' && d === '/') {
        while (i < text.length && text[i] !== '\n') {
          out += ' ';
          i++;
        }
        continue;
      }
      if (c === '/' && d === '*') {
        out += '  ';
        i += 2;
        while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) {
          out += text[i] === '\n' ? '\n' : ' ';
          i++;
        }
        out += '  ';
        i += 2;
        continue;
      }
      if (c === '"' || c === "'" || c === '`') {
        out += c;
        i++;
        while (i < text.length) {
          if (text[i] === '\\') {
            out += text[i] + (text[i + 1] ?? '');
            i += 2;
            continue;
          }
          out += text[i];
          const done = text[i] === c;
          i++;
          if (done) break;
        }
        continue;
      }
      out += c;
      i++;
    }
    return out;
  }

  /** 计算式动态 import：`import(` 之后不是字符串字面量 */
  function computedDynamicImports(raw: string): string[] {
    const text = stripComments(raw);
    const hits: string[] = [];
    for (const m of text.matchAll(/import\s*\(/g)) {
      const rest = text.slice(m.index! + m[0].length).replace(/^\s+/, '');
      if (/^['"`]/.test(rest)) continue;
      hits.push(m[0] + rest.slice(0, 40).replace(/\s+/g, ' '));
    }
    return hits;
  }

  function walk(dir: string, acc: string[] = []): string[] {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p, acc);
      else if (e.name.endsWith('.ts')) acc.push(p);
    }
    return acc;
  }

  const files = walk(path.join(ROOT, 'src'));

  it('src 下没有计算式动态 import（产物是 CJS，运行时解析不到）', () => {
    const bad = files
      .flatMap((f) => computedDynamicImports(fs.readFileSync(f, 'utf8')).map((hit) => `${path.relative(ROOT, f)} → ${hit}`));
    expect(bad, `这些位置用了计算式动态 import，CJS 产物里会退化成原生 import() 而失败：\n${bad.join('\n')}`).toEqual([]);
  });

  it('core 不直接 import 设置面板（会把整块面板拖进各域行为包）', () => {
    const bad = files
      .filter((f) => path.relative(path.join(ROOT, 'src'), f).startsWith(`core${path.sep}`))
      .filter((f) => /from\s+['"][^'"]*settings-panel['"]/.test(fs.readFileSync(f, 'utf8')))
      .map((f) => path.relative(ROOT, f));
    expect(bad, `core 里不要 import 设置面板，走 settings-provider 的注入通道：${bad.join('、')}`).toEqual([]);
  });
});
