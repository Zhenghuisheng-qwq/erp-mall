export const defaultPhonePaths = [
  '品牌 Apple · 系列 iPhone · 型号 iPhone 17 · 容量 128G · 颜色 黑色',
  '品牌 Apple · 系列 iPhone · 型号 iPhone 17 · 容量 128G · 颜色 白色',
  '品牌 Apple · 系列 iPhone · 型号 iPhone 17 · 容量 256G · 颜色 白色',
  '品牌 华为 · 系列 Mate · 容量 128G · 颜色 黑色',
]

export function assertDefaultPhone(text) {
  const missing = defaultPhonePaths.filter((item) => !text.includes(item))
  if (missing.length) throw new Error('默认手机模型缺少合法路径：' + missing.join(' | '))
  const crossed = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => (line.includes('Apple') && line.includes('Mate')) || (line.includes('华为') && line.includes('iPhone')))
  if (crossed.length) throw new Error('默认手机模型出现跨品牌组合：' + crossed.join(' | '))
  if (!text.includes(`合法组合 ${defaultPhonePaths.length} 条`)) throw new Error('合法组合数量和路径集合不一致：' + text)
}
