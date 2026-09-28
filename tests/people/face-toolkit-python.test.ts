// @vitest-environment node
/**
 * 脸谱工具包 Python 冒烟门（issue 510）：v0.4 收编时 bz_rec.py / bz_refs.py 各有一处
 * 「改签名漏改调用点」型 P0（REFS NameError / labeled_wavs TypeError），Node 判定层测试
 * 完全测不到——本文件补上 Python 层最便宜的兜底：
 *   1. py_compile 全部自写脚本（语法门）；
 *   2. 真调收编脚本的关键纯函数（临时目录，不碰真实数据根）：load_refs 缺质心三态、
 *      labeled_wavs 双参签名与空库、read_action 控制文件语义。
 * python / numpy 缺席的开发机自动跳过（本门守的是「收编缺陷」，不是环境检测）。
 */
import { describe, it, expect } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const PY_DIR = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../../tools/obsidian-face/python');
const SCRIPTS = ['bz_export.py', 'bz_sync.py', 'bz_prep.py', 'bz_rec.py', 'bz_refs.py'];

async function probe(code: string): Promise<boolean> {
  try {
    await execFileAsync('python', ['-c', code], { timeout: 20000 });
    return true;
  } catch {
    return false;
  }
}

const pyOk = await probe('print(1)');
const numpyOk = pyOk ? await probe('import numpy') : false;
if (pyOk && !numpyOk) {
  console.warn('[face-toolkit-python] 本机 python 缺 numpy，函数冒烟跳过（py_compile 照跑）');
}
const itPy = pyOk ? it : it.skip;
const itPyNumpy = pyOk && numpyOk ? it : it.skip;

describe('bz-face Python 冒烟门（issue 510）', () => {
  itPy('py_compile：五个自写脚本全部语法过门', { timeout: 30000 }, async () => {
    await execFileAsync('python', ['-m', 'py_compile', ...SCRIPTS.map((s) => path.join(PY_DIR, s))], { timeout: 30000 });
  });

  itPyNumpy(
    '收编函数真调：load_refs 缺质心三态 / labeled_wavs 双参空库 / read_action 控制语义',
    { timeout: 60000 },
    async () => {
      const driver = `
import json, os, sys, tempfile
sys.path.insert(0, sys.argv[1])
import bz_rec, bz_refs
with tempfile.TemporaryDirectory() as td:
    # 收编缺陷回归①：REFS 曾是 main() 局部量，load_refs 读全局必 NameError
    assert bz_rec.load_refs(td, "某人") == (None, None, "blind")
with tempfile.TemporaryDirectory() as td:
    # 收编缺陷回归②：holdout 段曾按旧单参调用 labeled_wavs，必 TypeError
    os.makedirs(os.path.join(td, "某人", "voice"))
    with open(os.path.join(td, "某人", "chat.json"), "w", encoding="utf-8") as f:
        json.dump([], f)
    assert bz_refs.labeled_wavs(td, "某人") == []
    # 控制文件语义：无文件 / 坏 JSON / 非对象 / 未知 action 一律无指令
    ctl = os.path.join(td, "rec-control.json")
    assert bz_rec.read_action(ctl) == ""
    for raw, want in [('{"action":"stop"}', "stop"), ('{"action":"pause"}', "pause"),
                      ('{"action":"resume"}', "resume"), ('{bad', ""), ('{"action":"x"}', ""), ('[]', "")]:
        with open(ctl, "w", encoding="utf-8") as f:
            f.write(raw)
        assert bz_rec.read_action(ctl) == want, (raw, bz_rec.read_action(ctl))
print("PY-SMOKE-OK")
`;
      const { stdout } = await execFileAsync('python', ['-X', 'utf8', '-c', driver, PY_DIR], { timeout: 60000 });
      expect(stdout).toContain('PY-SMOKE-OK');
    },
  );
});
