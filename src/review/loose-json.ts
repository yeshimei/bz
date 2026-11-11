/* ============================================================
 * bz · 宽容 JSON 解析（review/loose-json.ts）
 *
 * 模型的 Python 味儿很重：数组最后一个元素后面还要留个逗号
 * （`["A","B","C","D",]`）。严格 JSON.parse 会整段失败，于是辛苦生成的
 * 一整份题库/抽认卡全白费。
 *
 * 只修尾逗号这一种瑕疵——别的语法错误照样当失败，不猜、不补全。猜出来的
 * 东西比没有更糟：用户会把一条读不通的题当成自己的问题。
 * ============================================================ */

export function parseLooseJson(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    /* 落到下面修一次 */
  }
  try {
    return JSON.parse(String(text).replace(/,\s*([\]}])/g, '$1'));
  } catch {
    return null;
  }
}
