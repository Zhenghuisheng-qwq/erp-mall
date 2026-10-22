import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { Ref } from 'vue'
import type { CategoryFilterLayout, ProductListSavedView } from '../../domain/types'

type CategoryView = Pick<ProductListSavedView, 'id' | 'categoryFilterLayout'>

/** Display state for one mounted list. Only an explicit setting change persists;
 * closing a panel, switching views and resizing never edit category predicates. */
export function useProductListCategoryLayout(
  view: Readonly<Ref<CategoryView>>,
  saveLayout: (layout: CategoryFilterLayout) => void,
) {
  const categoryOpen = ref(false)
  const categorySideClosed = ref(false)
  const narrowScreen = ref(window.innerWidth < 960)
  const categoryLayout = computed(() => view.value.categoryFilterLayout === 'sidebar' || view.value.categoryFilterLayout === 'hidden' ? view.value.categoryFilterLayout : 'popover')
  const showSidebar = computed(() => categoryLayout.value === 'sidebar' && !narrowScreen.value && !categorySideClosed.value)

  function setCategorySidebar(enabled: boolean) {
    saveLayout(enabled ? 'sidebar' : 'popover')
    categorySideClosed.value = false
    categoryOpen.value = false
  }
  function syncNarrow() {
    narrowScreen.value = window.innerWidth < 960
  }

  // Preserve the page's default flush and registration order: view reset first,
  // then close the floating panel if sidebar visibility changes.
  watch(() => view.value.id, () => { categoryOpen.value = false; categorySideClosed.value = false })
  watch(showSidebar, () => { categoryOpen.value = false })
  onMounted(() => {
    syncNarrow()
    window.addEventListener('resize', syncNarrow)
  })
  onBeforeUnmount(() => window.removeEventListener('resize', syncNarrow))

  return { categoryOpen, categorySideClosed, narrowScreen, categoryLayout, showSidebar, setCategorySidebar }
}
