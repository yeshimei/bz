/**
 * 加密保险箱 UI 覆盖率补测：
 * 纯函数边界（附件收集/媒体槽/截断/MIME）、体检弹窗全流程、解锁弹窗补充分支
 * （冷却节流/清单损坏重设/设置流程异常/键盘与遮罩关闭）、列表过滤排序、
 * 抽屉预览与还原三分支、预览窗降级链（渲染超时/渲染失败/解密失败/原图加载）、
 * Controller 守卫与加锁链路、⚙️ 设置弹窗写回。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setApp } from '../../src/core/app';
import { setSettingsProvider, setSettingsSaver } from '../../src/core/settings-provider';
import {
  EncryptAppController,
  UIManager,
  collectNoteAttachments,
  collectNoteAttachmentPaths,
  collectMediaSlots,
  truncateName,
  mimeOf,
} from '../../src/encrypt/ui';
import type { SafeManager, SafeNote, HealthReport } from '../../src/encrypt/data';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks, hasNotice, clearNotices, getNoticeMessages, Platform, mockMarkdownRenderer } from '../mock-obsidian-entry';
import { closeItemMenu } from '../../src/core/item-actions';
import { closeSettingsModal } from '../../src/core/settings-modal';
import { compressImage, videoFrame } from '../../src/encrypt/preview';

// 预览生成函数可控化（真实 jsdom 无 canvas，恒 null）：默认给产物，个别用例再改写
vi.mock('../../src/encrypt/preview', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/encrypt/preview')>();
  return {
    ...actual,
    compressImage: vi.fn(async () => ({ dataUrl: 'data:image/jpeg;base64,PREVIEWED' })),
    videoFrame: vi.fn(async () => ({ dataUrl: 'data:image/jpeg;base64,FRAMED' })),
  };
});
const mockCompressImage = vi.mocked(compressImage);
const mockVideoFrame = vi.mocked(videoFrame);

async function waitFor(cond: () => boolean, timeout = 3000) {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > timeout) throw new Error('waitFor 超时');
    await new Promise((r) => setTimeout(r, 25));
  }
}

const BASE_CONFIG = { root: 'CONFIG/.ENCRYPT', previewEnabled: false, previewSize: 384, previewQuality: 0.5, autoLoadOriginal: false, securityMode: false };

/** 构造受控的 SafeManager 测试替身（UI 层鸭子类型依赖） */
function fakeDM(over: Record<string, any> = {}) {
  const notes: SafeNote[] = over.notes ?? [];
  return {
    unlocked: over.unlocked ?? true,
    password: over.password ?? 'pw',
    manifestIssue: over.manifestIssue,
    manifest: { notes },
    exists: vi.fn(async () => true),
    unlock: vi.fn(async (_pw: string, _force?: boolean) => over.unlockResult ?? true),
    lock: vi.fn(),
    scanHealth: vi.fn(async () => ({ items: [], integrityChecked: true }) as HealthReport),
    resolveHealth: vi.fn(async () => ({ notes: 0, files: 0 })),
    restoreNote: vi.fn(async () => ({ conflicts: [] as string[], removed: true, manifestSaveFailed: false })),
    decryptNoteBody: vi.fn(async () => '# 正文\n![[img.png]]'), // 嵌入名与默认附件 img.png 对应
    decryptPreview: vi.fn(async () => 'data:image/png;base64,PRE'),
    decryptAttachmentOriginal: vi.fn(async () => 'QUJDREVGRw=='),
    lockNote: vi.fn(async () => ({})),
    onUnlockChange: null as any,
    ...over.overrides,
  } as unknown as SafeManager;
}

function makeUI(dm: SafeManager, config = BASE_CONFIG) {
  const ui = new UIManager(dm, config as any);
  ui.ensureElements();
  return ui;
}

function findDialog(): HTMLElement | null {
  return [...document.querySelectorAll('div')].find(
    (d) => d.style.zIndex === '10070' && d.style.display === 'flex'
  ) as HTMLElement | null;
}

function cleanupDom() {
  [
    'bz-encrypt-mask', 'bz-encrypt-popup', 'bz-encrypt-preview-mask', 'bz-encrypt-preview-popup',
    'bz-encrypt-health-mask', 'bz-encrypt-health-popup',
  ].forEach((id) => document.getElementById(id)?.remove());
  closeItemMenu();
  closeSettingsModal();
  document.body.innerHTML = '';
  Platform.isMobile = false;
}

beforeEach(() => {
  resetObsidianMocks();
  clearNotices();
  setApp(mockAppWithVault(new MockVault()) as any);
  setSettingsProvider(() => BASE_CONFIG as any);
});
afterEach(cleanupDom);

// ==================== 纯函数补测 ====================
describe('纯函数覆盖补测', () => {
  it('collectNoteAttachments：空串引用跳过、basename 命中、子目录相对路径后缀匹配、未命中丢弃', () => {
    const files = [
      { path: '我的/影视/pic.png' },
      { path: '附件/子目录/clip.mp4' },
      { path: '其他.md' },
    ];
    const out = collectNoteAttachments(
      ['![[pic.png]]', '![](./附件/子目录/clip.mp4)', '![[不存在.png]]'].join('\n'),
      ['', ''], // 空串/空白引用应被跳过
      files
    );
    expect(out).toEqual(['我的/影视/pic.png', '附件/子目录/clip.mp4']);
  });

  it('collectNoteAttachments：URL 编码引用解码后匹配；markdown 图片与 video 标签正则兜底', () => {
    const files = [{ path: '我的/影视/a b.png' }, { path: '我的/影视/v.webm' }];
    const content = '![](%E6%88%91%E7%9A%84/%E5%BD%B1%E8%A7%86/a%20b.png)\n<video src="./我的/影视/v.webm"></video>';
    const out = collectNoteAttachments(content, [], files);
    expect(out).toEqual(['我的/影视/a b.png', '我的/影视/v.webm']);
  });

  it('collectNoteAttachmentPaths：缓存缺失/读取异常退化为纯正则；vault.getFiles 缺失不崩', () => {
    // getFileCache 返回 null → 仅正则
    const app1 = { metadataCache: { getFileCache: () => null }, vault: { getFiles: () => [{ path: '我的/影视/pic.png' }] } };
    expect(collectNoteAttachmentPaths(app1 as any, {} as any, '![[pic.png]]')).toEqual(['我的/影视/pic.png']);
    // getFileCache 抛错 → 吞掉退化正则
    const app2 = {
      metadataCache: { getFileCache: () => { throw new Error('缓存损坏'); } },
      vault: { getFiles: () => [{ path: 'pic.png' }] },
    };
    expect(collectNoteAttachmentPaths(app2 as any, {} as any, '![](pic.png)')).toEqual(['pic.png']);
    // vault.getFiles 缺失 → 空索引，全部丢弃
    const app3 = { metadataCache: { getFileCache: () => ({ embeds: [{ link: 'pic.png' }] }) }, vault: {} };
    expect(collectNoteAttachmentPaths(app3 as any, {} as any, '正文')).toEqual([]);
  });

  it('truncateName / mimeOf 边界：basename 截断加省略号；未知扩展名回退 octet-stream', () => {
    expect(truncateName('目录/' + '很'.repeat(30))).toBe('很'.repeat(20) + '…');
    expect(truncateName('短.png')).toBe('短.png');
    expect(truncateName('a/b/c.mp4')).toBe('c.mp4');
    expect(mimeOf('x.unknownext')).toBe('application/octet-stream');
    expect(mimeOf('x')).toBe('application/octet-stream'); // 无扩展名
  });

  it('collectMediaSlots：三种嵌入按文档顺序出槽；未匹配附件的槽为 null 且不入 inlined', () => {
    const atts = [
      { path: '我的/影视/wikilink.png' },
      { path: '我的/影视/mdimg.jpg' },
      { path: '我的/影视/video.mp4' },
    ] as any[];
    const md = '前文![[wikilink.png|100]]中段![alt](./mdimg.jpg)尾段<video src="video.mp4"></video>';
    const { text, slots, inlined } = collectMediaSlots(md, atts);
    // video 正则只消费到 src 的闭引号，标签尾部 '></video>' 保留在正文中（既有行为）
    expect(text).toBe('前文@@ENC_MEDIA_0@@中段@@ENC_MEDIA_1@@尾段@@ENC_MEDIA_2@@></video>');
    expect(slots.map((s) => s.attachment!.path)).toEqual(atts.map((a) => a.path));
    expect(inlined.size).toBe(3);
    const unmatched = collectMediaSlots('![[ghost.png]]', []);
    expect(unmatched.slots[0].attachment).toBeNull();
    expect([...unmatched.inlined]).toEqual([]);
    expect(unmatched.text).toBe('@@ENC_MEDIA_0@@');
  });
});

// ==================== 体检弹窗 ====================
describe('体检弹窗覆盖补测', () => {
  it('锁定态打开体检：先弹主密码，取消则不进入体检', async () => {
    const dm = fakeDM({ unlocked: false, overrides: { unlock: undefined } });
    const ui = makeUI(dm);
    ui.showPasswordDialog = vi.fn(async () => false);
    await ui.openHealthDialog();
    expect(ui.showPasswordDialog).toHaveBeenCalledTimes(1);
    expect(ui.healthMask).toBeNull();
  });

  it('扫描进度实时渲染各类别行；报告分区渲染 + 勾选计数联动', async () => {
    const report: HealthReport = {
      integrityChecked: true,
      items: [
        { cat: 'dead-entry', key: 'entry:1', label: '失效条目一' },
        { cat: 'orphan-file', key: 'file:a.enc', label: '孤儿 a.enc' },
        { cat: 'corrupted-body', key: 'show:1', label: '损坏镜像一' },
        { cat: 'corrupted-attachment', key: 'show:2', label: '损坏镜像二' },
        { cat: 'missing-attachment', key: 'show:3', label: '缺失附件一' },
      ],
    };
    const dm = fakeDM({
      overrides: {
        scanHealth: vi.fn(async (cb?: (p: any) => void) => {
          cb?.({ done: 1, total: 3, current: '条目一.txt', found: [{ cat: 'corrupted-body', key: 's', label: '实时坏镜像' }] });
          cb?.({ done: 2, total: 3, current: 'a.enc', found: [{ cat: 'missing-attachment', key: 'm', label: '实时缺失' }] });
          cb?.({ done: 3, total: 3, current: 'b.enc', found: [{ cat: 'dead-entry', key: 'd', label: '实时失效' }] });
          return report;
        }),
      },
    });
    const ui = makeUI(dm);
    // 扫描完成后实时区会被全量报告重渲染覆盖 → 在进度回调内同步捕获实时行样式
    const liveClassNames: string[][] = [];
    (dm as any).scanHealth.mockImplementation(async (cb?: (p: any) => void) => {
      cb?.({ done: 1, total: 3, current: '条目一.txt', found: [{ cat: 'corrupted-body', key: 's', label: '实时坏镜像' }] });
      cb?.({ done: 2, total: 3, current: 'a.enc', found: [{ cat: 'missing-attachment', key: 'm', label: '实时缺失' }] });
      // 实时区：第二次回调后应有「坏镜像 + 缺失」两类行（在 cb2 与 cb3 之间同步捕获）
      liveClassNames.push(
        [...document.querySelectorAll('.bz-encrypt-health-live .bz-encrypt-health-item')].map((r) => r.className)
      );
      cb?.({ done: 3, total: 3, current: 'b.enc', found: [{ cat: 'dead-entry', key: 'd', label: '实时失效' }] });
      return report;
    });
    await ui.openHealthDialog();
    await waitFor(() => !!document.querySelector('.bz-encrypt-health-summary'));
    // 实时区：第二次回调后应有「坏镜像 + 缺失」两类行
    expect(liveClassNames[liveClassNames.length - 1]).toEqual([
      'bz-encrypt-health-item bz-encrypt-health-item--bad',
      'bz-encrypt-health-item bz-encrypt-health-item--warn',
    ]);
    // 报告区
    const body = document.getElementById('bz-encrypt-health-body')!;
    expect(body.textContent).toContain('体检完成：5 个问题');
    expect(body.textContent).toContain('可清理（2）：1 个失效条目、1 个孤儿密文');
    expect(body.textContent).toContain('损坏镜像（2）——不可清理，请从备份恢复后重试还原');
    expect(body.textContent).toContain('附件镜像缺失（1）——还原时该附件将不可用');
    // 可清理项默认全选，计数联动
    const boxes = [...body.querySelectorAll<HTMLInputElement>('input.bz-encrypt-health-check')];
    expect(boxes.length).toBe(2);
    expect(boxes.every((b) => b.checked)).toBe(true);
    const cleanBtn = document.getElementById('bz-encrypt-health-clean') as HTMLButtonElement;
    expect(cleanBtn.textContent).toBe('清理勾选项 (2)');
    boxes[0].checked = false;
    boxes[0].dispatchEvent(new Event('change'));
    expect(cleanBtn.textContent).toBe('清理勾选项 (1)');
    // 重新体检按钮触发再次扫描（foot 仅有 class 无 id）
    const scanCount = (dm as any).scanHealth.mock.calls.length;
    ([...document.querySelectorAll('.bz-encrypt-health-foot button')].find((b) => b.textContent === '重新体检') as HTMLElement).click();
    await waitFor(() => (dm as any).scanHealth.mock.calls.length === scanCount + 1);
  });

  it('无可清理项：「可清理：无」标题 + 全部镜像完整提示', async () => {
    const dm = fakeDM({
      overrides: { scanHealth: vi.fn(async () => ({ items: [], integrityChecked: true })) },
    });
    const ui = makeUI(dm);
    await ui.openHealthDialog();
    await waitFor(() => !!document.querySelector('.bz-encrypt-health-summary'));
    const body = document.getElementById('bz-encrypt-health-body')!;
    expect(body.textContent).toContain('可清理：无');
    expect(body.textContent).toContain('全部镜像完整（解密+指纹校验通过）');
  });

  it('扫描失败 → 错误态文案；点遮罩关闭体检窗', async () => {
    const dm = fakeDM({
      overrides: { scanHealth: vi.fn(async () => { throw new Error('对账崩溃'); }) },
    });
    const ui = makeUI(dm);
    await ui.openHealthDialog();
    await waitFor(() => document.getElementById('bz-encrypt-health-body')!.textContent!.includes('体检失败：对账崩溃'));
    const mask = document.getElementById('bz-encrypt-health-mask')!;
    mask.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(mask.style.display).toBe('none');
    expect(document.getElementById('bz-encrypt-health-popup')!.style.display).toBe('none');
  });

  it('清理：未勾选提示；成功按类目汇总并自动复扫；失败如实报错', async () => {
    const dm = fakeDM({
      overrides: {
        resolveHealth: vi.fn(async () => ({ notes: 2, files: 1 })),
        scanHealth: vi.fn(async () => ({
          items: [{ cat: 'dead-entry', key: 'entry:1', label: '失效' }],
          integrityChecked: true,
        })),
      },
    });
    const ui = makeUI(dm);
    await ui.openHealthDialog();
    await waitFor(() => !!document.querySelector('.bz-encrypt-health-check'));

    // 全部取消勾选 → 提示未勾选
    const box = document.querySelector<HTMLInputElement>('input.bz-encrypt-health-check')!;
    box.checked = false;
    box.dispatchEvent(new Event('change'));
    (document.getElementById('bz-encrypt-health-clean') as HTMLElement).click();
    await waitFor(() => hasNotice('未勾选任何可清理项'));

    // 勾选后清理 → 汇总通知 + 自动重新体检
    box.checked = true;
    box.dispatchEvent(new Event('change'));
    (document.getElementById('bz-encrypt-health-clean') as HTMLElement).click();
    await waitFor(() => hasNotice('已清理：2 个失效条目、1 个孤儿密文'));
    expect((dm as any).scanHealth.mock.calls.length).toBeGreaterThanOrEqual(2);

    // 失败路径
    (dm as any).resolveHealth.mockRejectedValueOnce(new Error('磁盘只读'));
    (document.getElementById('bz-encrypt-health-clean') as HTMLElement).click();
    await waitFor(() => hasNotice('清理失败：磁盘只读'));
  });
});

// ==================== 解锁弹窗补充分支 ====================
describe('解锁弹窗覆盖补测', () => {
  function makePwUi(dm: SafeManager) {
    return makeUI(dm);
  }

  it('空密码点确认 → 「请输入密码」，不进入解锁流程', async () => {
    const dm = fakeDM();
    const ui = makePwUi(dm);
    const p = ui.showPasswordDialog();
    await waitFor(() => !!findDialog());
    ([...findDialog()!.querySelectorAll('button')].find((b) => b.textContent === '确认') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 10));
    expect(hasNotice('请输入密码')).toBe(true);
    expect(dm.unlock).not.toHaveBeenCalled();
    // 取消按钮收场
    ([...findDialog()!.querySelectorAll('button')].find((b) => b.textContent === '取消') as HTMLElement).click();
    await expect(p).resolves.toBe(false);
  });

  it('连续失败节流：冷却期内重试被拒并提示剩余等待秒数', async () => {
    const dm = fakeDM({ overrides: { unlock: vi.fn(async () => false) } });
    const ui = makePwUi(dm);
    const p = ui.showPasswordDialog();
    await waitFor(() => !!findDialog());
    const dialog = findDialog()!;
    const input = dialog.querySelectorAll('input[type="password"]')[0] as HTMLInputElement;
    const confirmBtn = [...dialog.querySelectorAll('button')].find((b) => b.textContent === '确认')!;
    input.value = 'wrong';
    confirmBtn.click();
    // 同时等两条通知都出现（失败后生产会清空输入框，重试前需重新填入）
    await waitFor(() => hasNotice('密码错误，请重试') && hasNotice(/1 秒后可再次尝试/));
    input.value = 'wrong';
    confirmBtn.click(); // 冷却窗口内立即重试 → 被拒
    expect(hasNotice(/尝试过于频繁，请再等 \d+ 秒/)).toBe(true);
    expect((dm as any).unlock.mock.calls.length).toBe(1); // 第二次请求根本没发出
    dialog.remove();
    void p;
  });

  it('清单损坏（manifestIssue=corrupt）：确认弹窗取消 → 不重设；确认 → 强制重设成功', async () => {
    const dm = fakeDM({
      manifestIssue: 'corrupt',
      overrides: { unlock: vi.fn(async (_pw: string, force?: boolean) => force === true) },
    });
    const ui = makePwUi(dm);
    const p = ui.showPasswordDialog();
    await waitFor(() => !!findDialog());
    const dialog = findDialog()!;
    const input = dialog.querySelectorAll('input[type="password"]')[0] as HTMLInputElement;
    input.value = 'newpw';
    ([...dialog.querySelectorAll('button')].find((b) => b.textContent === '确认') as HTMLElement).click();
    await waitFor(() => !!document.getElementById('__shared_confirm_mask__'));
    expect(document.getElementById('__shared_confirm_mask__')!.textContent).toContain('清单疑似损坏');
    // 先取消
    (document.getElementById('__shared_confirm_cancel__') as HTMLElement).click();
    await waitFor(() => hasNotice('未重设：请先检查或备份数据文件'));
    expect(findDialog()).toBeTruthy(); // 弹窗仍在，可继续操作

    // 再确认 → 重设成功
    ([...dialog.querySelectorAll('button')].find((b) => b.textContent === '确认') as HTMLElement).click();
    await waitFor(() => !!document.getElementById('__shared_confirm_ok__'));
    (document.getElementById('__shared_confirm_ok__') as HTMLElement).click();
    await p;
    expect(hasNotice('已重设主密码（旧数据不可恢复）')).toBe(true);
  });

  it('清单损坏但强制重设写盘失败 → 「重设失败：无法写入清单」，弹窗保持', async () => {
    const dm = fakeDM({
      manifestIssue: 'empty',
      overrides: { unlock: vi.fn(async () => false) },
    });
    const ui = makePwUi(dm);
    const p = ui.showPasswordDialog();
    await waitFor(() => !!findDialog());
    const dialog = findDialog()!;
    (dialog.querySelectorAll('input[type="password"]')[0] as HTMLInputElement).value = 'newpw';
    ([...dialog.querySelectorAll('button')].find((b) => b.textContent === '确认') as HTMLElement).click();
    await waitFor(() => !!document.getElementById('__shared_confirm_ok__'));
    (document.getElementById('__shared_confirm_ok__') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 30));
    expect(hasNotice('重设失败：无法写入清单')).toBe(true);
    dialog.remove();
    void p;
  });

  it('首设流程：unlock 写盘抛错 → 「设置失败」，Promise 以 false 结束；Enter 键等效点确认', async () => {
    const dm = fakeDM({
      unlocked: false,
      password: null,
      overrides: { exists: vi.fn(async () => false), unlock: vi.fn(async () => { throw new Error('磁盘满'); }) },
    });
    const ui = makePwUi(dm);
    const p = ui.showPasswordDialog();
    await waitFor(() => !!findDialog());
    const dialog = findDialog()!;
    const inputs = dialog.querySelectorAll('input[type="password"]');
    (inputs[0] as HTMLInputElement).value = 'master';
    (inputs[1] as HTMLInputElement).value = 'master';
    const ack = dialog.querySelector('.bz-encrypt-dialog-ack input') as HTMLInputElement;
    ack.checked = true;
    // 用 Enter 键触发确认（键盘路径）
    inputs[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await waitFor(() => hasNotice('设置失败：磁盘满'));
    await expect(p).resolves.toBe(false);
  });

  it('点遮罩关闭弹窗 = 取消（resolve false）', async () => {
    const dm = fakeDM();
    const ui = makePwUi(dm);
    const p = ui.showPasswordDialog();
    await waitFor(() => !!findDialog());
    findDialog()!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await expect(p).resolves.toBe(false);
  });
});

// ==================== 列表 / 抽屉 / 预览窗 ====================
function makeNote(over: Partial<SafeNote> = {}): SafeNote {
  return {
    id: 'n1',
    path: '我的/N.md',
    title: '笔记N',
    createdAt: '2025-06-01T00:00:00.000Z',
    contentRef: 'body.enc',
    attachments: [],
    ...over,
  } as SafeNote;
}

describe('列表与抽屉覆盖补测', () => {
  it('renderList：过滤 diary-entry/password-vault 条目，createdAt 倒序，空态文案', async () => {
    const dm = fakeDM({
      notes: [
        makeNote({ id: 'a', title: '普通甲', createdAt: '2025-01-01', kind: undefined }),
        makeNote({ id: 'b', title: '日记条', kind: 'diary-entry' }),
        makeNote({ id: 'c', title: '密码库', kind: 'password-vault' }),
        makeNote({ id: 'd', title: '普通乙', createdAt: '2025-09-09' }),
      ],
    });
    const ui = makeUI(dm);
    await ui.renderList();
    const titles = [...document.querySelectorAll('#bz-encrypt-list .bz-encrypt-card-title')].map((e) => e.textContent);
    expect(titles).toEqual(['普通乙', '普通甲']); // 新的在前，特殊类型被过滤
    // 空态
    (dm.manifest as any).notes = [];
    await ui.renderList();
    expect(document.getElementById('bz-encrypt-list')!.textContent).toContain('保险箱为空');
  });

  it('抽屉「预览」（keepOpen）：打开预览窗，正文混排图片 + 未引用附件入底部画廊 + 失败附件占位', async () => {
    const note = makeNote({
      attachments: [
        { path: '我的/影视/pic.png', kind: 'image', blobRef: 'r1', blobSize: 1, fingerprint: 'f', hasPreview: true, previewRef: 'p1' },
        { path: '我的/影视/broken.png', kind: 'image', blobRef: 'r2', blobSize: 1, fingerprint: 'f', hasPreview: true, previewRef: 'p2' },
        { path: '我的/影视/residual.mp4', kind: 'video', blobRef: 'r3', blobSize: 1, fingerprint: 'f', hasPreview: false, previewRef: '' },
      ] as any,
    });
    const dm = fakeDM({
      notes: [note],
      overrides: {
        // 正文引用 pic/broken 两个附件：pic 预览正常内嵌，broken 解密失败出占位
        decryptNoteBody: vi.fn(async () => '# 正文\n![[pic.png]]\n![[broken.png]]'),
        decryptPreview: vi.fn(async (a: any) => (a.path.endsWith('broken.png') ? Promise.reject(new Error('预览层坏')) : 'data:image/png;base64,OK')),
      },
    });
    const ui = makeUI(dm);
    await ui.renderList();
    const card = document.querySelector('.bz-encrypt-card') as HTMLElement;
    card.dispatchEvent(new MouseEvent('contextmenu', { button: 2, bubbles: true, cancelable: true, clientX: 60, clientY: 60 }));
    const previewItem = [...document.querySelectorAll('.bz-item-menu-item')].find((b) => b.textContent!.includes('预览')) as HTMLElement;
    expect(previewItem).toBeTruthy();
    previewItem.click();
    await waitFor(() => document.getElementById('bz-encrypt-preview-popup')!.style.display === 'flex');
    await waitFor(() => !!document.querySelector('.bz-encrypt-preview-md'));
    const popup = document.getElementById('bz-encrypt-preview-popup')!;
    // 图随文走：正文内嵌预览图
    expect(popup.querySelector('.bz-encrypt-preview-md img.bz-encrypt-preview-media')).toBeTruthy();
    // 预览层解密失败的附件显示占位提示
    expect(popup.querySelector('.bz-encrypt-preview-missing')).toBeTruthy();
    // 未被正文引用的附件进底部画廊（pic.png 在正文里，broken.png 也被引用过 → 只有 residual）
    const gallery = popup.querySelector('.bz-encrypt-preview-gallery')!;
    expect(gallery.textContent).toContain('residual.mp4');
  });

  it('抽屉「还原」确认三分支：取出完成跳转 / 清单保存失败警告 / 冲突中止保留条目；异常走错误通知', async () => {
    const note = makeNote({
      attachments: [{ path: 'a.png', kind: 'image', blobRef: 'r', blobSize: 1, fingerprint: 'f', hasPreview: false, previewRef: '' } as any],
    });

    const runRestore = async (result: any, reject = false) => {
      // 同一用例内多次构建 UI：先移除上一轮面板 DOM，防全局查询命中旧实例
      ['bz-encrypt-mask', 'bz-encrypt-popup', 'bz-encrypt-preview-mask', 'bz-encrypt-preview-popup'].forEach((id) =>
        document.getElementById(id)?.remove()
      );
      const dm = fakeDM({
        notes: [note],
        overrides: {
          restoreNote: reject
            ? vi.fn(async () => { throw new Error('镜像丢失'); })
            : vi.fn(async () => result),
        },
      });
      const ui = makeUI(dm);
      await ui.renderList();
      const card = document.getElementById('bz-encrypt-popup')!.querySelector('.bz-encrypt-card') as HTMLElement;
      card.dispatchEvent(new MouseEvent('contextmenu', { button: 2, bubbles: true, cancelable: true, clientX: 60, clientY: 60 }));
      ([...document.querySelectorAll('.bz-item-menu-item')].find((b) => b.textContent!.includes('还原')) as HTMLElement).click();
      await waitFor(() => !!document.getElementById('__shared_confirm_mask__'));
      expect(document.getElementById('__shared_confirm_mask__')!.textContent).toContain('还原到原路径');
      (document.getElementById('__shared_confirm_ok__') as HTMLElement).click();
      await new Promise((r) => setTimeout(r, 30));
      closeItemMenu();
      return { dm, ui };
    };

    // ① removed：进度转成功、面板收起、尝试打开还原后的笔记
    let { dm } = await runRestore({ conflicts: [], removed: true, manifestSaveFailed: false });
    expect(hasNotice(/还原完成/)).toBe(true);
    expect((dm as any).restoreNote.mock.calls[0][0]).toBe('n1');

    // ② manifestSaveFailed：明示落盘失败
    ({ dm } = await runRestore({ conflicts: [], removed: false, manifestSaveFailed: true }));
    await waitFor(() => getNoticeMessages().some((m) => m.includes('清单保存失败')));

    // ③ conflicts：整体未写回，条目保留
    await runRestore({ conflicts: ['我的/N.md', 'a.png'], removed: false, manifestSaveFailed: false });
    await waitFor(() => hasNotice(/还原中止：2 个目标被占用/));

    // ④ 异常
    await runRestore(undefined, true);
    await waitFor(() => hasNotice('还原失败：镜像丢失'));
  });

  it('openRestoredNote：文件存在才调 openLinkText；目录/不存在静默跳过', () => {
    const dm = fakeDM();
    const ui = makeUI(dm);
    const openLinkText = vi.fn(async () => {});
    setApp({
      vault: { getAbstractFileByPath: (p: string) => (p === 'ok.md' ? { path: 'ok.md' } : p === 'dir.md' ? { path: 'dir.md', isFolder: true } : null) },
      workspace: { openLinkText },
    } as any);
    ui.openRestoredNote(makeNote({ path: 'ok.md' }));
    expect(openLinkText).toHaveBeenCalledWith('ok.md', 'ok.md');
    ui.openRestoredNote(makeNote({ path: 'dir.md' }));
    ui.openRestoredNote(makeNote({ path: 'ghost.md' }));
    expect(openLinkText).toHaveBeenCalledTimes(1);
  });

  it('openPreview 锁定早退：不解密、不填充', async () => {
    const dm = fakeDM({ unlocked: false, password: null });
    const ui = makeUI(dm);
    await ui.openPreview(makeNote());
    await new Promise((r) => setTimeout(r, 20));
    expect(dm.decryptNoteBody).not.toHaveBeenCalled();
    expect(document.getElementById('bz-encrypt-preview-popup')!.textContent).toBe('');
  });
});

describe('预览窗降级链覆盖补测', () => {
  function makePreviewUI(dmOver: Record<string, any> = {}, config = BASE_CONFIG) {
    const note = makeNote({
      attachments: [
        { path: '我的/影视/img.png', kind: 'image', blobRef: 'r1', blobSize: 1, fingerprint: 'f', hasPreview: true, previewRef: 'p1' },
        { path: '我的/影视/vid.mp4', kind: 'video', blobRef: 'r2', blobSize: 1, fingerprint: 'f', hasPreview: false, previewRef: '' },
      ] as any,
    });
    const dm = fakeDM({ notes: [note], ...dmOver });
    const ui = makeUI(dm, config);
    return { ui, dm, note };
  }

  it('autoLoadOriginal 开启：预览打开即自动解密原始层并标记加载完成', async () => {
    const { ui, dm, note } = makePreviewUI({}, { ...BASE_CONFIG, autoLoadOriginal: true });
    await ui.openPreview(note);
    const popup = () => document.getElementById('bz-encrypt-preview-popup')!;
    // 先等填充完成（出现槽位或错误态），避免空集合的 every 恒真竞态
    await waitFor(
      () => document.querySelector('.bz-encrypt-preview-slot') !== null || popup().textContent!.includes('正文解密失败'),
      5000
    );
    // 两个槽（正文内嵌 + 画廊兜底）都自动点击加载
    await waitFor(() => {
      const slots = [...document.querySelectorAll<HTMLElement>('.bz-encrypt-preview-slot')];
      return slots.length >= 2 && slots.every((s) => s.dataset.loaded === '1');
    }, 5000);
    expect((dm as any).decryptAttachmentOriginal.mock.calls.length).toBeGreaterThanOrEqual(2);
    // 原始层替换产物落在 data URL 或 blob URL 上（依环境能力回退）
    const media = document.querySelector('.bz-encrypt-preview-md img.bz-encrypt-preview-media') as HTMLImageElement;
    expect(/^data:|^blob:/.test(media.src)).toBe(true);
  });

  it('点击缩略图：视频替换为可播放元素、无预览层的占位替换为原始图', async () => {
    const { ui, note } = makePreviewUI();
    await ui.openPreview(note);
    await waitFor(() => !!document.querySelector('.bz-encrypt-preview-slot'));
    // 正文内嵌 img.png 一个槽 + 底部画廊兜底 vid.mp4 一个槽
    const slots = [...document.querySelectorAll<HTMLElement>('.bz-encrypt-preview-slot')];
    expect(slots.length).toBe(2);
    // 视频 slot：占位 → 点击后替换为 <video>
    const vidSlot = slots.find((s) => s.querySelector('.bz-encrypt-preview-missing'))!;
    expect(vidSlot.getAttribute('data-attach')!.endsWith('vid.mp4')).toBe(true);
    vidSlot.click();
    await waitFor(() => !!vidSlot.querySelector('video.bz-encrypt-preview-video'));
    expect(vidSlot.dataset.loaded).toBe('1');
    // 图片 slot：有缩略图 → 点击原地替换 src
    const imgSlot = slots.find((s) => s.querySelector('img.bz-encrypt-preview-media'))!;
    const before = imgSlot.querySelector('img')!.src;
    imgSlot.click();
    await waitFor(() => (imgSlot.querySelector('img') as HTMLImageElement).src !== before);
    expect(imgSlot.classList.contains('bz-encrypt-preview-slot--loaded')).toBe(true);
    // 已加载过的 slot 再点不再重复解密
    const calls = (ui.dataManager as any).decryptAttachmentOriginal.mock.calls.length;
    imgSlot.click();
    expect((ui.dataManager as any).decryptAttachmentOriginal.mock.calls.length).toBe(calls);
  });

  it('原始层解密失败：缩略图/占位打上「点击重试」标记且不弹通知', async () => {
    const { ui, note } = makePreviewUI({
      overrides: { decryptAttachmentOriginal: vi.fn(async () => '') }, // 无密文 → 抛错路径
    });
    await ui.openPreview(note);
    await waitFor(() => !!document.querySelector('.bz-encrypt-preview-slot'));
    const slots = [...document.querySelectorAll<HTMLElement>('.bz-encrypt-preview-slot')];
    for (const s of slots) s.click();
    await waitFor(() => slots.every((s) => s.querySelector('[title="加载失败，点击重试"]')));
    expect(hasNotice(/加载失败/)).toBe(false); // 缩略图内恢复，不打扰用户
  });

  it('Markdown 渲染器拒绝：正文区留空但弹窗可用、画廊兜底仍在（不卡死）', async () => {
    const prev = mockMarkdownRenderer.render.getMockImplementation();
    mockMarkdownRenderer.render.mockImplementation(async () => {
      throw new Error('渲染崩溃');
    });
    try {
      const { ui, note } = makePreviewUI();
      await ui.openPreview(note);
      // 渲染拒绝按「已完成（失败）」处理 → 不走纯文本兜底，正文区为空但结构完整
      await waitFor(() => !!document.querySelector('.bz-encrypt-preview-md'));
      const mdEl = document.querySelector('.bz-encrypt-preview-md') as HTMLElement;
      expect(mdEl.textContent).toBe('');
      expect(document.querySelector('.bz-encrypt-preview-gallery')).toBeTruthy(); // 画廊兜底仍渲染
    } finally {
      mockMarkdownRenderer.render.mockImplementation(prev!);
    }
  });

  it('Markdown 渲染挂起 → 3 秒超时降级纯文本（预览永不挂起防护）', async () => {
    const prev = mockMarkdownRenderer.render.getMockImplementation();
    mockMarkdownRenderer.render.mockImplementation(() => new Promise(() => {})); // 永不完成
    vi.useFakeTimers();
    try {
      const { ui, note } = makePreviewUI();
      await ui.openPreview(note);
      await vi.advanceTimersByTimeAsync(3200);
      const popup = document.getElementById('bz-encrypt-preview-popup')!;
      // 超时降级：以原始明文兜底（嵌入保持原语法、未替换成媒体槽），弹窗仍可见正文
      expect(popup.textContent).toContain('# 正文');
      expect(popup.textContent).toContain('![[img.png]]'); // 与 makePreviewUI 默认正文一致
      expect(popup.querySelector('.bz-encrypt-preview-media')).toBeNull();
    } finally {
      vi.useRealTimers();
      mockMarkdownRenderer.render.mockImplementation(prev!);
    }
  });

  it('正文解密抛错 → 「正文解密失败」错误态', async () => {
    const { ui, note } = makePreviewUI({
      overrides: { decryptNoteBody: vi.fn(async () => { throw new Error('密钥不符'); }) },
    });
    await ui.openPreview(note);
    await waitFor(() => document.getElementById('bz-encrypt-preview-popup')!.textContent!.includes('正文解密失败'));
  });

  it('ESC 层级：预览开着只关预览；主面板开着再关主面板', async () => {
    const { ui, note } = makePreviewUI();
    await ui.openPreview(note);
    await waitFor(() => document.getElementById('bz-encrypt-preview-mask')!.style.display === 'block');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.getElementById('bz-encrypt-preview-mask')!.style.display).toBe('none');
    expect(ui.mask!.style.display).toBe('none'); // 主面板未被误关
    ui.show();
    expect(ui.mask!.style.display).toBe('block');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(ui.mask!.style.display).toBe('none');
  });
});

// ==================== EncryptAppController ====================
describe('EncryptAppController 覆盖补测', () => {
  afterEach(() => {
    EncryptAppController.instance = null;
  });

  function makeConfig(over: Record<string, any> = {}) {
    return { ...BASE_CONFIG, ...over } as any;
  }

  it('getInstance 单例复用；attachStatusBar 文案随解锁态切换；init 幂等', async () => {
    const c1 = EncryptAppController.getInstance(makeConfig());
    const c2 = EncryptAppController.getInstance(makeConfig());
    expect(c2).toBe(c1); // 单例
    const bar = document.createElement('span');
    c1.attachStatusBar(bar);
    expect(bar.textContent).toBe('🔒 保险箱'); // 初始锁定
    (c1.dataManager as any).onUnlockChange(true);
    expect(bar.textContent).toBe('🔓 保险箱');
    await c1.init();
    const initialized = c1.uiManager._initialized;
    await c1.init(); // 幂等早退
    expect(c1.uiManager._initialized).toBe(initialized);
    EncryptAppController.instance!.cleanup();
  });

  it('openManager：锁定时经密码弹窗决定是否展示；已解锁直接展示', async () => {
    const c = new EncryptAppController(makeConfig());
    await c.init(); // 先建 DOM（真实 openEncrypt 链路同样先 ensure）
    // 锁定 + 取消 → 不展示
    c.uiManager.showPasswordDialog = vi.fn(async () => false);
    await c.openManager();
    expect(c.uiManager.mask!.style.display).not.toBe('block');
    // 锁定 + 解锁成功 → 展示
    c.uiManager.showPasswordDialog = vi.fn(async () => true);
    await c.openManager();
    expect(c.uiManager.mask!.style.display).toBe('block');
    c.uiManager.hide();
    // 已解锁 → 直接展示
    (c.dataManager as any).unlocked = true;
    await c.openManager();
    expect(c.uiManager.mask!.style.display).toBe('block');
    c.cleanup();
  });

  it('lockCurrentNote 守卫：无活动文件、未解锁分别提示；确认悬而未决时重入被拒', async () => {
    const vault = new MockVault();
    const app = mockAppWithVault(vault);
    setApp(app as any);
    const c = new EncryptAppController(makeConfig());
    // 无活动文件
    app.workspace.getActiveFile = () => null;
    await c.lockCurrentNote();
    expect(hasNotice('请先打开要加密的笔记')).toBe(true);
    // 未解锁
    vault.files.set('我的/N.md', '内容');
    app.workspace.getActiveFile = () => vault.file('我的/N.md');
    await c.lockCurrentNote();
    expect(hasNotice('请先打开加密保险箱并解锁')).toBe(true);
    // 重入保护：第一次停在二次确认（未点），第二次调用被拒
    await c.dataManager.unlock('pw');
    const first = c.lockCurrentNote();
    await waitFor(() => !!document.getElementById('__shared_confirm_mask__'));
    await c.lockCurrentNote();
    expect(hasNotice('正在加密当前笔记，请稍候')).toBe(true);
    (document.getElementById('__shared_confirm_cancel__') as HTMLElement).click();
    await first; // 取消后 finally 复位
    c.cleanup();
  });

  it('lockCurrentNote：附件缺失整笔放弃（读不到即终止，不动清单）', async () => {
    const vault = new MockVault();
    vault.files.set('我的/N.md', '正文无嵌入');
    const app = mockAppWithVault(vault);
    app.workspace.getActiveFile = () => vault.file('我的/N.md');
    // 伪造引用索引指向一个实际不存在的文件：收集通过、读取失败
    (app.vault as any).getFiles = () => [{ path: 'phantom.png' }];
    app.metadataCache.getFileCache = () => ({ embeds: [{ link: 'phantom.png' }] });
    setApp(app as any);
    const c = new EncryptAppController(makeConfig());
    await c.dataManager.unlock('pw');
    const run = c.lockCurrentNote();
    await waitFor(() => !!document.getElementById('__shared_confirm_mask__'));
    (document.getElementById('__shared_confirm_ok__') as HTMLElement).click();
    await run;
    await waitFor(() => hasNotice('加密失败：附件读取失败（phantom.png）'));
    expect(c.dataManager.manifest.notes.length).toBe(0);
    c.cleanup();
  });

  it('lockCurrentNote 全流程：生成压缩预览、加密入箱、删除失败仅警告不回滚', async () => {
    const vault = new MockVault();
    vault.files.set('我的/N.md', '正文 ![[pic.png]]');
    vault.binaryFiles.set('我的/影视/pic.png', new Uint8Array([1, 2, 3]));
    const app = mockAppWithVault(vault);
    app.workspace.getActiveFile = () => vault.file('我的/N.md');
    setApp(app as any);
    const c = new EncryptAppController(makeConfig({ previewEnabled: true }));
    await c.dataManager.unlock('pw');
    // 原文件删除全部失败（模拟占用）→ 仅警告
    (app.vault as any).delete = async () => { throw new Error('被占用'); };
    const first = c.lockCurrentNote();
    await waitFor(() => !!document.getElementById('__shared_confirm_mask__'));
    expect(document.getElementById('__shared_confirm_mask__')!.textContent).toContain('加密到保险箱');
    expect(document.getElementById('__shared_confirm_mask__')!.textContent).toContain('1 个附件');
    (document.getElementById('__shared_confirm_ok__') as HTMLElement).click();
    await first;
    await waitFor(() => c.dataManager.manifest.notes.length === 1);
    expect(vault.files.has('我的/N.md')).toBe(true); // 删除失败 → 原文件保留（Q4-A 不回滚）
    expect(hasNotice(/2 个原文件删除失败/)).toBe(true); // 附件 + 笔记本体都删除失败
    const att = c.dataManager.manifest.notes[0].attachments[0];
    expect(att.hasPreview).toBe(true); // 预览生成成功并入箱
    expect(mockCompressImage).toHaveBeenCalled();

    // 第二笔：lockNote 抛错 → 加密失败提示
    (app.vault as any).delete = async () => {};
    (c.dataManager as any).lockNote = async () => { throw new Error('磁盘满'); };
    const second = c.lockCurrentNote();
    await waitFor(() => !!document.getElementById('__shared_confirm_mask__'));
    (document.getElementById('__shared_confirm_ok__') as HTMLElement).click();
    await second;
    await waitFor(() => hasNotice('加密失败：磁盘满'));
    c.cleanup();
  });

  it('lockCurrentNote：视频附件走 videoFrame 抽帧预览', async () => {
    const vault = new MockVault();
    vault.files.set('我的/V.md', '<video src="clip.mp4"></video>');
    vault.binaryFiles.set('我的/影视/clip.mp4', new Uint8Array([4, 5]));
    const app = mockAppWithVault(vault);
    app.workspace.getActiveFile = () => vault.file('我的/V.md');
    setApp(app as any);
    const c = new EncryptAppController(makeConfig({ previewEnabled: true }));
    await c.dataManager.unlock('pw');
    const run = c.lockCurrentNote();
    await waitFor(() => !!document.getElementById('__shared_confirm_mask__'));
    (document.getElementById('__shared_confirm_ok__') as HTMLElement).click();
    await run;
    await waitFor(() => c.dataManager.manifest.notes.length === 1);
    expect(mockVideoFrame).toHaveBeenCalled();
    expect(c.dataManager.manifest.notes[0].attachments[0].kind).toBe('video');
    c.cleanup();
  });

  it('⚙️ 设置弹窗：三组设置写回 + 首次改动提示重载生效一次；移动端追加全屏开关', async () => {
    const s: any = {
      encryptRoot: 'CONFIG/.ENCRYPT',
      encryptPreviewEnabled: true,
      encryptPreviewSize: '384',
      encryptPreviewQuality: '0.5',
      encryptAutoLoadOriginal: false,
      encryptSecurityMode: false,
    };
    setSettingsProvider(() => s);
    const saveSpy = vi.fn(async () => {});
    setSettingsSaver(saveSpy);
    const c = new EncryptAppController(makeConfig());
    c.uiManager.ensureElements();
    const settingsBtn = [...document.querySelectorAll('button')].find((b) => b.title === '保险箱设置')!;
    settingsBtn.click();
    let popup = document.getElementById('bz-settings-modal-popup')!;
    let names = [...popup.querySelectorAll('.setting-item')].map((el) => (el as any).__setting.name);
    expect(names).toEqual(['保险箱根目录', '生成压缩预览', '预览长边', '预览质量', '预览自动加载原图', '安全模式']);
    const controls = [...popup.querySelectorAll('.setting-item')].map((el) => (el as any).__setting.controls);
    await (controls[0][0] as any).trigger('新/路径'); // 根目录
    expect(s.encryptRoot).toBe('新/路径');
    await (controls[1][0] as any).trigger(false); // 预览开关
    expect(s.encryptPreviewEnabled).toBe(false);
    await (controls[2][0] as any).trigger('512'); // 预览长边
    await (controls[3][0] as any).trigger('0.8'); // 质量
    await (controls[4][0] as any).trigger(true); // 自动加载原图
    await (controls[5][0] as any).trigger(true); // 安全模式
    expect(s.encryptSecurityMode).toBe(true);
    await waitFor(() => saveSpy.mock.calls.length >= 6);
    expect(getNoticeMessages().filter((m) => m === '保险箱设置已保存，重载插件后生效').length).toBe(1); // 只提示一次
    closeSettingsModal();

    // 移动端组
    Platform.isMobile = true;
    settingsBtn.click();
    popup = document.getElementById('bz-settings-modal-popup')!;
    const mobileSetting = [...popup.querySelectorAll('.setting-item')]
      .map((el) => (el as any).__setting)
      .find((st: any) => st.name === '移动端默认全屏');
    expect(mobileSetting).toBeTruthy();
    await (mobileSetting.controls[0] as any).trigger(true);
    expect(s.encryptMobileDefaultFullscreen).toBe(true);
    closeSettingsModal();
    c.cleanup();
  });
});
