import { test, expect } from './fixtures';

test.describe('Board sorting', () => {
  test('totems appear in the correct column by status', async ({ totems, boardPage }) => {
    totems.create('Todo Totem', { status: 'todo', type: 'task' });
    totems.create('Active Totem', { status: 'in-progress', type: 'task' });
    totems.create('Done Totem', { status: 'completed', type: 'task' });

    await boardPage.goto();

    // Wait for all totems to appear in their columns
    await boardPage.waitForTotemInColumn('Todo Totem', 'todo');
    await boardPage.waitForTotemInColumn('Active Totem', 'in-progress');
    await boardPage.waitForTotemInColumn('Done Totem', 'completed');

    expect(await boardPage.getColumnTitles('todo')).toEqual(['Todo Totem']);
    expect(await boardPage.getColumnTitles('in-progress')).toEqual(['Active Totem']);
    expect(await boardPage.getColumnTitles('completed')).toEqual(['Done Totem']);
  });

  test('totems within a column are sorted by priority', async ({ totems, boardPage }) => {
    totems.create('Low Task', { status: 'todo', priority: 'low', type: 'task' });
    totems.create('Critical Task', { status: 'todo', priority: 'critical', type: 'task' });
    totems.create('Normal Task', { status: 'todo', priority: 'normal', type: 'task' });
    totems.create('High Task', { status: 'todo', priority: 'high', type: 'task' });

    await boardPage.goto();
    await boardPage.waitForColumnCount('todo', 4);

    const titles = await boardPage.getColumnTitles('todo');
    expect(titles).toEqual(['Critical Task', 'High Task', 'Normal Task', 'Low Task']);
  });

  test('totem moves to new column when status changes on disk', async ({ totems, boardPage }) => {
    const id = totems.create('Moving Totem', { status: 'todo', type: 'task' });

    await boardPage.goto();
    await boardPage.waitForTotemInColumn('Moving Totem', 'todo');

    // Change status via CLI
    totems.update(id, { status: 'in-progress' });

    // Wait for it to appear in the new column
    await boardPage.waitForTotemInColumn('Moving Totem', 'in-progress');
    await boardPage.waitForTotemNotInColumn('Moving Totem', 'todo');
  });

  test('column re-sorts when totem priority changes on disk', async ({ totems, boardPage }) => {
    const id = totems.create('Will Be Critical', {
      status: 'todo',
      priority: 'low',
      type: 'task'
    });
    totems.create('Normal Priority', { status: 'todo', priority: 'normal', type: 'task' });

    await boardPage.goto();
    await boardPage.waitForColumnCount('todo', 2);

    // Initially: Normal sorts before Low
    let titles = await boardPage.getColumnTitles('todo');
    expect(titles).toEqual(['Normal Priority', 'Will Be Critical']);

    // Promote to critical
    totems.update(id, { priority: 'critical' });

    // Should re-sort: critical before normal
    await expect(async () => {
      titles = await boardPage.getColumnTitles('todo');
      expect(titles).toEqual(['Will Be Critical', 'Normal Priority']);
    }).toPass({ timeout: 5_000 });
  });
});
