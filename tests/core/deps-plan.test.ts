/**
 * core/deps-plan：清单数据 + 勾选态 + 提示词。
 *
 * 这个模块的产品承诺只有一句：**用户勾了什么，提示词里就只写什么，且写进去的东西
 * 一定装在系统位置上**。所以这里测的是「哪些项会进提示词、进的时候说了什么」，
 * 不去测渲染（那是 deps-guide 的事，DOM 归集成测试）。
 */
import { describe, it, expect } from 'vitest';
import {
  PLAN_GROUPS,
  PLAN_ITEMS,
  backfillFields,
  buildPlanPrompt,
  dataFilePath,
  defaultPicked,
  formatSize,
  summarize,
  toggleRadio,
} from '../../src/core/deps-plan';

const CTX = {
  pluginDir: 'E:/vault/.obsidian/plugins/bz',
  vaultDir: 'E:/vault',
};

/** 只勾这几项（绕过默认值，好测单条路径） */
function only(...ids: string[]): Set<string> {
  return new Set(ids);
}

function prompt(picked: Set<string>): string {
  return buildPlanPrompt(picked, CTX);
}

describe('清单数据', () => {
  it('每一项的 group 都在 PLAN_GROUPS 里，否则渲染会静默丢行', () => {
    for (const item of PLAN_ITEMS) {
      expect(PLAN_GROUPS).toContain(item.group);
    }
  });

  it('分组非空，且每个分组至少有一项', () => {
    expect(PLAN_GROUPS.length).toBeGreaterThan(0);
    for (const g of PLAN_GROUPS) {
      expect(PLAN_ITEMS.some((i) => i.group === g)).toBe(true);
    }
  });

  it('id 唯一', () => {
    const ids = PLAN_ITEMS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('同一 radio 组最多一个默认项——否则打开弹窗就是自相矛盾的选中态', () => {
    const byRadio = new Map<string, number>();
    for (const item of PLAN_ITEMS) {
      if (!item.radio || !item.pickedByDefault) continue;
      byRadio.set(item.radio, (byRadio.get(item.radio) || 0) + 1);
    }
    for (const [, n] of byRadio) expect(n).toBe(1);
  });

  it('必装项排在最前面（同一分组内 required 先于可选）', () => {
    for (const g of PLAN_GROUPS) {
      const items = PLAN_ITEMS.filter((i) => i.group === g);
      const firstOptional = items.findIndex((i) => !i.required);
      if (firstOptional < 0) continue;
      const requiredAfter = items.slice(firstOptional).filter((i) => i.required);
      expect(requiredAfter).toHaveLength(0);
    }
  });
});

describe('默认勾选', () => {
  it('必装项与单选默认项都在里面', () => {
    const picked = defaultPicked();
    for (const item of PLAN_ITEMS) {
      if (item.required || item.pickedByDefault) expect(picked.has(item.id)).toBe(true);
    }
  });

  it('没标 required / pickedByDefault 的一项都不勾', () => {
    const picked = defaultPicked();
    for (const item of PLAN_ITEMS) {
      if (!item.required && !item.pickedByDefault) expect(picked.has(item.id)).toBe(false);
    }
  });

  it('默认值就是原型里那句「8 项 · 3.2 GB」', () => {
    const { count, mb } = summarize(defaultPicked());
    expect(count).toBe(8);
    expect(formatSize(mb)).toBe('3.2 GB');
  });
});

describe('组内单选', () => {
  it('切到另一个嵌入模型，旧的自动退出', () => {
    const next = toggleRadio(defaultPicked(), 'embed:qwen3-embedding:8b');
    expect(next.has('embed:qwen3-embedding:8b')).toBe(true);
    expect(next.has('embed:bge-m3')).toBe(false);
  });

  it('不影响别的单选组（换嵌入不会把重排/转写的选择清掉）', () => {
    const next = toggleRadio(defaultPicked(), 'embed:qwen3-embedding:8b');
    expect(next.has('asr:sensevoice')).toBe(true);
    expect(next.has('rerank:')).toBe(true);
  });

  it('不在任何单选组里的 id 原样返回副本（不改入参）', () => {
    const before = only('node');
    const next = toggleRadio(before, 'node');
    expect(next).not.toBe(before);
    expect([...next]).toEqual(['node']);
    expect([...before]).toEqual(['node']);
  });
});

describe('汇总', () => {
  it('体积为 0 的项不计入项数与体积（「不安装重排」什么都没下载）', () => {
    const withNone = summarize(only('node', 'rerank:'));
    expect(withNone.count).toBe(1);
    expect(withNone.mb).toBe(100);
  });

  it('MB / GB 的换算与取舍', () => {
    expect(formatSize(0)).toBe('0 MB');
    expect(formatSize(480)).toBe('480 MB');
    expect(formatSize(1024)).toBe('1 GB'); // 整数不拖 .0
    expect(formatSize(2528)).toBe('2.5 GB');
  });
});

describe('提示词', () => {
  it('开头把「别装进仓库和插件目录」说死，两个路径都点到', () => {
    const text = prompt(defaultPicked());
    expect(text).toContain('E:\\vault');
    expect(text).toContain('E:\\vault\\.obsidian\\plugins\\bz');
    expect(text).toMatch(/不要装进/);
  });

  it('没勾的项一句都不出现', () => {
    const text = prompt(only('node'));
    expect(text).toContain('Node.js');
    expect(text).not.toContain('Python 3.12');
    expect(text).not.toContain('ollama pull');
    expect(text).not.toContain('ffmpeg');
  });

  it('值守是固定步骤：什么都没勾也还在，且排在最后一个', () => {
    const text = prompt(only());
    expect(text).toContain('工具坞值守');
    const steps = text.split('\n').filter((l) => /^\d+\. /.test(l));
    expect(steps).toHaveLength(1);
    expect(steps[0]).toContain('工具坞值守');
  });

  it('值守脚本用本机绝对路径，-Node 要占位而不是瞎填', () => {
    const text = prompt(only());
    expect(text).toContain('E:\\vault\\.obsidian\\plugins\\bz\\downloads\\tools\\dock-watch\\install.ps1');
    expect(text).toContain('-Vault "E:\\vault"');
    expect(text).toMatch(/-Node "<[^"]+>"/);
  });

  it('嵌入 + 重排不匹配时要出警告（否则装了也不生效，用户查不出来）', () => {
    const text = prompt(only('embed:bge-m3', 'rerank:dengcao/Qwen3-Reranker-4B:Q4_K_M'));
    expect(text).toContain('qwen3-embedding:8b');
    expect(text).toContain('不会生效');
  });

  it('嵌入是 8b 时不出那条警告', () => {
    const text = prompt(only('embed:qwen3-embedding:8b', 'rerank:dengcao/Qwen3-Reranker-4B:Q4_K_M'));
    expect(text).not.toContain('不会生效');
  });

  it('选了「不安装重排」就不出现任何 pull 重排的命令', () => {
    const text = prompt(only('embed:bge-m3', 'rerank:'));
    expect(text).not.toContain('Qwen3-Reranker');
    expect(text).not.toContain('不会生效');
  });

  it('pip 一律带 --no-cache-dir 与 py -3.12（不落 C 盘缓存、不撞应用商店占位符）', () => {
    const text = prompt(defaultPicked());
    const pips = text.split('\n').filter((l) => l.includes('pip install'));
    expect(pips.length).toBeGreaterThan(0);
    for (const line of pips) {
      expect(line).toContain('py -3.12');
      expect(line).toContain('--no-cache-dir');
    }
  });

  it('torch 带 CPU 源；不带的话会拉 CUDA 版（2.5 GB 起）', () => {
    const text = prompt(only('asr:sensevoice'));
    expect(text).toContain('https://download.pytorch.org/whl/cpu');
  });

  it('转写是二选一：选了 whisper 就不出现 funasr', () => {
    const text = prompt(only('asr:whisper'));
    expect(text).toContain('faster-whisper');
    expect(text).not.toContain('funasr');
  });

  it('ffmpeg 装系统位置，不写插件目录下的落点', () => {
    const text = prompt(only('ffmpeg', 'ffprobe'));
    expect(text).toContain('winget');
    expect(text).toContain('PATH');
    // 早前版本把 ffmpeg 塞进 downloads\tools\ffmpeg\，这一版不再这样
    expect(text).not.toContain('downloads\\tools\\ffmpeg');
  });

  it('Ollama 的模型目录明确要求离开 C 盘和仓库目录', () => {
    const text = prompt(only('ollama'));
    expect(text).toContain('OLLAMA_MODELS');
    expect(text).toContain('别放 C 盘');
  });

  it('编号连续、每步之间空行——粘到对话框里不会被挤成一坨', () => {
    const text = prompt(defaultPicked());
    const steps = text.split('\n').filter((l) => /^\d+\. /.test(l));
    expect(steps.map((l) => Number(l.split('.')[0]))).toEqual(steps.map((_, i) => i + 1));
    expect(text).toContain('\n\n');
  });

  it('最后一步是让 AI 自己改插件设置文件，而不是给用户一张表', () => {
    const text = prompt(defaultPicked());
    // 文件名与键名都点到：不然 AI 只知道「要回填」，不知道回填到哪
    expect(text).toContain('E:\\vault\\.obsidian\\plugins\\bz\\data.json');
    expect(text).toContain('pythonPath');
    expect(text).toMatch(/别把这件事交回给我/);
    // 改文件的三条前提（备份 / 合法 JSON / 自己重启）一个都不能少
    expect(text).toContain('data.json.bak');
    expect(text).toMatch(/由你重启 Obsidian/);
    expect(text).toMatch(/合法 JSON/);
    // 结尾不把活推回用户
    expect(text).not.toMatch(/请你自己去设置里填/);
    expect(text).toMatch(/流程到这里结束/);
  });
});

describe('回填字段', () => {
  it('数据文件按插件目录算，不写死 bz（插件目录名是用户定的）', () => {
    expect(dataFilePath({ pluginDir: 'E:/vault/.obsidian/plugins/包仔', vaultDir: 'E:/vault' })).toBe(
      'E:\\vault\\.obsidian\\plugins\\包仔\\data.json',
    );
    // 末尾斜杠不该叠成两个
    expect(dataFilePath({ pluginDir: 'E:/vault/.obsidian/plugins/bz/', vaultDir: 'E:/vault' })).toBe(
      'E:\\vault\\.obsidian\\plugins\\bz\\data.json',
    );
  });

  it('默认勾选：路径、Ollama 地址、嵌入模型、重排总闸、转写引擎都在', () => {
    const keys = backfillFields(defaultPicked()).map((f) => f.key);
    expect(keys).toEqual([
      'pythonPath',
      'ffmpegPath',
      'ffprobePath',
      'secondBrainOllamaUrl',
      'secondBrainEmbeddingModel',
      'secondBrainRerank',
      'asrEngine',
    ]);
  });

  it('键名与设置面板同一套（写错一个字母就是静默不生效）', () => {
    const keys = new Set(backfillFields(defaultPicked()).map((f) => f.key));
    for (const k of keys) {
      // 这一版只允许出现这几个键；新增键时必须同时改设置面板的 binding
      expect([
        'pythonPath',
        'ffmpegPath',
        'ffprobePath',
        'secondBrainOllamaUrl',
        'secondBrainEmbeddingModel',
        'secondBrainRerank',
        'secondBrainRerankModel',
        'asrEngine',
        'asrWhisperModel',
      ]).toContain(k);
    }
  });

  it('嵌入模型写的是选中的那个名字（换 8b 就写 8b）', () => {
    const f = backfillFields(toggleRadio(defaultPicked(), 'embed:qwen3-embedding:8b')).find(
      (x) => x.key === 'secondBrainEmbeddingModel',
    )!;
    expect(f.value).toContain('"qwen3-embedding:8b"');
  });

  it('重排是「总闸 + 模型名」两个键：只写模型名而总闸 false，装了也不生效', () => {
    const picked = toggleRadio(defaultPicked(), 'rerank:dengcao/Qwen3-Reranker-4B:Q4_K_M');
    const map = new Map(backfillFields(picked).map((f) => [f.key, f.value]));
    expect(map.get('secondBrainRerank')).toBe('true');
    expect(map.get('secondBrainRerankModel')).toContain('Qwen3-Reranker-4B');
  });

  it('选「不安装重排」只关总闸，不留一个模型名在文件里', () => {
    const map = new Map(backfillFields(defaultPicked()).map((f) => [f.key, f.value]));
    expect(map.get('secondBrainRerank')).toContain('false');
    expect(map.has('secondBrainRerankModel')).toBe(false);
  });

  it('转写选 whisper：引擎换 faster-whisper，并给档位键', () => {
    const map = new Map(backfillFields(toggleRadio(defaultPicked(), 'asr:whisper')).map((f) => [f.key, f.value]));
    expect(map.get('asrEngine')).toBe('"faster-whisper"');
    expect(map.get('asrWhisperModel')).toContain('"small"');
  });

  it('没勾的项不产生键（勾掉 ffmpeg 就不该让 AI 去写 ffmpegPath）', () => {
    const keys = backfillFields(only('python', 'embed:bge-m3')).map((f) => f.key);
    expect(keys).toEqual(['pythonPath', 'secondBrainEmbeddingModel']);
  });

  it('Node 与 pip 包没有设置键——提示词里要交代「文件里没有它们」', () => {
    const text = prompt(only('node', 'pycryptodome'));
    expect(text).toContain('（这次没有要回填的键）');
    expect(text).toMatch(/Node\.js 与 pip 包不写进这个文件/);
  });
});
