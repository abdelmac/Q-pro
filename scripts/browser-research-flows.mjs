import assert from 'node:assert/strict';

/** High-risk consent/retry browser flows; invoked only with intercepted RPCs. */
export async function verifyBrowserResearchFlows({ page, context, catalog, fixtureDefinitions, submissionMocks, requests }) {
  const { SPECIALTIES, ALL_QUESTION_IDS, VALUE_OPTIONS, DEFAULT_PRIORITY_WEIGHTS, TRANSLATIONS, LOCAL_PROGRESS_COPY, createQuestionnairePersistence } = fixtureDefinitions;
  const copy = TRANSLATIONS.en;
  const localCopy = LOCAL_PROGRESS_COPY.en;
  const storageKey = 'qpro.questionnaire.v1';
  const queueKey = 'qpro.consented-submissions.v1';
  const studentId = '21b6c8e3-a8d3-4a67-9e5c-1a92c4852101';
  const specialistId = '21b6c8e3-a8d3-4a67-9e5c-1a92c4852102';
  const snapshot = {
    source: 'remote', version: catalog.version, revision: catalog.version.revision,
    specialties: SPECIALTIES,
    descriptions: Object.fromEntries(catalog.specialties.map(specialty => [specialty.name, specialty.descriptions])),
    clinicalSummaries: Object.fromEntries(catalog.specialties.map(specialty => [specialty.name, specialty.clinical_summaries])),
  };
  const specialistDraft = {
    submissionId: specialistId, actualSpecialty: SPECIALTIES[0].name,
    currentSpecialtyView: 'Synthetic clinical perspective for an automated browser test.',
    specialtyChangesOverYears: 'Synthetic changes observed over years of practice.',
    mostImportantSpecialtyQuality: 'Synthetic reflection about curiosity and listening.',
    wouldChooseAgain: 'yes', wouldNotChooseAgainReason: '',
    studentSelfQuestion: 'Synthetic question about meaningful work in medicine.',
    geography: { countryCode: 'RO', region: 'Cluj' },
  };
  const fullStudentDraft = {
    participantRole: 'student', language: 'en', location: { phase: 'student' },
    navigationStack: [{ phase: 'role' }, { phase: 'intro' }, { phase: 'qprofile' }, { phase: 'student' }],
    ratings: Object.fromEntries(ALL_QUESTION_IDS.map((id, index) => [id, (index % 10) + 1])),
    selectedValues: VALUE_OPTIONS.slice(0, 2), preferredSpecialty: null, actualSpecialty: null,
    priorities: DEFAULT_PRIORITY_WEIGHTS, specialistQuestionnaireMode: null,
    participantReflectionDraft: { submissionId: studentId, studyYear: '4', medicineView: '', geography: { countryCode: 'RO', region: 'Cluj' } },
    specialistDraft, catalog: snapshot,
  };
  async function serializedDraft(draft) {
    const saved = new Map();
    const serializer = createQuestionnairePersistence({ getItem: async key => saved.get(key) ?? null, setItem: async (key, value) => { saved.set(key, value); }, removeItem: async key => { saved.delete(key); } });
    await serializer.save(draft);
    assert.equal((await serializer.load()).status, 'restored');
    return saved.get(storageKey);
  }
  async function seedDraft(draft) {
    const raw = await serializedDraft(draft);
    await page.evaluate(({ key, raw }) => { localStorage.clear(); localStorage.setItem(key, raw); }, { key: storageKey, raw });
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByRole('button', { name: localCopy.resumeButton, exact: true }).waitFor();
    return raw;
  }
  async function resume(draft) {
    await seedDraft(draft);
    await page.getByRole('button', { name: localCopy.resumeButton, exact: true }).click();
  }
  const queue = () => page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? '{"items":[]}').items, queueKey);
  const waitQueueLength = length => page.waitForFunction(({ key, length }) => JSON.parse(localStorage.getItem(key) ?? '{"items":[]}').items.length === length, { key: queueKey, length });

  // Complete all 81 ratings through the same versioned draft parser as the app.
  // The written view remains blank and country/region are voluntarily supplied.
  const acceptedStudents = [];
  submissionMocks.handler = ({ route, rpc, args }) => {
    assert.equal(rpc, 'submit_student_response_v6');
    acceptedStudents.push(structuredClone(args));
    return route.fulfill({ json: args.p_submission_id });
  };
  await resume(fullStudentDraft);
  await page.getByRole('heading', { name: copy.studentDataTitle, exact: true }).waitFor();
  assert.equal(await page.locator('#medicine-view').inputValue(), '');
  assert.equal(await page.locator('#medicine-view').getAttribute('required'), null);
  const beforeSaving = requests.filter(request => request.rpc.startsWith('submit_')).length;
  await context.setOffline(true);
  await page.getByRole('button', { name: copy.studentContinue, exact: true }).click();
  await page.getByText(localCopy.queued, { exact: true }).waitFor();
  await waitQueueLength(1);
  const [queuedStudent] = await queue();
  assert.equal(queuedStudent.id, studentId);
  assert.equal(queuedStudent.consent, true);
  assert.equal(queuedStudent.status, 'pending');
  assert.equal(Object.keys(queuedStudent.payload.p_ratings).length, 81);
  assert.equal(queuedStudent.payload.p_medicine_view, null);
  assert.equal(queuedStudent.payload.p_country_code, 'RO');
  assert.equal(queuedStudent.catalogVersionId, catalog.version.id);
  assert.equal(requests.filter(request => request.rpc.startsWith('submit_')).length, beforeSaving, 'Offline Save must not pretend the server received a submission');
  const { rpc_name: queuedRpc, ...frozenStudentPayload } = queuedStudent.payload;
  assert.equal(queuedRpc, 'submit_student_response_v6');
  await context.setOffline(false);
  await waitQueueLength(0);
  assert.equal(acceptedStudents.length, 1, 'Reconnection sends the frozen contribution once');
  assert.deepEqual(acceptedStudents[0], frozenStudentPayload);
  await page.evaluate(() => { window.dispatchEvent(new Event('online')); window.dispatchEvent(new Event('online')); });
  await page.waitForFunction(() => !document.querySelector('button:disabled')?.textContent?.includes('Sending'));
  assert.equal(acceptedStudents.length, 1, 'Repeated online notifications do not resend an accepted contribution');
  console.log('Browser consent flow: optional text, offline queue and identical once-confirmed retry passed.');

  // A prior success is not a receipt for a different payload using the same ID.
  const specialistCalls = [];
  submissionMocks.handler = ({ route, rpc, args }) => {
    assert.equal(rpc, 'submit_specialist_response_v5');
    specialistCalls.push(structuredClone(args));
    return specialistCalls.length === 1
      ? route.fulfill({ json: args.p_submission_id })
      : route.fulfill({ status: 409, json: { code: '23505', message: 'Submission ID already used with a different payload', details: null, hint: null } });
  };
  await resume({ ...fullStudentDraft, participantRole: 'specialist', ratings: {}, selectedValues: [], specialistQuestionnaireMode: 'skipped', location: { phase: 'specialist' }, navigationStack: [{ phase: 'role' }, { phase: 'intro' }, { phase: 'specialist-choice' }, { phase: 'specialist' }] });
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
  assert.equal(specialistCalls[0].p_submission_id, specialistId);
  assert.equal(specialistCalls[1].p_submission_id, specialistId);
  assert.equal(specialistCalls[1].p_current_specialty_view, changedView);
  assert.notDeepEqual(specialistCalls[0], specialistCalls[1]);
  const [rejected] = await queue();
  assert.equal(rejected.status, 'rejected');
  assert.equal(rejected.payload.p_current_specialty_view, changedView);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  assert.equal(specialistCalls.length, 2, 'Rejected payloads are not retried automatically');
  console.log('Browser consent flow: stale successful receipt does not accept an edited same-ID contribution.');

  // A saved draft can only be replaced with an explicit choice.
  const original = await seedDraft(fullStudentDraft);
  let dialogPromise = page.waitForEvent('dialog');
  let chooseRole = page.locator('[data-participant-role="curious"]').click();
  let dialog = await dialogPromise;
  assert.match(dialog.message(), /draft|saved|discard|erase|replace/i);
  await dialog.dismiss();
  await chooseRole;
  assert.equal(await page.evaluate(key => localStorage.getItem(key), storageKey), original);
  assert.equal(await page.getByRole('button', { name: localCopy.resumeButton, exact: true }).isVisible(), true);
  dialogPromise = page.waitForEvent('dialog');
  chooseRole = page.locator('[data-participant-role="curious"]').click();
  dialog = await dialogPromise;
  await dialog.accept();
  await chooseRole;
  await page.getByRole('button', { name: copy.startButton, exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: localCopy.resumeButton, exact: true }).count(), 0);
  await page.waitForFunction(key => JSON.parse(localStorage.getItem(key) ?? '{}').draft?.participantRole === 'curious', storageKey);

  // Opting out survives a browser reload and must not silently resume saving.
  await page.locator('aside details summary').first().click();
  await page.getByLabel(localCopy.enable, { exact: true }).uncheck();
  await page.waitForFunction(key => localStorage.getItem(key) === null, storageKey);
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('aside details summary').first().click();
  assert.equal(await page.getByLabel(localCopy.enable, { exact: true }).isChecked(), false);
  await page.locator('[data-participant-role="student"]').click();
  await page.getByRole('button', { name: copy.startButton, exact: true }).waitFor();
  assert.equal(await page.evaluate(key => localStorage.getItem(key), storageKey), null);
  console.log('Browser privacy flow: explicit resume replacement and reload-persistent local-save opt-out passed.');
  submissionMocks.handler = null;
}
