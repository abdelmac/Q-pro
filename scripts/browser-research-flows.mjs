import assert from 'node:assert/strict';

/** High-risk consent/retry browser flows; invoked only with intercepted RPCs. */
export async function verifyBrowserResearchFlows({ page, context, catalog, fixtureDefinitions, submissionMocks, requests }) {
  const { SPECIALTIES, ALL_QUESTION_IDS, RATING_SECTIONS, TRANSLATIONS, MAP_TRANSLATIONS, LOCAL_PROGRESS_COPY } = fixtureDefinitions;
  const copy = TRANSLATIONS.en;
  const mapCopy = MAP_TRANSLATIONS.en;
  const localCopy = LOCAL_PROGRESS_COPY.en;
  const storageKey = 'qpro.questionnaire.v1';
  const preferenceKey = 'qpro.autosave-enabled.v1';
  const queueKey = 'qpro.consented-submissions.v1';
  const queue = () => page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? '{"items":[]}').items, queueKey);
  const waitQueueLength = length => page.waitForFunction(({ key, length }) => JSON.parse(localStorage.getItem(key) ?? '{"items":[]}').items.length === length, { key: queueKey, length });
  async function assertNoQuestionnaireStorage() {
    assert.deepEqual(await page.evaluate(({ storageKey, preferenceKey }) => ({
      draft: localStorage.getItem(storageKey), preference: localStorage.getItem(preferenceKey),
      writes: window.__questionnaireStorageWrites,
    }), { storageKey, preferenceKey }), { draft: null, preference: null, writes: [] });
    assert.equal(await page.getByText('On this device', { exact: true }).count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Resume questionnaire', exact: true }).count(), 0);
    assert.equal(await page.getByLabel('Save my progress on this device', { exact: true }).count(), 0);
  }
  async function start(role) {
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator(`[data-participant-role="${role}"]`).click();
    await page.getByRole('button', { name: copy.startButton, exact: true }).click();
  }

  // Complete the real interface, including every rating. No local-storage draft
  // or application test backdoor is used to bypass questionnaire validation.
  const acceptedStudents = [];
  submissionMocks.handler = ({ route, rpc, args }) => {
    assert.equal(rpc, 'submit_student_response_v7');
    assert.equal(args.p_scoring_context.engine_revision, 'scoring-engine-v2');
    assert.equal(args.p_scoring_context.trait_mapping_version, 'question-traits-q81-v1');
    assert.match(args.p_scoring_context.model_checksum, /^fnv1a64-[0-9a-f]{16}$/);
    assert.equal(Object.keys(args.p_scoring_context.priorities).length, 5);
    acceptedStudents.push(structuredClone(args));
    return route.fulfill({ json: args.p_submission_id });
  };
  await start('student');
  assert.equal(await page.locator('[data-pending-submissions]').count(), 0, 'An empty queue shows no notice');
  await page.getByRole('heading', { name: copy.specialtyTitle, exact: true }).waitFor();
  await page.getByRole('button', { name: copy.continue, exact: true }).click();
  await page.getByRole('heading', { name: copy.valuesTitle, exact: true }).waitFor();
  await page.locator('main button').nth(0).click();
  await page.locator('main button').nth(1).click();
  await page.getByRole('button', { name: copy.continue, exact: true }).click();
  const expectedRatings = {};
  for (const [sectionIndex, section] of RATING_SECTIONS.entries()) {
    const sliders = page.getByRole('slider');
    await sliders.first().waitFor();
    assert.equal(await sliders.count(), section.questions.length);
    const next = page.locator('footer').getByRole('button').last();
    assert.equal(await next.isDisabled(), true, 'Unanswered questions still block the next step');
    for (const [questionIndex, question] of section.questions.entries()) {
      const rating = (sectionIndex + questionIndex) % 2 === 0 ? 10 : 1;
      await sliders.nth(questionIndex).press(rating === 10 ? 'End' : 'Home');
      assert.equal(await sliders.nth(questionIndex).inputValue(), String(rating));
      expectedRatings[question.id] = rating;
    }
    await next.click();
  }
  assert.equal(Object.keys(expectedRatings).length, ALL_QUESTION_IDS.length);
  assert.equal(ALL_QUESTION_IDS.length, 81);
  await page.getByRole('heading', { name: copy.qProfileTitle, exact: true }).waitFor();
  await page.getByRole('button', { name: copy.qProfileContinue, exact: true }).click();
  await page.getByRole('heading', { name: copy.studentDataTitle, exact: true }).waitFor();
  assert.equal(await page.locator('#medicine-view').inputValue(), '');
  assert.equal(await page.locator('#medicine-view').getAttribute('required'), null);
  await page.locator('#study-year').selectOption('4');
  await page.getByLabel(mapCopy.country, { exact: true }).selectOption('RO');
  await page.getByLabel(mapCopy.region, { exact: true }).fill('Cluj');
  await assertNoQuestionnaireStorage();
  assert.equal((await queue()).length, 0, 'Unsubmitted answers are not saved in the research queue');
  const beforeSaving = requests.filter(request => request.rpc.startsWith('submit_')).length;
  await context.setOffline(true);
  await page.getByRole('button', { name: copy.studentContinue, exact: true }).click();
  await page.getByText(localCopy.queued, { exact: true }).waitFor();
  await waitQueueLength(1);
  await page.locator('[data-pending-submissions]').waitFor();
  const [queuedStudent] = await queue();
  assert.match(queuedStudent.id, /^[0-9a-f-]{36}$/i);
  assert.equal(queuedStudent.id, queuedStudent.payload.p_submission_id);
  assert.equal(queuedStudent.consent, true);
  assert.equal(queuedStudent.status, 'pending');
  assert.deepEqual(queuedStudent.payload.p_ratings, expectedRatings);
  assert.equal(queuedStudent.payload.p_medicine_view, null);
  assert.equal(queuedStudent.payload.p_study_year, 4);
  assert.equal(queuedStudent.payload.p_country_code, 'RO');
  assert.equal(queuedStudent.catalogVersionId, catalog.version.id);
  assert.equal(requests.filter(request => request.rpc.startsWith('submit_')).length, beforeSaving, 'Offline Save must not pretend the server received a submission');
  const { rpc_name: queuedRpc, ...frozenStudentPayload } = queuedStudent.payload;
  assert.equal(queuedRpc, 'submit_student_response_v7');
  await context.setOffline(false);
  await waitQueueLength(0);
  await page.locator('[data-pending-submissions]').waitFor({ state: 'detached' });
  assert.equal(acceptedStudents.length, 1, 'Reconnection sends the frozen contribution once');
  assert.deepEqual(acceptedStudents[0], frozenStudentPayload);
  await page.evaluate(() => { window.dispatchEvent(new Event('online')); window.dispatchEvent(new Event('online')); });
  await page.waitForFunction(() => !document.querySelector('button:disabled')?.textContent?.includes('Sending'));
  assert.equal(acceptedStudents.length, 1, 'Repeated online notifications do not resend an accepted contribution');
  await assertNoQuestionnaireStorage();
  console.log('Browser consent flow: all 81 ratings, optional text, offline queue and identical once-confirmed retry passed without local questionnaire saves.');

  // A prior success is not a receipt for a different payload using the same ID.
  const specialistCalls = [];
  submissionMocks.handler = ({ route, rpc, args }) => {
    assert.equal(rpc, 'submit_specialist_response_v6');
    assert.equal(args.p_scoring_context, null, 'Skipped questionnaires do not invent scoring settings');
    specialistCalls.push(structuredClone(args));
    return specialistCalls.length === 1
      ? route.fulfill({ json: args.p_submission_id })
      : route.fulfill({ status: 409, json: { code: '23505', message: 'Submission ID already used with a different payload', details: null, hint: null } });
  };
  await start('specialist');
  await page.locator('[data-specialist-path="skip"]').click();
  await page.getByRole('button', { name: SPECIALTIES[0].name, exact: true }).click();
  await page.getByPlaceholder(copy.specialistCurrentViewPlaceholder, { exact: true }).fill('Synthetic clinical perspective for an automated browser test.');
  await page.getByPlaceholder(copy.specialistChangesOverYearsPlaceholder, { exact: true }).fill('Synthetic changes observed over years of practice.');
  await page.getByPlaceholder(copy.specialistMostImportantQualityPlaceholder, { exact: true }).fill('Synthetic reflection about curiosity and listening.');
  await page.getByRole('button', { name: copy.specialistYes, exact: true }).click();
  await page.getByPlaceholder(copy.specialistStudentSelfQuestionPlaceholder, { exact: true }).fill('Synthetic question about meaningful work in medicine.');
  await page.getByLabel(mapCopy.country, { exact: true }).selectOption('RO');
  await page.getByLabel(mapCopy.region, { exact: true }).fill('Cluj');
  await page.getByRole('button', { name: copy.specialistSubmit, exact: true }).click();
  await page.getByRole('heading', { name: copy.specialistThankYou, exact: true }).waitFor();
  assert.equal(specialistCalls.length, 1);
  await page.locator('[data-navigation-back]').click();
  await page.locator('[data-specialist-path="skip"]').click();
  const changedView = 'Changed synthetic perspective: this is a distinct contribution payload.';
  await page.getByPlaceholder(copy.specialistCurrentViewPlaceholder, { exact: true }).fill(changedView);
  await page.getByRole('button', { name: copy.specialistSubmit, exact: true }).click();
  await page.getByText(/This contribution was not accepted\./).waitFor();
  assert.equal(await page.getByRole('heading', { name: copy.specialistThankYou, exact: true }).count(), 0);
  assert.equal(specialistCalls.length, 2);
  assert.match(specialistCalls[0].p_submission_id, /^[0-9a-f-]{36}$/i);
  assert.equal(specialistCalls[1].p_submission_id, specialistCalls[0].p_submission_id);
  assert.equal(specialistCalls[1].p_current_specialty_view, changedView);
  assert.notDeepEqual(specialistCalls[0], specialistCalls[1]);
  const [rejected] = await queue();
  assert.equal(rejected.status, 'rejected');
  assert.equal(rejected.payload.p_current_specialty_view, changedView);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  assert.equal(specialistCalls.length, 2, 'Rejected payloads are not retried automatically');
  await assertNoQuestionnaireStorage();
  console.log('Browser consent flow: stale successful receipt does not accept an edited same-ID contribution.');

  // Upgrading removes only legacy autosave keys, not consented submissions or
  // unrelated preferences. The opaque draft must never be parsed or resumed.
  const preservedQueue = await page.evaluate(key => localStorage.getItem(key), queueKey);
  await page.evaluate(({ storageKey, preferenceKey }) => {
    localStorage.setItem(storageKey, JSON.stringify({ legacy: 'old questionnaire draft' }));
    localStorage.setItem(preferenceKey, 'true');
    localStorage.setItem('q-pro-browser-unrelated-preference', 'preserve-me');
  }, { storageKey, preferenceKey });
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: copy.roleIntrospection, exact: true }).waitFor();
  await page.waitForFunction(({ storageKey, preferenceKey }) => localStorage.getItem(storageKey) === null && localStorage.getItem(preferenceKey) === null, { storageKey, preferenceKey });
  await assertNoQuestionnaireStorage();
  assert.equal(await page.evaluate(key => localStorage.getItem(key), queueKey), preservedQueue);
  assert.equal(await page.evaluate(() => localStorage.getItem('q-pro-browser-unrelated-preference')), 'preserve-me');
  await page.locator('[data-participant-role="curious"]').click();
  await page.getByRole('button', { name: copy.startButton, exact: true }).waitFor();
  await assertNoQuestionnaireStorage();
  await page.locator('[data-pending-submissions]').getByRole('button', { name: localCopy.remove, exact: true }).click();
  await waitQueueLength(0);
  await page.locator('[data-pending-submissions]').waitFor({ state: 'detached' });
  console.log('Browser privacy flow: no resume UI or draft writes; reload starts fresh and clears only obsolete autosave data.');
  submissionMocks.handler = null;
}
