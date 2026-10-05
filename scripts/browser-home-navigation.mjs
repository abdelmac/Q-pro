import assert from 'node:assert/strict';

/** Tests Home with synthetic API fixtures in a fresh tab, never an existing user session. */
export async function verifyBrowserHomeNavigation({ context, fixtureDefinitions }) {
  const { LANGUAGES, TRANSLATIONS, MAP_TRANSLATIONS } = fixtureDefinitions;
  const page = await context.newPage();
  const errors = [];
  const submissions = [];
  let documentRequests = 0;
  page.setDefaultTimeout(15_000);
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    if (request.resourceType() === 'document') documentRequests += 1;
    if (/\/rest\/v1\/rpc\/submit_/.test(request.url())) submissions.push(request.url());
  });
  // This tab does not inherit the shared page's beforeunload-only dialog assertion.
  // Confirmation dialogs are handled explicitly at each tested navigation below.
  page.on('dialog', dialog => {
    if (dialog.type() === 'beforeunload') void dialog.accept();
  });
  const home = page.locator('header [data-navigation-home]');
  const next = page.locator('footer').getByRole('button').last();
  const snapshotStorage = () => page.evaluate(() => Object.fromEntries(
    Object.keys(localStorage).sort().map(key => [key, localStorage.getItem(key)]),
  ));
  const chooseLanguage = async language => {
    if (language.code === 'en') return;
    await page.locator('header button').last().click();
    await page.getByRole('button', { name: `${language.flag} ${language.label}`, exact: true }).click();
  };
  const checkHeader = async (copy, label, current = false) => {
    await home.waitFor({ state: 'visible' });
    assert.equal(await home.count(), 1, `${label}: exactly one Home button is shown`);
    assert.equal(await home.and(page.getByRole('button', { name: copy.home, exact: true })).count(), 1, `${label}: Home has a translated accessible name`);
    assert.equal(await home.getAttribute('aria-current'), current ? 'page' : null, `${label}: current-page state is correct`);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const layout = await page.evaluate(() => {
      const rect = element => {
        const box = element.getBoundingClientRect();
        return { x: box.x, y: box.y, width: box.width, height: box.height };
      };
      const visible = element => element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden';
      return {
        width: innerWidth,
        scroll: document.documentElement.scrollWidth,
        home: rect(document.querySelector('header [data-navigation-home]')),
        controls: [...document.querySelectorAll('header button, header [data-brand-logo]')].filter(visible).map(rect),
      };
    });
    assert.ok(layout.scroll <= layout.width + 1, `${label}: page fits without horizontal overflow`);
    assert.ok(layout.home.width >= 44 && layout.home.height >= 44, `${label}: Home has a mobile-sized touch target`);
    for (const [index, box] of layout.controls.entries()) {
      assert.ok(box.x >= -1 && box.x + box.width <= layout.width + 1, `${label}: header control ${index} fits the viewport`);
      for (const other of layout.controls.slice(index + 1)) {
        const overlapWidth = Math.min(box.x + box.width, other.x + other.width) - Math.max(box.x, other.x);
        const overlapHeight = Math.min(box.y + box.height, other.y + other.height) - Math.max(box.y, other.y);
        assert.ok(overlapWidth <= 1 || overlapHeight <= 1, `${label}: header buttons and branding do not overlap`);
      }
    }
    const language = LANGUAGES.find(entry => TRANSLATIONS[entry.code] === copy);
    const switcher = page.locator('header button').last();
    const switcherText = (await switcher.innerText()).trim();
    if ([language.flag, language.label].includes(switcherText)) {
      await switcher.click();
      for (const option of LANGUAGES) {
        const button = page.getByRole('button', { name: `${option.flag} ${option.label}`, exact: true });
        await button.waitFor({ state: 'visible' });
        const bounds = await button.boundingBox();
        assert.ok(bounds && bounds.x >= -1 && bounds.x + bounds.width <= layout.width + 1,
          `${label}: the open language menu stays entirely inside the viewport`);
      }
      await page.getByRole('button', { name: `${language.flag} ${language.label}`, exact: true }).click();
    }
    if ((label.endsWith('fr 320px') && /^(Role|Intro|Partial questionnaire) /.test(label))
      || label === 'Role en 375px') {
      await page.screenshot({ path: `browser-qa.local/home-navigation-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`, fullPage: true, animations: 'disabled' });
    }
  };
  const expectRole = async copy => {
    await page.getByRole('heading', { name: copy.roleIntrospection, exact: true }).waitFor();
    assert.equal(await page.locator('[data-participant-role]').count(), 3, 'Home returns directly to participant selection');
    await page.waitForFunction(() => scrollY === 0);
  };
  const visitIntro = async copy => {
    await page.locator('[data-participant-role="student"]').click();
    await page.getByRole('button', { name: copy.startButton, exact: true }).waitFor();
  };
  const startStudent = async copy => {
    await visitIntro(copy);
    await page.getByRole('button', { name: copy.startButton, exact: true }).click();
    await page.getByRole('heading', { name: copy.specialtyTitle, exact: true }).waitFor();
  };
  const answerHomeConfirmation = async (copy, accept) => {
    const dialogPromise = page.waitForEvent('dialog');
    const clickPromise = home.click();
    const dialog = await dialogPromise;
    assert.equal(dialog.type(), 'confirm', 'Discarding in-memory answers requires confirmation');
    assert.equal(dialog.message(), copy.homeExitConfirm, 'The warning is translated and explains the reset');
    if (accept) await dialog.accept();
    else await dialog.dismiss();
    await clickPromise;
  };

  try {
    for (const width of [320, 375, 1440]) {
      await page.setViewportSize({ width, height: width >= 768 ? 1000 : 812 });
      for (const language of LANGUAGES) {
        const copy = TRANSLATIONS[language.code];
        const label = `${language.code} ${width}px`;
        await page.goto('http://127.0.0.1:4179/', { waitUntil: 'networkidle' });
        await chooseLanguage(language);
        await expectRole(copy);
        const initialStorage = await snapshotStorage();
        const initialDocumentRequests = documentRequests;
        await checkHeader(copy, `Role ${label}`, true);
        await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
        await home.click();
        await expectRole(copy);

        await page.getByRole('button', { name: copy.navCredits, exact: true }).click();
        await page.getByRole('heading', { name: copy.creditsTitle, exact: true }).waitFor();
        await checkHeader(copy, `Credits ${label}`);
        await home.click();
        await expectRole(copy);

        await page.getByRole('button', { name: copy.navWorldMap, exact: true }).click();
        await page.getByRole('heading', { name: MAP_TRANSLATIONS[language.code].title, exact: true }).waitFor();
        await checkHeader(copy, `Map ${label}`);
        await home.click();
        await expectRole(copy);

        await visitIntro(copy);
        await checkHeader(copy, `Intro ${label}`);
        await home.focus();
        await home.press('Enter');
        await expectRole(copy);

        await visitIntro(copy);
        await page.getByRole('button', { name: copy.navExplorer, exact: true }).click();
        await page.getByRole('heading', { name: copy.explorerTitle, exact: true }).waitFor();
        await checkHeader(copy, `Explorer ${label}`);
        await home.click();
        await expectRole(copy);

        await visitIntro(copy);
        await page.getByRole('button', { name: copy.navExplorer, exact: true }).click();
        const specialtyHeading = page.getByRole('heading', { level: 3 }).first();
        const specialtyName = await specialtyHeading.textContent();
        await specialtyHeading.click();
        await page.getByRole('heading', { name: specialtyName, exact: true }).waitFor();
        await checkHeader(copy, `Nested specialty ${label}`);
        await home.click();
        await expectRole(copy);

        await startStudent(copy);
        await checkHeader(copy, `Questionnaire specialty ${label}`);
        const specialtyChoice = page.locator('main button[aria-pressed]').first();
        await specialtyChoice.click();
        await next.click();
        await page.getByRole('heading', { name: copy.valuesTitle, exact: true }).waitFor();
        await page.locator('main button').first().click();
        await next.click();
        const sliders = page.getByRole('slider');
        await sliders.first().waitFor();
        await sliders.first().press('End');
        await checkHeader(copy, `Partial questionnaire ${label}`);
        const ratingState = await sliders.evaluateAll(elements => elements.map(element => ({
          value: element.value, unanswered: element.getAttribute('aria-valuetext'),
        })));
        await answerHomeConfirmation(copy, false);
        assert.deepEqual(await sliders.evaluateAll(elements => elements.map(element => ({
          value: element.value, unanswered: element.getAttribute('aria-valuetext'),
        }))), ratingState, `${label}: cancelling Home preserves all ratings`);

        // Check the earlier inputs as well, not just the currently displayed slider.
        await page.locator('[data-navigation-back]').click();
        await page.getByRole('heading', { name: copy.valuesTitle, exact: true }).waitFor();
        assert.equal(await page.locator('main button').first().locator('svg').count(), 1, `${label}: cancelling preserves the selected value`);
        await page.locator('[data-navigation-back]').click();
        await page.getByRole('heading', { name: copy.specialtyTitle, exact: true }).waitFor();
        assert.equal(await page.locator('main button[aria-pressed="true"]').count(), 1, `${label}: cancelling preserves the selected specialty`);
        await next.click();
        await next.click();
        assert.equal(await sliders.first().inputValue(), '10', `${label}: returning to ratings preserves the answer`);
        await answerHomeConfirmation(copy, true);
        await expectRole(copy);
        assert.deepEqual(await snapshotStorage(), initialStorage, `${label}: Home neither writes drafts nor removes unrelated browser storage`);
        assert.equal(documentRequests, initialDocumentRequests, `${label}: Home is in-app navigation, never a browser reload`);

        await startStudent(copy);
        assert.equal(await page.locator('main button[aria-pressed="true"]').count(), 0, `${label}: confirmed Home clears the previous specialty`);
        await next.click();
        await page.getByRole('heading', { name: copy.valuesTitle, exact: true }).waitFor();
        assert.equal(await next.isDisabled(), true, `${label}: confirmed Home clears selected values`);
        await page.locator('main button').first().click();
        await next.click();
        await sliders.first().waitFor();
        assert.deepEqual(await sliders.evaluateAll(elements => elements.map(element => element.getAttribute('aria-valuetext'))),
          Array(await sliders.count()).fill(copy.sliderNoSelection), `${label}: all ratings are unanswered on a clean restart`);
        assert.equal(await next.isDisabled(), true, `${label}: reset ratings do not count as default answers`);
        await answerHomeConfirmation(copy, true);
        await expectRole(copy);
        assert.deepEqual(await page.evaluate(() => ({
          draft: localStorage.getItem('qpro.questionnaire.v1'),
          savingPreference: localStorage.getItem('qpro.autosave-enabled.v1'),
          writes: window.__questionnaireStorageWrites,
        })), { draft: null, savingPreference: null, writes: [] }, `${label}: navigation retains memory-only questionnaire progress`);

        if (width === 375 && language.code === 'en') {
          await page.locator('[data-participant-role="specialist"]').click();
          await page.getByRole('button', { name: copy.startButton, exact: true }).click();
          await page.locator('[data-specialist-path="skip"]').waitFor();
          await checkHeader(copy, `Specialist choice ${label}`);
          await page.locator('[data-specialist-path="skip"]').click();
          await page.getByRole('heading', { name: copy.specialistSpecialtyTitle, exact: true }).waitFor();
          await checkHeader(copy, `Specialist contribution ${label}`);
          await page.getByLabel(MAP_TRANSLATIONS.en.country, { exact: true }).selectOption('RO');
          await answerHomeConfirmation(copy, false);
          assert.equal(await page.getByLabel(MAP_TRANSLATIONS.en.country, { exact: true }).inputValue(), 'RO',
            'Cancelling Home preserves a geography-only contribution form before any written answer');
          await answerHomeConfirmation(copy, true);
          await expectRole(copy);
          assert.deepEqual(await snapshotStorage(), initialStorage, 'Leaving a specialist contribution does not submit or store its fields');
        }
      }
    }
    assert.deepEqual(errors, [], 'Home navigation has no browser runtime errors');
    assert.deepEqual(submissions, [], 'Home navigation never submits research answers');
    console.log('Home navigation passed at 320/375/1440px in EN/RO/FR: public-page headers, direct and nested returns, keyboard activation, confirmed resets, cancellation preserving all answer types, clean restarts and no reload/storage/submission.');
  } finally {
    await page.close();
  }
}
