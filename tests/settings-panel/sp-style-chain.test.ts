// @vitest-environment node
/**
 * 设置面板评审壳「样式链」回归（2026-09-23 用户报「标签管理混乱」后补的守卫）。
 *
 * 面板真身跑在 prototype-view.html 的 iframe 里（桌面/移动两个 iframe 同源），
 * 样式是**逐份直链**的：漏一份不报错，只让该块的 markup 裸奔——
 * 2026-09-23 症候 = 收藏本「标签管理」custom 行：行堆成一列、lucide 图标无尺寸约束撑满整块。
 * （插件端走聚合根 styles.css，天然不缺；只有评审壳会漏。补链要补在 iframe 视图上，
 * 挂在壳页 prototype.html 上等于没链——番茄钟那份 2026-09-23 之前就是这么挂错的。）
 *
 * 两条不变量：
 * 1. 链上必须含**有 custom 行的域**的样式——custom 行是域内自绘 markup，吃域内类名与域内 token；
 * 2. 链序与 build-css SOURCES 一致（层叠次序 = 插件端聚合结果的次序）。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repo = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');
const view = () => repo('prototypes/settings-panel/prototype-view.html');

/** 链上出现的样式 href 顺序（相对路径原样，便于断言） */
function chainOf(html: string): string[] {
  return [...html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map((m) => m[1]);
}

describe('设置面板壳：iframe 视图的样式链', () => {
  it('链上含收藏本样式（标签管理 custom 行的骨架与图标尺寸来源）', () => {
    expect(chainOf(view())).toContain('../../src/favorites/styles.css');
  });

  it('链上含全部「有 custom 行的域」的样式（新增 custom 行必须同步补链）', () => {
    // 现役 custom 行：favorites 标签管理、home 首页入口内联编辑器
    // （grep 口径：src/**/settings*.ts 与域 ui.ts 里的 type: 'custom'）
    for (const css of ['../../src/home/styles.css', '../../src/favorites/styles.css']) {
      expect(chainOf(view()), `${css} 缺链 = 该域 custom 行裸奔`).toContain(css);
    }
  });

  it('链序与 build-css SOURCES 一致（core 三份 → 各域 → 本域样式殿后）', () => {
    const chain = chainOf(view());
    const at = (p: string) => chain.indexOf(p);
    const order = [
      '../../src/core/styles.css',
      '../../src/core/ui/tokens.css',
      '../../src/core/ui/components.css',
      '../../src/home/styles.css',
      '../../src/favorites/styles.css',
      '../../src/pomodoro/styles.css',
      '../../src/settings-panel/styles.css',
      '../../src/checkup/styles.css',
    ];
    order.forEach((p, i) => {
      expect(at(p), `${p} 不在链上`).toBeGreaterThan(-1);
      if (i > 0) expect(at(order[i - 1]), `${order[i - 1]} 应排在 ${p} 之前`).toBeLessThan(at(p));
    });
  });
});
