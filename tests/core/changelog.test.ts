/**
 * changelog 测试（ticket 03）：版本比较、折叠渲染、已读版本记录（localStorage）。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  compareVersions,
  getChangelogContent,
  displayChangelog,
  checkAndShowChangelog,
  CHANGELOGS,
} from '../../src/core/changelog';

describe('CHANGELOGS', () => {
  it('8 个 identifier 齐全', () => {
    expect(Object.keys(CHANGELOGS).sort()).toEqual(
      ['bz', 'article', 'luhmann', 'library', 'movie', 'belongings', 'diary', 'password-manager'].sort()
    );
  });
});

describe('compareVersions', () => {
  it('比较语义', () => {
    expect(compareVersions('1.6.0', '1.5.0')).toBe(1);
    expect(compareVersions('1.5.0', '1.6.0')).toBe(-1);
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
    expect(compareVersions('1.10.0', '1.9.0')).toBe(1);
  });
});

describe('getChangelogContent', () => {
  it('未知 identifier → null', () => {
    expect(getChangelogContent('nope', null)).toBeNull();
  });

  it('shownVersion 为 null → 仅展开最新版本', () => {
    const html = getChangelogContent('bz', null)!;
    expect(html).toContain('v1.6.0');
    // 最新版本展开，旧版本折叠
    const v1_6 = html.match(/v1\.6\.0[\s\S]*?changelog-version-content" style="[^"]*">([\s\S]*?)<\/div>/);
    expect(v1_6![1]).toContain('到期');
    const v1_5 = html.match(/v1\.5\.0[\s\S]*?changelog-version-content" style="([^"]*)"/);
    expect(v1_5![1]).toContain('display:none');
  });

  it('shownVersion 为旧版本 → 展开高于它的全部版本', () => {
    const html = getChangelogContent('bz', '1.4.0')!;
    const v1_5 = html.match(/v1\.5\.0[\s\S]*?changelog-version-content" style="([^"]*)"/);
    expect(v1_5![1]).not.toContain('display:none');
    const v1_3 = html.match(/v1\.3\.0[\s\S]*?changelog-version-content" style="([^"]*)"/);
    expect(v1_3![1]).toContain('display:none');
  });
});

/** jsdom 中按 style.cssText 查找弹窗遮罩（Q3 弹窗无 id，属性选择器在 jsdom 不可靠） */
function findChangelogMask(): HTMLElement | null {
  const divs = document.querySelectorAll('div');
  for (const d of Array.from(divs)) {
    if (d.style.cssText.includes('z-index') && d.style.cssText.includes('10005')) return d as HTMLElement;
  }
  return null;
}

describe('displayChangelog / checkAndShowChangelog', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '';
  });

  it('displayChangelog 直接弹出弹窗（含折叠标题与关闭按钮）', () => {
    displayChangelog('belongings');
    const mask = findChangelogMask();
    expect(mask).not.toBeNull();
    expect(mask!.textContent).toContain('归物本的更新日记');
    expect(document.querySelectorAll('.changelog-version-title').length).toBe(1);
  });

  it('未知 identifier → console.warn 且不弹窗', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    displayChangelog('unknown-id');
    expect(findChangelogMask()).toBeNull();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('checkAndShowChangelog：新版本弹窗并记录已读', () => {
    checkAndShowChangelog('bz');
    expect(localStorage.getItem('changelog_bz_shown_version')).toBe('1.6.0');
    expect(findChangelogMask()).not.toBeNull();

    // 再次调用同版本不弹窗
    document.body.innerHTML = '';
    checkAndShowChangelog('bz');
    expect(findChangelogMask()).toBeNull();
  });

  it('checkAndShowChangelog：无定义 identifier 静默返回', () => {
    checkAndShowChangelog('news'); // Q3 无 news 定义，聚合讯调用直接跳过
    expect(localStorage.getItem('changelog_news_shown_version')).toBeNull();
  });

  it('折叠交互：点击版本标题展开/收起', () => {
    displayChangelog('bz');
    const title = document.querySelector('.changelog-version-title') as HTMLElement;
    const content = document.querySelector('.changelog-version-content') as HTMLElement;
    expect(content.style.display).not.toBe('none');
    title.click();
    expect(content.style.display).toBe('none');
    title.click();
    expect(content.style.display).toBe('block');
  });
});
