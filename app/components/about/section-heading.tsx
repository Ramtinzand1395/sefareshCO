type SectionHeadingProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  centered?: boolean;
  id?: string;
};

export function SectionHeading({
  eyebrow,
  title,
  description,
  centered = false,
  id,
}: SectionHeadingProps) {
  return (
    <div className={centered ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}>
      {eyebrow && (
        <p className="mb-3 text-sm font-black text-brand-blue">{eyebrow}</p>
      )}
      <h2 id={id} className="text-3xl font-black leading-[1.45] text-brand-navy sm:text-4xl">
        {title}
      </h2>
      {description && (
        <p className="mt-4 text-base leading-8 text-brand-muted sm:text-lg">{description}</p>
      )}
    </div>
  );
}
