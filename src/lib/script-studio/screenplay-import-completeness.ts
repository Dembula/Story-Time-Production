/**
 * Import completeness helpers — prevent vision OCR from cropping multi-page scripts.
 */

/** Pure policy: never let shorter OCR crop a fuller embed. */
export function shouldKeepEmbedOverOcr(input: {
  embedLetters: number;
  ocrLetters: number;
  embedUsable: boolean;
  pageCount?: number | null;
}): boolean {
  const { embedLetters, ocrLetters, embedUsable, pageCount } = input;
  if (!embedUsable || embedLetters < 40) return false;
  if (embedLetters > ocrLetters * 1.05) return true;
  if (
    pageCount &&
    pageCount > 1 &&
    ocrLetters < pageCount * 400 &&
    embedLetters >= ocrLetters
  ) {
    return true;
  }
  return false;
}

/** Rough completeness check vs known PDF page count. */
export function extractLooksCompleteForPageCount(
  letterCount: number,
  pageCount?: number | null,
): boolean {
  if (!pageCount || pageCount <= 1) return letterCount >= 40;
  return letterCount >= pageCount * 500;
}
