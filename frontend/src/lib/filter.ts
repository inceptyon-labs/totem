import type { Totem } from '$lib/totems.svelte';

/**
 * Returns true if the totem matches the filter text.
 * Case-insensitive substring match against title, type, status, tags, and ID.
 */
export function matchesFilter(totem: Totem, text: string): boolean {
  if (!text) return true;
  const lower = text.toLowerCase();
  return (
    totem.title.toLowerCase().includes(lower) ||
    totem.type.toLowerCase().includes(lower) ||
    totem.status.toLowerCase().includes(lower) ||
    totem.id.toLowerCase().includes(lower) ||
    totem.tags.some((tag) => tag.toLowerCase().includes(lower))
  );
}
