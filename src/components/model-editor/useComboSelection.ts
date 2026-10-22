import { ref } from 'vue'

/** 一份按操作顺序维护的 PLN 勾选状态；模型/版本变化的 watch 仍由页面协调。 */
export function useComboSelection() {
  const checkedIds = ref<string[]>([])

  function toggle(id: string) {
    if (!id) return
    checkedIds.value = checkedIds.value.includes(id) ? checkedIds.value.filter((item) => item !== id) : [...checkedIds.value, id]
  }
  function selectAll(ids: readonly string[]) {
    checkedIds.value = [...new Set([...checkedIds.value, ...ids])]
  }
  function clear() {
    checkedIds.value = []
  }
  function invert(ids: readonly string[]) {
    const selected = new Set(checkedIds.value)
    ids.forEach((id) => {
      if (selected.has(id)) selected.delete(id)
      else selected.add(id)
    })
    checkedIds.value = [...selected]
  }
  function retain(ids: readonly string[]) {
    const alive = new Set(ids)
    const next = checkedIds.value.filter((id) => alive.has(id))
    if (next.length !== checkedIds.value.length) checkedIds.value = next
  }

  return { checkedIds, toggle, selectAll, clear, invert, retain }
}
