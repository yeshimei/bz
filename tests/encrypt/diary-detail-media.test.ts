/**
 * 加密日记详情：文字 + 对应的图片/视频（2026-11-06 用户要求）。
 * 纯 HTML 层断言：正文剥掉块头、有附件时给媒体容器与「图文预览」入口。
 * 另钉住 fillDiaryMedia 的四条行为：正文顺序、切条目竞态丢弃、只自动加载图片、预览层只解一次。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { noteDetailHTML } from '../../src/encrypt/vault-assets-view';
import { UIManager } from '../../src/encrypt/ui';
import type { SafeNote } from '../../src/encrypt/data';

const CONFIG = {
  root: 'CONFIG/.ENCRYPT',
  previewEnabled: true,
  previewSize: 384,
  previewQuality: 0.5,
  autoLoadOriginal: false,
  securityMode: false,
};

function diaryNote(attachments: SafeNote['attachments'], id = 'd1'): SafeNote {
  return {
    id,
    kind: 'diary-entry',
    path: '我的/日记/2026-08-10.md',
    title: '2026-08-10 · 21:00 日记',
    createdAt: new Date(Date.UTC(2026, 7, 10, 13, 0)).toISOString(),
    contentRef: 'd1.enc',
    attachments,
  };
}

function img(path: string): SafeNote['attachments'][number] {
  return { path, kind: 'image', blobRef: '.b.enc', blobSize: 3, fingerprint: 'f', hasPreview: true, previewRef: '.p.enc' };
}

function vid(path: string): SafeNote['attachments'][number] {
  return { path, kind: 'video', blobRef: '.b.enc', blobSize: 3, fingerprint: 'f', hasPreview: true, previewRef: '.p.enc' };
}

describe('noteDetailHTML：加密日记的图文详情', () => {
  it('正文剥掉块头；有附件 → 媒体容器 + 图文预览入口', () => {
    const html = noteDetailHTML(
      diaryNote([img('我的/日记/附件/a.png')]),
      'diary',
      '# 日记/加密 21:00\n今晚的月亮'
    );
    expect(html).toContain('今晚的月亮');
    expect(html).not.toContain('# 日记/加密');
    expect(html).toContain('data-diary-media');
    expect(html).toContain('图文预览');
    expect(html).toContain('data-detail="preview"');
    // 预览与还原、复制、销毁并列，动作不丢
    expect(html).toContain('data-detail="restore-diary"');
    expect(html).toContain('data-detail="copy-diary"');
    expect(html).toContain('data-detail="destroy-diary"');
  });

  it('无附件：不摆空媒体区', () => {
    const html = noteDetailHTML(diaryNote([]), 'diary', '# 日记 09:00\n只有字');
    expect(html).toContain('只有字');
    expect(html).not.toContain('data-diary-media');
    expect(html).toContain('无附件');
  });
});

/* ================= fillDiaryMedia：顺序 / 竞态 / 自动加载 / 缓存 ================= */

/** 详情壳只取媒体容器：fillDiaryMedia 按 [data-diary-media] 定位 */
function mediaRoot(): { root: HTMLElement; box: HTMLElement } {
  const root = document.createElement('div');
  root.innerHTML = '<div data-diary-media></div>';
  document.body.appendChild(root);
  return { root, box: root.querySelector('[data-diary-media]') as HTMLElement };
}

/** 假数据层：预览层按路径回 dataUrl，原始层返回一段 base64 */
function fakeDM(previewCall?: (a: { path: string }) => void) {
  return {
    unlocked: true,
    manifest: { notes: [] as SafeNote[] },
    decryptPreview: vi.fn(async (a: { path: string }) => {
      previewCall?.(a);
      return `data:image/jpeg;base64,${a.path}`;
    }),
    decryptAttachmentOriginal: vi.fn(async (_a: { path: string }) => 'QUJD'),
    lock: vi.fn(),
  };
}

function slotOf(box: HTMLElement, path: string): HTMLElement {
  const hit = [...box.querySelectorAll<HTMLElement>('[data-attach]')].find(
    (el) => decodeURIComponent(el.getAttribute('data-attach') || '') === path
  );
  if (!hit) throw new Error('slot not found: ' + path);
  return hit;
}

describe('fillDiaryMedia：详情里的图片/视频', () => {
  const uis: UIManager[] = [];

  function makeUI(dm: any, config = CONFIG): UIManager {
    const ui = new UIManager(dm, { ...config });
    uis.push(ui);
    return ui;
  }

  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    for (const ui of uis) ui.pwDataManager.destroy();
    uis.length = 0;
    document.body.innerHTML = '';
  });

  it('按正文出现顺序排版，未被引用的附件接在后面', async () => {
    const ui = makeUI(fakeDM());
    const note = diaryNote([
      img('我的/日记/附件/a.png'),
      vid('我的/日记/附件/b.mp4'),
      img('我的/日记/附件/c.png'),
    ]);
    const { root, box } = mediaRoot();
    await (ui as any).fillDiaryMedia(
      root,
      note,
      '# 📖 21:00\n先看 c ![[附件/c.png]]，再看 a ![[附件/a.png]]\n![[附件/b.mp4]]'
    );
    const order = [...box.querySelectorAll('[data-attach]')].map((el) =>
      decodeURIComponent(el.getAttribute('data-attach') || '')
    );
    expect(order).toEqual([
      '我的/日记/附件/c.png',
      '我的/日记/附件/a.png',
      '我的/日记/附件/b.mp4',
    ]);
  });

  it('正文未引用 / 无正文时：附件按清单顺序全量铺（首帧兜底）', async () => {
    const ui = makeUI(fakeDM());
    const note = diaryNote([img('a.png'), vid('b.mp4'), img('c.png')]);
    const { root, box } = mediaRoot();
    await (ui as any).fillDiaryMedia(root, note);
    expect(box.querySelectorAll('[data-attach]').length).toBe(3);
    expect(slotOf(box, 'a.png')).toBeTruthy();
    expect(slotOf(box, 'c.png')).toBeTruthy();
  });

  it('切条目竞态：解密窗口内旧 box 离树 → 这批结果丢弃（不写进已废弃的详情）', async () => {
    const ui = makeUI(fakeDM());
    const note = diaryNote([img('a.png')]);
    const { root, box } = mediaRoot();
    const pending = (ui as any).fillDiaryMedia(root, note, '# 📖 09:00\n![[a.png]]');
    box.remove(); // 详情被重建/切走：旧容器离树
    await pending;
    expect(box.querySelectorAll('[data-attach]').length).toBe(0);
    expect(box.innerHTML).toBe('');
  });

  it('autoLoadOriginal：只自动解密图片，视频保持点击按需加载', async () => {
    const dm = fakeDM();
    const ui = makeUI(dm, { ...CONFIG, autoLoadOriginal: true });
    const note = diaryNote([img('我的/日记/附件/a.png'), vid('我的/日记/附件/b.mp4')]);
    const { root, box } = mediaRoot();
    await (ui as any).fillDiaryMedia(
      root,
      note,
      '# 📖 09:00\n![[附件/a.png]]\n![[附件/b.mp4]]'
    );
    const imgSlot = slotOf(box, '我的/日记/附件/a.png');
    const vidSlot = slotOf(box, '我的/日记/附件/b.mp4');
    await vi.waitFor(() => expect(imgSlot.dataset.loaded).toBe('1'));
    // 视频不自动加载：不进入 loading/loaded，也不解原始层
    expect(vidSlot.dataset.loaded).toBeUndefined();
    expect(vidSlot.dataset.loading).toBeUndefined();
    expect(dm.decryptAttachmentOriginal).toHaveBeenCalledTimes(1);
    expect(dm.decryptAttachmentOriginal.mock.calls[0]![0].path).toBe('我的/日记/附件/a.png');
  });

  it('预览缓存：首帧与正文落定两次渲染，同一附件只解一次', async () => {
    const dm = fakeDM();
    const ui = makeUI(dm);
    const note = diaryNote([img('a.png'), vid('b.mp4')]);
    // 首帧（正文未就绪）：按清单顺序铺
    const first = mediaRoot();
    await (ui as any).fillDiaryMedia(first.root, note);
    expect(dm.decryptPreview).toHaveBeenCalledTimes(2);
    // 正文落定后重绘：顺序重排但预览层走缓存，不再解密
    const second = mediaRoot();
    await (ui as any).fillDiaryMedia(second.root, note, '# 📖 09:00\n![[a.png]]\n![[b.mp4]]');
    expect(dm.decryptPreview).toHaveBeenCalledTimes(2);
    expect(second.box.querySelectorAll('[data-attach]').length).toBe(2);
    expect(slotOf(second.box, 'a.png').querySelector('img')).toBeTruthy();
  });

  it('预览缓存随上锁清空：再次渲染重新解密（明文不跨锁驻留）', async () => {
    const dm = fakeDM();
    const ui = makeUI(dm);
    const note = diaryNote([img('a.png'), vid('b.mp4')]);
    await (ui as any).fillDiaryMedia(mediaRoot().root, note);
    expect(dm.decryptPreview).toHaveBeenCalledTimes(2);
    dm.unlocked = false; // 上锁前先置为锁定态（lockNow 的统计快照不再取清单）
    (ui as any).lockNow();
    dm.unlocked = true;
    await (ui as any).fillDiaryMedia(mediaRoot().root, note);
    expect(dm.decryptPreview).toHaveBeenCalledTimes(4);
  });
});
