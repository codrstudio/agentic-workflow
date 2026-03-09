const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    console.log('Navigating to http://localhost:2103/web...');
    await page.goto('http://localhost:2103/web', { waitUntil: 'networkidle' });

    const title = await page.title();
    console.log('✓ Page title:', title);

    const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 100));
    console.log('✓ Page loaded successfully');

    // Take a screenshot
    await page.screenshot({ path: 'screenshot.png' });
    console.log('✓ Screenshot saved to screenshot.png');

    // Check if the page has the root element
    const hasRoot = await page.evaluate(() => document.getElementById('root') !== null);
    console.log('✓ Root element exists:', hasRoot);

    console.log('\n✅ Website is running and accessible!');
  } catch (err) {
    console.error('❌ Error accessing website:', err.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
