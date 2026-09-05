interface SpecialtyBibliographyProps {
  references: readonly string[];
  title: string;
  headingLevel?: 'h3' | 'h5';
}

export default function SpecialtyBibliography({
  references,
  title,
  headingLevel = 'h3',
}: SpecialtyBibliographyProps) {
  if (references.length === 0) return null;

  const Heading = headingLevel;

  return (
    <section className="rounded-xl border border-brand-100 bg-white/70 p-4">
      <Heading className="mb-3 text-xs font-semibold uppercase tracking-wider text-brand-700">
        {title}
      </Heading>
      <ul className="list-disc space-y-2 pl-5 marker:text-brand-400">
        {references.map((reference, index) => (
          <li
            key={`${index}-${reference}`}
            className="break-words text-xs leading-relaxed text-ink-600 sm:text-sm"
          >
            {reference}
          </li>
        ))}
      </ul>
    </section>
  );
}
