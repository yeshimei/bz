/**
 * 剪藏本设置「数据源」组（ticket 124，ADR-0060；自旧 clipping 域迁入 clipbook，ADR-0086）：
 * news.json 存在 → 三源开关 + UP 主名单管理 + B站抓取条数 + 保留天数；缺失 → 安装引导行。
 * 数据操作走 ./news-source-settings（串行队列 + 段级合并写盘）。
 *
 * 声明式重写（推翻 ticket 131 的 custom 插槽方案）：全组输出标准声明行（toggle/number/
 * button/info），与其他设置组同一渲染链（core ⚙️ 弹窗 + 设置面板两端同 schema 同视觉）。
 * 三难点的解法：
 * - 异步状态：schema 构建改为「先 await readDataSourceState() 再建行」，状态在构建期
 *   一次性预载进闭包状态盒（入口见 clipbook/ui.ts openSettings 与 settings-panel loader）；
 * - 外部数据绑定：news.json 键走 RowBinding 三函数逃生口（get/set 读写字盒、save 落盘），
 *   不占 data.json；显隐联动用闭包捕获字盒（snapshot 只覆盖 data.json，外部行自捕获）；
 * - UP 名单列表：组内只留「管理」按钮行（计数在 desc），增删/配置在独立 UP 主弹窗
 *   （renderSettingsInto 自建 overlay，形态不变）。
 */
import { notice } from '../core/notice';
import { numStrBinding } from '../core/settings-common';
import { createOverlay } from '../core/dom';
import { escManager } from '../core/esc-manager';
import { renderSettingsInto } from '../core/settings-schema';
import type { SettingsRow, SettingsRowContext, SettingsSchema } from '../core/settings-schema';
import {
  readDataSourceState, writeSources, addBilibiliUp, removeBilibiliUp,
  writeBilibiliMaxItems, writeBilibiliCookie, type DataSourceState,
} from './news-source-settings';
import { resolveUidFromInput, type BilibiliUpInfo } from './news-data';

/** 状态盒（构建期快照的可变副本）：三函数绑定 get/set 读它，save 经数据层落盘 */
type DataSourceBox = DataSourceState;

/**
 * 数据源组声明行（入口先 await readDataSourceState() 把状态传进来）：
 * B 站开关关闭 → UP 主名单与抓取条数两行隐藏（visibleWhen 闭包读状态盒）。
 */
export function dataSourceGroupRows(init: DataSourceState): SettingsRow[] {
  const box: DataSourceBox = {
    ...init,
    sources: { ...init.sources },
    bilibiliUps: [...init.bilibiliUps],
    bilibiliUpInfo: { ...init.bilibiliUpInfo },
  };
  if (!box.exists) {
    return [
      { type: 'info', name: '尚未启用新闻数据源', desc: '聚合讯数据由外部「数据源守护」进程（obsidian-news）抓取入库。安装并启动后此处会显示数据源设置。' },
      { type: 'button', name: '安装数据源', buttonText: '复制安装命令', cta: true, onClick: () => {
        const cmd = 'npm install -g @jwbz/obsidian-news && obsidian-news start';
        navigator.clipboard.writeText(cmd).then(
          () => notice('安装命令已复制', 'success'),
          () => notice('复制失败，请手动复制', 'error')
        );
      } },
    ];
  }

  const bilibiliOn = () => box.sources.bilibili === true;
  /** 三源开关绑定：读写字盒 sources 段，落盘整段合并写（数据层只声明 sources 段） */
  const sourceBinding = (key: 'zhihu' | 'guokr' | 'bilibili') => ({
    get: () => box.sources[key] === true,
    set: (v: boolean) => { box.sources[key] = v; },
    save: () => writeSources({ ...box.sources }),
  });
  /** 名单行描述（动态计数；文案过 ticket 100 lint：8 字以上自然句） */
  const upListDesc = () =>
    box.bilibiliUps.length > 0
      ? `已跟踪 ${box.bilibiliUps.length} 位 UP 主，添加与移除在管理弹窗`
      : '暂未跟踪 UP 主，添加与移除在管理弹窗';

  return [
    { type: 'toggle', name: '知乎日报', desc: '抓取知乎日报每日文章', binding: sourceBinding('zhihu'),
      onChange: (v) => notice(`已${v ? '开启' : '关闭'}知乎日报`, 'success') },
    { type: 'toggle', name: '果壳科学人', desc: '抓取果壳科学人最新文章', binding: sourceBinding('guokr'),
      onChange: (v) => notice(`已${v ? '开启' : '关闭'}果壳科学人`, 'success') },
    { type: 'toggle', name: 'B站 UP 主', desc: '抓取名单内 UP 主的视频投稿', binding: sourceBinding('bilibili'),
      onChange: (v) => notice(`已${v ? '开启' : '关闭'}B站 UP 主`, 'success') },
    { type: 'button', name: 'UP 主名单', desc: upListDesc(), buttonText: '管理', cta: true,
      visibleWhen: bilibiliOn,
      onClick: (ctx) => openUpManagerModal({
        ups: [...box.bilibiliUps],
        upInfo: { ...box.bilibiliUpInfo },
        cookie: box.bilibiliCookie,
        onChanged: async () => {
          // 增删/配置后重读盘回填状态盒 + 行描述（以磁盘为基底，与写队列串行）
          const fresh = await readDataSourceState();
          box.bilibiliUps = [...fresh.bilibiliUps];
          box.bilibiliUpInfo = { ...fresh.bilibiliUpInfo };
          box.bilibiliCookie = fresh.bilibiliCookie;
          setRowDesc(ctx, upListDesc());
          ctx.refreshVisibility();
        },
      }) },
    { type: 'number', name: 'B站抓取条数', desc: '每位 UP 主抓取最近动态的条数上限，默认 10', min: 1, max: 50, step: 1,
      visibleWhen: bilibiliOn,
      binding: {
        get: () => box.bilibiliMaxItems,
        set: (v) => { box.bilibiliMaxItems = v; },
        save: () => writeBilibiliMaxItems(box.bilibiliMaxItems),
      } },
    { type: 'number', name: '文章保留天数', desc: '已读与跳过文章的数据超期自动清理，默认 30 天', min: 1, step: 1,
      binding: numStrBinding('newsRetentionUnsavedDays', 30) },
  ];
}

/** 行描述回填（弹窗改名单后刷新计数）：面板行 = .bz-sp-set-desc，core ⚙️ 弹窗行 = .setting-item-description */
function setRowDesc(ctx: SettingsRowContext, text: string): void {
  const el = ctx.rowEl.querySelector<HTMLElement>('.bz-sp-set-desc')
    || ctx.rowEl.querySelector<HTMLElement>('.setting-item-description');
  if (el) el.textContent = text;
}

// ===== UP 主名单管理弹窗（ticket 126 + 127）=====
// 独立 overlay——层 10100（设置弹窗 10050 之上、共享确认 10250 之下）；
// 内容经 renderSettingsInto 渲染进自建 overlay（bz-up-manager-mask/-popup id 与
// z 序 10100/10101 不变；不换 openSettingsModal——其单例 toggle 语义会顶掉底层剪藏设置弹窗）。

/** UP 弹窗 schema 构建入参（lint 注册时以最小参数调用即可） */
export interface UpManagerSchemaOptions {
  ups: string[];
  upInfo: Record<string, BilibiliUpInfo>;
  cookie: string;
  onChanged: () => void;
}

/** UP 弹窗级可变状态盒：添加/Cookie/名单操作共享（schema 每次打开重建，状态随弹窗生命周期） */
interface UpManagerBox {
  inputValue: string;
  cookieInput: string;
  ups: string[];
  upInfo: Record<string, BilibiliUpInfo>;
}

/**
 * UP 主名单管理弹窗 schema（全面声明行；原 custom 三行——添加复合行/Cookie 复合行/自绘名单已退役）：
 * 添加行与 Cookie 行 = text + 行内按钮（actions，渲染器统一实现）；名单 = 通用 list 行
 * （头像/主副文案/移除，items 函数形式每次移除后以字盒为基底重建）。
 */
export function upManagerSettingsSchema(opts: UpManagerSchemaOptions): SettingsSchema {
  const box: UpManagerBox = {
    inputValue: '',
    cookieInput: String(opts.cookie || ''),
    ups: [...opts.ups],
    upInfo: { ...opts.upInfo },
  };
  return {
    groups: [
      {
        icon: 'users',
        name: 'UP 主名单',
        rows: [
          {
            type: 'text',
            name: '添加 UP 主',
            desc: '粘贴主页链接或视频链接，自动解析后入库',
            placeholder: '粘贴链接或 UID',
            binding: {
              get: () => box.inputValue,
              set: (v) => { box.inputValue = v; },
              save: () => {},
            },
            actions: [{
              text: '添加',
              cta: true,
              onClick: (value) => addUpUid(value, box, opts),
            }],
          },
          {
            type: 'text',
            name: 'B 站 Cookie 可选',
            desc: cookieDesc(box.cookieInput),
            placeholder: '粘贴 buvid3 或 SESSDATA 等 Cookie',
            binding: {
              get: () => box.cookieInput,
              set: (v) => { box.cookieInput = v; },
              save: () => {},
            },
            actions: [
              { text: '保存', onClick: (value) => saveCookie(value || '', box, opts) },
              { text: '清除', onClick: () => saveCookie('', box, opts) },
            ],
          },
          {
            type: 'list',
            name: '名单列表',
            desc: '已跟踪的 UP 主，移除后不再抓取其投稿',
            items: () => box.ups.map((uid) => ({
              key: uid,
              label: upDisplayName(uid, box.upInfo[uid]),
              sub: `UID ${uid}`,
              imageUrl: box.upInfo[uid]?.avatar,
            })),
            emptyText: '暂无跟踪 UP 主，在上方粘贴主页链接或视频链接添加',
            onChange: (keys) => {
              void (async () => {
                const removed = box.ups.filter((u) => !keys.includes(u));
                for (const uid of removed) {
                  await removeBilibiliUp(uid);
                  box.ups = box.ups.filter((u) => u !== uid);
                  delete box.upInfo[uid];
                  notice(`已移除 UP 主 ${uid}`, 'success');
                }
                if (removed.length > 0) opts.onChanged();
              })();
            },
          },
        ],
      },
    ],
  };
}

/** UP 主显示名：后台回填名字则用之，否则回退 uid（ticket 126） */
function upDisplayName(uid: string, info?: BilibiliUpInfo): string {
  return info && info.name ? info.name : `UP ${uid}`;
}

/** Cookie 行描述（当前配置态联动；ticket 127 风控引导精简为自然句，32 字内过文案 lint） */
function cookieDesc(current: string): string {
  return `遇到风控时需粘贴登录后的 Cookie。当前${current ? '已配置' : '未配置'}`;
}

/** 添加动作：解析 UID 入库（去重），回填字盒并联动外部刷新 */
async function addUpUid(raw: string | undefined, box: UpManagerBox, opts: UpManagerSchemaOptions): Promise<void> {
  const input = String(raw || '').trim();
  if (!input) return;
  const uid = await resolveUidFromInput(input);
  if (!uid) {
    notice('无法识别 UID，请粘贴 space.bilibili.com 内的主页链接', 'error');
    return;
  }
  const added = await addBilibiliUp(uid);
  if (!added) {
    notice('该 UP 主已在名单中', 'info');
    return;
  }
  box.inputValue = '';
  box.ups = [...box.ups, uid];
  opts.onChanged();
  notice(`已添加 UP 主 ${uid}`, 'success');
}

/** Cookie 保存/清除动作：落盘 + 字盒同步 + 描述态由渲染器回填（onChanged 刷外部计数） */
async function saveCookie(value: string, box: UpManagerBox, opts: UpManagerSchemaOptions): Promise<void> {
  await writeBilibiliCookie(value);
  box.cookieInput = value;
  opts.onChanged();
  notice(value ? 'B 站 Cookie 已保存' : '已清除 B 站 Cookie，回自动引导', 'success');
}

/** 打开 UP 主名单管理弹窗：自建 overlay + 声明式内容（ticket 131；z 序与叠加行为零变化） */
function openUpManagerModal(opts: { ups: string[]; upInfo: Record<string, BilibiliUpInfo>; cookie: string; onChanged: () => void }): void {
  let handle: { unregister(): void } | null = null;
  function close(): void {
    mask.remove();
    popup.remove();
    if (handle) handle.unregister();
  }
  const { mask, popup } = createOverlay({
    maskId: 'bz-up-manager-mask',
    popupId: 'bz-up-manager-popup',
    maxWidth: 560, // ticket 170 方案 A：加宽让描述换行，文字不再拥挤
    onMaskClick: close,
  });

  const header = document.createElement('div');
  header.className = 'bz-settings-header';
  const title = document.createElement('h3');
  title.className = 'bz-settings-title';
  title.textContent = 'UP 主名单管理';
  header.appendChild(title);

  const content = document.createElement('div');
  content.className = 'bz-settings-content';

  // 声明式内容：渲染进自建 overlay（不换 openSettingsModal——单例会顶掉底层剪藏设置弹窗）
  renderSettingsInto(content, upManagerSettingsSchema(opts));

  popup.appendChild(header);
  popup.appendChild(content);
  document.body.appendChild(mask);
  document.body.appendChild(popup);
  mask.style.display = 'block';
  popup.style.display = 'flex';

  const handleReg = escManager.register('bz-up-manager', {
    isVisible: () => true,
    close,
  });
  handle = handleReg;
}
