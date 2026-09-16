import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

/** Uses the browser suite's existing public fixtures; never changes a participant draft. */
export async function verifyBrowserBranding({ page, fixtureDefinitions }) {
  const { LANGUAGES, TRANSLATIONS } = fixtureDefinitions;
  const widths = [320, 375, 768, 1440];
  await mkdir('browser-qa.local', { recursive: true });

  const chooseLanguage = async language => {
    await page.locator('header button').last().click();
    try {
      await page.getByRole('button', { name: `${language.flag} ${language.label}`, exact: true }).click();
    } catch (error) {
      await page.screenshot({ path: 'browser-qa.local/branding-menu-failure.png', fullPage: true });
      console.error('Branding language menu:', await page.locator('header button').allTextContents());
      throw error;
    }
  };
  const checkLayout = async label => {
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const dimensions = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
    assert.ok(dimensions.scroll <= dimensions.width + 1, `${label}: horizontal overflow ${JSON.stringify(dimensions)}`);
    const logo = page.getByRole('img', { name: 'Specialty Match', exact: true });
    await logo.waitFor({ state: 'visible' });
    const box = await logo.boundingBox();
    assert.ok(box && box.width > 0 && box.height > 0, `${label}: logo is rendered`);
    assert.ok(box.x >= 0 && box.x + box.width <= dimensions.width + 1, `${label}: complete logo fits the viewport`);
    return logo;
  };

  await page.getByRole('heading', { name: TRANSLATIONS.en.roleIntrospection, exact: true }).waitFor();
  const sourceImages = page.locator('[data-brand-logo="horizontal"] image');
  assert.equal(await sourceImages.count(), 2, 'The horizontal lockup uses the supplied mark and lettering');
  const source = await sourceImages.first().getAttribute('href');
  assert.ok(source, 'The supplied logo has a source URL');
  const imageInfo = await page.evaluate(async href => {
    const url = new URL(href, document.baseURI);
    const response = await fetch(url);
    const image = new Image();
    image.src = url.href;
    await image.decode();
    return { status: response.status, contentType: response.headers.get('content-type'), sameOrigin: url.origin === location.origin, pathname: url.pathname, width: image.naturalWidth, height: image.naturalHeight };
  }, source);
  assert.equal(imageInfo.status, 200, 'The original logo is served successfully');
  assert.equal(imageInfo.sameOrigin, true, 'Branding does not depend on a third-party image host');
  assert.match(imageInfo.contentType ?? '', /^image\/png/);
  assert.match(imageInfo.pathname, /\/branding\/specialty-match-logo\.png$/);
  assert.equal(imageInfo.width, 1254, 'The supplied artwork keeps its original dimensions');
  assert.equal(imageInfo.height, 1254);
  assert.deepEqual(await sourceImages.evaluateAll(elements => elements.map(image => image.getAttribute('href'))), [source, source], 'Both pieces of the compact lockup reuse the original artwork');

  for (const language of LANGUAGES) {
    const copy = TRANSLATIONS[language.code];
    if (language.code !== 'en') await chooseLanguage(language);
    await page.getByRole('heading', { name: copy.roleIntrospection, exact: true }).waitFor();
    for (const width of widths) {
      await page.setViewportSize({ width, height: width >= 768 ? 1000 : 812 });
      const logo = await checkLayout(`role branding ${language.code} ${width}px`);
      assert.equal(await logo.getAttribute('data-brand-logo'), 'horizontal');
      const logoBox = await logo.boundingBox();
      const switcherBox = await page.locator('header button').last().boundingBox();
      assert.ok(logoBox && switcherBox && logoBox.x + logoBox.width <= switcherBox.x + 1, 'Logo does not overlap the language switcher');
      if (language.code === 'en' && (width === 375 || width === 1440)) {
        await page.screenshot({ path: `browser-qa.local/branding-role-${width === 375 ? 'mobile375' : 'desktop1440'}.png`, fullPage: true });
      }
    }

    await page.getByRole('button', { name: copy.navCredits, exact: true }).click();
    await page.getByRole('heading', { name: copy.creditsTitle, exact: true }).waitFor();
    for (const width of widths) {
      await page.setViewportSize({ width, height: width >= 768 ? 1000 : 812 });
      const logo = await checkLayout(`credits branding ${language.code} ${width}px`);
      assert.equal(await logo.getAttribute('data-brand-logo'), 'stacked');
      assert.equal(await logo.locator('image').count(), 1, 'Credits preserve the original stacked artwork');
      assert.equal(await logo.locator('image').getAttribute('href'), source);
      if (language.code === 'en' && (width === 375 || width === 1440)) {
        await page.screenshot({ path: `browser-qa.local/branding-credits-${width === 375 ? 'mobile375' : 'desktop1440'}.png`, fullPage: true });
      }
    }
    await page.locator('[data-navigation-back]').click();
    await page.getByRole('heading', { name: copy.roleIntrospection, exact: true }).waitFor();
    assert.equal(await page.locator('[data-participant-role]').count(), 3, 'Credits return to the unselected participant page');
  }

  await chooseLanguage(LANGUAGES.find(language => language.code === 'en'));
  await page.setViewportSize({ width: 375, height: 812 });
  await page.getByRole('heading', { name: TRANSLATIONS.en.roleIntrospection, exact: true }).waitFor();
  console.log('Branding: original PNG decoded, accessible lockups, EN/FR/RO role and credits pages at 320/375/768/1440px passed.');
}
