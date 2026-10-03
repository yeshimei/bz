/**
 * 工具登记校验测试。
 *
 * 一条登记只记 **bz 自己那份事实**：`id`（稳定键）、`path`（声明文件在哪）、`enabled`、
 * 信任标记。标题 / 描述 / 参数 / 节奏 / 启动命令**全在声明文件里** —— 所以这组用例同时是
 * 「登记里不许出现第二份元数据」这条纪律的守卫：`name` / `note` / `trigger` / `cmd`
 * 就算被写进 `data.json`，也不许被读进登记（抄一份就多一个会和声明打架的源）。
 *
 * 校验规则：**能安全用的留下，脏的丢掉，绝不抛、绝不猜一个默认路径**。
 */
import { describe, it, expect } from 'vitest';
import {
  TOOL_ID_RE,
  parseToolEntries,
  parseToolEntry,
  runSignature,
} from '../../src/dock/registry';

const good = { id: 'iamtxt-signin', path: 'E:/Obsidian/dock-tools/daily-signin/dock.json' };

describe('parseToolEntry', () => {
  it('合法条目归一成两条事实（id + path）', () => {
    expect(parseToolEntry(good)).toEqual({ id: 'iamtxt-signin', path: good.path });
    expect(parseToolEntry({ id: 'a', path: 'C:/t/dock.json' })).toEqual({ id: 'a', path: 'C:/t/dock.json' });
  });

  it('id 必须能安全拼文件名（防 ../ 与盘符）', () => {
    for (const id of ['../evil', 'C:/x', 'a b', 'A-B', '', '-lead', 'a'.repeat(65)]) {
      expect(parseToolEntry({ ...good, id })).toBeNull();
    }
    expect(TOOL_ID_RE.test('tool-2')).toBe(true);
  });

  it('path 为空 → 丢（绝不补一个默认路径）', () => {
    expect(parseToolEntry({ id: 'a', path: '' })).toBeNull();
    expect(parseToolEntry({ id: 'a', path: '   ' })).toBeNull();
    expect(parseToolEntry({ id: 'a' })).toBeNull();
  });

  it('非对象一律 null 且不抛', () => {
    for (const bad of [null, undefined, 1, 'x', []]) expect(parseToolEntry(bad)).toBeNull();
  });

  it('旧形态（cmd/args/trigger/name/note/shell）一律不进登记 —— 元数据的源只有声明文件', () => {
    const legacy = {
      id: 'a',
      path: 'C:/t/dock.json',
      cmd: 'C:/scripts/signin.cmd',
      args: ['--quiet'],
      cwd: 'C:/scripts',
      shell: true,
      trigger: 'auto',
      name: '兜底名',
      note: '备注',
    };
    expect(parseToolEntry(legacy)).toEqual({ id: 'a', path: 'C:/t/dock.json' });
    // 连「只写旧字段、没有 path」的条目也留不下 —— 没有声明文件路径就不知道它是什么
    expect(parseToolEntry({ id: 'a', cmd: 'x', trigger: 'auto' })).toBeNull();
  });

  it('trustedAt / trustedRun 空白等于没有（信任的对象是命令签名，见 runSignature）', () => {
    expect(parseToolEntry({ ...good, trustedAt: '   ' })!.trustedAt).toBeUndefined();
    expect(parseToolEntry({ ...good, trustedRun: '' })!.trustedRun).toBeUndefined();
    expect(parseToolEntry({ ...good, trustedAt: '2026-10-04T00:00:00Z' })!.trustedAt).toBe(
      '2026-10-04T00:00:00Z',
    );
    expect(parseToolEntry({ ...good, trustedRun: 'node\u0000raw\u0000signin.mjs' })!.trustedRun).toBe(
      'node\u0000raw\u0000signin.mjs',
    );
  });

  it('enabled 只认布尔（缺省 = 启用，由消费方判 undefined）', () => {
    expect(parseToolEntry({ ...good, enabled: false })!.enabled).toBe(false);
    expect(parseToolEntry({ ...good, enabled: 'no' })!.enabled).toBeUndefined();
  });
});

describe('runSignature', () => {
  const base = { cmd: 'node', args: ['signin.mjs'] };

  it('命令 / 参数 / shell 任一变化都会改签名（都在「实际执行了什么」里）', () => {
    expect(runSignature(base)).not.toBe(runSignature({ ...base, cmd: 'python' }));
    expect(runSignature(base)).not.toBe(runSignature({ ...base, args: ['signin.mjs', '--dry'] }));
    expect(runSignature(base)).not.toBe(runSignature({ ...base, shell: true }));
  });

  it('args 顺序不同 = 不同签名（顺序会改变语义）', () => {
    expect(runSignature({ cmd: 'x', args: ['a', 'b'] })).not.toBe(runSignature({ cmd: 'x', args: ['b', 'a'] }));
  });

  it('同一份声明反复算得到同一个签名；args 缺省与空数组等价', () => {
    expect(runSignature(base)).toBe(runSignature({ ...base }));
    expect(runSignature({ cmd: 'x' })).toBe(runSignature({ cmd: 'x', args: [] }));
  });

  it('cwd 不入签名 —— 信任的对象是命令，不是它从哪儿起（换目录不该逼人重签）', () => {
    const a = runSignature({ cmd: 'node', args: ['s.mjs'], cwd: 'C:/a' } as never);
    const b = runSignature({ cmd: 'node', args: ['s.mjs'], cwd: 'C:/b' } as never);
    expect(a).toBe(b);
  });
});

describe('parseToolEntries', () => {
  it('逐条校验、重复 id 只留第一条', () => {
    const list = parseToolEntries([
      { id: 'a', path: 'C:/a/dock.json' },
      { id: '../bad', path: 'C:/b/dock.json' },
      { id: 'a', path: 'C:/z/dock.json' },
      { id: 'b', path: 'C:/w/dock.json' },
      null,
    ]);
    expect(list.map((e) => e.id)).toEqual(['a', 'b']);
    expect(list[0].path).toBe('C:/a/dock.json');
  });

  it('非数组 → 空表（不抛）', () => {
    expect(parseToolEntries(undefined)).toEqual([]);
    expect(parseToolEntries({ id: 'a', path: 'x' })).toEqual([]);
  });
});
