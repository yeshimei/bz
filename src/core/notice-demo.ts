/**
 * 通知样式演示（ticket 25 渐进式第 1 批的样式验收入口）。
 * 命令 `bz-notification-demo`：依次展示全部通知样式——
 * 四种类型 × 六种动画变体 / 多阶段动态消息 / 进度条 / 富文本+操作按钮 /
 * 堆叠上限 / 不确定进度 / 多行富文本。
 * 样式确认后此命令可保留（作为样式自查入口）或移除。
 */
import { notify } from './notice';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runNotificationDemo(): Promise<void> {
  // 1. 信息 · 桌面默认 slide-right（右侧滑入）
  notify('备忘录已刷新');

  await delay(1600);

  // 2. 成功 · pop + ✅ 图标
  notify('物品「耳机」添加成功！', { type: 'success', variant: 'pop' });

  await delay(1600);

  // 3. 警告 · shake（抖动强调）
  notify('数据文件解析失败，请检查 CONFIG/STORAGE/memo.json 格式', {
    type: 'warning',
    variant: 'shake',
  });

  await delay(1800);

  // 4. 错误 · shake（默认停留 5s）
  notify('保存失败：网络连接中断', { type: 'error', variant: 'shake' });

  await delay(1800);

  // 5. 动态消息 · 四阶段原地更新
  const h1 = notify('正在连接 AI 服务…');
  await delay(1400);
  h1.setMessage('正在分析笔记内容…');
  await delay(1400);
  h1.setMessage('正在生成摘要…');
  await delay(1400);
  h1.setMessage('摘要已生成，已写入 frontmatter');
  await delay(1600);
  h1.hide();

  await delay(400);

  // 6. 进度条 · 慢速推进 0→100，完成后进度条变绿
  const h2 = notify('向量索引刷新中…', { type: 'progress' });
  for (let pct = 10; pct <= 100; pct += 10) {
    await delay(300);
    h2.setProgress(pct);
  }
  h2.setMessage('向量库已是最新');
  await delay(1600);
  h2.hide();

  await delay(500);

  // 7. 富文本 + 操作按钮（撤销）
  notify('已删除「深度学习入门」', {
    title: '剪藏本',
    action: {
      label: '↩ 撤销',
      onClick: () => {
        notify('已撤销删除（演示）', { type: 'success', variant: 'pop' });
      },
    },
  });

  await delay(2200);

  // 8. slide-left：从左侧滑入
  notify('收藏已添加', { type: 'success', variant: 'slide-left' });

  await delay(1500);

  // 9. slide-right：从右侧滑入（桌面默认）
  notify('已删除「旧文章.md」', { variant: 'slide-right' });

  await delay(1500);

  // 10. bounce：弹性回弹（庆祝感）
  notify('连续复习 7 天！', { type: 'success', variant: 'bounce' });

  await delay(1600);

  // 11. 堆叠上限：快速连发 6 条，最旧的被挤掉
  for (let i = 1; i <= 6; i++) {
    notify('堆叠演示 第 ' + i + ' 条（上限 5 条，挤掉最旧）', { type: 'info' });
    await delay(130);
  }

  await delay(2200);

  // 12. 不确定进度（跑马灯）：连接中 → 降级
  const h3 = notify('正在连接 Ollama 服务…', { type: 'progress' });
  h3.setProgress(-1);
  await delay(2800);
  h3.setMessage('连接失败，已降级为本地检索');
  h3.setType('error');
  await delay(2400);
  h3.hide();

  await delay(400);

  // 13. 多行富文本（标题 + 长消息自动换行）
  notify('《深度学习的数学》摘要已生成\n📌 标签：#数学 #读书笔记 #AI\n✍️ 一句话：用最小篇幅讲清反向传播的直觉', {
    title: '自动摘要',
  });
}
