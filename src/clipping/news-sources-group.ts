/**
 * 剪藏本设置「数据源」组（ticket 124，ADR-0060）：
 * news.json 存在 → 三源开关 + UP 主名单 + 保留天数 + 状态行；缺失 → 安装引导块。
 * UI 层（jsdom 可测）；数据操作走 ../news/source-settings。
 */
import { Setting } from 'obsidian';
import { notice } from '../core/notice';
import { getSettings, saveSettings } from '../core/settings-provider';
import { refreshSettingsGroupCounts } from '../core/settings-modal';
import {
  readDataSourceState, writeSources, addBilibiliUp, removeBilibiliUp, type DataSourceState,
} from '../news/source-settings';
import { resolveUidFromInput } from '../news/data';

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
  renderUpList(groupBody, state.bilibiliUps, refreshCounts);
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
    { key: 'bilibili', name: 'B站 UP 主', desc: '抓取下方名单内 UP 主的视频投稿' },
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
            // B 站开关联动 UP 名单可见性（关闭时隐藏名单行）
            const rows = groupBody.querySelectorAll<HTMLElement>('[data-up-row]');
            rows.forEach((r) => { r.style.display = v ? '' : 'none'; });
            refreshCounts();
          }
          notice(`已${v ? '开启' : '关闭'}${it.name}`, 'success');
        });
      });
  }
}

/** UP 主名单：现有列表 + 粘贴链接/UID 添加（闭包捕获输入值，不依赖 DOM 查询） */
function renderUpList(groupBody: HTMLElement, ups: string[], refreshCounts: () => void): void {
  let inputValue = '';
  const head = new Setting(groupBody)
    .setName('UP 主名单')
    .setDesc('粘贴主页链接（space.bilibili.com/123456）或视频链接自动解析 UID');
  head.addText((text) => {
    text.setPlaceholder('粘贴链接或 UID');
    text.onChange((v) => { inputValue = v; });
  });
  head.addButton((btn) =>
    btn.setButtonText('添加').setCta().onClick(async () => {
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
      notice(`已添加 UP 主 ${uid}`, 'success');
      // 重新渲染名单区（移除旧列表行后重建）
      groupBody.querySelectorAll('[data-up-row]').forEach((r) => r.remove());
      groupBody.querySelector('[data-up-list-head]')?.remove();
      renderUpRows(groupBody, [...ups, uid], refreshCounts);
      refreshCounts();
    })
  );
  // 列表头占位（供追加行时替换）
  renderUpRows(groupBody, ups, refreshCounts);
}

function renderUpRows(groupBody: HTMLElement, ups: string[], refreshCounts: () => void): void {
  if (ups.length === 0) return;
  const listHead = document.createElement('div');
  listHead.dataset.upListHead = '1';
  groupBody.appendChild(listHead);
  for (const uid of ups) {
    const row = new Setting(listHead);
    row.setName(`UP ${uid}`);
    row.setDesc(`https://space.bilibili.com/${uid}`);
    row.addExtraButton((b) => {
      b.setIcon('trash').setTooltip('移除');
      b.onClick(async () => {
        await removeBilibiliUp(uid);
        row.settingEl.remove();
        if (groupBody.querySelectorAll('[data-up-row]').length === 0) {
          groupBody.querySelector('[data-up-list-head]')?.remove();
        }
        refreshCounts();
        notice(`已移除 UP 主 ${uid}`, 'success');
      });
    });
    row.settingEl.dataset.upRow = '1';
  }
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