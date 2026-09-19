// @vitest-environment node
/**
 * 行为流「发射侧 × 消费侧」契约对账（home 深审 arch A2；favorites 批 A arch-2 先例平移）：
 *
 * ADR-0132 把首页时间线换源到小橘行为流后，消费侧（SOURCE_DOMAIN 映射 + mapBehaviorEvent
 * 动作表 + sidecar 文件路径）此前全靠人工盘点。本文件补齐发射侧半边：
 *  1. sidecar 路径单源——home 只读 smartcat/memory.ts 导出的 SMARTCAT_BEHAVIOR_SIDECAR_FILE，
 *     src/home 内不得再出现文件名字面量（双源曾让「发射侧改名 → home 静默读空」零报警）；
 *  2. 发射侧 source 字面量静态扫描——addObservation 的域级 source 必须在消费侧映射表
 *     （behaviorSourceDomain 有映射）内，非域 source（chat/attach 等噪音）显式登记白名单。
 *     消费侧 mapBehaviorEvent 的 default 分支「宁缺勿假」兜住未收录/动态 source
 *     （tracked.kind / classifyPath / 'domain:'+key 等动态面），故本测试锁**字面量面**；
 *     发射侧新增域级 source 而消费侧未映射时此测试红（时间线静默变空的防线）。
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { SMARTCAT_BEHAVIOR_SIDECAR_FILE } from '../../src/smartcat/memory';
import { SOURCE_DOMAIN } from '../../src/home/behavior-timeline';

const ROOT = path.resolve(process.cwd(), 'src');

/** 消费侧不需要进首页时间线的发射 source（非域级：小橘自身链路 / 附件 / 闪念）。
 *  消费侧经 mapBehaviorEvent default 分支剔除——登记于此防「新字面量」误报。 */
const NON_DOMAIN_SOURCES = ['chat', 'attach', 'flash'];

/** 发射侧已登记的存量异名（ADR-0072 迁出后 source 值不迁移，消费侧映射表认旧名） */
const LEGACY_DOMAIN_SOURCES = ['literature', 'bili-downloader', 'library'];

describe('行为流契约对账（arch A2）', () => {
  it('sidecar 文件名单源：smartcat 导出恒等 + src/home 零字面量双源', () => {
    expect(SMARTCAT_BEHAVIOR_SIDECAR_FILE).toBe('smartcat-behavior.json');
    // src/home/** 内不再允许出现文件名字面量（正典在 smartcat/memory.ts，经 import 消费）
    const violations: string[] = [];
    const walk = (dir: string): void => {
      for (const name of fs.readdirSync(dir)) {
        const p = path.join(dir, name);
        if (fs.statSync(p).isDirectory()) walk(p);
        else if (name.endsWith('.ts') && !name.endsWith('.test.ts')) {
          const text = fs.readFileSync(p, 'utf8');
          if (text.includes("'smartcat-behavior.json'")) violations.push(path.relative(ROOT, p));
        }
      }
    };
    walk(path.join(ROOT, 'home'));
    expect(violations, `sidecar 文件名字面量双源：${violations.join(', ')}`).toEqual([]);
  });

  it('发射侧 addObservation 字面量 source 全集：域级有映射、非域级在白名单', () => {
    // 静态扫描 src/smartcat 的 addObservation('xxx' 字面量发射点
    const found = new Set<string>();
    const walk = (dir: string): void => {
      for (const name of fs.readdirSync(dir)) {
        const p = path.join(dir, name);
        if (fs.statSync(p).isDirectory()) walk(p);
        else if (name.endsWith('.ts') && !name.endsWith('.test.ts')) {
          const text = fs.readFileSync(p, 'utf8');
          const re = /addObservation\(\s*'([a-z-]+)'/g;
          let m: RegExpExecArray | null;
          while ((m = re.exec(text))) found.add(m[1]);
        }
      }
    };
    walk(path.join(ROOT, 'smartcat'));
    expect(found.size).toBeGreaterThan(0);

    const unknown: string[] = [];
    for (const s of found) {
      const isDomainLevel = s in SOURCE_DOMAIN; // 域级 = 消费侧映射表收录（含 memo→memo 恒等映射）
      if (!isDomainLevel && !NON_DOMAIN_SOURCES.includes(s)) unknown.push(s);
    }
    expect(unknown, `未对账的发射 source（域级须进映射表，其余登记 NON_DOMAIN_SOURCES）：${unknown.join(', ')}`).toEqual([]);
  });

  it('消费侧映射表键集稳定（存量异名不迁移——ADR-0072 后 source 值保持原名）', () => {
    // 存量异名：literature / bili-downloader（知识盒旧名）、library（书库旧名）——映射值是**新域 id**
    expect(SOURCE_DOMAIN.literature).toBe('knowledge');
    expect(SOURCE_DOMAIN['bili-downloader']).toBe('knowledge');
    expect(SOURCE_DOMAIN.library).toBe('bookshelf');
    // 全表值域 = 首页域 id（透传键不在表内，经 behaviorSourceDomain 原样返回）
    for (const [, domain] of Object.entries(SOURCE_DOMAIN)) {
      expect(typeof domain).toBe('string');
      expect(domain.length).toBeGreaterThan(0);
    }
  });
});
