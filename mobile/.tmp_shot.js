const { chromium } = require('playwright')
const path = require('path')

;(async () => {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 500, height: 1400 } })
  const files = ['concept_horarios.html', 'concept_servicios.html', 'concept_ajustes.html']
  for (const f of files) {
    const url = 'file://' + path.resolve(__dirname, 'design/mockups', f).replace(/\\/g, '/')
    await page.goto(url)
    await page.waitForTimeout(400)
    const out = path.resolve(__dirname, 'design/mockups', f.replace('.html', '.png'))
    await page.screenshot({ path: out, fullPage: true })
    console.log('saved', out)
  }
  await browser.close()
})()
