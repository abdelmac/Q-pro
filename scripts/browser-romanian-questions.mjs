import assert from 'node:assert/strict';

/** Exercises real questionnaire controls using only the suite's intercepted APIs. */
export async function verifyBrowserRomanianQuestions({ page, fixtureDefinitions }) {
  const { ALL_QUESTION_IDS, RATING_SECTIONS, QUESTION_TRANSLATIONS, TRANSLATIONS, LANGUAGES } = fixtureDefinitions;
  const copy = TRANSLATIONS.ro;
  const informalRomanian = /(?:^|[\s„”"'(])(?:Ești|ești|Îți|îți|tău|tăi|tale|tine)(?=$|[\s.,!?”"')])/u;
  assert.equal(ALL_QUESTION_IDS.length, 81);
  assert.equal(RATING_SECTIONS.length, 7);
  assert.deepEqual(Object.keys(QUESTION_TRANSLATIONS.ro).sort(), [...ALL_QUESTION_IDS].sort());
  assert.equal(QUESTION_TRANSLATIONS.ro.P13, 'Rămâneți calm într-o situație de criză.');
  for (const id of ALL_QUESTION_IDS) {
    assert.doesNotMatch(QUESTION_TRANSLATIONS.ro[id], informalRomanian, `${id}: use formal Romanian address`);
  }

  const chooseLanguage = async code => {
    const language = LANGUAGES.find(entry => entry.code === code);
    assert.ok(language, `Language fixture exists for ${code}`);
    await page.locator('header button').last().click();
    await page.getByRole('button', { name: `${language.flag} ${language.label}`, exact: true }).click();
  };
  const noOverflow = async label => {
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const dimensions = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
    assert.ok(dimensions.scroll <= dimensions.width + 1, `${label}: horizontal overflow ${JSON.stringify(dimensions)}`);
  };
  const verifyLabels = async (section, language, width) => {
    const expected = section.questions.map(({ id }) => QUESTION_TRANSLATIONS[language][id]);
    assert.equal(await page.getByRole('slider').count(), section.questions.length);
    assert.deepEqual(await page.getByRole('slider').evaluateAll(elements => elements.map(element => element.getAttribute('aria-label'))), expected,
      `${section.id} ${language} ${width}px: accessible question labels match the selected translation`);
    assert.deepEqual(await page.locator('main fieldset legend').allTextContents(), expected,
      `${section.id} ${language}: each fieldset has its translated question`);
    const visibleParagraphs = await page.locator('main p').evaluateAll(elements => elements
      .filter(element => element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden')
      .map(element => element.textContent));
    for (const text of expected) assert.ok(visibleParagraphs.includes(text), `${section.id} ${language}: visible question text is complete`);
    await noOverflow(`${section.id} ${language} ${width}px`);
  };

  for (const width of [320, 375]) {
    await page.reload({ waitUntil: 'networkidle' });
    await page.setViewportSize({ width, height: 812 });
    await page.getByRole('heading', { name: TRANSLATIONS.en.roleIntrospection, exact: true }).waitFor();
    await chooseLanguage('ro');
    await page.locator('[data-participant-role="student"]').click();
    await page.getByRole('button', { name: copy.startButton, exact: true }).click();
    await page.getByRole('heading', { name: copy.specialtyTitle, exact: true }).waitFor();
    await page.getByRole('button', { name: copy.continue, exact: true }).click();
    await page.getByRole('heading', { name: copy.valuesTitle, exact: true }).waitFor();
    await page.locator('main button').first().click();
    await page.getByRole('button', { name: copy.continue, exact: true }).click();

    const visited = [];
    for (const [sectionIndex, section] of RATING_SECTIONS.entries()) {
      const sliders = page.getByRole('slider');
      await sliders.first().waitFor();
      await verifyLabels(section, 'ro', width);
      assert.deepEqual(await sliders.evaluateAll(elements => elements.map(element => ({ min: element.min, max: element.max, step: element.step }))),
        section.questions.map(() => ({ min: '1', max: '10', step: '1' })), 'Every question retains the integer 1–10 scale');
      const next = page.locator('footer').getByRole('button').last();
      assert.equal(await next.isDisabled(), true, 'A new section has no default answers');

      // Verify every discrete value through normal keyboard interaction once per
      // width, then answer the other controls at alternating scale boundaries.
      if (sectionIndex === 0) {
        const first = sliders.first();
        await first.press('Home');
        assert.equal(await first.inputValue(), '1');
        for (let rating = 2; rating <= 10; rating += 1) {
          await first.press('ArrowRight');
          assert.equal(await first.inputValue(), String(rating), 'The slider advances in exact integer steps');
        }
        await first.press('ArrowRight');
        assert.equal(await first.inputValue(), '10', 'The slider cannot exceed ten');
        await first.press('Home');
        await first.press('ArrowLeft');
        assert.equal(await first.inputValue(), '1', 'The slider cannot go below one');
      }

      const expectedRatings = [];
      for (const [index, question] of section.questions.entries()) {
        const rating = (sectionIndex + index) % 2 === 0 ? 10 : 1;
        await sliders.nth(index).press(rating === 10 ? 'End' : 'Home');
        assert.equal(await sliders.nth(index).inputValue(), String(rating));
        expectedRatings.push(String(rating));
        visited.push(question.id);
      }
      for (const language of ['en', 'fr', 'ro']) {
        await chooseLanguage(language);
        await verifyLabels(section, language, width);
        assert.deepEqual(await sliders.evaluateAll(elements => elements.map(element => element.value)), expectedRatings,
          `${section.id} ${language}: changing language retains all selected ratings`);
        assert.equal(await next.isDisabled(), false, 'Language changes do not discard completed answers');
      }
      await next.click();
    }
    assert.deepEqual(visited, ALL_QUESTION_IDS, `${width}px: all 81 questions were rendered in their original order`);
    await page.getByRole('heading', { name: copy.qProfileTitle, exact: true }).waitFor();
    assert.equal(await page.evaluate(() => localStorage.getItem('qpro.questionnaire.v1')), null, 'Questionnaire coverage does not save local drafts');
    assert.deepEqual(await page.evaluate(() => window.__questionnaireStorageWrites), []);
  }

  // Keep subsequent shared-page tests independent; never submit these answers.
  await page.reload({ waitUntil: 'networkidle' });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.getByRole('heading', { name: TRANSLATIONS.en.roleIntrospection, exact: true }).waitFor();
  assert.equal(await page.getByRole('slider').count(), 0);
  console.log('Romanian questionnaire: all 81 formal labels across seven sections at 320/375px, complete integer 1–10 slider range, EN/FR/RO switching without losing answers and no overflow passed. No research submissions.');
}
