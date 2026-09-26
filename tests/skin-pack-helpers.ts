/**
 * 皮肤包测试辅助（ADR-0199 / issue 475）。
 *
 * 皮肤远端化后，选择卡只列「内置首套 + 已就绪远端皮肤」（core/skin-pack 就绪表）。
 * 因此凡是断言「远端皮肤可被选中 / 皮肤类被挂上」的用例，都得先 seed 就绪表；
 * 否则 normalize 会回落内置首套，断言看着像功能坏了，实则是没下载。
 */
import { seedSkinPackState, type SkinPackEntry } from '../src/core/skin-pack';

/** 各域预览区类名前缀（= scripts/skins.catalog.json 的 previewClass 约定） */
const PREVIEW_PREFIX: Record<string, string> = {
  bookshelf: 'bz-skinprev-bs-',
  pomodoro: 'bz-sp-prev-pomo-',
  memo: 'bz-skinprev-',
  smartcat: 'bz-sc-prev-',
};

/** 把某域若干远端皮肤标成就绪（name 用 id 占位——测试不断言中文名） */
export function seedRemoteSkins(domain: keyof typeof PREVIEW_PREFIX | string, ids: string[]): void {
  const prefix = PREVIEW_PREFIX[domain] ?? '';
  seedSkinPackState(
    ids.map(
      (id): SkinPackEntry => ({
        id,
        domain,
        name: id,
        file: `skins/${domain}/${id}.css`,
        previewClass: `${prefix}${id}`,
        sha256: 'a'.repeat(64),
      }),
    ),
  );
}
