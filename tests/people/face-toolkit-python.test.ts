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
const SCRIPTS = ['bz_export.py', 'bz_sync.py', 'bz_prep.py', 'bz_rec.py', 'bz_refs.py', 'bz_check.py'];

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
  itPy('py_compile：六个自写脚本全部语法过门', { timeout: 30000 }, async () => {
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
    # （v0.6 起第四位返旁音门限：老 npz 无门限 = None = 本次不过滤）
    assert bz_rec.load_refs(td, "某人") == (None, None, "blind", None)
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

  itPy(
    '账本原子替换重试（ADR-0219）：前 N 次 PermissionError 退避重试成功；耗尽抛 LedgerBusy 人话且不留 tmp',
    { timeout: 60000 },
    async () => {
      // numpy 只被 bz_rec 的管线阶段用（save 不用），缺席时 stub 掉即可测「账本韧性」这条纯路径
      const driver = `
import json, os, sys, tempfile, types
if "numpy" not in sys.modules:
    try:
        import numpy  # noqa: F401
    except Exception:
        sys.modules["numpy"] = types.ModuleType("numpy")
sys.path.insert(0, sys.argv[1])
import bz_rec

REAL = os.replace
bz_rec.SAVE_BACKOFF = 0.0

# ① 前 3 次被拒（插件轮询持读句柄）→ 第 4 次成功；tmp 名带 pid 与序号、成功不留 tmp
with tempfile.TemporaryDirectory() as td:
    out = os.path.join(td, "r.turns.json")
    seen = []
    def flaky(src, dst):
        seen.append(os.path.basename(src))
        if len(seen) <= 3:
            raise PermissionError(5, "拒绝访问")
        return REAL(src, dst)
    bz_rec.os.replace = flaky
    try:
        bz_rec.save({"phase": "transcribe"}, out)
    finally:
        bz_rec.os.replace = REAL
    assert len(seen) == 4, seen
    assert seen[0] == "r.turns.json.%d.0.tmp" % os.getpid(), seen[0]
    assert seen[3].endswith(".3.tmp"), seen[3]
    assert [f for f in os.listdir(td) if f.endswith(".tmp")] == [], "成功路径不留 tmp"
    assert json.load(open(out, encoding="utf-8"))["phase"] == "transcribe"

# ② 重试耗尽 → LedgerBusy（人话，不裸抛 PermissionError）且不留 tmp
with tempfile.TemporaryDirectory() as td:
    out = os.path.join(td, "r.turns.json")
    def denied(src, dst):
        raise PermissionError(5, "拒绝访问")
    bz_rec.os.replace = denied
    bz_rec.SAVE_TRIES = 3
    try:
        try:
            bz_rec.save({"phase": "transcribe"}, out)
            raise AssertionError("应当抛 LedgerBusy")
        except bz_rec.LedgerBusy as e:
            assert "重试 3 次" in str(e), str(e)
        assert [f for f in os.listdir(td) if f.endswith(".tmp")] == [], "失败路径不留 tmp"
    finally:
        bz_rec.os.replace = REAL
print("PY-LEDGER-OK")
`;
      const { stdout } = await execFileAsync('python', ['-X', 'utf8', '-c', driver, PY_DIR], { timeout: 60000 });
      expect(stdout).toContain('PY-LEDGER-OK');
    },
  );

  itPyNumpy(
    '旁音门限契约（ADR-0216）：npz meta 里读得到 → dual 返门限；缺 meta / 缺 peer / 缺 npz 各自回落',
    { timeout: 60000 },
    async () => {
      const driver = `
import json, os, sys, tempfile
import numpy as np
sys.path.insert(0, sys.argv[1])
import bz_rec, bz_check

v = np.ones(4, dtype=np.float32)
with tempfile.TemporaryDirectory() as td:
    vp = os.path.join(td, "voiceprints"); os.makedirs(vp)
    # ① none：npz 不在 → blind，无门限
    assert bz_rec.load_refs(vp, "某人") == (None, None, "blind", None)
    # ② me-only：只有 me → 不给门限（只有一个质心时第三人天然「不像我」，判了必误拦）
    np.savez(os.path.join(vp, "甲.npz"), me=v, meta=json.dumps({"mode": "me-only"}))
    me, peer, mode, thr = bz_rec.load_refs(vp, "甲")
    assert (peer, mode, thr) == (None, "me-only", None)
    # ③ dual 有门限：读回 meta 里的浮点值
    np.savez(os.path.join(vp, "乙.npz"), me=v, peer=v, meta=json.dumps({"mode": "dual", "side_speech_threshold": 0.1875}))
    assert bz_rec.load_refs(vp, "乙")[3] == 0.1875
    # ④ dual 但 meta 坏 / 无该字段 → None（本次只做两态，不误杀）
    np.savez(os.path.join(vp, "丙.npz"), me=v, peer=v, meta="{bad")
    assert bz_rec.load_refs(vp, "丙")[3] is None
    np.savez(os.path.join(vp, "丁.npz"), me=v, peer=v, meta=json.dumps({"mode": "dual"}))
    assert bz_rec.load_refs(vp, "丁")[3] is None
# check 脚本：缺 vp 时只认「没有判据」，且通过门限是显式常量（照抄 ADR-0216 的宁可漏滤取向）
with tempfile.TemporaryDirectory() as td:
    assert bz_check.load_refs(td, "某人") == (None, None)
assert 0 < bz_check.PASS_SIM <= 0.5, bz_check.PASS_SIM
print("PY-SIDE-OK")
`;
      const { stdout } = await execFileAsync('python', ['-X', 'utf8', '-c', driver, PY_DIR], { timeout: 60000 });
      expect(stdout).toContain('PY-SIDE-OK');
    },
  );

  itPy(
    '媒体增量索引三态（ADR-0223 档 B）：首次全扫 / 未变月份读缓存不重扫 / 目录变动后只重扫那一个月',
    { timeout: 60000 },
    async () => {
      // 「没重扫」的证明用污染探针：手改索引里的清单，若第二轮仍按缓存走，假条目会出现在 jobs 里；
      // 被重扫覆盖则假条目消失。这比数 stat 次数更能证明「真的没扫」。
      const driver = `
import json, os, shutil, sys, tempfile, time
from pathlib import Path
sys.path.insert(0, sys.argv[1])
try:
    import bz_prep
except Exception as e:
    print("IMG-INDEX-SKIP", e)
    raise SystemExit(0)

root = tempfile.mkdtemp(prefix="bzidx-")
attach = Path(root) / "attach"
for rel in ["2026-08/Img/aaaa.dat", "2026-08/Video/bbbb.mp4",
            "2026-08/File/cccc.pdf", "2026-09/Img/dddd.dat"]:
    p = attach / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    with open(p, "wb") as f:
        f.write(b"x" * 16)
idx = Path(root) / ".bz-face" / "media-index" / "某人.json"

j1 = bz_prep.build_media_jobs(attach, idx)
assert len(j1) == 4, j1
assert sorted(k for _, k, _ in j1) == ["file", "image", "image", "video"], j1

with open(idx, encoding="utf-8") as f:
    data = json.load(f)
data["months"]["2026-08"]["files"] = [["Img/fake.dat", "image"]]
with open(idx, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False)

j2 = [str(p).replace(chr(92), "/") for p, _, _ in bz_prep.build_media_jobs(attach, idx)]
assert any("fake.dat" in x for x in j2), j2   # 假条目还在 = 这一月没重扫（缓存命中）
assert len(j2) == 2, j2

sub = attach / "2026-08" / "Img" / "新目录"
sub.mkdir(parents=True, exist_ok=True)
time.sleep(0.02)
os.utime(attach / "2026-08" / "Img", None)

j3 = [str(p).replace(chr(92), "/") for p, _, _ in bz_prep.build_media_jobs(attach, idx)]
assert not any("fake.dat" in x for x in j3), j3   # 污染被真实重扫覆盖
assert len(j3) == 4, j3
shutil.rmtree(root, ignore_errors=True)
print("IMG-INDEX-OK")
`;
      const { stdout } = await execFileAsync('python', ['-X', 'utf8', '-c', driver, PY_DIR], { timeout: 60000 });
      expect(stdout).toContain('IMG-INDEX-OK');
    },
  );
});
