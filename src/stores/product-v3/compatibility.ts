import { computed } from 'vue'
import { defineStore } from 'pinia'
import { useMaterialStore } from '../material'

/** 兼容关系和物料档案写在同一份本地数据里，两边看到的是同一张表。 */
export const useCompatibilityStore = defineStore('product-v3-compatibility', () => {
  const material = useMaterialStore()
  const list = computed(() => material.state.compatibilities)

  function byId(id: string) {
    return list.value.find((item) => item.id === id)
  }

  function forMain(mainProductId: string) {
    return list.value.filter((item) => item.mainProductId === mainProductId)
  }

  return { list, byId, forMain }
})
