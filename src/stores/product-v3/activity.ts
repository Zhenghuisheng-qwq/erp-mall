import { defineStore } from 'pinia'
import { reactive, watch } from 'vue'

export interface DemoActivity {
  id: string
  time: string
  title: string
  detail: string
}

const ACTIVITY_KEY = 'iyge-v3-activity'

function seedActivities(): DemoActivity[] {
  return [
    {
      id: 'act-plan',
      time: '2026-10-13T08:30:00.000Z',
      title: '创建规划',
      detail: '创建手机商品规划。分类是手机，产品类型是 Apple手机。',
    },
    {
      id: 'act-sku',
      time: '2026-10-13T08:36:00.000Z',
      title: '生成 SKU 预览',
      detail: 'iPhone17 生成 3 条：256G 黑色、256G 白色、512G 白色。',
    },
    {
      id: 'act-material',
      time: '2026-10-13T08:50:00.000Z',
      title: '创建物料',
      detail: '生成 3 条手机物料，并登记保护膜、手机壳、充电器。',
    },
  ]
}

function loadActivities() {
  try {
    const raw = localStorage.getItem(ACTIVITY_KEY)
    if (!raw) return seedActivities()
    const parsed = JSON.parse(raw) as DemoActivity[]
    return Array.isArray(parsed) && parsed.length ? parsed : seedActivities()
  } catch {
    return seedActivities()
  }
}

export const useActivityStore = defineStore('product-v3-activity', () => {
  const items = reactive<DemoActivity[]>(loadActivities())

  watch(
    items,
    () => {
      localStorage.setItem(ACTIVITY_KEY, JSON.stringify(items))
    },
    { deep: true },
  )

  function add(title: string, detail: string) {
    items.unshift({
      id: `act-${Date.now().toString(36)}`,
      time: new Date().toISOString(),
      title,
      detail,
    })
  }

  function resetAll() {
    items.splice(0, items.length, ...seedActivities())
  }

  return { items, add, resetAll }
})
