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
import { Setting } from 'obsidian';
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

/** UP 弹窗 schema 构建入参（lint 注册时以最小参数调用即可——custom 行无 name/desc） */
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
  /** 列表区重绘（renderUpList 登记；添加/移除后调用） */
  listRefresh: () => void;
}

/**
 * UP 主名单管理弹窗 schema（ticket 131 声明式；渲染进自建 overlay）：
 * 「添加 UP 主」「B 站 Cookie（可选）」为多控件复合行（文本+按钮、动态 desc），列表区为
 * 自定义列表 DOM——declarative 十类行均无法等价表达（渲染器缺口，custom 插槽兜底），
 * 故三行全部走 custom 插槽；组壳（分组卡片）由 schema 声明。
 */
export function upManagerSettingsSchema(opts: UpManagerSchemaOptions): SettingsSchema {
  const box: UpManagerBox = {
    inputValue: '',
    cookieInput: String(opts.cookie || ''),
    ups: [...opts.ups],
    upInfo: { ...opts.upInfo },
    listRefresh: () => {},
  };
  return {
    groups: [
      {
        icon: 'users',
        name: 'UP 主名单',
        rows: [
          { type: 'custom', render: (body) => renderAddUpRow(body, box, opts.onChanged) },
          { type: 'custom', render: (body) => renderCookieRow(body, box, opts.onChanged) },
          { type: 'custom', render: (body, ctx) => renderUpList(body, box, opts.onChanged, ctx) },
        ],
      },
    ],
  };
}

/** UP 主显示名：后台回填名字则用之，否则回退 uid（ticket 126） */
function upDisplayName(uid: string, info?: BilibiliUpInfo): string {
  return info && info.name ? info.name : `UP ${uid}`;
}

/** 顶部添加行：文本输入（粘贴链接/UID）+ 添加按钮（解析入库） */
function renderAddUpRow(body: HTMLElement, box: UpManagerBox, onChanged: () => void): void {
  new Setting(body)
    .setName('添加 UP 主')
    .setDesc('粘贴主页链接（space.bilibili.com/123456）或视频链接自动解析 UID')
    .addText((text) => {
      text.setPlaceholder('粘贴链接或 UID');
      text.onChange((v) => { box.inputValue = v; });
    })
    .addButton((btn) =>
      btn.setButtonText('添加').setCta().onClick(() => {
        void (async () => {
          const raw = (box.inputValue || '').trim();
          if (!raw) return;
          const uid = await resolveUidFromInput(raw);
          if (!uid) {
            notice('无法识别 UID，请粘贴 space.bilibili.com/<uid> 主页链接', 'error');
            return;
          }
          const added = await addBilibiliUp(uid);
          if (!added) {
            notice('该 UP 主已在名单中', 'info');
            return;
          }
          box.inputValue = '';
          box.ups.push(uid);
          box.listRefresh();
          onChanged();
          notice(`已添加 UP 主 ${uid}`, 'success');
        })();
      })
    );
}

/** B 站 Cookie 配置区（ticket 127）：接口 412/-352 风控引导，保存/清除落盘，desc 随状态联动 */
function renderCookieRow(body: HTMLElement, box: UpManagerBox, onChanged: () => void): void {
  const cookieDesc = () =>
    `接口返回 412/-352（风控）时需要「登录后」的 Cookie：浏览器登录并打开 bilibili.com → F12 → Cookie → 复制含 SESSDATA 的整段粘贴（当前${box.cookieInput ? '已配置' : '未配置，走自动引导'}）`;
  const row = new Setting(body)
    .setName('B 站 Cookie（可选）')
    .setDesc(cookieDesc());
  row.addText((text) => {
    text.setPlaceholder('粘贴 buvid3/SESSDATA 等 Cookie');
    text.setValue(box.cookieInput);
    text.onChange((v) => { box.cookieInput = v; });
  });
  row.addButton((btn) =>
    btn.setButtonText('保存').onClick(() => {
      void (async () => {
        await writeBilibiliCookie(box.cookieInput);
        row.setDesc(cookieDesc());
        onChanged();
        notice('B 站 Cookie 已保存', 'success');
      })();
    })
  );
  row.addButton((btn) =>
    btn.setButtonText('清除').onClick(() => {
      void (async () => {
        await writeBilibiliCookie('');
        box.cookieInput = '';
        row.setDesc(cookieDesc());
        onChanged();
        notice('已清除 B 站 Cookie（回自动引导）', 'success');
      })();
    })
  );
}

/** 名单列表区：空态 / 行（头像 + 名字 + uid + 移除）；移除走 news.json 写回 + 组内概要刷新 */
function renderUpList(body: HTMLElement, box: UpManagerBox, onChanged: () => void, ctx: SettingsRowContext): void {
  const listEl = document.createElement('div');
  listEl.dataset.upManagerList = '1';
  body.appendChild(listEl);
  const refresh = () => {
    listEl.innerHTML = '';
    if (box.ups.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'bz-up-manager-empty';
      empty.textContent = '暂无跟踪 UP 主，在上方粘贴主页链接或视频链接添加';
      listEl.appendChild(empty);
      return;
    }
    for (const uid of box.ups) {
      const info = box.upInfo[uid];
      const row = document.createElement('div');
      row.className = 'bz-up-manager-row';
      row.dataset.upRow = '1';
      if (info && info.avatar) {
        const img = document.createElement('img');
        img.className = 'bz-up-manager-avatar';
        img.src = info.avatar;
        img.alt = '';
        img.onerror = () => img.remove(); // 头像加载失败不占位
        row.appendChild(img);
      }
      const text = document.createElement('div');
      text.className = 'bz-up-manager-text';
      const name = document.createElement('div');
      name.className = 'bz-up-manager-name';
      name.textContent = upDisplayName(uid, info);
      const uidEl = document.createElement('div');
      uidEl.className = 'bz-up-manager-uid';
      uidEl.textContent = `UID ${uid}`;
      text.appendChild(name);
      text.appendChild(uidEl);
      row.appendChild(text);
      const del = document.createElement('button');
      del.className = 'bz-up-manager-remove';
      del.textContent = '移除';
      del.onclick = () => {
        void (async () => {
          await removeBilibiliUp(uid);
          box.ups = box.ups.filter((u) => u !== uid);
          delete box.upInfo[uid];
          refresh();
          onChanged();
          ctx.refreshVisibility();
          notice(`已移除 UP 主 ${uid}`, 'success');
        })();
      };
      row.appendChild(del);
      listEl.appendChild(row);
    }
  };
  box.listRefresh = refresh;
  refresh();
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
