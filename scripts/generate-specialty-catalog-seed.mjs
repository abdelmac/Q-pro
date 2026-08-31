import { build } from 'esbuild';

const result = await build({
  stdin: {
    contents: `
      export { SPECIALTIES } from './src/data/specialties.ts';
      export { translateBlurb } from './src/data/i18n.ts';
      export { QUESTION_TRAITS, VALUE_MAPPING } from './src/data/traits.ts';
      export { DIMENSIONS } from './src/data/dimensions.ts';
    `,
    resolveDir: process.cwd(),
    sourcefile: 'specialty-catalog-seed-entry.ts',
    loader: 'ts',
  },
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node20',
  write: false,
});

const bundledSource = result.outputFiles[0].text;
const moduleUrl = `data:text/javascript;base64,${Buffer.from(bundledSource).toString('base64')}`;
const {
  DIMENSIONS,
  QUESTION_TRAITS,
  SPECIALTIES,
  VALUE_MAPPING,
  translateBlurb,
} = await import(moduleUrl);

const sortRecord = (record) => Object.fromEntries(
  Object.entries(record).sort(([left], [right]) => left.localeCompare(right)),
);

const descriptionsFor = (specialty) => {
  const en = specialty.blurb;
  return {
    en,
    fr: translateBlurb(specialty.name, 'fr') || en,
    ro: translateBlurb(specialty.name, 'ro') || en,
  };
};

const summariesFor = (descriptions) => ({
  en: `Initial clinical summary, not yet clinically reviewed: ${descriptions.en} An authorized Doctor or Professor must review this text and document its sources before it is treated as clinical guidance.`,
  fr: `Résumé clinique initial, pas encore validé cliniquement : ${descriptions.fr} Un médecin ou professeur autorisé doit relire ce texte et documenter ses sources avant qu'il soit considéré comme une synthèse clinique.`,
  ro: `Rezumat clinic inițial, care nu a fost încă validat clinic: ${descriptions.ro} Un medic sau profesor autorizat trebuie să revizuiască acest text și să documenteze sursele înainte ca acesta să fie considerat ghid clinic.`,
});

const questionTraits = new Set(
  Object.values(QUESTION_TRAITS).flat().map(({ trait }) => trait),
);
const valueTraits = new Set(
  Object.values(VALUE_MAPPING).flat().map(({ trait }) => trait),
);
const traitDimensions = new Map();
for (const dimension of DIMENSIONS) {
  for (const trait of dimension.traits) traitDimensions.set(trait, dimension.key);
}

const allTraits = new Set([
  ...traitDimensions.keys(),
  ...questionTraits,
  ...valueTraits,
  ...SPECIALTIES.flatMap(({ profile }) => Object.keys(profile)),
]);

const measurementSource = (trait) => {
  const fromQuestion = questionTraits.has(trait);
  const fromValue = valueTraits.has(trait);
  if (fromQuestion && fromValue) return 'question_and_value';
  if (fromQuestion) return 'question';
  if (fromValue) return 'value_only';
  return 'unmeasured';
};

const warningFor = (trait) => {
  if (trait === 'manual_orientation') {
    return 'Only created when the Manual/hands-on activity value is selected; it is not measured for the full cohort.';
  }
  if (trait === 'prevention_orientation') {
    return 'Not produced by any current question or selected value; its profile value is locked until the model is corrected and versioned.';
  }
  return null;
};

const payload = {
  entries: SPECIALTIES.map((specialty) => {
    const descriptions = descriptionsFor(specialty);
    return {
      name: specialty.name,
      category: specialty.category,
      descriptions,
      clinical_summaries: summariesFor(descriptions),
      profile: sortRecord(specialty.profile),
    };
  }),
  traits: [...allTraits].sort().map((code) => ({
    code,
    dimension: traitDimensions.get(code) ?? 'lifestyle',
    measurement_source: measurementSource(code),
    warning: warningFor(code),
  })),
};

const compact = process.argv.includes('--compact');
process.stdout.write(`${JSON.stringify(payload, null, compact ? 0 : 2)}\n`);
