import { browser } from '$app/environment';

export const prerender = true;
export const ssr = false;

export function load() {
  let selectedTotemId: string | null = null;
  let showPlanningChat = false;
  let showChanges = false;
  let filterText = '';

  if (browser) {
    const params = new URLSearchParams(window.location.search);
    selectedTotemId = params.get('totem');

    showPlanningChat = localStorage.getItem('totems-planning-chat') === 'true';
    showChanges = localStorage.getItem('totems-changes-pane') === 'true';
    filterText = localStorage.getItem('totems-filter-text') ?? '';
  }

  return { selectedTotemId, showPlanningChat, showChanges, filterText };
}
