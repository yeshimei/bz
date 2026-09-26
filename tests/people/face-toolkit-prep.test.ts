// @vitest-environment node
/**
 * 脸谱工具包 bz-face prep 判定层测试（issue 468 / ADR-0196 决策 1、3、5、7）。
 *
 * 被测对象是包内纯判定层 tools/obsidian-face/lib/prep-core.js（CommonJS）——全部注入
 * 假件 / 预录协议行，**不真跑 prep 子进程、不探测真实环境、不碰真实微信数据**。
 * CLI（bin/bz-face.js）只是「预检 → 起子进程 → 逐行转发 → 汇总退出码」的薄壳；
 * 子进程管道（probes.runSyncProcess）同 464 先例不在单测面。
 *
 * 覆盖：阶段计划（四段词汇与顺序）、prep 参数解析（联系人 / --data-root 必填、派生档
 * 与转写引擎参数面、畸形拒收）、控制文件契约（pause/resume/stop，坏 JSON / 未知 action
 * 一律无指令）、协议行格式化与 src/core/external-tool.ts parseBzLine 的**跨层契约**、
 * 转发中继（透传 + 无结果行时兜底失败结果）、预检判定（sync 产物不在位 → 硬失败不静默
 * 降级；微信**不需要**在跑——prep 不取密钥）、启动失败归类、Python 侧镜像契约
 * （bz_prep.py 的 phase 词汇 / 控制文件路径 / chat.json 只读不动——源码级 tripwire）。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  PREP_PHASES,
  buildPrepPlan,
  BZ_DIR_NAME,
  CONTROL_FILE,
  CONTROL_POLL_MS,
  parseControlAction,
  parsePrepArgv,
  formatBzLine,
  createPrepRelay,
  judgePrepPreflight,
  classifyPrepSpawnFailure,
} from '../../tools/obsidian-face/lib/prep-core.js';
import { parseBzLine } from '../../src/core/external-tool';

const PYTHON_DIR = fileURLToPath(new URL('../../tools/obsidian-face/python/', import.meta.url));

describe('bz-face prep 判定层（issue 468）', () => {
  describe('阶段计划（步骤词汇表）', () => {
    it('四段按序：媒体导出 → 派生图片档 → 图片关联表 → 语音转写；id 是 [bz-p] 的 phase 词', () => {
      expect(PREP_PHASES.map((p) => p.id)).toEqual(['media', 'derive', 'map', 'transcribe']);
      expect(PREP_PHASES.map((p) => p.label)).toEqual(['媒体导出', '派生图片档', '图片关联表', '语音转写']);
      for (const p of PREP_PHASES) {
        expect(p.detail.trim()).not.toBe('');
      }
    });

    it('buildPrepPlan 给副本：改返回值不动词汇表本体', () => {
      const plan = buildPrepPlan();
      (plan[0] as { id: string }).id = '篡改';
      expect(PREP_PHASES[0].id).toBe('media');
      expect(buildPrepPlan()[0].id).toBe('media');
    });
  });

  describe('参数解析', () => {
    it('全参数：位置联系人 + --data-root/--python/--src/--ffmpeg/--derive-edge/--derive-quality/--asr-engine/--asr-model/--limit', () => {
      expect(
        parsePrepArgv([
          'prep',
          '大琳',
          '--data-root',
          'E:\\根',
          '--python',
          'py',
          '--src',
          'C:\\账号',
          '--ffmpeg',
          'C:\\ffmpeg.exe',
          '--derive-edge',
          '1600',
          '--derive-quality',
          '90',
          '--asr-engine',
          'faster-whisper',
          '--asr-model',
          'medium',
          '--limit',
          '5',
        ]),
      ).toMatchObject({
        command: 'prep',
        contact: '大琳',
        dataRoot: 'E:\\根',
        python: 'py',
        src: 'C:\\账号',
        ffmpeg: 'C:\\ffmpeg.exe',
        deriveEdge: 1600,
        deriveQuality: 90,
        asrEngine: 'faster-whisper',
        asrModel: 'medium',
        limit: 5,
      });
    });

    it('缺省值：deriveEdge=1280、deriveQuality=80、asrEngine=sensevoice、asrModel=small、limit=0；开头 prep 可省', () => {
      expect(parsePrepArgv(['--data-root=E:\\根', '大琳'])).toMatchObject({
        command: 'prep',
        contact: '大琳',
        dataRoot: 'E:\\根',
        deriveEdge: 1280,
        deriveQuality: 80,
        asrEngine: 'sensevoice',
        asrModel: 'small',
        limit: 0,
      });
    });

    it('联系人（位置参数）与 --data-root 都必填（help/version 例外）', () => {
      const noContact = parsePrepArgv(['prep', '--data-root', 'E:\\根']);
      expect(noContact.command).toBeNull();
      expect(noContact.error).toContain('联系人');
      const noRoot = parsePrepArgv(['prep', '大琳']);
      expect(noRoot.error).toContain('--data-root');
      expect(parsePrepArgv(['prep', '--help']).help).toBe(true);
      expect(parsePrepArgv(['prep', '--version']).version).toBe(true);
    });

    it('多余位置参数 / 未知参数拒收，绝不猜', () => {
      expect(parsePrepArgv(['prep', '大琳', '阿琳', '--data-root', 'X']).error).toContain('多余的位置参数');
      expect(parsePrepArgv(['prep', '大琳', '--data-root', 'X', '--wat']).error).toContain('未知参数');
      expect(parsePrepArgv(['prep', '大琳', '--data-root']).error).toContain('--data-root');
    });

    it('畸形值拒收：derive-edge <64 / 非整数、derive-quality 越界、limit 负数、asr-engine 不认识', () => {
      expect(parsePrepArgv(['prep', '大琳', '--data-root', 'X', '--derive-edge', '63']).error).toContain('--derive-edge');
      expect(parsePrepArgv(['prep', '大琳', '--data-root', 'X', '--derive-edge', 'abc']).error).toContain('--derive-edge');
      expect(parsePrepArgv(['prep', '大琳', '--data-root', 'X', '--derive-quality', '0']).error).toContain('--derive-quality');
      expect(parsePrepArgv(['prep', '大琳', '--data-root', 'X', '--derive-quality', '101']).error).toContain('--derive-quality');
      expect(parsePrepArgv(['prep', '大琳', '--data-root', 'X', '--limit', '-1']).error).toContain('--limit');
      const bad = parsePrepArgv(['prep', '大琳', '--data-root', 'X', '--asr-engine', 'whisper']);
      expect(bad.error).toContain('--asr-engine');
      expect(bad.error).toContain('sensevoice');
    });
  });

  describe('控制文件契约（协作式让行；469 阶段机照此写文件）', () => {
    it('{"action":"pause"|"resume"|"stop"} → 同名指令', () => {
      expect(parseControlAction('{"action":"pause"}')).toBe('pause');
      expect(parseControlAction('{"action":"resume"}')).toBe('resume');
      expect(parseControlAction('{"action":"stop"}')).toBe('stop');
      expect(parseControlAction('{"action":"stop","ts":123}')).toBe('stop');
    });

    it('坏 JSON / 非对象 / 缺 action / 未知 action 一律无指令（长任务绝不因半截控制文件而中断）', () => {
      expect(parseControlAction('{"action":')).toBe('');
      expect(parseControlAction('')).toBe('');
      expect(parseControlAction('null')).toBe('');
      expect(parseControlAction('"pause"')).toBe('');
      expect(parseControlAction('[{"action":"pause"}]')).toBe('');
      expect(parseControlAction('{}')).toBe('');
      expect(parseControlAction('{"action":"kill"}')).toBe('');
      expect(parseControlAction(null)).toBe('');
      expect(parseControlAction(undefined)).toBe('');
    });

    it('常量：控制文件在 <数据根>/.bz-face/control.json（464 预留的路径），轮询 1s', () => {
      expect(BZ_DIR_NAME).toBe('.bz-face');
      expect(CONTROL_FILE).toBe('control.json');
      expect(CONTROL_POLL_MS).toBe(1000);
    });
  });

  describe('协议行格式化 × parseBzLine 跨层契约（Node 发的行，插件必须解析得回）', () => {
    it('p 行：prep 的 phase 词全部往返', () => {
      for (const phase of ['media', 'derive', 'map', 'transcribe']) {
        expect(parseBzLine(formatBzLine('p', { phase, pct: 42 }))).toEqual({
          kind: 'progress',
          phase,
          pct: 42,
        });
      }
      expect(parseBzLine(formatBzLine('p', { phase: 'map', pct: null }))).toEqual({
        kind: 'progress',
        phase: 'map',
        pct: null,
      });
    });

    it('step/info/result 行往返：结果行带 stopped 与 failed（exit 0 但 failed>0 属正常完成）', () => {
      const line = formatBzLine('step', '派生图片档：原图 → desc/（长边 1280、JPEG 质量 80）');
      expect(parseBzLine(line)).toEqual({ kind: 'step', text: '派生图片档：原图 → desc/（长边 1280、JPEG 质量 80）' });

      const result = {
        ok: true,
        stopped: true,
        contact: '大琳',
        media: { voice: { done: 10, skip: 3, fail: 1 } },
        derive: { done: 20, skip: 5, fail: 0 },
        transcribe: { done: 9, skip: 3, fail: 1 },
        failed: 2,
        failures: [{ kind: 'voice', error: '缺 silk 记录：sid=1' }],
      };
      expect(parseBzLine(formatBzLine('result', result))).toEqual({ kind: 'result', data: result });
    });

    it('畸形输入不抛：空 step / 循环引用 / 未知 kind → 空串', () => {
      expect(formatBzLine('step', '  ')).toBe('');
      const circular: Record<string, unknown> = {};
      circular.self = circular;
      expect(formatBzLine('result', circular)).toBe('');
      expect(formatBzLine('wat' as 'step', {})).toBe('');
    });
  });

  describe('转发中继（透传 + 结果行兜底）', () => {
    it('子进程行原样透传（协议 / 非协议都不改写），空行丢弃', () => {
      const relay = createPrepRelay();
      const out = [
        ...relay.write('[bz-step] 媒体导出：语音 wav、图片'),
        ...relay.write('[bz-info] {"phase":"media","counts":{"voice":{"done":1}}}'),
        ...relay.write(''),
        ...relay.write('funasr 加载中……'),
      ];
      expect(out).toEqual([
        '[bz-step] 媒体导出：语音 wav、图片',
        '[bz-info] {"phase":"media","counts":{"voice":{"done":1}}}',
        'funasr 加载中……',
      ]);
      expect(relay.sawResult).toBe(false);
    });

    it('见过 [bz-result] → finish 不补行（Python 的结果行唯一权威，不二次包装）', () => {
      const relay = createPrepRelay();
      relay.write('[bz-result] {"ok":true,"stopped":false,"failed":0}');
      expect(relay.sawResult).toBe(true);
      expect(relay.finish(0, '')).toEqual([]);
      expect(relay.finish(1, '晚到的 stderr')).toEqual([]);
    });

    it('没见结果行、退出码 0 → 兜底失败结果行（prep 口径：重跑只补缺口），且可被 parseBzLine 解析', () => {
      const relay = createPrepRelay();
      const lines = relay.finish(0, '');
      expect(lines).toHaveLength(1);
      const ev = parseBzLine(lines[0]) as { kind: 'result'; data: { ok: boolean; error: string } };
      expect(ev.kind).toBe('result');
      expect(ev.data.ok).toBe(false);
      expect(ev.data.error).toContain('prep');
      expect(ev.data.error).toContain('只补缺口');
    });

    it('没见结果行、非零退出 → 错误带退出码与 stderr 末行；errorMessage 显式给则优先', () => {
      const relay = createPrepRelay();
      const lines = relay.finish(1, 'Traceback (most recent call last):\n  转写引擎加载失败：boom');
      const ev = parseBzLine(lines[0]) as { kind: 'result'; data: { ok: boolean; error: string } };
      expect(ev.data.ok).toBe(false);
      expect(ev.data.error).toContain('退出码 1');
      expect(ev.data.error).toContain('转写引擎加载失败：boom');

      const relay2 = createPrepRelay();
      const lines2 = relay2.finish(null, '', '启动失败归类文案');
      const ev2 = parseBzLine(lines2[0]) as { kind: 'result'; data: { ok: boolean; error: string } };
      expect(ev2.data.ok).toBe(false);
      expect(ev2.data.error).toBe('启动失败归类文案');
    });
  });

  describe('预检判定（sync 产物不在位 → 硬失败，绝不静默降级；微信不需要在跑）', () => {
    const okDataRoot = { configured: true, path: 'E:\\根', exists: true, writable: true };
    const okContact = { configured: true, path: 'E:\\根\\大琳', exists: true, hasChat: true };

    it('全绿 → ok（预检面里没有微信——prep 不取密钥）', () => {
      expect(judgePrepPreflight({ dataRoot: okDataRoot, contact: okContact })).toEqual({ ok: true });
    });

    it('数据根：未配置 / 不存在 / 不可写 → 各自硬失败', () => {
      expect(judgePrepPreflight({ contact: okContact, dataRoot: { configured: false } }).error).toContain('--data-root');
      const missing = judgePrepPreflight({ contact: okContact, dataRoot: { configured: true, path: 'X:\\缺失', exists: false } });
      expect(missing.ok).toBe(false);
      expect(missing.error).toContain('X:\\缺失');
      expect(judgePrepPreflight({ contact: okContact, dataRoot: { configured: true, path: 'D:\\只读', exists: true, writable: false } }).error).toContain('不可写');
    });

    it('联系人目录不存在 / 没有 chat.json → 指回 bz-face sync，绝不静默降级', () => {
      const noDir = judgePrepPreflight({ dataRoot: okDataRoot, contact: { configured: true, path: 'E:\\根\\路人', exists: false } });
      expect(noDir.ok).toBe(false);
      expect(noDir.error).toContain('联系人目录不存在');
      expect(noDir.error).toContain('bz-face sync');

      const noChat = judgePrepPreflight({ dataRoot: okDataRoot, contact: { configured: true, path: 'E:\\根\\大琳', exists: true, hasChat: false } });
      expect(noChat.ok).toBe(false);
      expect(noChat.error).toContain('chat.json');
      expect(noChat.error).toContain('bz-face sync');
    });

    it('联系人未配置（没传联系人）→ 提示用法', () => {
      const e = judgePrepPreflight({ dataRoot: okDataRoot, contact: { configured: false } });
      expect(e.ok).toBe(false);
      expect(e.error).toContain('联系人');
    });
  });

  describe('启动失败归类', () => {
    it('ENOENT → 找不到 Python + doctor 指引；EACCES → 权限；其它取首行消息', () => {
      const enoent = classifyPrepSpawnFailure({ code: 'ENOENT', message: 'spawn python ENOENT' }, 'py -3.12');
      expect(enoent).toContain('找不到 Python 命令「py -3.12」');
      expect(enoent).toContain('bz-face doctor');

      expect(classifyPrepSpawnFailure({ code: 'EACCES', message: 'spawn python EACCES' }, 'python')).toContain('无执行权限');

      const other = classifyPrepSpawnFailure({ message: 'spawn failed\n第二行' }, 'python');
      expect(other).toContain('预处理进程启动失败');
      expect(other).not.toContain('第二行');
    });

    it('空/缺省输入不抛，给兜底文案', () => {
      expect(classifyPrepSpawnFailure(null)).toContain('预处理进程启动失败');
      expect(classifyPrepSpawnFailure(undefined, 'python')).toContain('预处理进程启动失败');
    });
  });

  describe('Python 侧镜像契约（bz_prep.py 与判定层同源——源码级 tripwire）', () => {
    const src = readFileSync(path.join(PYTHON_DIR, 'bz_prep.py'), 'utf8');

    it('phase 词汇表四段都在 bz_prep.py 里（与 PREP_PHASES 同源镜像）', () => {
      for (const phase of PREP_PHASES) {
        expect(src).toContain(`"${phase.id}"`);
      }
    });

    it('控制文件路径 <数据根>/.bz-face/control.json 与轮询间隔 1s 在 Python 侧同源', () => {
      expect(src).toContain('".bz-face"');
      expect(src).toContain('"control.json"');
      expect(src).toContain('CONTROL_POLL_SECONDS = 1.0');
      expect(src).toContain('{"action":"pause"}');
      expect(src).toContain('{"action":"stop"}');
    });

    it('绝不写回 chat.json：bz_prep.py 不存在任何对 chat.json 的写路径', () => {
      // chat.json 只允许被读（read_text）；写动作只准落在旁路表 / 媒体文件上
      expect(src).not.toMatch(/atomic_write\([^)]*chat\.json/);
      expect(src).not.toMatch(/chat\.json"\)\s*\.\s*write_text/);
      expect(src).not.toMatch(/open\([^)]*chat\.json[^)]*['"]w/);
      expect(src).toMatch(/chat\.json"\)\.read_text/); // 且确实是对齐它的
    });

    it('绝不安装：bz_prep.py 不经 subprocess / os.system 执行 pip / winget（文档字符串提及不算）', () => {
      expect(src).not.toMatch(/subprocess\.(run|call|check_output|check_call|Popen)\([^)]*pip/);
      expect(src).not.toMatch(/os\.system\([^)]*pip/i);
      expect(src).not.toMatch(/subprocess\.(run|call|check_output|check_call|Popen)\([^)]*winget/);
      expect(src).not.toMatch(/os\.system\([^)]*winget/i);
    });
  });
});
