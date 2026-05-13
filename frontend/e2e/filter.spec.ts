import { test, expect } from './fixtures';

test.describe('Filter', () => {
  test('filters beans by title in backlog view', async ({ beans, backlogPage, page }) => {
    beans.create('Authentication Feature', { status: 'todo', type: 'feature' });
    beans.create('Database Migration', { status: 'todo', type: 'task' });
    beans.create('Auth Bug Fix', { status: 'todo', type: 'bug' });

    await backlogPage.goto(3);

    // Type in filter
    const filterInput = page.getByTestId('filter-input');
    await filterInput.fill('auth');

    // Should show only beans matching "auth" (case-insensitive)
    await expect(async () => {
      const titles = await backlogPage.getBeanTitles();
      expect(titles).toEqual(['Auth Bug Fix', 'Authentication Feature']);
    }).toPass({ timeout: 5_000 });
  });

  test('filters beans by type in backlog view', async ({ beans, backlogPage, page }) => {
    beans.create('My Bug', { status: 'todo', type: 'bug' });
    beans.create('My Task', { status: 'todo', type: 'task' });
    beans.create('My Feature', { status: 'todo', type: 'feature' });

    await backlogPage.goto(3);

    const filterInput = page.getByTestId('filter-input');
    await filterInput.fill('bug');

    await expect(async () => {
      const titles = await backlogPage.getBeanTitles();
      expect(titles).toEqual(['My Bug']);
    }).toPass({ timeout: 5_000 });
  });

  test('shows parent when child matches filter', async ({ beans, backlogPage, page }) => {
    const parentId = beans.create('Parent Feature', { status: 'todo', type: 'feature' });
    const childId = beans.create('Special Child Task', { status: 'todo', type: 'task' });
    beans.run(['update', childId, '--parent', parentId]);
    beans.create('Unrelated Bean', { status: 'todo', type: 'task' });

    await backlogPage.goto(3); // Parent + child + unrelated

    const filterInput = page.getByTestId('filter-input');
    await filterInput.fill('Special');

    // Parent should be shown because its child matches
    await expect(async () => {
      const titles = await backlogPage.getBeanTitles();
      expect(titles).toEqual(['Parent Feature', 'Special Child Task']);
    }).toPass({ timeout: 5_000 });
  });

  test('clear button resets filter', async ({ beans, backlogPage, page }) => {
    beans.create('Alpha', { status: 'todo', type: 'task' });
    beans.create('Bravo', { status: 'todo', type: 'task' });

    await backlogPage.goto(2);

    const filterInput = page.getByTestId('filter-input');
    await filterInput.fill('Alpha');

    await expect(async () => {
      const titles = await backlogPage.getBeanTitles();
      expect(titles).toEqual(['Alpha']);
    }).toPass({ timeout: 5_000 });

    // Click clear button
    await page.getByTestId('filter-clear').click();

    await expect(async () => {
      const titles = await backlogPage.getBeanTitles();
      expect(titles).toEqual(['Alpha', 'Bravo']);
    }).toPass({ timeout: 5_000 });
  });

  test('shows "No matching beans" when filter has no results', async ({
    beans,
    backlogPage,
    page
  }) => {
    beans.create('Some Bean', { status: 'todo', type: 'task' });

    await backlogPage.goto(1);

    const filterInput = page.getByTestId('filter-input');
    await filterInput.fill('zzzznonexistent');

    await expect(page.getByText('No beans').first()).toBeVisible({ timeout: 5_000 });
  });

  test('filters beans in board view', async ({ beans, boardPage, page }) => {
    beans.create('Auth Feature', { status: 'todo', type: 'feature' });
    beans.create('Database Task', { status: 'todo', type: 'task' });
    beans.create('Auth Bug', { status: 'in-progress', type: 'bug' });

    await boardPage.goto();

    const filterInput = page.getByTestId('filter-input');
    await filterInput.fill('auth');

    // Only auth-related beans should be visible
    await expect(async () => {
      const todoTitles = await boardPage.getColumnTitles('todo');
      expect(todoTitles).toEqual(['Auth Feature']);

      const inProgressTitles = await boardPage.getColumnTitles('in-progress');
      expect(inProgressTitles).toEqual(['Auth Bug']);
    }).toPass({ timeout: 5_000 });
  });

  test('filter is shared between backlog and board views', async ({ beans, backlogPage, page }) => {
    beans.create('Alpha', { status: 'todo', type: 'task' });
    beans.create('Bravo', { status: 'todo', type: 'task' });

    await backlogPage.goto(2);

    // Filter in backlog view
    const filterInput = page.getByTestId('filter-input');
    await filterInput.fill('Alpha');

    await expect(async () => {
      const titles = await backlogPage.getBeanTitles();
      expect(titles).toEqual(['Alpha']);
    }).toPass({ timeout: 5_000 });

    // Switch to board view - filter should still apply
    await page.getByRole('button', { name: 'Board' }).click();
    await page.waitForSelector('[data-status]', { timeout: 10_000 });

    await expect(async () => {
      const todoTitles = await page
        .locator('[data-status="todo"] [role="listitem"] [role="button"] span.text-sm')
        .allTextContents();
      expect(todoTitles.map((t) => t.trim())).toEqual(['Alpha']);
    }).toPass({ timeout: 5_000 });
  });

  test('Cmd/Ctrl+F focuses the filter input', async ({ beans, backlogPage, page }) => {
    beans.create('Some Bean', { status: 'todo', type: 'task' });
    await backlogPage.goto(1);

    // Press Cmd+F (or Ctrl+F)
    const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
    await page.keyboard.press(`${modifier}+f`);

    // Filter input should be focused
    await expect(page.getByTestId('filter-input')).toBeFocused();
  });
});
