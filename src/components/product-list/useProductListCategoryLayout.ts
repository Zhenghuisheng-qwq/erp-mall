import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { Ref } from 'vue'
import type { CategoryFilterLayout, ProductListSavedView } from '../../domain/types'

type CategoryView = Pick<ProductListSavedView, 'id' | 'categoryFilterLayout'>

/** The view layout is the only desktop preference. A narrow overlay is temporary. */
export function useProductListCategoryLayout(
  view: Readonly<Ref<CategoryView>>,
  saveLayout: (layout: CategoryFilterLayout) => unknown | Promise<unknown>,
) {
  const categoryOpen = ref(false)
  // Kept for old callers; no separate persisted or transient desktop closed state.
  const categorySideClosed = computed(() => categoryLayout.value !== 'sidebar')
  const narrowScreen = ref(window.innerWidth < 960)
  const categoryLayout = computed(() => view.value.categoryFilterLayout === 'sidebar' ? 'sidebar' : 'popover')
  const showSidebar = computed(() => categoryLayout.value === 'sidebar' && !narrowScreen.value)

  async function setCategorySidebar(enabled: boolean) {
    const result = await saveLayout(enabled ? 'sidebar' : 'popover')
    if (result && typeof result === 'object' && 'ok' in result && !result.ok) return false
    categoryOpen.value = false
    return true
  }
  async function openCategory() {
    if (narrowScreen.value) { categoryOpen.value = true; return true }
    return setCategorySidebar(true)
  }
  function closeSidebar() { return setCategorySidebar(false) }
  function syncNarrow() {
    narrowScreen.value = window.innerWidth < 960
  }

  watch(() => view.value.id, () => { categoryOpen.value = false })
  watch(showSidebar, () => { categoryOpen.value = false })
  watch(narrowScreen, () => { categoryOpen.value = false })
  onMounted(() => {
    syncNarrow()
    window.addEventListener('resize', syncNarrow)
  })
  onBeforeUnmount(() => window.removeEventListener('resize', syncNarrow))

  return { categoryOpen, categorySideClosed, narrowScreen, categoryLayout, showSidebar, setCategorySidebar, openCategory, closeSidebar }
}
