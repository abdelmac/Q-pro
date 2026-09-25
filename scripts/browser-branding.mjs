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
  const checkVectorArtwork = async (logo, label) => {
    const artwork = await logo.evaluate(element => {
      const elements = [element, ...element.querySelectorAll('*')];
      const gradientIds = [...element.querySelectorAll('linearGradient, radialGradient')].map(gradient => gradient.id);
      const localIds = elements.filter(node => node.id).map(node => node.id);
      const paintReferences = elements.flatMap(node => [...node.attributes].flatMap(attribute =>
        [...attribute.value.matchAll(/url\(["']?#([^\s)"']+)["']?\)/g)].map(match => match[1])));
      const allIds = [...document.querySelectorAll('[data-brand-logo] [id]')].map(node => node.id);
      return {
        tagName: element.tagName.toLowerCase(),
        rasterImages: element.querySelectorAll('image, img, foreignObject').length,
        pathCount: element.querySelectorAll('path[d]').length,
        gradientIds,
        unresolvedPaints: paintReferences.filter(id => !localIds.includes(id)),
        duplicateIds: allIds.filter((id, index) => allIds.indexOf(id) !== index),
        blendModes: [...new Set(elements.map(node => getComputedStyle(node).mixBlendMode))],
        wordmark: [...element.querySelectorAll('text')].map(node => node.textContent).join(' ').replace(/\s+/g, ' ').trim(),
        variant: element.dataset.brandLogo,
      };
    });
    assert.equal(artwork.tagName, 'svg', `${label}: logo uses native vector artwork`);
    assert.equal(artwork.rasterImages, 0, `${label}: logo does not wrap a bitmap`);
    assert.ok(artwork.pathCount > 0, `${label}: compass is drawn with vector paths`);
    assert.ok(artwork.gradientIds.length > 0 && artwork.gradientIds.every(Boolean), `${label}: gradient IDs are present`);
    assert.deepEqual(artwork.unresolvedPaints, [], `${label}: paint and mask references resolve within this logo`);
    assert.deepEqual(artwork.duplicateIds, [], `${label}: logo instances have distinct gradient IDs`);
    assert.deepEqual(artwork.blendModes, ['normal'], `${label}: transparent artwork does not rely on blending a white image`);
    if (artwork.variant !== 'mark') assert.equal(artwork.wordmark, 'Specialty Match', `${label}: vector lettering is complete`);
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
    await checkVectorArtwork(logo, label);
    return logo;
  };

  await page.getByRole('heading', { name: TRANSLATIONS.en.roleIntrospection, exact: true }).waitFor();
  const horizontalLogo = page.locator('[data-brand-logo="horizontal"]');
  await checkVectorArtwork(horizontalLogo, 'Initial horizontal logo');
  const magnifiedArtwork = await horizontalLogo.evaluate(async element => {
    const clone = element.cloneNode(true);
    const box = element.viewBox.baseVal;
    // Render at four times its native viewBox scale to exercise vector scaling.
    clone.setAttribute('width', String(Math.ceil(box.width * 4)));
    clone.setAttribute('height', String(Math.ceil(box.height * 4)));
    clone.removeAttribute('class');
    const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' }));
    const image = new Image();
    try {
      image.src = url;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0);
      const corners = [[0, 0], [canvas.width - 1, 0], [0, canvas.height - 1], [canvas.width - 1, canvas.height - 1]];
      return {
        width: canvas.width,
        height: canvas.height,
        cornerAlpha: corners.map(([x, y]) => context.getImageData(x, y, 1, 1).data[3]),
      };
    } finally {
      URL.revokeObjectURL(url);
    }
  });
  assert.ok(magnifiedArtwork.width > 1000 && magnifiedArtwork.height > 100, 'The inline vector renders at high resolution');
  assert.deepEqual(magnifiedArtwork.cornerAlpha, [0, 0, 0, 0], 'Vector lockup has transparent corners instead of a white image plate');

  // Playwright intentionally aborts /favicon.ico in routed browser contexts.
  // Verify that exact resource with its HTTP client; decode SVG and PNGs in-page.
  const icoHref = await page.locator('head link[rel="icon"][type="image/x-icon"]').getAttribute('href');
  const icoResponse = await page.request.get(new URL(icoHref, page.url()).href);
  assert.equal(icoResponse.status(), 200, 'ICO fallback is served at its exact declared URL');
  assert.ok((await icoResponse.body()).length > 22, 'ICO fallback is not empty');
  const iconResults = await page.evaluate(async () => {
    const links = [...document.head.querySelectorAll('link[rel="icon"], link[rel="apple-touch-icon"], link[rel="manifest"]')];
    return Promise.all(links.map(async link => {
      const response = link.type === 'image/x-icon' ? null : await fetch(link.href);
      const result = { rel: link.rel, type: link.type, sizes: link.getAttribute('sizes'), status: response?.status ?? 200, contentType: response?.headers.get('content-type'), pathname: new URL(link.href).pathname };
      if (link.rel === 'manifest') {
        const manifest = await response.json();
        result.icons = await Promise.all(manifest.icons.map(async entry => {
          const url = new URL(entry.src, link.href);
          const image = new Image(); image.src = url.href; await image.decode();
          return { sizes: entry.sizes, purpose: entry.purpose, width: image.naturalWidth, height: image.naturalHeight, pathname: url.pathname };
        }));
      } else if (link.type === 'image/png' || link.type === 'image/svg+xml' || link.rel === 'apple-touch-icon') {
        const image = new Image(); image.src = link.href; await image.decode();
        result.width = image.naturalWidth; result.height = image.naturalHeight;
      }
      return result;
    }));
  });
  assert.equal(iconResults.length, 6, 'Vector favicon, browser fallback icons, Apple touch icon and manifest are linked');
  const vectorIcon = iconResults.find(icon => icon.type === 'image/svg+xml');
  assert.ok(vectorIcon, 'A vector favicon is declared');
  assert.equal(vectorIcon.sizes, 'any', 'Vector favicon scales to any browser icon size');
  assert.match(vectorIcon.contentType ?? '', /^image\/svg\+xml/);
  assert.match(vectorIcon.pathname, /\/branding\/compass\.svg$/);
  assert.equal(vectorIcon.width, 100);
  assert.equal(vectorIcon.height, 100);
  for (const icon of iconResults) {
    assert.equal(icon.status, 200, `Icon resolves: ${icon.pathname}`);
    assert.ok(icon.pathname.startsWith('/Q-pro/'), 'Icon resources respect the deployment base path');
    if (icon.sizes && icon.sizes !== 'any') assert.equal(`${icon.width}x${icon.height}`, icon.sizes, 'Icon dimensions match the declaration');
    for (const entry of icon.icons ?? []) {
      assert.equal(`${entry.width}x${entry.height}`, entry.sizes);
      assert.ok(entry.pathname.startsWith('/Q-pro/branding/'));
      assert.equal(entry.purpose, 'any maskable');
    }
  }

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
  console.log('Branding: transparent vector lockups, unique gradients, 4x rendering, SVG/browser/home-screen icons, EN/FR/RO role and credits pages at 320/375/768/1440px passed.');
}
