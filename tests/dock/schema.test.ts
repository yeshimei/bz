/**
 * dock 契约（声明 + 运行记录）校验测试。
 *
 * 这一层的全部价值就是「**永不抛**」与「**不可信输入降级而不是连累整体**」：
 * 工具目录里的声明文件 / 落盘文件都是不可信输入，坏一份不能让整个域打不开。
 * 所以这里大量用例是「畸形 → 丢弃 / null，但不抛」。
 */
import { describe, it, expect } from 'vitest';
import {
  DOCK_CONTRACT_VERSION,
  DOCK_ID_RE,
  buildArgs,
  parseManifest,
  parseParam,
  parseRunRecord,
  parseRunsFile,
  parseRunsFileText,
  stripSecrets,
} from '../../src/dock/schema';

const goodManifest = {
  v: 1,
  id: 'iamtxt-signin',
  name: 'iamtxt 每日签到',
  description: '每天自动签到',
  run: { cmd: 'node', args: ['signin.mjs'] },
  params: [
    { key: 'mode', label: '模式', type: 'choice', options: [{ value: 'fast', label: '快' }], default: 'fast' },
    { key: 'deep', label: '深度', type: 'number', default: 1, min: 1, max: 5 },
  ],
};

describe('parseManifest', () => {
  it('接受合法声明并归一', () => {
    const m = parseManifest(goodManifest)!;
    expect(m).not.toBeNull();
    expect(m.v).toBe(DOCK_CONTRACT_VERSION);
    expect(m.id).toBe('iamtxt-signin');
    expect(m.params).toHaveLength(2);
    expect(m.params[1]).toMatchObject({ key: 'deep', type: 'number', min: 1, max: 5 });
  });

  it('不认识契约版本 → 拒绝（不猜）', () => {
    expect(parseManifest({ ...goodManifest, v: 2 })).toBeNull();
    expect(parseManifest({ ...goodManifest, v: '1' })).toBeNull();
  });

  it('id 非法 → 拒绝（它要拿来拼文件名）', () => {
    for (const id of ['../evil', 'A-B', '上-下', '-lead', '', 'a'.repeat(65)]) {
      expect(parseManifest({ ...goodManifest, id })).toBeNull();
    }
    expect(DOCK_ID_RE.test('iamtxt-signin')).toBe(true);
    expect(DOCK_ID_RE.test('tool2')).toBe(true);
  });

  it('name 为空 → 拒绝', () => {
    expect(parseManifest({ ...goodManifest, name: '   ' })).toBeNull();
  });

  it('未知字段原样保留（前向兼容）', () => {
    const m = parseManifest({ ...goodManifest, futureField: { a: 1 } })!;
    expect((m as Record<string, unknown>).futureField).toEqual({ a: 1 });
  });

  it('坏参数只丢那一条，不连累整份清单', () => {
    const m = parseManifest({
      ...goodManifest,
      params: [
        { key: 'ok', label: '好', type: 'text' },
        { key: 'bad', label: '坏', type: 'no-such-type' },
        { label: '缺key', type: 'text' },
        null,
        { key: 'dup', label: '一', type: 'text' },
        { key: 'dup', label: '二', type: 'text' },
      ],
    })!;
    expect(m.params.map((p) => p.key)).toEqual(['ok', 'dup']);
    expect(m.params[1].label).toBe('一'); // 同 key 只留第一个
  });

  it('非对象 / 坏结构一律 null 且不抛', () => {
    for (const bad of [null, undefined, 42, 'x', [], { v: 1 }]) {
      expect(parseManifest(bad)).toBeNull();
    }
  });

  it('节奏：合法声明解析出结构化字段', () => {
    const m = parseManifest({
      ...goodManifest,
      schedule: { kind: 'daily', hour: 9, note: '09:00 起随机 0~2 小时' },
    })!;
    expect(m.schedule).toEqual({ kind: 'daily', hour: 9, note: '09:00 起随机 0~2 小时' });
  });

  it('节奏：越界字段单独丢弃，整条节奏仍在（少一个字段只是判得粗一点）', () => {
    const m = parseManifest({ ...goodManifest, schedule: { kind: 'daily', hour: 99 } })!;
    expect(m.schedule).toEqual({ kind: 'daily' });
  });

  it('节奏：kind 不合法 → 视同未声明', () => {
    expect(parseManifest({ ...goodManifest, schedule: { kind: '每分钟' } })!.schedule).toBeUndefined();
    expect(parseManifest({ ...goodManifest, schedule: 'daily' })!.schedule).toBeUndefined();
  });

  it('run 段：合法则归一（args 过滤非字符串；空 args 不留键）', () => {
    expect(parseManifest(goodManifest)!.run).toEqual({ cmd: 'node', args: ['signin.mjs'] });
    const noArgs = parseManifest({ ...goodManifest, run: { cmd: 'my-tool', args: [] } })!;
    expect(noArgs.run).toEqual({ cmd: 'my-tool' });
    const dirty = parseManifest({ ...goodManifest, run: { cmd: 'node', args: ['a', 1, null] } })!;
    expect(dirty.run!.args).toEqual(['a']);
  });

  it('run 段：cmd 空 / run 不是对象 → 整段丢弃（声明只能看、不能跑），其余元数据照留', () => {
    for (const run of [{ cmd: '' }, { cmd: '   ' }, { args: ['x'] }, 'node', null, 42, []]) {
      const m = parseManifest({ ...goodManifest, run })!;
      expect(m.run).toBeUndefined();
      expect(m.name).toBe('iamtxt 每日签到');
    }
    expect(parseManifest({ ...goodManifest, run: undefined })!.run).toBeUndefined();
  });

  it('run.shell / run.cwd 只认非空字符串与严格布尔', () => {
    const m = parseManifest({ ...goodManifest, run: { cmd: 'x.cmd', shell: true, cwd: ' C:/tools ' } })!;
    expect(m.run).toEqual({ cmd: 'x.cmd', shell: true, cwd: 'C:/tools' });
    expect(parseManifest({ ...goodManifest, run: { cmd: 'x', shell: 'yes' } })!.run!.shell).toBeUndefined();
    expect(parseManifest({ ...goodManifest, run: { cmd: 'x', cwd: '  ' } })!.run!.cwd).toBeUndefined();
  });
});

describe('parseParam', () => {
  it('options 逐项校验，坏项丢弃、label 缺省回落 value', () => {
    const p = parseParam({
      key: 'm',
      label: '模式',
      type: 'choice',
      options: [{ value: 'a' }, { label: '没值' }, null, { value: 'b', label: '' }],
    })!;
    expect(p.options).toEqual([
      { value: 'a', label: 'a' },
      { value: 'b', label: 'b' },
    ]);
  });

  it('path 的 mode 只认 file/dir，其余回落 file', () => {
    expect(parseParam({ key: 'p', label: 'L', type: 'path', mode: 'dir' })!.mode).toBe('dir');
    expect(parseParam({ key: 'p', label: 'L', type: 'path', mode: 'weird' })!.mode).toBe('file');
  });
});

describe('运行记录校验', () => {
  const goodRun = {
    runId: 'r1',
    trigger: 'auto',
    status: 'ok',
    startedAt: '2026-10-04T10:34:39+08:00',
    finishedAt: '2026-10-04T10:34:41+08:00',
    exitCode: 0,
    message: '签到成功',
    steps: [{ text: '检查登录态' }, { text: '', at: 'x' }, null, { text: '发起签到', status: 'ok' }],
    progress: { phase: '签到', pct: 100 },
  };

  it('合法记录归一；空步骤丢弃', () => {
    const r = parseRunRecord(goodRun)!;
    expect(r.status).toBe('ok');
    expect(r.steps).toHaveLength(2);
    expect(r.progress).toEqual({ phase: '签到', pct: 100 });
  });

  it('缺 startedAt 或 status 不认识 → 丢弃该条', () => {
    expect(parseRunRecord({ ...goodRun, startedAt: undefined })).toBeNull();
    expect(parseRunRecord({ ...goodRun, status: 'weird' })).toBeNull();
    expect(parseRunRecord({ ...goodRun, status: 'running' })).not.toBeNull();
  });

  it('trigger 不认识时回落 manual（不丢整条）', () => {
    expect(parseRunRecord({ ...goodRun, trigger: 'cron' })!.trigger).toBe('manual');
  });

  it('pct 非有限数一律归 null —— 绝不假报进度', () => {
    expect(parseRunRecord({ ...goodRun, progress: { phase: 'x', pct: '50' } })!.progress!.pct).toBeNull();
    expect(parseRunRecord({ ...goodRun, progress: { phase: 'x', pct: NaN } })!.progress!.pct).toBeNull();
    expect(parseRunRecord({ ...goodRun, progress: { phase: 'x' } })!.progress!.pct).toBeNull();
  });

  it('error.kind 不在枚举内 → unknown，但错误块保留', () => {
    const r = parseRunRecord({ ...goodRun, status: 'failed', error: { kind: '没见过的', detail: 'x' } })!;
    expect(r.error).toEqual({ kind: 'unknown', detail: 'x' });
  });

  it('metrics 只留有限数；全不合格则整块丢弃', () => {
    expect(parseRunRecord({ ...goodRun, metrics: { a: 1, b: 'x' } })!.metrics).toEqual({ a: 1 });
    expect(parseRunRecord({ ...goodRun, metrics: { b: 'x' } })!.metrics).toBeUndefined();
  });

  it('exitCode null 与 0 都能保留（null = 进程未能启动）', () => {
    expect(parseRunRecord({ ...goodRun, exitCode: null })!.exitCode).toBeNull();
    expect(parseRunRecord({ ...goodRun, exitCode: 0 })!.exitCode).toBe(0);
  });
});

describe('运行记录文件校验', () => {
  const file = {
    v: 1,
    tool: 'iamtxt-signin',
    runs: [
      { startedAt: '2026-10-04T10:00:00Z', status: 'ok' },
      { startedAt: '2026-10-04T09:00:00Z', status: 'nope' },
    ],
  };

  it('tool 串台 → 整份拒绝（防 A 的记录文件被写成 B 的内容）', () => {
    expect(parseRunsFile(file, 'other-tool')).toBeNull();
    expect(parseRunsFile(file, 'iamtxt-signin')).not.toBeNull();
  });

  it('坏记录丢弃、好记录保留', () => {
    expect(parseRunsFile(file)!.runs).toHaveLength(1);
  });

  it('版本不符 → null；坏文本 → null（不抛）', () => {
    expect(parseRunsFile({ ...file, v: 9 })).toBeNull();
    expect(parseRunsFileText('{ not json')).toBeNull();
    expect(parseRunsFileText('')).toBeNull();
    expect(parseRunsFileText(undefined)).toBeNull();
  });

  it('容忍 UTF-8 BOM（PowerShell 写文件很常见）', () => {
    expect(parseRunsFileText('\uFEFF' + JSON.stringify(file), 'iamtxt-signin')).not.toBeNull();
  });
});

describe('buildArgs', () => {
  const manifest = {
    params: [
      { key: 'mode', label: '模式', type: 'choice' as const },
      { key: 'force', label: '强制', type: 'bool' as const },
      { key: 'tags', label: '多选', type: 'multichoice' as const },
      { key: 'note', label: '备注', type: 'text' as const },
      { key: 'token', label: '令牌', type: 'secret' as const },
    ],
  };

  it('bool true 发开关、false 不发；空非必填跳过', () => {
    expect(buildArgs(manifest, { force: true })).toEqual(['--force']);
    expect(buildArgs(manifest, { force: false })).toEqual([]);
    expect(buildArgs(manifest, { note: '' })).toEqual([]);
  });

  it('multichoice 重复发同一 key；secret 照发（工具需要它）', () => {
    expect(buildArgs(manifest, { tags: ['a', 'b'], token: 't' })).toEqual(['--tags=a', '--tags=b', '--token=t']);
  });

  it('number 0 不被当成空', () => {
    const m = { params: [{ key: 'n', label: 'N', type: 'number' as const }] };
    expect(buildArgs(m, { n: 0 })).toEqual(['--n=0']);
  });
});

describe('stripSecrets', () => {
  it('剔除 secret 类型的参数（运行记录要落盘，密钥不能跟着落）', () => {
    const manifest = {
      params: [
        { key: 'token', label: '令', type: 'secret' as const },
        { key: 'mode', label: '模式', type: 'text' as const },
      ],
    };
    expect(stripSecrets(manifest, { token: 's', mode: 'fast' })).toEqual({ mode: 'fast' });
  });
});
