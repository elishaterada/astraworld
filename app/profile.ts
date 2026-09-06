/** A local display label only; never an authenticated identity. */
export function validateUsername(raw: string): { name: string; error: string } {
  const name = raw.normalize("NFC").trim().replace(/\s+/g, " ");
  if (!/^[\p{L}\p{N} _'-]{2,20}$/u.test(name)) {
    return {
      name,
      error:
        "Use 2–20 letters or numbers. Spaces, hyphens and underscores are welcome.",
    };
  }
  return { name, error: "" };
}
