// @vitest-environment node
/**
 * 脸谱工具包 bz-face status 判定层测试（issue 510）。
 *
 * 被测对象是包内纯判定层 tools/obsidian-face/lib/status-core.js（CommonJS）——临时目录里
 * 摆真文件（fs 真读），不碰真实数据根。覆盖：argv 解析（联系人 + --data-root 必填）、
 * 产物事实采集（各产物一行：齐 / 空 / 缺 / 坏 JSON 各归其位）、报告组装（✓/△/✗ 前缀、
 * 缺失计数、联系人目录缺席 = 硬失败退出码语义）。
 */
import { describe, it, expect, afterAll } from 'vitest';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseStatusArgv, collectStatusFacts, formatStatusReport } from '../../tools/obsidian-face/lib/status-core.js';

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'bz-face-status-'));
afterAll(() => {
  try {
    fs.rmSync(TMP, { recursive: true, force: true });
  } catch {
    /* tmp 清理失败不影响判定 */
  }
});

/** 摆一位产物齐全的联系人 */
function makeFullContact(name: string): string {
  const dir = path.join(TMP, name);
  fs.mkdirSync(path.join(dir, 'voice'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'image', '2026-09'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'desc', '2026-09'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'recordings'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'stats.json'), JSON.stringify({ msgs: 10, voices: 2, images: 3, voiceSec: 12.5, syncedAt: '2026-09-29T08:00:00' }));
  fs.writeFileSync(
    path.join(dir, 'chat.json'),
    JSON.stringify([
      { ct: 1, type: 1, msg: 'hi' },
      { ct: 2, type: 34, msg: '[语音 3秒]' },
      { ct: 3, type: 3, msg: '[图片]' },
    ]),
  );
  fs.writeFileSync(path.join(dir, 'voice', '20260901_1.wav'), 'x');
  fs.writeFileSync(path.join(dir, 'voice', '20260902_2.wav'), 'x');
  fs.writeFileSync(path.join(dir, 'voice.json'), JSON.stringify([{ wav: `${name}/voice/20260901_1.wav`, text: '你好', emotion: '平静' }]));
  fs.writeFileSync(path.join(dir, 'image', '2026-09', 'abc.jpg'), 'x');
  fs.writeFileSync(path.join(dir, 'desc', '2026-09', 'abc.jpg'), 'x');
  fs.writeFileSync(path.join(dir, 'image_map.json'), JSON.stringify([{ file: '2026-09/abc.jpg', ct: 3 }]));
  fs.writeFileSync(path.join(dir, 'recordings', '周二.aac'), 'x');
  fs.writeFileSync(path.join(dir, 'recordings', '周二.aac.turns.json'), JSON.stringify({ phase: 'done', turns: [{ start: 0, end: 1 }] }));
  return dir;
}

describe('bz-face status 判定层（issue 510）', () => {
  afterAll(() => {
    // windows 下句柄释放后再清一次
    try {
      execSync(`rd /s /q "${TMP}"`, { stdio: 'ignore' });
    } catch {
      /* 系统临时目录，残留无害 */
    }
  });

  describe('CLI 参数解析', () => {
    it('联系人（位置）+ --data-root 必填；等号写法同认；多余位置参数与未知参数拒收', () => {
      expect(parseStatusArgv(['status', '大琳', '--data-root', 'E:\\根'])).toMatchObject({ command: 'status', contact: '大琳', dataRoot: 'E:\\根' });
      expect(parseStatusArgv(['大琳', '--data-root=E:\\根'])).toMatchObject({ contact: '大琳' });
      expect(parseStatusArgv(['status']).error).toContain('联系人');
      expect(parseStatusArgv(['status', '大琳']).error).toContain('--data-root');
      expect(parseStatusArgv(['status', 'a', 'b', '--data-root', 'x']).error).toContain('只收一个');
      expect(parseStatusArgv(['status', '大琳', '--python', 'py', '--data-root', 'x']).error).toContain('未知参数');
      expect(parseStatusArgv(['status', '--help']).help).toBe(true);
      expect(parseStatusArgv(['--version']).version).toBe(true);
    });
  });

  describe('产物事实采集与报告', () => {
    it('产物齐全 → 全 ✓ 行 + 小结零缺失', () => {
      const name = '大琳';
      makeFullContact(name);
      const facts = collectStatusFacts(TMP, name);
      const { lines, missing } = formatStatusReport(TMP, name, facts);
      expect(missing).toBe(0);
      expect(lines.join('\n')).toContain('chat.json：3 条消息（语音 1 / 图片 1）');
      expect(lines.join('\n')).toContain('voice/：2 个 wav');
      expect(lines.join('\n')).toContain('voice.json：转写 1 条');
      expect(lines.join('\n')).toContain('image_map.json：关联 1 条');
      expect(lines.join('\n')).toContain('recordings/：音频 1 个；sidecar：周二.aac=done/1轮');
      expect(lines.join('\n')).toContain(`${name}.npz：没有`);
      expect(lines.filter((l) => l.startsWith('△')).length).toBeGreaterThan(0);
    });

    it('缺产物 → ✗ 行带下一步命令；坏 JSON → △；目录缺席 → 退出码语义 missing=-1', () => {
      const name = '小空';
      fs.mkdirSync(path.join(TMP, name, 'recordings'), { recursive: true });
      fs.writeFileSync(path.join(TMP, name, 'stats.json'), '{bad');
      const facts = collectStatusFacts(TMP, name);
      const { lines, missing } = formatStatusReport(TMP, name, facts);
      const joined = lines.join('\n');
      expect(joined).toContain('stats.json：读不出');
      expect(joined).toContain('chat.json：没有');
      expect(joined).toContain('bz-face export');
      expect(joined).toContain('recordings/：空');
      expect(missing).toBeGreaterThan(0);

      const nope = collectStatusFacts(TMP, '不存在的人');
      expect(nope.dirExists).toBe(false);
      expect(formatStatusReport(TMP, '不存在的人', nope).missing).toBe(-1);
    });

    it('录音 sidecar 坏 JSON → phase=? 不炸；.tmp 残留不计音频；voice.json 缺席但 voice/ 有货 → ✗ 引导 prep', () => {
      const name = '半截';
      fs.mkdirSync(path.join(TMP, name, 'voice'), { recursive: true });
      fs.mkdirSync(path.join(TMP, name, 'recordings'), { recursive: true });
      fs.writeFileSync(path.join(TMP, name, 'voice', 'a.wav'), 'x');
      fs.writeFileSync(path.join(TMP, name, 'recordings', 'r.m4a'), 'x');
      fs.writeFileSync(path.join(TMP, name, 'recordings', 'r.m4a.turns.json'), '{bad');
      fs.writeFileSync(path.join(TMP, name, 'recordings', 'r.m4a.turns.json.tmp'), '{bad'); // 原子写残留
      const facts = collectStatusFacts(TMP, name);
      const { lines } = formatStatusReport(TMP, name, facts);
      const joined = lines.join('\n');
      expect(joined).toContain('r.m4a=?');
      expect(joined).toContain('recordings/：音频 1 个'); // .tmp 不计
      expect(joined).toContain('voice.json：还没有转写');
    });
  });
});
