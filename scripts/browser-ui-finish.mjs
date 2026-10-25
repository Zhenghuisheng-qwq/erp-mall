import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createServer } from 'vite'
import { chromium } from 'playwright-core'

const before = process.argv.includes('--before')
const output = resolve('work/ui-finish', before ? 'before' : 'after')
mkdirSync(output, { recursive: true })
const server = await createServer({ cacheDir: resolve('work/ui-finish/vite-cache'), server: { host: '127.0.0.1', port: 0, hmr: false, watch: null } })
let browser, page
const checks = [], errors = [], geometry = []
try {
  const { createBenefitPackageFixture } = await server.ssrLoadModule('/scripts/benefit-package-fixtures.ts')
  const { data } = createBenefitPackageFixture(); data.activeRole = 'admin'
  await server.listen()
  const base = `http://127.0.0.1:${server.httpServer.address().port}`
  browser = await chromium.launch({ channel: 'chrome', headless: true })
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, reducedMotion: 'reduce', locale: 'zh-CN' })
  await ctx.addInitScript(data => {
    if (location.protocol !== 'http:' || localStorage.getItem('iyge-v2-mock-db')) return
    localStorage.setItem('iyge-v2-mock-db', JSON.stringify({ version: 15, data }))
    localStorage.setItem('iyge-v2-theme', 'light')
  }, data)
  page = await ctx.newPage(); page.setDefaultTimeout(12000)
  page.on('pageerror', e => errors.push(String(e)))
  const group = () => page.locator('[data-group="product"]')
  const fly = () => page.locator('#nav-flyout')
  const shot = async name => { await page.waitForTimeout(250); await page.screenshot({ path: resolve(output, name + '.png'), fullPage: true }) }
  const mark = name => { checks.push(name); console.log('PASS ' + name) }
  await page.goto(base + '/account', { waitUntil: 'networkidle' })
  await page.evaluate(async () => (await import('/src/stores/catalog.ts')).useCatalogStore().waitForPersistence())
  const original = await page.evaluate(() => localStorage.getItem('iyge-v2-mock-db'))
  await group().hover(); await shot('navigation-floating-light')
  assert.equal(await fly().locator('a[aria-current="page"]').count(), 0)
  await page.locator('[data-nav-pin]').click(); await shot('navigation-pinned-light')
  await page.locator('[data-nav-pin]').click()
  await page.locator('.theme-switch').click(); await group().hover(); await shot('navigation-floating-dark')
  await page.locator('[data-nav-pin]').click(); await shot('navigation-pinned-dark')
  await page.locator('[data-nav-pin]').click(); await page.locator('.theme-switch').click()

  await group().hover(); await group().focus(); await page.keyboard.press('ArrowRight')
  assert.equal(await page.locator(':focus').evaluate(e => e.tagName), 'A')
  await page.mouse.move(1100, 400); await page.waitForTimeout(280)
  const keyboardSurvivesMouseLeave = await fly().count() === 1
  if (before) {
    assert.equal(keyboardSurvivesMouseLeave, false, 'Confirm the reported defect before changing it')
    checks.push('REPRODUCED: mouse leave closes keyboard-focused details')
  } else {
    assert(keyboardSurvivesMouseLeave)
    assert(await fly().evaluate(e => e.contains(document.activeElement)))
    await page.keyboard.press('Tab'); assert(await fly().evaluate(e => e.contains(document.activeElement)))
    await shot('keyboard-focus-retained')
    await page.keyboard.press('Escape'); assert.equal(await fly().count(), 0)
    assert.equal(await page.locator(':focus').getAttribute('data-group'), 'product')
    await page.waitForTimeout(280); assert.equal(await fly().count(), 0)
    mark('keyboard details survive mouse leave; Escape closes once and restores module focus')

    await page.keyboard.press('ArrowRight'); await fly().locator('a').last().focus(); await page.keyboard.press('Tab')
    assert.equal(await page.locator('.rail-wrap').evaluate(e => e.contains(document.activeElement)), false)
    await page.waitForTimeout(280); assert.equal(await fly().count(), 0)
    mark('real Tab leaving navigation closes after delay')

    await group().hover(); await page.mouse.move(1100, 400); await page.waitForTimeout(280); assert.equal(await fly().count(), 0)
    await group().hover(); await fly().locator('.flyout-head').hover(); await page.waitForTimeout(240); assert(await fly().isVisible())
    await page.mouse.move(1100, 400); await page.waitForTimeout(280); assert.equal(await fly().count(), 0)
    mark('mouse-only hover still closes; crossing columns stays open')

    await group().hover()
    for (const section of await fly().locator('.flyout-section').all()) {
      const m = await section.evaluate(e => {
        const h = e.querySelector('h3'), link = e.querySelector('a')
        const ht = h.querySelector('.menu-label'), lt = link.querySelector('.menu-label')
        return { headingSize: getComputedStyle(h).fontSize, leafSize: getComputedStyle(link).fontSize,
          indent: lt.getBoundingClientRect().x - ht.getBoundingClientRect().x,
          headingIcons: h.querySelectorAll('svg').length, leafIcons: link.querySelectorAll('svg').length }
      })
      assert.equal(m.headingSize, '12px'); assert.equal(m.leafSize, '14px'); assert(m.indent >= 16 && m.indent <= 24)
      assert.equal(m.headingIcons, 1); assert.equal(m.leafIcons, 1); geometry.push(m)
    }
    assert.equal(await fly().locator(':scope > .flyout-body > a[href="/"]').count(), 1)
    await page.locator('[data-nav-pin]').click(); await page.mouse.move(1100,400); await page.waitForTimeout(280)
    await page.locator('[data-group="product"]').focus(); await page.keyboard.press('Escape')
    assert(await fly().isVisible()); assert.equal(await page.locator('[data-nav-pin]').getAttribute('aria-pressed'), 'true')
    await page.locator('[data-nav-pin]').click()
    mark('group/leaf hierarchy has icons, 12/14px text, 16–24px indent; direct page preserved; Escape preserves pin')
    assert.equal(await page.evaluate(() => localStorage.getItem('iyge-v2-mock-db')), original)
    mark('navigation-only actions preserve persisted business data byte for byte')
    // Stable route icons must survive names chosen by the user, and labels must wrap inside the column.
    await group().hover()
    const iconBefore = await fly().locator('a[href="/skus"] svg').evaluate(e => e.innerHTML)
    await page.evaluate(async () => {
      const { defaultMenuNodes, MENU_KEY } = await import('/src/domain/menuConfig.ts')
      const nodes = defaultMenuNodes()
      nodes.find(n => n.route === '/skus').title = '用户自定义的超长规格商品管理名称用于验证完整换行和图标稳定性'
      localStorage.setItem(MENU_KEY, JSON.stringify({ version: 1, nodes }))
    })
    await page.reload({ waitUntil: 'networkidle' }); await group().hover()
    const renamed = fly().locator('a[href="/skus"]')
    assert.equal(await renamed.locator('svg').evaluate(e => e.innerHTML), iconBefore)
    const labelFits = await renamed.locator('.menu-label').evaluate(e => e.scrollWidth <= e.clientWidth + 1)
    assert(labelFits)
    const fallback = await page.evaluate(async () => {
      const { menuRouteIcon } = await import('/src/layouts/navigationIcons.ts')
      const icon = menuRouteIcon('/unconfigured-route')
      return icon.name || icon.__name
    })
    assert.equal(fallback, 'Document')
    await shot('navigation-long-name-light')
    await page.locator('.theme-switch').click(); await group().hover(); await shot('navigation-long-name-dark')
    mark('renamed long labels wrap inside details; route icons stay stable and unknown routes use neutral fallback')

  }
  assert.deepEqual(errors, [])
  writeFileSync(resolve(output, 'navigation-result.json'), JSON.stringify({ phase: before ? 'before' : 'after', browser: browser.version(), keyboardSurvivesMouseLeave, checks, geometry, errors }, null, 2))
} catch (error) {
  if (page) await page.screenshot({ path: resolve(output,'failure.png'), fullPage:true }).catch(() => {})
  throw error
} finally { await browser?.close(); await server.close() }
