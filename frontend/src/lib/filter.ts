import type { Bean } from '$lib/beans.svelte';

/**
 * Returns true if the bean matches the filter text.
 * Case-insensitive substring match against title, type, status, tags, and ID.
 */
export function matchesFilter(bean: Bean, text: string): boolean {
  if (!text) return true;
  const lower = text.toLowerCase();
  return (
    bean.title.toLowerCase().includes(lower) ||
    bean.type.toLowerCase().includes(lower) ||
    bean.status.toLowerCase().includes(lower) ||
    bean.id.toLowerCase().includes(lower) ||
    bean.tags.some((tag) => tag.toLowerCase().includes(lower))
  );
}
