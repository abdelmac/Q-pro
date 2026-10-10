import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { build } from 'esbuild';
import { chromium } from 'playwright';

// Documentation only. This imports static source; it never reads .env, Auth or a backend.
const stem = 'MedCompass-Questionnaire-EN-RO-FR-2026-10-10';
const output = resolve('docs');
const qa = resolve('.local', 'questionnaire-document-qa');
const languages = ['en', 'ro', 'fr'];
const bundle = await build({
  stdin: { contents: `export { RATING_SECTIONS } from './src/data/questions'; export { TRANSLATIONS, QUESTION_TRANSLATIONS, SECTION_TRANSLATIONS, VALUE_TRANSLATIONS } from './src/data/i18n'; export { VALUE_OPTIONS } from './src/data/traits'; export { MAP_TRANSLATIONS } from './src/data/mapI18n'; export { STUDENT_STUDY_YEARS } from './src/lib/participantProfile';`, resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, write: false, platform: 'node', format: 'esm', tsconfig: 'tsconfig.app.json', logLevel: 'silent',
});
const { RATING_SECTIONS, TRANSLATIONS, QUESTION_TRANSLATIONS, SECTION_TRANSLATIONS, VALUE_TRANSLATIONS, VALUE_OPTIONS, MAP_TRANSLATIONS, STUDENT_STUDY_YEARS } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const exact = (dictionary, key) => Object.fromEntries(languages.map(language => {
  const text = dictionary[language][key];
  assert.equal(typeof text, 'string', `Missing ${language} text for ${key}`);
  assert.ok(text.length > 0, `Empty ${language} text for ${key}`);
  return [language, text];
}));
const ratings = RATING_SECTIONS.flatMap(section => section.questions.map(question => ({
  id: question.id, section: section.id, text: exact(QUESTION_TRANSLATIONS, question.id),
})));
assert.equal(ratings.length, 81);
assert.equal(new Set(ratings.map(item => item.id)).size, 81);
for (const language of languages) assert.deepEqual(Object.keys(QUESTION_TRANSLATIONS[language]).sort(), ratings.map(item => item.id).sort(), `${language} must have exactly the 81 current items`);
let nextNumber = 0;
for (const item of ratings) item.number = ++nextNumber;
for (const section of RATING_SECTIONS) for (const item of section.questions) assert.equal(QUESTION_TRANSLATIONS.en[item.id], item.text);
const sources = [
  'src/data/questions.ts', 'src/data/i18n.ts', 'src/data/traits.ts', 'src/data/mapI18n.ts',
  'src/lib/participantProfile.ts', 'src/App.tsx', 'src/components/RoleSelection.tsx',
  'src/components/ValuesStep.tsx', 'src/components/SpecialistPrompt.tsx',
  'src/components/ParticipantReflectionForm.tsx', 'src/components/GeographyFields.tsx',
];
const sourceHashes = Object.fromEntries(await Promise.all(sources.map(async path => [path, createHash('sha256').update(await readFile(path)).digest('hex')])));
const revision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', windowsHide: true }).trim();
const pages = [{
  title: 'Questionnaire · English / Română / Français',
  description: 'Exact application wording · Source snapshot: 10 October 2026',
  paragraphs: [
    'This document contains all 81 current rating items, presented in the application’s section order, followed by its active participant prompts and answer options. The global numbers 1–81 are document references; IDs such as T1 and P13 are the stable application identifiers.',
    'Question wording and translations are copied directly from the source code. They have not been rewritten, corrected or newly translated for this document. Explanatory headings and notes describe the current interface, not additional questions.',
    'The rating scale remains 1–10. Students and medicine explorers complete the 81 ratings. Specialists may complete them or skip directly to the specialty interview. A contribution is stored for research only after the participant chooses the consent-and-save action.',
    'The appendix includes participant role, specialist pathway, specialty selection, all 14 career-value choices, the optional student/explorer reflection, optional study year (1–6), five specialist interview questions and the conditional “why not” follow-up, plus optional geography fields.',
    'Specialty and country dropdown catalogs are not reproduced: they are selection catalogs rather than questionnaire items, and the specialty catalog may be versioned separately. Deprecated experience/satisfaction questions and administration-only controls are not part of this questionnaire snapshot.',
    `Source revision: ${revision}. Exact source-file SHA-256 hashes are included in the accompanying .source.json for reproducibility. This is a source snapshot, not a claim of questionnaire validation or a record of participant answers.`,
  ],
  rows: [
    { label: '1', text: exact(TRANSLATIONS, 'sliderRarely') },
    { label: '10', text: exact(TRANSLATIONS, 'sliderStrongly') },
  ],
}];

for (const section of RATING_SECTIONS) {
  const items = ratings.filter(item => item.section === section.id);
  for (let offset = 0; offset < items.length; offset += 8) {
    const chunk = items.slice(offset, offset + 8);
    pages.push({
      title: languages.map(language => SECTION_TRANSLATIONS[language][section.id].title).join(' / '),
      description: `Items ${chunk[0].number}–${chunk.at(-1).number} of 81 · ${section.id} · Scale 1–10`,
      rows: chunk.map(item => ({ label: `${item.number}\n${item.id}`, text: item.text, ratingId: item.id })),
      note: '1–10: ' + languages.map(language => `${language.toUpperCase()} ${TRANSLATIONS[language].sliderRarely} → ${TRANSLATIONS[language].sliderStrongly}`).join(' · '),
    });
  }
}

let appendixNumber = 0;
const field = key => ({ label: `A${++appendixNumber}`, sourceKey: `TRANSLATIONS.${key}`, text: exact(TRANSLATIONS, key) });
const mapField = key => ({ label: `A${++appendixNumber}`, sourceKey: `MAP_TRANSLATIONS.${key}`, text: exact(MAP_TRANSLATIONS, key) });
const appendix = (title, rows, note) => pages.push({ title, description: 'Appendix · Active participant interface wording', rows, note });
appendix('A · Participant identification', ['roleIntrospection', 'roleSelectionTitle', 'roleSelectionDescription', 'curiousMode', 'curiousRoleDescription', 'studentMode', 'studentRoleDescription', 'specialistMode', 'specialistRoleDescription'].map(field), 'The first line is the homepage reflection prompt. One role is selected before starting. Display order: exploring medicine, student, specialist.');
appendix('B · Specialist questionnaire pathway', ['specialistPathTitle', 'specialistPathDescription', 'specialistPathAnswer', 'specialistPathAnswerDescription', 'specialistPathSkip', 'specialistPathSkipDescription', 'specialistPathPrivacy'].map(field), 'The specialist may skip all 81 ratings and career-value choices. The five-question specialty interview remains available.');
appendix('C · Specialty selection and career values', ['specialtyTitle', 'specialtySubtitle', 'specialtyOptional', 'specialistSpecialtyTitle', 'specialistSpecialtySubtitle', 'specialistSpecialtyRequired', 'valuesTitle', 'valuesSubtitle'].map(field), 'Preferred specialty: optional for students/explorers and does not alter scores. Actual specialty: required for specialists. On the complete-questionnaire path, the current interface requires at least one selected career value and allows up to four.');
for (let offset = 0; offset < VALUE_OPTIONS.length; offset += 7) {
  appendix(`D · Career-value options ${offset + 1}–${Math.min(offset + 7, VALUE_OPTIONS.length)}`, VALUE_OPTIONS.slice(offset, offset + 7).map(value => ({ label: `A${++appendixNumber}`, sourceKey: `VALUE_TRANSLATIONS.${value}`, text: exact(VALUE_TRANSLATIONS, value) })), 'These are the exact value labels displayed by the application, including any existing spelling differences. Select 1–4 values to continue on the full questionnaire path.');
}
appendix('E · Student and explorer perspectives', ['studentDataTitle', 'curiousDataTitle', 'participantMedicineView', 'participantMedicineViewOptional', 'participantMedicineViewPlaceholder', 'participantMedicineViewPrivacy'].map(field), 'The written reflection is optional. If entered, its trimmed length must be 3–2,000 characters. It is not required to save a contribution.');
appendix('F · Study year and saving choices', [field('studentStudyYear'), field('studentPreferNotToSay'), ...STUDENT_STUDY_YEARS.map(year => ({ label: `A${++appendixNumber}`, sourceKey: `TRANSLATIONS.studentYear(${year})`, text: Object.fromEntries(languages.map(language => [language, TRANSLATIONS[language].studentYear(year)])) })), field('studentContinue'), field('studentSkip')], 'Study year is optional and appears only for medical students, not medicine explorers. Available numeric years are exactly 1–6.');
appendix('G · Student and explorer research disclosure', ['studentDataDesc', 'curiousDataDesc'].map(field), 'The save and skip actions shown on the preceding page correspond to these disclosures. This is a text snapshot; no participant responses are included.');
appendix('H · Specialist interview: questions 1–3', ['specialistPromptTitle', 'specialistFreeTextPrivacy', 'specialistCurrentView', 'specialistCurrentViewPlaceholder', 'specialistChangesOverYears', 'specialistChangesOverYearsPlaceholder', 'specialistMostImportantQuality', 'specialistMostImportantQualityPlaceholder'].map(field), 'Questions 1–3 require text to submit a specialist contribution: minimum 3 trimmed characters, maximum 2,000 characters each. Helper placeholders are shown after their corresponding prompts.');
appendix('I · Specialist interview: questions 4–5', ['specialistWouldChooseAgain', 'specialistYes', 'specialistNo', 'specialistWhyNotChooseAgain', 'specialistWhyNotChooseAgainPlaceholder', 'specialistStudentSelfQuestion', 'specialistStudentSelfQuestionPlaceholder'].map(field), 'Question 4 requires Yes or No. The “why not” textbox appears and is required only for No (3–2,000 characters). Question 5 requires 3–1,000 characters. The conditional textbox is not a sixth unconditional interview question.');
appendix('J · Specialist research disclosure', ['specialistPromptDescCompleted', 'specialistPromptDescSkipped', 'specialistSubmit'].map(field), 'The displayed disclosure depends on whether the specialist completed or skipped the 81-item questionnaire. Partial ratings and career values are not submitted on the skipped path.');
appendix('K · Optional geography', ['geographyTitle', 'optional', 'country', 'countryPlaceholder', 'region', 'regionPlaceholder', 'regionUnavailable', 'regionHelp'].map(mapField), 'This widget appears only when the public-map feature is enabled. Country and region are optional; a country must be selected to enter a region. Region length is limited to 100 characters. Country choices are not expanded in this document.');
appendix('L · Geography disclosure', [mapField('geographyHelp')], 'Geography fields can appear on both the student/explorer contribution form and the specialist contribution form. No live map settings or participant geography were read to generate this source snapshot.');

const source = { title: 'MedCompass questionnaire', date: '2026-10-10', languages, revision, sourceHashes, ratings, pages };
assert.equal(pages.flatMap(page => page.rows ?? []).filter(row => row.ratingId).length, 81);
const stringify = JSON.stringify(source, null, 2);
if (/sb_(?:secret|publishable)_[A-Za-z0-9_-]{12,}|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]+\./.test(stringify)) throw new Error('Credential-shaped text in document');
await mkdir(output, { recursive: true });
await mkdir(qa, { recursive: true });
const snapshot = resolve(output, `${stem}.source.json`);
await writeFile(snapshot, stringify + '\n');
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${stem}</title><style>
@page { size: A4 landscape; margin: 0; }
* { box-sizing: border-box; } body { margin: 0; font-family: Arial, sans-serif; color: #243447; font-size: 10pt; line-height: 1.25; }
.sheet { width: 297mm; height: 210mm; padding: 12mm 15mm 15mm; break-after: page; position: relative; overflow: visible; }
.sheet:last-child { break-after: auto; } .content { height: 181mm; } .brand { color: #356fa6; font-size: 8pt; font-weight: bold; letter-spacing: 1px; margin-bottom: 9px; }
h1 { font-size: 18pt; line-height: 1.2; color: #163e6d; margin: 0 0 10px; } p { margin: 0 0 12px; } .description { color: #536775; margin-bottom: 14px; } .cover p { max-width: 990px; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; margin: 0 0 9px; } th,td { border: 1px solid #d1dee8; padding: 9px; text-align: left; vertical-align: top; overflow-wrap: anywhere; white-space: pre-line; }
th { color: white; background: #163e6d; padding: 8px 9px; } th:first-child,td:first-child { width: 6%; font-size: 8pt; } tbody tr:nth-child(even) { background: #f3f7fa; }
.note { font-size: 8pt; color: #536775; line-height: 1.3; } footer { position: absolute; bottom: 7mm; left: 15mm; right: 15mm; display: flex; justify-content: space-between; font-size: 8pt; color: #536775; }
</style></head><body>${pages.map((page, index) => `<section class="sheet${index === 0 ? ' cover' : ''}"><div class="content"><div class="brand">MEDCOMPASS · QUESTIONNAIRE · 10 OCTOBER 2026</div><h1>${escape(page.title)}</h1><p class="description">${escape(page.description)}</p>${(page.paragraphs ?? []).map(text => `<p>${escape(text)}</p>`).join('')}${page.rows ? `<table><thead><tr><th scope="col"># / ID</th><th scope="col" lang="en">English</th><th scope="col" lang="ro">Română</th><th scope="col" lang="fr">Français</th></tr></thead><tbody>${page.rows.map(row => `<tr${row.ratingId ? ` data-rating-id="${escape(row.ratingId)}"` : ''}><td>${escape(row.label)}</td>${languages.map(language => `<td lang="${language}">${escape(row.text[language])}</td>`).join('')}</tr>`).join('')}</tbody></table>` : ''}${page.note ? `<p class="note">${escape(page.note)}</p>` : ''}</div><footer><span>MedCompass · Questionnaire EN / RO / FR · 10 October 2026</span><span>${index + 1} / ${pages.length}</span></footer></section>`).join('')}</body></html>`;
await writeFile(resolve(output, `${stem}.html`), html);
const docx = resolve(output, `${stem}.docx`);
const wordResult = execFileSync('python', ['-B', 'scripts/generate-questionnaire-docx.py', snapshot, docx], { encoding: 'utf8', windowsHide: true });
console.log(wordResult.trim());
const edge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const browser = await chromium.launch({ headless: true, ...(existsSync(edge) ? { executablePath: edge } : {}) });
try {
  const context = await browser.newContext({ viewport: { width: 1150, height: 825 }, deviceScaleFactor: 1.3, serviceWorkers: 'block' });
  let networkRequests = 0;
  await context.route('**/*', route => { networkRequests++; return route.abort(); });
  const page = await context.newPage();
  await page.setContent(html, { waitUntil: 'load' });
  await page.emulateMedia({ media: 'print' });
  await page.evaluate(() => document.fonts.ready);
  const audit = await page.locator('.content').evaluateAll(nodes => nodes.map((node, index) => ({ page: index + 1, title: node.querySelector('h1').textContent, height: node.clientHeight, scrollHeight: node.scrollHeight, width: node.clientWidth, scrollWidth: node.scrollWidth })));
  const overflow = audit.filter(item => item.scrollHeight > item.height + 1 || item.scrollWidth > item.width + 1);
  await writeFile(resolve(qa, 'layout-audit.json'), JSON.stringify({ pages: audit, overflow, networkRequests }, null, 2));
  for (const index of [0, 1, 4, 9, 14, 17, 21, pages.length - 2].filter(index => index < pages.length)) await page.locator('.sheet').nth(index).screenshot({ path: resolve(qa, `page-${String(index + 1).padStart(2, '0')}.png`) });
  assert.deepEqual(overflow, [], 'PDF authored pages must not overflow');
  assert.equal(networkRequests, 0, 'Document rendering must not make network requests');
  assert.equal(await page.locator('[data-rating-id]').count(), 81);
  for (const language of languages) {
    const rendered = await page.locator(`[data-rating-id] td[lang="${language}"]`).allTextContents();
    assert.deepEqual(rendered, ratings.map(item => item.text[language]));
  }
  const pdfPath = resolve(output, `${stem}.pdf`);
  await page.pdf({ path: pdfPath, preferCSSPageSize: true, printBackground: true, tagged: true, outline: true });
  const pdf = await readFile(pdfPath);
  const pdfPages = [...pdf.toString('latin1').matchAll(/\/Type\s*\/Page\b/g)].length;
  assert.ok(pdf.subarray(0, 8).toString().startsWith('%PDF-'));
  assert.equal(pdfPages, pages.length);
  const report = { date: source.date, languages, sourceRevision: revision, sourceHashes, ratingItemsPerLanguage: 81, ratingSections: RATING_SECTIONS.length, careerValueOptions: VALUE_OPTIONS.length, appendixRows: appendixNumber, pdfPages, pdfBytes: pdf.length, exactTextVerified: true, layoutOverflow: false, networkRequests, docx: JSON.parse(wordResult).docx };
  await writeFile(resolve(output, `${stem}.qa.json`), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ docx, pdf: pdfPath, pages: pdfPages, ratingItemsPerLanguage: 81, languages, layoutOverflow: false, networkRequests }));
} finally {
  await browser.close();
}
