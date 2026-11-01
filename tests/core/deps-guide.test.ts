// @vitest-environment jsdom
/**
 * 依赖清单弹窗的**结构**回归（core/deps-guide.ts）。
 *
 * 这一屏是照定稿原型（.scratch/deps-guide-proto）一比一复刻的，形状就是需求本身：
 *   头行（标题 + ✕）/ 正文（分组卡：普通项走行、模型项走表）/ 提示词 / 底栏。
 * 所以这里钉的不是「有没有渲染」，而是**哪一块长什么样**——嵌入模型必须是四列表
 * （名称 / MTEB 参考分 / 下载体积 / 显存）、重排与嵌入同卡但隔一条线、转写只有表、
 * 运行时与音视频是两行。谁哪天顺手把它改回「一列到底」的清单，这几条会红。
 *
 * 视觉（圆角、间距）在 CSS 里，jsdom 量不出来，别在这里断言。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { openDepsGuide } from '../../src/core/deps-guide';
import { closeAllModals } from '../../src/core/ui/modal';
import { PLAN_GROUPS } from '../../src/core/deps-plan';
import { resetObsidianMocks } from '../mock-obsidian-entry';

/** 只要能解析出仓库与插件目录就够了（弹窗只读这两个路径） */
const APP = { vault: { configDir: '.obsidian', adapter: { getBasePath: () => 'E:/vault' } } };

function popup(): HTMLElement {
  return document.querySelector<HTMLElement>('.bz-deps-modal') as HTMLElement;
}
function groups(): HTMLElement[] {
  return [...popup().querySelectorAll<HTMLElement>('.bz-deps-grp')];
}
function groupOf(name: string): HTMLElement {
  return groups().find((g) => g.querySelector('.bz-deps-grp-h')?.textContent === name) as HTMLElement;
}

describe('deps-guide 弹窗结构（照原型）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
    // 探活别真打网络：这一屏只把结果写进右格，节点照样渲染
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('offline');
    }));
  });
  afterEach(() => {
    closeAllModals();
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
  });

  it('壳：头行带标题与关闭钮，正文与底栏各一段', () => {
    openDepsGuide(APP);
    expect(popup().querySelector('.bz-deps-h .bz-deps-t')?.textContent).toBe('bz 依赖什么');
    expect(popup().querySelector('.bz-deps-h .bz-deps-x')).toBeTruthy();
    expect(popup().querySelector('.bz-deps-b')).toBeTruthy();
    expect(popup().querySelector('.bz-deps-bar')).toBeTruthy();
  });

  it('分组顺序与 PLAN_GROUPS 一致（运行时在最上面）', () => {
    openDepsGuide(APP);
    const heads = groups().map((g) => g.querySelector('.bz-deps-grp-h')?.textContent);
    expect(heads).toEqual([...PLAN_GROUPS]);
  });

  it('运行时：两行，必装项固定勾上且改不了', () => {
    openDepsGuide(APP);
    const rows = groupOf('运行时').querySelectorAll('.bz-deps-row');
    expect(rows.length).toBe(2);
    for (const row of rows) {
      const ck = row.querySelector<HTMLInputElement>('.bz-deps-ck')!;
      expect(ck.type).toBe('checkbox');
      expect(ck.checked).toBe(true);
      expect(ck.disabled).toBe(true);
      expect(row.querySelector('.bz-deps-req')?.textContent).toBe('必装');
    }
  });

  it('向量检索：Ollama 一行 + 嵌入四列表（9 个模型）+ 重排两列表（3 项，隔一条线）', () => {
    openDepsGuide(APP);
    const g = groupOf('向量检索');
    expect(g.querySelectorAll('.bz-deps-row').length).toBe(1);

    const wrap = g.querySelector('.bz-deps-tw') as HTMLElement;
    const tables = wrap.querySelectorAll('table.bz-deps-tb');
    expect(tables.length).toBe(2);

    const embed = tables[0];
    const embedHead = [...embed.querySelectorAll('thead th')].map((th) => th.textContent);
    expect(embedHead).toEqual(['向量模型', 'MTEB 参考分', '下载体积', '显存']);
    const embedRows = embed.querySelectorAll('tbody tr');
    expect(embedRows.length).toBe(9);
    // 单选必须是 radio（同一组只能选一个），不是 checkbox
    expect(embedRows[0].querySelector<HTMLInputElement>('input')!.type).toBe('radio');

    // 重排表在 .bz-deps-sub 里（与嵌入表之间一条分隔线）
    const sub = wrap.querySelector('.bz-deps-sub') as HTMLElement;
    expect(sub).toBeTruthy();
    const rerank = sub.querySelector('table.bz-deps-tb') as HTMLTableElement;
    expect([...rerank.querySelectorAll('thead th')].map((th) => th.textContent)).toEqual(['重排模型', '体积']);
    expect(rerank.querySelectorAll('tbody tr').length).toBe(3);
  });

  it('推荐行铺品牌底（原型 tr.hl）：嵌入 2 行 + 重排 2 行 + 转写 1 行', () => {
    openDepsGuide(APP);
    expect(groupOf('向量检索').querySelectorAll('tr.is-hl').length).toBe(4);
    expect(groupOf('语音转写').querySelectorAll('tr.is-hl').length).toBe(1);
  });

  it('语音转写：只有一张三列表（引擎 / 语言 / 模型体积），没有普通行', () => {
    openDepsGuide(APP);
    const g = groupOf('语音转写');
    expect(g.querySelectorAll('.bz-deps-row').length).toBe(0);
    const table = g.querySelector('table.bz-deps-tb') as HTMLTableElement;
    expect([...table.querySelectorAll('thead th')].map((th) => th.textContent)).toEqual(['引擎', '语言', '模型体积']);
    expect(table.querySelectorAll('tbody tr').length).toBe(2);
  });

  it('音视频处理两行、脸谱一行（都必装）', () => {
    openDepsGuide(APP);
    expect(groupOf('音视频处理').querySelectorAll('.bz-deps-row').length).toBe(2);
    expect(groupOf('脸谱').querySelectorAll('.bz-deps-row').length).toBe(1);
  });

  it('底栏汇总按默认勾选算：8 项 · 约 3.1 GB', () => {
    openDepsGuide(APP);
    const sum = popup().querySelector('.bz-deps-sum') as HTMLElement;
    expect(sum.textContent).toBe('已选 8 项 · 约 3.1 GB');
    expect(popup().querySelectorAll('.bz-deps-bar .bz-deps-acts .bz-btn').length).toBe(2);
  });

  it('教程按钮：文案「看视频教程」，不写分P，点开就是第 3P 那一集', () => {
    openDepsGuide(APP);
    const [video] = popup().querySelectorAll<HTMLButtonElement>('.bz-deps-acts .bz-btn');
    expect(video.textContent).toBe('看视频教程');
    expect(video.disabled).toBe(false);
    // 2026-11-01 用户口径：界面上不出现「共几集 / 4P」这类字样
    expect(video.title).toBe('在浏览器里打开（B 站）');
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    video.click();
    expect(open).toHaveBeenCalledWith(
      'https://www.bilibili.com/video/BV1vNsZ6pE7i/?p=3',
      '_blank',
      'noopener',
    );
    open.mockRestore();
  });

  it('换嵌入模型：单选互斥，汇总与提示词当场跟着变', () => {
    openDepsGuide(APP);
    const embed = groupOf('向量检索').querySelector('table.bz-deps-tb') as HTMLTableElement;
    const hi = embed.querySelector<HTMLInputElement>('input[value="embed:qwen3-embedding:8b"]')!;
    hi.checked = true;
    hi.dispatchEvent(new Event('change', { bubbles: true }));

    // bge-m3 与 8b 互斥（radio 组内只剩一个）
    const bge = embed.querySelector<HTMLInputElement>('input[value="embed:bge-m3"]')!;
    expect(bge.checked).toBe(false);
    // 8b 比 bge-m3 贵 3.5 GB 左右，汇总要变
    expect((popup().querySelector('.bz-deps-sum') as HTMLElement).textContent).not.toBe('已选 8 项 · 约 3.1 GB');
    expect(popup().querySelector('.bz-deps-pbox pre')?.textContent).toContain('qwen3-embedding:8b');
  });

  it('勾了重排但嵌入选的是 bge-m3 → 卡片下面给出「装了不会跑」的说明', () => {
    openDepsGuide(APP);
    const warn = groupOf('向量检索').querySelector('.bz-deps-warn') as HTMLElement;
    expect(warn).toBeTruthy();
    // 默认就是 bge-m3 + 不装重排：这时候还没到该劝的时候
    expect(warn.hidden).toBe(true);

    const rb = groupOf('向量检索').querySelector<HTMLInputElement>('input[value="rerank:dengcao/Qwen3-Reranker-4B:Q4_K_M"]')!;
    rb.checked = true;
    rb.dispatchEvent(new Event('change', { bubbles: true }));
    expect(warn.hidden).toBe(false);
    expect(warn.textContent).toContain('qwen3-embedding:8b');

    // 换成 8b：门过了，警示收回
    const hi = groupOf('向量检索').querySelector<HTMLInputElement>('input[value="embed:qwen3-embedding:8b"]')!;
    hi.checked = true;
    hi.dispatchEvent(new Event('change', { bubbles: true }));
    expect(warn.hidden).toBe(true);
  });

  it('拿不到绝对路径（移动端）→ 不弹窗，只给一句为什么', () => {
    // 手机上 vault.adapter.getBasePath() 给不出路径：清单里的安装位置一个都不存在，
    // 提示词还会写成「不要装进 Obsidian 仓库 」——宁可不给这个入口
    openDepsGuide({ vault: { configDir: '.obsidian', adapter: {} } });
    expect(popup()).toBeNull();
    expect(document.body.textContent).toContain('只能在电脑上装');
  });

  it('Ollama 那行右格是探活结果，不是体积', async () => {
    openDepsGuide(APP);
    const val = groupOf('向量检索').querySelector('.bz-deps-row .bz-deps-val') as HTMLElement;
    await new Promise((r) => setTimeout(r, 0));
    expect(val.textContent).toBe('没检测到');
    expect(val.classList.contains('bz-deps-val--bad')).toBe(true);
  });

  it('提示词框上面不放任何说明（数据文件与键名只在提示词正文里）', () => {
    openDepsGuide(APP);
    const pbox = popup().querySelector('.bz-deps-pbox') as HTMLElement;
    const prev = pbox.previousElementSibling as HTMLElement | null;
    // 提示词框前面紧挨着的只能是最后一个分组卡，不能是「改动写进 / 要改的键」那种说明块
    expect(prev?.classList.contains('bz-deps-grp')).toBe(true);
    expect(popup().querySelector('.bz-deps-data')).toBeNull();
  });
});
