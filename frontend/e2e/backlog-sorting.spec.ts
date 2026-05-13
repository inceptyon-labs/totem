import { test, expect } from './fixtures';

test.describe('Backlog sorting', () => {
  test('totems are sorted by priority, then type, then title within each section', async ({
    totems,
    backlogPage
  }) => {
    totems.create('Todo Normal Task', { status: 'todo', priority: 'normal', type: 'task' });
    totems.create('Todo Normal Bug', { status: 'todo', priority: 'normal', type: 'bug' });
    totems.create('Todo High Feature', { status: 'todo', priority: 'high', type: 'feature' });
    totems.create('Draft Idea', { status: 'draft', priority: 'low', type: 'task' });

    await backlogPage.goto(4);

    const titles = await backlogPage.getTotemTitles();
    // Todo section first (sorted by priority, then type, then title), then Draft section
    expect(titles).toEqual([
      'Todo High Feature',
      'Todo Normal Bug',
      'Todo Normal Task',
      'Draft Idea'
    ]);
  });

  test('list re-sorts when a totem priority changes on disk', async ({ totems, backlogPage }) => {
    const id1 = totems.create('Low Priority Task', {
      status: 'todo',
      priority: 'low',
      type: 'task'
    });
    totems.create('Normal Priority Task', { status: 'todo', priority: 'normal', type: 'task' });

    await backlogPage.goto(2);

    let titles = await backlogPage.getTotemTitles();
    expect(titles).toEqual(['Normal Priority Task', 'Low Priority Task']);

    // Change the low-priority totem to critical via CLI (filesystem change)
    totems.update(id1, { priority: 'critical' });

    // The totem should now appear first
    await expect(async () => {
      titles = await backlogPage.getTotemTitles();
      expect(titles).toEqual(['Low Priority Task', 'Normal Priority Task']);
    }).toPass({ timeout: 5_000 });
  });

  test('list re-sorts when a totem status changes on disk', async ({ totems, backlogPage }) => {
    const id1 = totems.create('A Draft Totem', { status: 'draft', type: 'task' });
    totems.create('B Todo Totem', { status: 'todo', type: 'task' });

    await backlogPage.goto(2);

    // Todo section comes before Draft section
    let titles = await backlogPage.getTotemTitles();
    expect(titles).toEqual(['B Todo Totem', 'A Draft Totem']);

    // Move the draft totem to todo
    totems.update(id1, { status: 'todo' });

    // Both are now todo, should sort by title
    await expect(async () => {
      titles = await backlogPage.getTotemTitles();
      expect(titles).toEqual(['A Draft Totem', 'B Todo Totem']);
    }).toPass({ timeout: 5_000 });
  });

  test('new totem appears in correct sorted position', async ({ totems, backlogPage }) => {
    totems.create('Zebra Task', { status: 'todo', type: 'task' });
    totems.create('Alpha Task', { status: 'todo', type: 'task' });

    await backlogPage.goto(2);

    let titles = await backlogPage.getTotemTitles();
    expect(titles).toEqual(['Alpha Task', 'Zebra Task']);

    // Create a new totem that should sort between the two
    totems.create('Middle Task', { status: 'todo', type: 'task' });

    await expect(async () => {
      titles = await backlogPage.getTotemTitles();
      expect(titles).toEqual(['Alpha Task', 'Middle Task', 'Zebra Task']);
    }).toPass({ timeout: 5_000 });
  });

  test('dragging a totem reorders it within the backlog', async ({ totems, backlogPage }) => {
    // Create totems with same status/priority/type so they sort by title
    totems.create('Alpha', { status: 'todo', type: 'task' });
    totems.create('Bravo', { status: 'todo', type: 'task' });
    totems.create('Charlie', { status: 'todo', type: 'task' });

    await backlogPage.goto(3);

    // Initial order: Alpha, Bravo, Charlie
    let titles = await backlogPage.getTotemTitles();
    expect(titles).toEqual(['Alpha', 'Bravo', 'Charlie']);

    // Drag Charlie above Alpha
    await backlogPage.dragTotem('Charlie', 'Alpha', 'above');

    // New order: Charlie, Alpha, Bravo
    await expect(async () => {
      titles = await backlogPage.getTotemTitles();
      expect(titles).toEqual(['Charlie', 'Alpha', 'Bravo']);
    }).toPass({ timeout: 5_000 });
  });

  test('dragging a totem onto another reparents it and persists', async ({
    totems,
    backlogPage,
    page
  }) => {
    totems.create('Parent Totem', { status: 'todo', type: 'feature' });
    totems.create('Child Totem', { status: 'todo', type: 'task' });

    await backlogPage.goto(2);

    // Both are top-level initially
    let titles = await backlogPage.getTotemTitles();
    expect(titles).toContain('Parent Totem');
    expect(titles).toContain('Child Totem');

    // Drag Child Totem onto Parent Totem to reparent it
    await backlogPage.dragTotem('Child Totem', 'Parent Totem', 'onto');

    // Child Totem should now be nested under Parent Totem
    await expect(async () => {
      const parentItem = backlogPage.totemByTitle('Parent Totem');
      const nestedChild = parentItem.locator('.totem-item', { hasText: 'Child Totem' });
      await expect(nestedChild).toBeVisible();
    }).toPass({ timeout: 5_000 });

    // Reload the page to verify persistence
    await page.reload();
    await backlogPage.waitForTotem('Parent Totem');

    // After reload, Child Totem should still be nested under Parent Totem
    await expect(async () => {
      const parentItem = backlogPage.totemByTitle('Parent Totem');
      const nestedChild = parentItem.locator('.totem-item', { hasText: 'Child Totem' });
      await expect(nestedChild).toBeVisible();
    }).toPass({ timeout: 5_000 });
  });

  test('dragging a totem into a specific position within another parent works', async ({
    totems,
    backlogPage,
    page
  }) => {
    // Create a feature with 3 child tasks
    const parentId = totems.create('Parent Feature', { status: 'todo', type: 'feature' });
    const childA = totems.create('Alpha Child', { status: 'todo', type: 'task' });
    const childB = totems.create('Bravo Child', { status: 'todo', type: 'task' });
    const childC = totems.create('Charlie Child', { status: 'todo', type: 'task' });

    // Set parent relationships via CLI
    totems.run(['update', childA, '--parent', parentId]);
    totems.run(['update', childB, '--parent', parentId]);
    totems.run(['update', childC, '--parent', parentId]);

    // Create a top-level task to drag in
    totems.create('Interloper', { status: 'todo', type: 'task' });

    await backlogPage.goto(5); // Parent Feature + 3 children + Interloper

    // Drag Interloper above Bravo Child (between Alpha and Bravo)
    await backlogPage.dragTotem('Interloper', 'Bravo Child', 'above');

    // Verify: Interloper should be between Alpha Child and Bravo Child
    await expect(async () => {
      const parentItem = backlogPage.totemByTitle('Parent Feature');
      const childTitles = await parentItem
        .locator('.totem-item [role="button"] > div > span.text-sm')
        .allTextContents();
      const trimmed = childTitles.map((t) => t.trim());
      expect(trimmed).toEqual(['Alpha Child', 'Interloper', 'Bravo Child', 'Charlie Child']);
    }).toPass({ timeout: 5_000 });

    // Verify persistence
    await page.reload();
    await backlogPage.waitForTotem('Parent Feature');

    await expect(async () => {
      const parentItem = backlogPage.totemByTitle('Parent Feature');
      const childTitles = await parentItem
        .locator('.totem-item [role="button"] > div > span.text-sm')
        .allTextContents();
      const trimmed = childTitles.map((t) => t.trim());
      expect(trimmed).toEqual(['Alpha Child', 'Interloper', 'Bravo Child', 'Charlie Child']);
    }).toPass({ timeout: 5_000 });
  });

  test('deleted totem disappears from list', async ({ totems, backlogPage }) => {
    const id1 = totems.create('Totem To Delete', { status: 'todo', type: 'task' });
    totems.create('Totem To Keep', { status: 'todo', type: 'task' });

    await backlogPage.goto(2);

    // Delete the totem via CLI
    totems.run(['delete', '--force', id1]);

    await backlogPage.waitForTotemGone('Totem To Delete');
    expect(await backlogPage.count()).toBe(1);
  });
});
