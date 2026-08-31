/**
 * 设置页「获取模型名」选择器弹窗（ticket 173）：点击拉取当前服务商模型列表，弹列表选择器，
 * 选中回填模型名。局部实现（Q8 拍板）：不并入 settings-modal.ts——语义不同（非域设置弹窗），
 * 复用 createOverlay 遮罩 + escManager（id bz-model-picker）。
 * 单例：同一时刻至多一个；重复调用先关旧窗。
 */
import { createOverlay } from './dom';
import { escManager } from './esc-manager';
import type { ModelOption } from './ai-models';

export interface ModelPickerOptions {
  /** 服务商 label（弹窗标题/来源展示） */
  providerLabel: string;
  /** 当前生效模型（置顶展示 + 选中态） */
  current: string;
  /** 模型选项列表 */
  models: ModelOption[];
  /** 选中回调（返回 Promise 可选；选择器关闭在 resolve 后） */
  onPick: (model: ModelOption) => void | Promise<void>;
  /** 关闭回调（遮罩/Esc/未选中关闭） */
  onClose?: () => void;
}

let currentPicker: { mask: HTMLElement; popup: HTMLElement; dispose: () => void; onClose?: () => void } | null = null;

/** 关闭当前模型选择器（无则静默）；触发 onClose（至多一次） */
export function closeModelPicker(): void {
  if (currentPicker) {
    const p = currentPicker;
    currentPicker = null;
    p.dispose();
    p.onClose?.();
  }
}

/** 打开模型选择器（幂等：已开先关） */
export function openModelPicker(opts: ModelPickerOptions): void {
  closeModelPicker();
  const prevActive = document.activeElement;

  const { mask, popup } = createOverlay({
    maskId: 'bz-model-picker-mask',
    popupId: 'bz-model-picker-popup',
    onMaskClick: () => closeModelPicker(),
  });

  const header = document.createElement('div');
  header.className = 'bz-settings-header';
  const title = document.createElement('h3');
  title.className = 'bz-settings-title';
  title.textContent = `选择模型（${opts.providerLabel}）`;
  header.appendChild(title);

  const content = document.createElement('div');
  content.className = 'bz-settings-content';

  // 当前生效模型说明行（info 行语义：名称 + 描述，非可选）
  const currentInfo = document.createElement('div');
  currentInfo.className = 'setting-item';
  const curName = document.createElement('div');
  curName.className = 'setting-item-name';
  curName.textContent = '当前模型';
  const curDesc = document.createElement('div');
  curDesc.className = 'setting-item-description';
  curDesc.textContent = opts.current || '未设置（使用服务商默认）';
  currentInfo.append(curName, curDesc);
  content.appendChild(currentInfo);

  // 模型列表区：点击行即选中
  const listWrap = document.createElement('div');
  listWrap.className = 'bz-model-picker-list';
  const cur = opts.current;
  if (opts.models.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'bz-settings-empty';
    empty.textContent = '该服务商未返回可用模型';
    listWrap.appendChild(empty);
  } else {
    // 当前生效值置顶展示，其余按服务商返回顺序
    const ordered = [...opts.models].sort((a, b) => {
      const ac = a.id === cur ? 0 : 1;
      const bc = b.id === cur ? 0 : 1;
      return ac - bc;
    });
    for (const m of ordered) {
      const row = document.createElement('div');
      row.className = 'bz-model-picker-row' + (m.id === cur ? ' is-current' : '');
      const name = document.createElement('span');
      name.className = 'bz-model-picker-name';
      name.textContent = m.id;
      const detail = document.createElement('span');
      detail.className = 'bz-model-picker-detail';
      detail.textContent = m.detail || '';
      row.append(name, detail);
      row.onclick = () => {
        void Promise.resolve(opts.onPick(m)).then(() => closeModelPicker());
      };
      listWrap.appendChild(row);
    }
  }
  content.appendChild(listWrap);

  popup.appendChild(header);
  popup.appendChild(content);
  document.body.appendChild(mask);
  document.body.appendChild(popup);
  mask.style.display = 'block';
  popup.style.display = 'flex';
  popup.setAttribute('role', 'dialog');
  popup.setAttribute('aria-modal', 'true');

  const handle = escManager.register('bz-model-picker', {
    isVisible: () => !!currentPicker,
    close: () => closeModelPicker(),
  });
  currentPicker = {
    mask,
    popup,
    onClose: opts.onClose,
    dispose: () => {
      mask.remove();
      popup.remove();
      handle.unregister();
      if (prevActive && prevActive instanceof HTMLElement && prevActive.isConnected) {
        prevActive.focus();
      }
    },
  };
}
