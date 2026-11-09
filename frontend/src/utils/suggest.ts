export type Suggestion = {
  text: string;
  sub?: string;
};

/**
 * Filters and ranks suggestions for what the user has typed so far.
 * Best matches first: text that starts with the query, then text where a
 * later word starts with it, then text that merely contains it. Within a
 * tier the original order is kept (so callers can pre-sort by frequency).
 * An empty query returns the first few items unfiltered.
 */
export const rankSuggestions = (
  items: Suggestion[],
  query: string,
  limit = 8
): Suggestion[] => {
  const needle = query.trim().toLowerCase();

  if (!needle) {
    return items.slice(0, limit);
  }

  const scored: Array<{ item: Suggestion; tier: number; index: number }> = [];

  items.forEach((item, index) => {
    const haystack = `${item.text} ${item.sub || ""}`.toLowerCase();
    const text = item.text.toLowerCase();

    let tier = -1;
    if (text.startsWith(needle)) {
      tier = 0;
    } else if (text.split(/[\s,.\-/()]+/).some((word) => word.startsWith(needle))) {
      tier = 1;
    } else if (haystack.includes(needle)) {
      tier = 2;
    }

    // An exact, already-typed value isn't a useful suggestion.
    if (tier >= 0 && text !== needle) {
      scored.push({ item, tier, index });
    }
  });

  return scored
    .sort((a, b) => a.tier - b.tier || a.index - b.index)
    .slice(0, limit)
    .map((entry) => entry.item);
};
