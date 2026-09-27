/** Joins class names, skipping empty ones. */
export function cx(...names: (string | false | null | undefined)[]): string {
  return names.filter(Boolean).join(" ");
}

/** Splits plain text on blank lines, as the old pages break long text into paragraphs. */
export function paragraphs(text: string | null | undefined): string[] {
  return (text ?? "").split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean);
}

/**
 * Splits a heading into its plain start and its highlighted end, the way the old
 * runtime highlighted hub headings: the last third of the words, one to three.
 */
export function accentSplit(text: string): { regular: string; accent: string } {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const count = Math.min(3, Math.max(1, Math.round(words.length * 0.34)));
  return { regular: words.slice(0, -count).join(" "), accent: words.slice(-count).join(" ") };
}

/** "5+" → { count: "5", suffix: "+" }, as the stat counters read them. */
export function statValue(value: string): { count: string; suffix: string } {
  const match = /^\D*(\d+)(.*)$/.exec(value.trim());
  return match ? { count: match[1], suffix: match[2].trim().slice(0, 4) } : { count: "0", suffix: "" };
}

/** Splits a heading into sentences, one line each, as the home hero shows it. */
export function sentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+/).map((line) => line.trim()).filter(Boolean);
}

/** Modifier of a partner's logo link: the partner's variant, or its slug when the variant is "default". */
export function partnerLogoModifier(partner: { slug: string; fields: { variant?: string | null } }): string {
  const variant = partner.fields.variant?.trim();
  return variant && variant !== "default" ? variant : partner.slug;
}
