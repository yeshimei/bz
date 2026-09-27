/* ============================================================
 * bz · 仓库双源基址（core/remote-base.ts，零依赖叶子模块）
 *
 * 全仓**唯一事实源**——资源通道（remote-asset 的 downloads/ 资产）与插件
 * 自更新（self-update 的仓库根三件套）都从这里取双源地址，杜绝两处各写一份
 * 字面量导致漂移。
 *
 * 通道口径：GitHub raw **主** → jsDelivr **备**（国内被墙时的第二通道）；
 * 两路都 404/失败才报错，且第一个成功的就用——见两消费方各自的行为语义。
 * ============================================================ */

/** 仓库双源基址：GitHub raw 主 → jsDelivr 备（国内被墙时的第二通道）。
 *  唯一事实源——资源通道（remote-asset）与插件自更新（self-update）共用。 */
export const REPO_BASES = [
  'https://raw.githubusercontent.com/yeshimei/bz/master',
  'https://cdn.jsdelivr.net/gh/yeshimei/bz@master',
];

/** 仓库根文件的双源 URL（自更新三件套：manifest.json / main.js / styles.css） */
export function repoRemotesFor(name: string): string[] {
  return REPO_BASES.map((b) => `${b}/${name}`);
}

/** downloads/ 资产的双源 URL（fileName 是相对 downloads/ 的路径，可为多级） */
export function downloadRemotesFor(fileName: string): string[] {
  return REPO_BASES.map((b) => `${b}/downloads/${fileName}`);
}
