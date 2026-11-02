/**
 * 发版两道闸的钉子（2026-11-02 立）
 *
 * 这两道闸存在的理由就是「记性靠不住」：note 没给用户过目就打包、没说「发布」就上传，
 * 都实际发生过（v1.36.0 的半成品上线、v1.40.0 挂齐资产才贴卡）。所以判定逻辑必须是
 * 纯函数、可单测——不能只是脚本里几行 if，改着改着就失效。
 *
 * **本文件不许出现真实仓库路径的字面量**（根构建产物、清单文件、文档目录的名字都算）：
 * 增量选择器从测试文件里的字符串字面量建「文本边」（`scripts/test-affected.mjs` 的
 * buildIndex），在注释里顺手提到它的名字也等于宣布「有测试在盯它」，那条
 * 「构建产物没人读 → 全量」的兜底会被压掉（affected-repo-paths.ts 里点名的自指噪声）。
 * 要真名就从被测脚本的函数里取（`releaseAssetNames` / `notePath` / `gatePath`）。
 */
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  PUBLISH_WORD,
  assetFingerprint,
  clearGate,
  evaluateNote,
  evaluatePublish,
  evaluateReleaseOrder,
  gatePath,
  manifestVersion,
  noteBody,
  notePath,
  readGate,
  releaseAssetNames,
  renderNoteCard,
  renderPublishCard,
  sha256File,
  writeGate,
} from '../../scripts/release-gate.mjs';

const VER = '9.9.9';
/** Release 上那批资产名（从脚本取，不写字面量——见文件头） */
const ASSETS = releaseAssetNames(VER);
/** 版本号那一份 manifest：ASSETS 里也有它，写完资产再重写一遍 */
const MF_NAME = ASSETS[4];

const NOTE = ['# 更新日志', '', '## ✨ 新增', '', '- **游戏库** ：一句话', '', '# 安装', '', '略', ''].join('\n');

/** 造一个最小仓库根：manifest + note + 六个资产 */
function makeRepo(note = NOTE) {
  const root = mkdtempSync(join(tmpdir(), 'bz-gate-'));
  mkdirSync(dirname(notePath(root, VER)));
  writeFileSync(notePath(root, VER), note);
  for (const f of ASSETS) writeFileSync(join(root, f), `content-of-${f}`);
  writeFileSync(join(root, MF_NAME), JSON.stringify({ version: VER }));
  return root;
}

let root;

beforeEach(() => {
  root = makeRepo();
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('第一道闸：版本号 + note 全文过目', () => {
  it('没有批准记录 → 不放行（版本号与文案都没给人看过）', () => {
    const r = evaluateNote(root, VER);
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('还没过目');
  });

  it('批准过 → 放行，记着那一刻的 note 摘要', () => {
    writeGate(root, { version: VER, noteSha256: sha256File(notePath(root, VER)), noteApprovedAt: 'x' });
    expect(evaluateNote(root, VER).ok).toBe(true);
  });

  it('note 批准之后又改 → 作废：批准的是旧稿，不能拿旧批准发新稿', () => {
    writeGate(root, { version: VER, noteSha256: sha256File(notePath(root, VER)), noteApprovedAt: 'x' });
    writeFileSync(notePath(root, VER), NOTE.replace('一句话', '改过的文案'));
    const r = evaluateNote(root, VER);
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('重新过目');
  });

  it('换版本 → 旧批准不算数', () => {
    writeGate(root, { version: VER, noteSha256: sha256File(notePath(root, VER)), noteApprovedAt: 'x' });
    expect(evaluateNote(root, '1.0.0').ok).toBe(false);
  });

  it('过目卡里给的是正文全文（到「# 安装」为止，不含固定三节）', () => {
    const card = renderNoteCard(root, VER);
    expect(card).toContain(`v${VER}`);
    expect(card).toContain('**游戏库** ：一句话');
    expect(card).toContain('approve-note');
    expect(card).toContain(VER);
  });

  it('note 文件不存在 → 直接不放行', () => {
    rmSync(notePath(root, VER));
    expect(evaluateNote(root, VER).ok).toBe(false);
    expect(noteBody(root, VER)).toBeNull();
  });
});

describe('第二道闸：资产清单过目 + 明确说「发布」', () => {
  function approveNote() {
    writeGate(root, { version: VER, noteSha256: sha256File(notePath(root, VER)), noteApprovedAt: 'x' });
  }

  it('note 过了、没说「发布」→ 不放行', () => {
    approveNote();
    const r = evaluatePublish(root, VER);
    expect(r.ok).toBe(false);
    expect(r.reason).toContain(PUBLISH_WORD);
  });

  it('说了「发布」→ 放行，并记下那一批资产的指纹', () => {
    approveNote();
    writeGate(root, {
      ...readGate(root),
      assetsSha256: assetFingerprint(root, VER),
      publishApprovedAt: 'y',
    });
    expect(evaluatePublish(root, VER).ok).toBe(true);
  });

  it('批准之后资产重打过 → 作废：确认卡对不上刚挂上去的包', () => {
    approveNote();
    writeGate(root, {
      ...readGate(root),
      assetsSha256: assetFingerprint(root, VER),
      publishApprovedAt: 'y',
    });
    writeFileSync(join(root, ASSETS[0]), 'repacked');
    const r = evaluatePublish(root, VER);
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('资产又变了');
  });

  it('note 闸没过时，publish 闸也不过（两道都跳不过去）', () => {
    expect(evaluatePublish(root, VER).ok).toBe(false);
  });

  it('确认卡 = note 全文 + 资产逐个 sha256，一条不漏', () => {
    const card = renderPublishCard(root, VER);
    for (const f of ASSETS) {
      expect(card).toContain(f);
      expect(card).toContain(sha256File(join(root, f)));
    }
    expect(card).toContain(`--i-say=${PUBLISH_WORD}`);
  });
});

describe('第三道闸：发布顺序（对外镜像必须晚于 Release 转正）', () => {
  const TAG = `v${VER}`;

  it('Release 还不存在 → 拦住（半成品不许先上线，v1.40.0 就是这么翻的）', () => {
    const r = evaluateReleaseOrder({ tag: TAG, exists: false });
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('还不存在');
  });

  it('还是 draft → 拦住（用户看不到草稿，镜像出去等于绕过发布）', () => {
    const r = evaluateReleaseOrder({ tag: TAG, exists: true, isDraft: true });
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('草稿');
  });

  it('已转正 → 放行', () => {
    expect(evaluateReleaseOrder({ tag: TAG, exists: true, isDraft: false }).ok).toBe(true);
  });

  it('预发布（prerelease）算已发布，放行但要把事实带出来', () => {
    const r = evaluateReleaseOrder({ tag: TAG, exists: true, isDraft: false, isPrerelease: true });
    expect(r.ok).toBe(true);
    expect(r.prerelease).toBe(true);
  });

  it('tag 形状不合法 → 拦住（目录名只能是 vX.Y.Z）', () => {
    expect(evaluateReleaseOrder({ tag: 'v1.4', exists: true }).ok).toBe(false);
    expect(evaluateReleaseOrder({ tag: '', exists: true }).ok).toBe(false);
    expect(evaluateReleaseOrder({}).ok).toBe(false);
  });
});

describe('闸文件', () => {
  it('reset 之后两道都要重新过', () => {
    writeGate(root, { version: VER, noteSha256: sha256File(notePath(root, VER)), noteApprovedAt: 'x' });
    clearGate(root);
    expect(existsSync(gatePath(root))).toBe(false);
    expect(evaluateNote(root, VER).ok).toBe(false);
  });

  it('闸文件坏了（半截 JSON）按「没批准」处理——宁可多问一遍', () => {
    writeFileSync(gatePath(root), '{ 坏了');
    expect(readGate(root)).toBeNull();
    expect(evaluateNote(root, VER).ok).toBe(false);
  });

  it('版本号缺省读 manifest（唯一事实源）', () => {
    expect(manifestVersion(root)).toBe(VER);
  });
});
