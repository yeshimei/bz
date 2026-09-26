# ADR-0159 · 外观占位设置键显式保留

日期：2026-09-16 · 关联：issue 364、issue 246（占位键设计原案）

## 背景

全域裁剪批（issue 364）三路扫描发现 26 个外观占位设置键（`xxLayout` / `xxSkin` /
`xxTheme` 形态：memoLayout、homeLayout、homeSkin、bookshelfLayout、cinemaStyle、
cinemaSkinTheme、belSkin/Theme、diarySkin/Theme、clipbookSkin/Theme、favoritesSkin/Theme、
reviewSkin/Theme、secondbrainSkin/Theme、knowledgeSkin/Theme、encryptSkin/Theme、
passwordVaultSkin/Theme、settingsPanelLayout/Skin 等）只有设置 UI 行引用、运行时零消费
——真正消费皮肤的仅 memo / bookshelf / pomodoro 三家。扫描结论曾列为「疑似可裁剪」。

## 决策

**显式保留，不裁剪。** 这是 issue 246 的有意设计：设置先行、域 UI 消费在真做皮肤时接入。
用户拍板（2026-09-16）：「不动，为后续扩展用的」。后续全域审计**不再重提**本批键的裁剪；
仅当某域明确确认永不做皮肤/多布局时，才就该域成对（Skin+Theme / Layout）单独拍板退役。

## 后果

+ 皮肤/布局扩展的设置面已就位，真做时零设置迁移。
− 审计工具会把「schema 有键、运行时零消费」持续报为疑似死键；本 ADR 即豁免依据，
  死键扫描需携带此豁免清单。
