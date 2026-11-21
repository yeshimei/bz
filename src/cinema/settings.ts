/**
 * 影院（cinema）域设置 schema（接入设置面板；窗口内无设置按钮，收敛进 Obsidian 设置面板）
 * issue 194：补「显示」组——默认排序/默认状态筛选（打开面板时读，非法值回落，见 index.ts applyDefaultView）。
 */
import { numStrBinding } from '../core/settings-common'; // eslint-disable-line @typescript-eslint/no-unused-vars -- 保留：列数行退役后本域暂无消费者
import type { SettingsSchema } from '../core/settings-schema';
import { resolveAssetDir, domainAssetsDir } from '../core/attachment-dir';
import { tryGetSettings } from '../core/settings-provider';

export function cinemaSettingsSchema(): SettingsSchema {
  return {
    groups: [
      {
        // 外观组（issue 246）：布局行收编真键 cinemaStyle——午夜场上岸单卡（gaz/booth 未实现不暴露，
        // 非法值域内回落午夜场，重开面板生效）；主题行占位，域消费待皮肤设计时接入
        icon: 'palette',
        name: '外观',
        rows: [
          {
            type: 'choiceCards',
            name: '面板布局',
            binding: { key: 'cinemaStyle' },
            options: [
              { value: 'midnight', label: '午夜场', prevClass: 'bz-sp-prev-panel' },
            ],
          },
          {
            type: 'choiceCards',
            name: '面板主题',
            binding: { key: 'cinemaSkinTheme' },
            layoutKey: 'cinemaStyle',
            options: [
              { value: 'nightfall', label: '夜幕', layout: 'midnight', prevClass: 'bz-sp-prev-nightfall' },
            ],
          },
        ],
      },
      {
        icon: 'folder-open',
        name: '目录',
        rows: [
          { type: 'path', mode: 'single', name: '影视文件夹', desc: '影院读取的影视文件夹，日记本也共用', binding: { key: 'cinemaFolderPath' } },
          { type: 'path', mode: 'single', name: '海报文件夹', desc: '豆瓣抓取的海报图片保存位置，留空跟随 Obsidian 的默认附件位置', binding: { key: 'cinemaPosterFolder' },
            // 空值时显示**实际生效目录**：设置 → Obsidian 附件位置 → <影视文件夹>/assets
            // （2026-10-31 起不再有任何写死的海报目录）
            fallbackValue: () => {
              const s = tryGetSettings();
              return resolveAssetDir(s.cinemaPosterFolder, domainAssetsDir(s.cinemaFolderPath)).dir;
            } },
          // 旧「每批加载数量」（cinemaPageSize）已删除：全仓无消费点（列表一次全量渲染），属死配置
        ],
      },
      // 「数据抓取」组（ApiZero Key / 豆瓣 Cookie）已挪入设置面板「数据源凭据」组（ADR-0133 收编，issue 331 定名）
      {
        icon: 'eye',
        name: '显示',
        rows: [
          {
            type: 'select',
            name: '默认排序',
            desc: '打开面板时列表按所选规则排序',
            binding: { key: 'cinemaSortMode' },
            options: [
              { value: 'date', label: '最近观看' },
              { value: 'created', label: '按创建时间' },
              { value: 'rating', label: '按评分' },
            ],
          },
          {
            type: 'select',
            name: '默认状态筛选',
            desc: '打开面板时选中的状态筛选',
            binding: { key: 'cinemaStatusFilter' },
            options: [
              { value: '', label: '全部' },
              { value: '想看', label: '想看' },
              { value: '在看', label: '在看' },
              { value: '已看', label: '已看' },
            ],
          },
          // issue 376 / ADR-0168：按季合并（纯渲染层分组；同一部作品 ≥2 季才合并，单季照旧一卡）。
          // 2026-09-20：缺省**开**（用户拍板），并入的「剧名：副标题」特别篇在卡片详情里单列。
          // 2026-10-05：合并组加入「纪录片」——《守护解放西》这类分季纪录片与剧集同理
          {
            type: 'toggle',
            name: '按季合并',
            desc: '同一部剧或纪录片的各季合并成一张卡片',
            help:
              '同一部剧集、动漫或纪录片的多个季，在海报墙上合并成一张卡片，点进去才展开各季；「剧名：副标题」这类特别篇也归进卡里单独一段。' +
              '它只改变海报墙怎么分组，不碰笔记、不改文件名、不动目录；关掉立刻恢复成每季一张卡，数据层面没有任何变化。',
            binding: { key: 'cinemaMergeSeasons' },
          },
          // 影评写入笔记正文（2026-11-21 QQ 群 Panda 反馈，作者拍板）：开关只是索引，
          // 打开/关闭各弹一次影院风格确认框，确认后才批量迁入/清除；取消则不写值不翻开关
          {
            type: 'toggle',
            name: '影评写入笔记正文',
            desc: '影评写进笔记正文标记区，可用 markdown 编辑',
            help:
              '打开后，影评会写进影片笔记正文的 <BZ-MOVIE> 标记区，位置在笔记顶部、海报上面，可以直接用 markdown 语法编辑；界面和正文两边改动会互相同步。' +
              '属性里的影评仍留着做备份。打开和关闭都会先弹确认框：打开时统计可搬的篇数，关闭时统计正文已有影评的篇数，并问是否批量清除、只在属性保留。',
            binding: { key: 'cinemaReviewInNote' },
            confirm: async (v) => {
              const [{ confirmCinemaFromSettings }, review, { getApp }, { notice }] = await Promise.all([
                import('./ui'),
                import('./review-in-note'),
                import('../core/app'),
                import('../core/notice'),
              ]);
              const app = getApp();
              const { candidates, withBlock } = await review.countReviewNotes(app);
              if (v) {
                const ok = await confirmCinemaFromSettings({
                  kicker: '影评写入笔记正文',
                  lines: [
                    `是否把所有影片的影评放到笔记当中？当前有 ${candidates} 篇可搬。`,
                    '确认后批量写入正文的 <BZ-MOVIE> 标记区，属性里仍保留影评备份。',
                  ],
                  okLabel: '确认打开',
                });
                if (!ok) return false;
                const res = await review.migrateReviewsIntoNotes(app);
                notice(
                  `已把 ${res.done} 篇影评写入笔记${res.failed ? `，${res.failed} 篇失败` : ''}`,
                  res.failed ? 'warning' : 'success',
                );
                return true;
              }
              const ok = await confirmCinemaFromSettings({
                kicker: '关闭影评写入笔记',
                lines: [
                  `当前有 ${withBlock} 篇笔记在正文放了影评。`,
                  '关掉后是否批量清除正文里的标记、只在属性中保留影评？正文里改过的内容会先并回属性，不会丢。',
                ],
                okLabel: '确认关闭',
                danger: true,
              });
              if (!ok) return false;
              const res = await review.clearReviewsFromNotes(app);
              notice(
                `已清除 ${res.done} 篇正文影评${res.failed ? `，${res.failed} 篇失败` : ''}`,
                res.failed ? 'warning' : 'success',
              );
              return true;
            },
          },
        ],
      },
    ],
  };
}
