/**
 * 剪藏本设置「数据源」组（ticket 124，ADR-0060；自旧 clipping 域迁入 clipbook，ADR-0086）：
 * news.json 存在 → 三源开关 + UP 主名单 + 保留天数 + 状态行；缺失 → 安装引导块。
 * UI 层（jsdom 可测）；数据操作走 ./news-source-settings。
 *
 * ticket 131（ADR-0064）声明式迁移：组壳（createSettingsGroup 卡片形态）由 schema 渲染器承担，
 * 本模块只负责组内内容（经 custom 插槽渲染进组体）。news.json 是外部数据（非 data.json），且
 * 状态读取为异步 + 段内联动（B 站开关关→UP 名单段隐藏、缺失引导、异步状态行）依赖 news.json
 * 键——渲染器 visibleWhen 的 snapshot 只覆盖 data.json 键，故整段保留 custom 插槽内部逻辑，
 * 仅刷新通道换用渲染器句柄（refreshVisibility 统一重求值 + 徽标回填）。
 */
import { Setting } from 'obsidian';
import { notice } from '../core/notice';
import { getSettings, saveSettings } from '../core/settings-provider';
import { numStrBinding } from '../core/settings-common';
import { createOverlay } from '../core/dom';
import { escManager } from '../core/esc-manager';
import { renderSettingsInto } from '../core/settings-schema';
import type { SettingsRowContext, SettingsSchema } from '../core/settings-schema';
import {
  readDataSourceState, writeSources, addBilibiliUp, removeBilibiliUp,
  writeBilibiliMaxItems, writeBilibiliCookie, type DataSourceState,
} from './news-source-settings';
import { resolveUidFromInput, type BilibiliUpInfo } from './news-data';

/**
 * 数据源组构建（custom 插槽内容）：检测 news.json → 两条路径；groupBody 为 schema 渲染器
 * 传入的包装容器（位于「数据源」分组卡体内）；refreshVisibility 为渲染器句柄（徽标回填等）。
 */
export function buildNewsSourcesGroup(groupBody: HTMLElement, refreshVisibility: () => void): void {
  // 异步读取状态后在组体内渲染（首帧仅显示加载行，回填后徽标刷新）
  const loading = new Setting(groupBody)
    .setName('数据源状态')
    .setDesc('读取中…');
  void readDataSourceState().then((state) => {
    loading.settingEl.remove();
    renderDataSourceGroup(groupBody, state, refreshVisibility);
  });
}

function renderDataSourceGroup(groupBody: HTMLElement, state: DataSourceState, refreshVisibility: () => void): void {
  if (!state.exists) {
    renderInstallGuide(groupBody);
    refreshVisibility();
    return;
  }
  renderSourceSwitches(groupBody, state.sources, refreshVisibility);
  renderUpSection(groupBody, state.bilibiliUps, state.bilibiliUpInfo, state.sources.bilibili, state.bilibiliMaxItems, state.bilibiliCookie, refreshVisibility);
  renderRetention(groupBody, refreshVisibility);
  refreshVisibility();
}

/** news.json 缺失 → 引导块（安装/启动 obsidian-news） */
function renderInstallGuide(groupBody: HTMLElement): void {
  const guide = new Setting(groupBody)
    .setName('尚未启用新闻数据源')
    .setDesc('聚合讯数据由外部「数据源守护」进程（obsidian-news）抓取入库。安装并启动后此处会显示数据源设置。');
  guide.addButton((btn) =>
    btn.setButtonText('复制安装命令').onClick(() => {
      const cmd = 'npm install -g @jwbz/obsidian-news && obsidian-news start';
      navigator.clipboard.writeText(cmd).then(
        () => notice('安装命令已复制', 'success'),
        () => notice('复制失败，请手动复制', 'error')
      );
    })
  );
}

/** 三源独立开关（写 news.json.sources；B 站开关联动 UP 名单段可见性——ticket 126） */
function renderSourceSwitches(groupBody: HTMLElement, sources: { zhihu: boolean; guokr: boolean; bilibili: boolean }, refreshVisibility: () => void): void {
  const items: Array<{ key: 'zhihu' | 'guokr' | 'bilibili'; name: string; desc: string }> = [
    { key: 'zhihu', name: '知乎日报', desc: '抓取知乎日报每日文章' },
    { key: 'guokr', name: '果壳科学人', desc: '抓取果壳科学人最新文章' },
    { key: 'bilibili', name: 'B站 UP 主', desc: '抓取名单内 UP 主的视频投稿' },
  ];
  for (const it of items) {
    new Setting(groupBody)
      .setName(it.name)
      .setDesc(it.desc)
      .addToggle((toggle) => {
        toggle.setValue(!!sources[it.key]).onChange(async (v) => {
          const next = { ...sources, [it.key]: v };
          await writeSources(next);
          if (it.key === 'bilibili') {
            // B 站开关联动 UP 名单段可见性：关闭时整个「UP 主名单」段隐藏（ticket 126）
            const section = groupBody.querySelector<HTMLElement>('[data-up-section]');
            if (section) section.style.display = v ? '' : 'none';
            refreshVisibility();
          }
          notice(`已${v ? '开启' : '关闭'}${it.name}`, 'success');
        });
      });
  }
}

/** UP 主显示名：后台回填名字则用之，否则回退 uid（ticket 126） */
function upDisplayName(uid: string, info?: BilibiliUpInfo): string {
  return info && info.name ? info.name : `UP ${uid}`;
}

/**
 * UP 主名单段（ticket 126）：组内只留「管理」按钮行 + 抓取条数行（ticket 127），添加/删除移入独立弹窗；
 * B 站源关闭时整段隐藏（与开关联动，不残留名单行）。
 */
function renderUpSection(groupBody: HTMLElement, ups: string[], upInfo: Record<string, BilibiliUpInfo>, bilibiliEnabled: boolean, maxItems: number, cookie: string, refreshVisibility: () => void): void {
  const section = document.createElement('div');
  section.dataset.upSection = '1';
  section.style.display = bilibiliEnabled ? '' : 'none';
  groupBody.appendChild(section);
  const build = () => {
    section.innerHTML = '';
    const row = new Setting(section)
      .setName('UP 主名单')
      .setDesc(ups.length > 0 ? `已跟踪 ${ups.length} 位` : '暂未跟踪 UP 主');
    row.addButton((btn) =>
      btn.setButtonText('管理').setCta().onClick(() => {
        openUpManagerModal({
          ups,
          upInfo,
          cookie,
          onChanged: async () => {
            // 增删/配置后重读盘（以磁盘为基底）重绘组内按钮行与徽标
            const fresh = await readDataSourceState();
            ups = fresh.bilibiliUps;
            upInfo = fresh.bilibiliUpInfo;
            cookie = fresh.bilibiliCookie;
            build();
            refreshVisibility();
          },
        });
      })
    );
    // ticket 127：每 UP 最近 N 条（不走 24h 窗口）
    new Setting(section)
      .setName('B站抓取条数')
      .setDesc('每位 UP 主抓取最近多少条动态（不走 24 小时窗口），默认 10，范围 1-50')
      .addText((text) =>
        text.setValue(String(maxItems)).onChange(async (v) => {
          await writeBilibiliMaxItems(v);
          notice('B 站抓取条数已保存', 'success');
        })
      );
  };
  build();
}

// ===== UP 主名单管理弹窗（ticket 126 + 127）=====
// 独立 overlay——层 10100（设置弹窗 10050 之上、共享确认 10250 之下）；
// ticket 131 声明式：内容经 renderSettingsInto 渲染进自建 overlay（bz-up-manager-mask/-popup id 与
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

/** 已跳过文章保留天数（ticket 170：与「已保存保留天数」同义去重；改为数字框，空值回退 7） */
function renderRetention(groupBody: HTMLElement, refreshVisibility: () => void): void {
  const binding = numStrBinding('newsRetentionSkippedDays', 7);
  new Setting(groupBody)
    .setName('已跳过文章保留天数')
    .setDesc('删除')
    .addText((text) =>
      text.setValue(String(binding.get())).onChange(async (v) => {
        const n = Number(v);
        if (Number.isFinite(n) && n > 0) binding.set(n);
        await saveSettings();
      })
    );
}