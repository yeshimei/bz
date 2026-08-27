/**
 * 剪藏本设置「数据源」组（ticket 124，ADR-0060）：
 * news.json 存在 → 三源开关 + UP 主名单 + 保留天数 + 状态行；缺失 → 安装引导块。
 * UI 层（jsdom 可测）；数据操作走 ../news/source-settings。
 */
import { Setting } from 'obsidian';
import { notice } from '../core/notice';
import { getSettings, saveSettings } from '../core/settings-provider';
import { refreshSettingsGroupCounts } from '../core/settings-modal';
import { createOverlay } from '../core/dom';
import { escManager } from '../core/esc-manager';
import {
  readDataSourceState, writeSources, addBilibiliUp, removeBilibiliUp,
  writeBilibiliMaxItems, writeBilibiliCookie, type DataSourceState,
} from '../news/source-settings';
import { resolveUidFromInput, type BilibiliUpInfo } from '../news/data';

/** 数据源组构建：检测 news.json → 两条路径；groupBody 为 buildNewsSourcesGroup 挂载容器 */
export function buildNewsSourcesGroup(el: HTMLElement, groupBody: HTMLElement): void {
  // 异步读取状态后在组体内渲染（首帧仅显示加载行，回填后徽标刷新）
  const loading = new Setting(groupBody)
    .setName('数据源状态')
    .setDesc('读取中…');
  void readDataSourceState().then((state) => {
    loading.settingEl.remove();
    renderDataSourceGroup(groupBody, state, () => refreshSettingsGroupCounts(el));
  });
}

function renderDataSourceGroup(groupBody: HTMLElement, state: DataSourceState, refreshCounts: () => void): void {
  if (!state.exists) {
    renderInstallGuide(groupBody);
    refreshCounts();
    return;
  }
  renderSourceSwitches(groupBody, state.sources, refreshCounts);
  renderUpSection(groupBody, state.bilibiliUps, state.bilibiliUpInfo, state.sources.bilibili, state.bilibiliMaxItems, state.bilibiliCookie, refreshCounts);
  renderRetention(groupBody, refreshCounts);
  renderStatusRow(groupBody, state);
  refreshCounts();
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

/** 三源独立开关（写 news.json.sources） */
function renderSourceSwitches(groupBody: HTMLElement, sources: { zhihu: boolean; guokr: boolean; bilibili: boolean }, refreshCounts: () => void): void {
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
            refreshCounts();
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

/** 名单概要（「管理」按钮行 desc）：已跟踪 N 位 + 名字预览（有资料用名字，否则 uid） */
function buildUpSummary(ups: string[], upInfo: Record<string, BilibiliUpInfo>): string {
  if (ups.length === 0) return '暂无跟踪 UP 主，点击「管理」粘贴主页链接或视频链接添加';
  const names = ups.map((uid) => upDisplayName(uid, upInfo[uid]));
  const preview = names.length > 3 ? `${names.slice(0, 3).join('、')} 等 ${names.length} 位` : names.join('、');
  return `已跟踪 ${ups.length} 位：${preview}。点击「管理」添加/删除`;
}

/**
 * UP 主名单段（ticket 126）：组内只留「管理」按钮行 + 抓取条数行（ticket 127），添加/删除移入独立弹窗；
 * B 站源关闭时整段隐藏（与开关联动，不残留名单行）。
 */
function renderUpSection(groupBody: HTMLElement, ups: string[], upInfo: Record<string, BilibiliUpInfo>, bilibiliEnabled: boolean, maxItems: number, cookie: string, refreshCounts: () => void): void {
  const section = document.createElement('div');
  section.dataset.upSection = '1';
  section.style.display = bilibiliEnabled ? '' : 'none';
  groupBody.appendChild(section);
  const build = () => {
    section.innerHTML = '';
    const row = new Setting(section)
      .setName('UP 主名单')
      .setDesc(buildUpSummary(ups, upInfo));
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
            refreshCounts();
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

/** UP 主名单管理弹窗（ticket 126 + 127）：独立 overlay——层 10100（设置弹窗 10050 之上、共享确认 10250 之下）；
 *  顶部添加行 + 列表（头像/名字回填展示 + uid + 移除）+ B 站 Cookie 配置区（风控 412 引导） */
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
    zIndex: 10100,
    maxWidth: 460,
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

  let inputValue = '';
  let currentUps = [...opts.ups];
  let currentInfo = { ...opts.upInfo };

  /** 列表重绘：空态 / 行（头像 + 名字 + uid + 移除） */
  const refresh = () => {
    listEl.innerHTML = '';
    if (currentUps.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'bz-up-manager-empty';
      empty.textContent = '暂无跟踪 UP 主，在上方粘贴主页链接或视频链接添加';
      listEl.appendChild(empty);
      return;
    }
    for (const uid of currentUps) {
      const info = currentInfo[uid];
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
          currentUps = currentUps.filter((u) => u !== uid);
          delete currentInfo[uid];
          refresh();
          opts.onChanged();
          notice(`已移除 UP 主 ${uid}`, 'success');
        })();
      };
      row.appendChild(del);
      listEl.appendChild(row);
    }
  };

  const listEl = document.createElement('div');
  listEl.dataset.upManagerList = '1';

  new Setting(content)
    .setName('添加 UP 主')
    .setDesc('粘贴主页链接（space.bilibili.com/123456）或视频链接自动解析 UID')
    .addText((text) => {
      text.setPlaceholder('粘贴链接或 UID');
      text.onChange((v) => { inputValue = v; });
    })
    .addButton((btn) =>
      btn.setButtonText('添加').setCta().onClick(() => {
        void (async () => {
          const raw = (inputValue || '').trim();
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
          inputValue = '';
          currentUps.push(uid);
          refresh();
          opts.onChanged();
          notice(`已添加 UP 主 ${uid}`, 'success');
        })();
      })
    );

  // ticket 127：B 站 Cookie 配置（接口 412/-352 风控时使用；空=清除走自动引导）
  let cookieInput = String(opts.cookie || '');
  const cookieDesc = () =>
    `接口返回 412/-352（风控）时需要「登录后」的 Cookie：浏览器登录并打开 bilibili.com → F12 → Cookie → 复制含 SESSDATA 的整段粘贴（当前${cookieInput ? '已配置' : '未配置，走自动引导'}）`;
  const cookieRow = new Setting(content)
    .setName('B 站 Cookie（可选）')
    .setDesc(cookieDesc())
    .addText((text) => {
      text.setPlaceholder('粘贴 buvid3/SESSDATA 等 Cookie');
      text.setValue(cookieInput);
      text.onChange((v) => { cookieInput = v; });
    });
  cookieRow.addButton((btn) =>
    btn.setButtonText('保存').onClick(() => {
      void (async () => {
        await writeBilibiliCookie(cookieInput);
        cookieRow.setDesc(cookieDesc());
        opts.onChanged();
        notice('B 站 Cookie 已保存', 'success');
      })();
    })
  );
  cookieRow.addButton((btn) =>
    btn.setButtonText('清除').onClick(() => {
      void (async () => {
        await writeBilibiliCookie('');
        cookieInput = '';
        cookieRow.setDesc(cookieDesc());
        opts.onChanged();
        notice('已清除 B 站 Cookie（回自动引导）', 'success');
      })();
    })
  );

  content.appendChild(listEl);
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

  refresh();
}

/** 保留天数（已保存 3 天 / 已跳过 7 天，设置可调） */
function renderRetention(groupBody: HTMLElement, refreshCounts: () => void): void {
  const s = getSettings();
  new Setting(groupBody)
    .setName('已保存文章保留天数')
    .setDesc('已保存至剪藏（正文已清空）的骨架条目超过此时长删除；未读永不清理')
    .addText((text) =>
      text.setValue(s.newsRetentionSavedDays || '3').onChange(async (v) => {
        s.newsRetentionSavedDays = v;
        await saveSettings();
      })
    );
  new Setting(groupBody)
    .setName('已跳过文章保留天数')
    .setDesc('已跳过（正文已清空）的骨架条目超过此时长删除')
    .addText((text) =>
      text.setValue(s.newsRetentionSkippedDays || '7').onChange(async (v) => {
        s.newsRetentionSkippedDays = v;
        await saveSettings();
      })
    );
}

/** 只读状态行：最近抓取时间 / UP 主数量 */
function renderStatusRow(groupBody: HTMLElement, state: DataSourceState): void {
  const upsCount = state.bilibiliUps.length;
  const lastTime = state.lastFetchAt ? new Date(state.lastFetchAt.replace(' ', 'T')).toLocaleString() : '暂无抓取记录';
  new Setting(groupBody)
    .setName('抓取状态')
    .setDesc(`最近抓取：${lastTime}；已跟踪 ${upsCount} 位 UP 主；共 ${state.totalArticles} 篇`)
    .addButton((btn) =>
      btn.setButtonText('刷新').onClick(async () => {
        const fresh = await readDataSourceState();
        btn.setDisabled(true);
        btn.setButtonText('刷新中…');
        notice(
          fresh.lastFetchAt
            ? `最近抓取：${new Date(fresh.lastFetchAt.replace(' ', 'T')).toLocaleString()}（${fresh.bilibiliUps.length} 位 UP 主）`
            : '暂无抓取记录',
          'info'
        );
        btn.setDisabled(false);
        btn.setButtonText('刷新');
      })
    );
}