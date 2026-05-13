import { test, expect } from './fixtures';

test.describe('Board archive all', () => {
  test('archive all button is hidden when no completed totems', async ({ totems, boardPage }) => {
    totems.create('Todo Totem', { status: 'todo', type: 'task' });

    await boardPage.goto();
    await boardPage.waitForColumnCount('todo', 1);

    await expect(boardPage.archiveAllButton).not.toBeVisible();
  });

  test('archive all button is visible when completed totems exist', async ({ totems, boardPage }) => {
    totems.create('Done Totem', { status: 'completed', type: 'task' });

    await boardPage.goto();
    await boardPage.waitForColumnCount('completed', 1);

    await expect(boardPage.archiveAllButton).toBeVisible();
  });

  test('archive all removes all completed totems from the board', async ({ totems, boardPage }) => {
    totems.create('Done A', { status: 'completed', type: 'task' });
    totems.create('Done B', { status: 'completed', type: 'task' });
    totems.create('Still Todo', { status: 'todo', type: 'task' });

    await boardPage.goto();
    await boardPage.waitForColumnCount('completed', 2);
    await boardPage.waitForColumnCount('todo', 1);

    await boardPage.archiveAllCompleted();

    // Completed column should empty out
    await boardPage.waitForColumnCount('completed', 0);
    // Todo column should be unaffected
    await boardPage.waitForColumnCount('todo', 1);
  });

  test('cancel in confirmation modal does not archive totems', async ({
    totems,
    boardPage,
    page
  }) => {
    totems.create('Done Totem', { status: 'completed', type: 'task' });

    await boardPage.goto();
    await boardPage.waitForColumnCount('completed', 1);

    // Open the modal
    await boardPage.archiveAllButton.click();

    // Cancel
    await page.getByRole('button', { name: 'Cancel' }).click();

    // Totem should still be there
    await boardPage.waitForColumnCount('completed', 1);
  });
});
