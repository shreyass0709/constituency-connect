/**
 * Structured data for search engines, escaped properly.
 *
 * `JSON.stringify` does not escape `<`, so a value containing `</script>` closes the tag
 * early and everything after it is parsed as HTML — stored XSS on the busiest public
 * pages. The office writes these values (bio, vision, FAQ answers), so this is a staff
 * account away rather than anonymous, which is exactly the account worth protecting.
 * `<` is valid JSON and means the same thing to a parser (docs/02 §8, XSS).
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
