// @vitest-environment node
/**
 * 脸谱工具包 Python 冒烟门（issue 510）：v0.4 收编时 bz_rec.py / bz_refs.py 各有一处
 * 「改签名漏改调用点」型 P0（REFS NameError / labeled_wavs TypeError），Node 判定层测试
 * 完全测不到——本文件补上 Python 层最便宜的兜底：
 *   1. py_compile 全部自写脚本（语法门）；
 *   2. 真调收编脚本的关键纯函数（临时目录，不碰真实数据根）：load_refs 缺质心三态、
 *      labeled_wavs 双参签名与空库、read_action 控制文件语义、TargetIndex 产物存在判定语义
 *      （扩展名优先级 / 类别隔离 / 缺目录 / note_written，ADR-0223 修订）。
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
    '产物存在判定 TargetIndex（ADR-0223 修订）：扩展名按 IMAGE_EXTS 优先级、类别目录不串、缺目录不抛、写盘后即时可见',
    { timeout: 60000 },
    async () => {
      // 增量索引撤回后，这个存在判定是媒体段唯一的「跳不跳」依据，必须在真 Python 上钉住语义：
      // ① 扩展名优先级（jpg 压 bin——listdir 顺序随机，取首个命中的非法实现会报 bin，语义不等价）；
      // ② 类别目录隔离；③ 缺目录/缺名不抛；④ note_written（同轮写盘后立刻要判得到，否则会被写两次）。
      const driver = `
import shutil, sys, tempfile
from pathlib import Path
sys.path.insert(0, sys.argv[1])
try:
    import bz_prep
except Exception as e:
    print("TGT-SKIP", e)
    raise SystemExit(0)

root = Path(tempfile.mkdtemp(prefix="bztgt-"))
cdir = root / "某人"
for rel in ["image/2025-08/aaaa.jpg", "image/2025-08/aaaa.bin",
            "image/2025-08/bbbb.bin", "thumb/2025-08/aaaa.jpg",
            "video/2025-08/vvvv.mp4"]:
    p = cdir / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_bytes(b"x")

t = bz_prep.TargetIndex(cdir)
hit, cand = t.hit("image", "2025-08", "aaaa")
assert cand == "jpg", cand
assert hit == cdir / "image" / "2025-08" / "aaaa.jpg", hit
assert t.hit("image", "2025-08", "bbbb")[1] == "bin"
assert t.hit("thumb", "2025-08", "aaaa")[1] == "jpg"
assert t.hit("thumb", "2025-08", "bbbb") == (None, None)
assert t.hit("image", "2099-01", "zzzz") == (None, None)
assert t.hit("video", "2099-01", "nope") == (None, None)
assert bz_prep.TargetIndex(cdir).has("video", "2025-08", "vvvv.mp4") is True
assert bz_prep.TargetIndex(cdir).has("video", "2025-08", "wwww.mp4") is False
t2 = bz_prep.TargetIndex(cdir)
assert t2.has("video", "2025-08", "wwww.mp4") is False
t2.note_written("video", "2025-08", "wwww.mp4")
assert t2.has("video", "2025-08", "wwww.mp4") is True
shutil.rmtree(root, ignore_errors=True)
print("TGT-OK")
`;
      const { stdout } = await execFileAsync('python', ['-X', 'utf8', '-c', driver, PY_DIR], { timeout: 60000 });
      expect(stdout).toContain('TGT-OK');
    },
  );

  itPy(
    '本人头像导出 write_self_avatar（issue 529）：落 <数据根>/.bz-face/me/、字节比对幂等、换格式清旧图',
    { timeout: 60000 },
    async () => {
      // 插件设置「我的头像」的默认值就靠这个产物；路径形态与幂等语义是插件侧 me-avatar.ts 的契约对齐面。
      // 只有 sqlite3（stdlib）参与，不需要 numpy —— 走 itPy 档。
      const driver = `
import os, sqlite3, sys, tempfile
from pathlib import Path
sys.path.insert(0, sys.argv[1])
try:
    import bz_sync
except Exception as e:
    print("SELF-SKIP", e)
    raise SystemExit(0)

PNG = b"\\x89PNG\\r\\n\\x1a\\n" + b"p" * 16
JPG = b"\\xff\\xd8\\xff" + b"j" * 16

with tempfile.TemporaryDirectory() as td:
    root = Path(td) / "root"
    db = Path(td) / "db"
    (db / "head_image").mkdir(parents=True)
    p = db / "head_image" / "head_image.db"
    con = sqlite3.connect(str(p))
    con.execute("create table head_image(username text, image_buffer blob)")
    con.execute("insert into head_image values(?,?)", ("wxid_me", PNG))
    con.commit()
    con.close()

    # ① 首写：new + 落 .bz-face/me/avatar.png（放对目录 = 不会被联系人扫描当成一位联系人）
    assert bz_sync.write_self_avatar(root, db, "wxid_me") == "new"
    t = root / ".bz-face" / "me" / "avatar.png"
    assert t.read_bytes() == PNG
    # ② 幂等：同字节不重写
    assert bz_sync.write_self_avatar(root, db, "wxid_me") == "unchanged"
    # ③ 换格式：新扩展名落位、旧的那张清掉（插件按扩展名探测序取第一张）
    con = sqlite3.connect(str(p))
    con.execute("update head_image set image_buffer=? where username=?", (JPG, "wxid_me"))
    con.commit()
    con.close()
    assert bz_sync.write_self_avatar(root, db, "wxid_me") == "new"
    assert sorted(os.listdir(root / ".bz-face" / "me")) == ["avatar.jpg"]
    # ④ 没有本人记录 / 不知道账号 wxid：none / skipped（都不挡整轮）
    assert bz_sync.write_self_avatar(root, db, "nobody") == "none"
    assert bz_sync.write_self_avatar(root, db, "") == "skipped"
print("SELF-AVATAR-OK")
`;
      const { stdout } = await execFileAsync('python', ['-X', 'utf8', '-c', driver, PY_DIR], { timeout: 60000 });
      expect(stdout).toContain('SELF-AVATAR-OK');
    },
  );

  itPy(
    'stats.json 幂等比对剥掉 syncedAt（issue 532）：内容没变 = unchanged 不重写，「更新数」不再虚胖成全量',
    { timeout: 60000 },
    async () => {
      // 插件侧同步摘要（更新 N 位 / 未变 M 位）与「同步到底更新了谁」的观感都吃这个语义。
      const driver = `
import json, sys, tempfile, time
from pathlib import Path
sys.path.insert(0, sys.argv[1])
try:
    import bz_sync
except Exception as e:
    print("STATS-SKIP", e)
    raise SystemExit(0)

with tempfile.TemporaryDirectory() as td:
    cdir = Path(td) / "某人"
    cdir.mkdir(parents=True)
    st = {"msgs": 120, "voices": 9, "images": 15, "voiceSec": 234.5, "lastCt": 1770000000, "maxSid": 777, "group": False}
    # ① 首写：new，落盘带 syncedAt
    assert bz_sync.write_stats_json(cdir, st) == "new"
    first = json.loads((cdir / "stats.json").read_text(encoding="utf-8"))
    assert first["syncedAt"] and first["msgs"] == 120
    # ② 内容没变（哪怕时间流逝）→ unchanged，文件原样（保留上一轮 syncedAt）
    time.sleep(1.1)  # syncedAt 秒级精度：睡过 1 秒才证得出「不是靠时间戳重写」
    assert bz_sync.write_stats_json(cdir, st) == "unchanged"
    again = json.loads((cdir / "stats.json").read_text(encoding="utf-8"))
    assert again == first
    # ③ 内容变了 → updated，syncedAt 刷新
    st2 = {**st, "msgs": 121, "lastCt": st["lastCt"] + 30}
    assert bz_sync.write_stats_json(cdir, st2) == "updated"
    third = json.loads((cdir / "stats.json").read_text(encoding="utf-8"))
    assert third["msgs"] == 121 and third["syncedAt"] >= first["syncedAt"]
    # ④ 旧文件读不动（手工改坏）：按内容变了走重写，不抛
    (cdir / "stats.json").write_bytes(b"{oops")
    assert bz_sync.write_stats_json(cdir, st2) == "updated"
print("STATS-IDEMPOTENT-OK")
`;
      const { stdout } = await execFileAsync('python', ['-X', 'utf8', '-c', driver, PY_DIR], { timeout: 60000 });
      expect(stdout).toContain('STATS-IDEMPOTENT-OK');
    },
  );
});
