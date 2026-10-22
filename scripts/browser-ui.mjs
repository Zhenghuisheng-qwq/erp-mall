function exactText(value) {
  return new RegExp(`^${String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`)
}

export async function waitUiSettled(page) {
  await page.waitForFunction(() => {
    const nodes = [...document.querySelectorAll('.el-overlay, .el-overlay-dialog')]
    return nodes.every((node) => {
      const rect = node.getBoundingClientRect()
      const style = getComputedStyle(node)
      const covers = rect.width > 2 && rect.height > 2 && style.display !== 'none' && style.visibility !== 'hidden' && style.pointerEvents !== 'none'
      return !covers
    })
  }, null, { timeout: 8000 })
}

export async function openTools(page) {
  await waitUiSettled(page)
  const tools = page.locator('.view-tools')
  // Finish a possible previous closing transition before deciding whether to open.
  async function settle() {
    if (await tools.count()) await tools.evaluate(async node => {
      const popper = node.closest('.el-popper')
      await Promise.all((popper?.getAnimations({ subtree: true }) || []).map(animation => animation.finished.catch(() => {})))
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    })
  }
  await settle()
  if (!(await tools.isVisible())) await page.getByRole('button', { name: '列表设置', exact: true }).click()
  await tools.waitFor()
  await settle()
}

export async function closeTools(page) {
  await waitUiSettled(page)
  const tools = page.locator('.view-tools')
  if (await tools.isVisible()) await page.getByRole('heading', { name: /^(SPU 管理|SKU 管理)$/ }).click()
  await tools.waitFor({ state: 'hidden' })
}

export async function createView(page, name) {
  await page.waitForLoadState('networkidle')
  await page.locator('.list-switch').waitFor()
  if (await page.locator('[data-sku-workbench]').count()) {
    await page.getByRole('button', { name: '更多', exact: true }).click()
    await page.getByRole('button', { name: '新建视图', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: '新建视图', exact: true })
    await dialog.getByPlaceholder('视图名称').fill(name)
    await dialog.getByRole('button', { name: '创建', exact: true }).click()
    await dialog.waitFor({ state: 'hidden' })
    await page.locator('.view-current').filter({ hasText: exactText(name) }).waitFor()
    return
  }
  await openTools(page)
  await page.locator('.view-tools').getByRole('button', { name: '新建视图', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: '新建视图' })
  await dialog.getByPlaceholder('视图名称').fill(name)
  await dialog.getByRole('button', { name: '创建', exact: true }).click()
  await page.locator('.view-current').filter({ hasText: exactText(name) }).waitFor()
  await waitUiSettled(page)
}

export async function chooseView(page, name) {
  await waitUiSettled(page)
  await page.locator('.view-current').click()
  await page.locator('[data-saved-view]').filter({ hasText: exactText(name) }).click()
  await page.waitForFunction((expected) => {
    const confirm = [...document.querySelectorAll('[role="dialog"]')].some((node) => (node.getAttribute('aria-label') || '') === '清空暂存' && node.getClientRects().length > 0)
    const current = document.querySelector('.view-current')?.textContent?.trim() || ''
    return confirm || current === expected
  }, name)
}

export async function clickOption(page, option) {
  await page.waitForFunction((text) => {
    const node = [...document.querySelectorAll('.el-select-dropdown__item')].filter((item) => {
      if ((item.textContent || '').trim() !== text) return false
      const rect = item.getBoundingClientRect()
      const style = getComputedStyle(item)
      return rect.height > 20 && rect.width > 40 && style.visibility !== 'hidden' && style.display !== 'none'
    }).at(-1)
    if (!node) return false
    const rect = node.getBoundingClientRect()
    const box = `${Math.round(rect.x)}:${Math.round(rect.y)}:${Math.round(rect.height)}`
    const stable = node.dataset.stableBox === box
    node.dataset.stableBox = box
    return stable
  }, option)
  const clicked = await page.evaluate((text) => {
    const node = [...document.querySelectorAll('.el-select-dropdown__item')].filter((item) => {
      if ((item.textContent || '').trim() !== text) return false
      const rect = item.getBoundingClientRect()
      const style = getComputedStyle(item)
      return rect.height > 20 && rect.width > 40 && style.visibility !== 'hidden' && style.display !== 'none'
    }).at(-1)
    if (!node) return false
    node.click()
    return true
  }, option)
  if (!clicked) throw new Error(`没有点到可见选项 ${option}`)
}

export async function pickToolSelect(page, placeholder, option) {
  await openTools(page)
  const select = page.locator('.view-tools .el-select').filter({
    has: page.locator('.el-select__placeholder', { hasText: exactText(placeholder) }),
  })
  await select.scrollIntoViewIfNeeded()
  await select.click()
  await clickOption(page, option)
  await waitUiSettled(page)
}

export async function setCategorySidebar(page, enabled) {
  await openTools(page)
  const checkbox = page.locator('.view-tools .el-checkbox').filter({ hasText: '常驻分类栏' })
  if (await checkbox.locator('input').isChecked() !== enabled) await checkbox.click()
  await closeTools(page)
  if (enabled && await page.getByRole('button', { name: '展开分类栏', exact: true }).isVisible()) await page.getByRole('button', { name: '展开分类栏', exact: true }).click()
}
