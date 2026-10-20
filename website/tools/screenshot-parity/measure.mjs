/**
 * The pixels the register really removes, measured rather than predicted.
 *
 * Earlier rounds predicted what visibility: hidden removes from element, Range and
 * descendant rectangles, and every round found a paint source the prediction did
 * not see (generated content, shadows, outlines, shadow trees, ...). Here nothing
 * is predicted: on the very load that was captured with the register hidden (the
 * masked capture), the register's stored nodes are shown again, everything else
 * unchanged, and the page is captured again (the unmasked capture). The pixels
 * that differ between the two are exactly what hiding removed on that side,
 * whatever painted them.
 *
 * The unmasked capture is taken until two consecutive captures agree; a page that
 * does not settle without the register hidden cannot be measured, and is refused.
 *
 * Per entry: when more than one entry applies and the total is over the entry cap,
 * each entry is measured on its own (only its nodes hidden). Otherwise no entry
 * can remove more than the total, which is already within the entry cap.
 *
 * Everything that touches a browser is passed in, so tests can drive it with fakes:
 *   screenshot()   -> PNG buffer of the full page
 *   showAll()      -> show every register node (masks stay hidden)
 *   hideAll()      -> hide every register node again (the masked state)
 *   hideOnly(ids)  -> show all, then hide only the nodes of these entries
 *   wait()         -> let the page paint
 *   diff(a, b)     -> { differentPixels, sizeMismatch, width, height }
 */
export async function measureRemoved({ entries, maskedPng, screenshot, showAll, hideAll, hideOnly, wait, diff, maxAttempts, entryCap }) {
  const result = { stable: true, sizeChanged: false, captures: 0, total: null, entries: null, entriesMeasured: false };
  await showAll();
  await wait();
  let unmasked = null;
  let previous = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const png = await screenshot();
    result.captures++;
    if (previous && previous.equals(png)) {
      unmasked = png;
      break;
    }
    previous = png;
    await wait();
  }

  try {
    if (!unmasked) {
      result.stable = false;
      return result;
    }

    const all = diff(maskedPng, unmasked);
    if (all.sizeMismatch) {
      result.sizeChanged = true;
      return result;
    }
    const area = Math.max(1, all.width * all.height);
    result.total = { pixels: all.differentPixels, share: all.differentPixels / area };

    if (entries.length === 1) {
      result.entries = [{ id: entries[0].id, ...result.total }];
      result.entriesMeasured = true;
    } else if (entries.length > 1 && result.total.share > entryCap) {
      result.entries = [];
      for (const entry of entries) {
        await hideOnly([entry.id]);
        await wait();
        const png = await screenshot();
        result.captures++;
        const one = diff(png, unmasked);
        if (one.sizeMismatch) {
          result.sizeChanged = true;
          return result;
        }
        result.entries.push({ id: entry.id, pixels: one.differentPixels, share: one.differentPixels / area });
      }
      result.entriesMeasured = true;
    }

    return result;
  } finally {
    await hideAll();
    await wait();
  }
}
