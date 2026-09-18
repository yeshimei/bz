/**
 * ESC 全局层级管理器
 * 原实现来自 QuickAdd 环境的 Q3.js（window.__utils.escManager）。
 * 独立插件版：注册多个层级，ESC 按下时从最上层开始找可见的关闭。
 * 未来迁移其他脚本（收藏本/影视等）时可复用此模块。
 */
export interface EscLayer {
  isVisible: () => boolean;
  close: () => void;
}

export interface EscHandle {
  unregister: () => void;
}

export const escManager = (() => {
  const layers: (EscLayer & { id: string })[] = [];
  /** 软关旗标（N1）：destroy() 置位、arm() 复位——keydown 首行判旗直返。
   *  Obsidian 禁用→再启用不会重新求值模块（IIFE 单例常驻），摘监听/清层都不可逆，
   *  软关后 layers 保留（重启用后 isVisible 判活自愈），ESC 处理可随 arm() 恢复。 */
  let disabled = false;

  const onKeydown = (e: KeyboardEvent) => {
    if (disabled) return;
    if (e.key !== 'Escape') return;
    for (let i = layers.length - 1; i >= 0; i--) {
      const L = layers[i];
      try {
        if (L.isVisible()) {
          L.close();
          e.preventDefault();
          // stopImmediatePropagation（非仅 stopPropagation）：命中可见层处理后，
          // 同 document 节点上其余 keydown 监听（含后注册的私挂监听）不得再响应
          // 同一次 ESC，杜绝「一层 ESC、两层同关」的双触发。
          // 立约：禁止在域内私挂 document 级 ESC 监听，一律走 escManager 注册层级。
          e.stopImmediatePropagation();
          return;
        }
      } catch (err) {
        layers.splice(i, 1);
      }
    }
  };

  // 环境守卫：node 环境下（数据层测试）不注册 DOM 监听，Obsidian 运行时 document 恒存在
  if (typeof document !== 'undefined') {
    document.addEventListener('keydown', onKeydown);
  }

  return {
    register(id: string, layer: EscLayer): EscHandle {
      for (let i = layers.length - 1; i >= 0; i--) {
        if (layers[i].id === id && !layers[i].isVisible()) layers.splice(i, 1);
      }
      const rec = Object.assign({ id }, layer);
      layers.push(rec);
      return {
        unregister: () => {
          const i = layers.indexOf(rec);
          if (i !== -1) layers.splice(i, 1);
        },
      };
    },
    /** 插件卸载时软关（N1）：只置 disabled 旗标——不摘 document 监听（模块 IIFE
     *  常驻单例，Obsidian 禁用→再启用不重新求值，摘了就全站 ESC 永久失效）、
     *  不清 layers（重启用后旧层由 isVisible 判活自愈）。恢复走 arm()。 */
    destroy() {
      disabled = true;
    },
    /** 插件（重）启用时恢复 ESC 处理（main.ts onload 调用；幂等） */
    arm() {
      disabled = false;
    },
  };
})();

/** ==================== 面板 ESC 幂等注册样板收口 ====================
 * 各域面板的「registered 旗标 + handle 保存 + register/unregister」样板统一走这里：
 *  - registerPanelEsc：同 id 已注册时静默跳过（幂等），层常驻由 isVisible 判活；
 *  - unregisterPanelEsc：注销并清缓存（未注册时静默）。
 * 层 id 约定沿用域内 'bz-<域>'。 */
const panelEscHandles = new Map<string, EscHandle>();

export function registerPanelEsc(id: string, isVisible: () => boolean, close: () => void): void {
  if (panelEscHandles.has(id)) return;
  panelEscHandles.set(id, escManager.register(id, { isVisible, close }));
}

export function unregisterPanelEsc(id: string): void {
  panelEscHandles.get(id)?.unregister();
  panelEscHandles.delete(id);
}
