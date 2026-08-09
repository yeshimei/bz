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

  const onKeydown = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    for (let i = layers.length - 1; i >= 0; i--) {
      const L = layers[i];
      try {
        if (L.isVisible()) {
          L.close();
          e.preventDefault();
          e.stopPropagation();
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
    /** 插件卸载时移除全局监听 */
    destroy() {
      if (typeof document !== 'undefined') {
        document.removeEventListener('keydown', onKeydown);
      }
    },
  };
})();
