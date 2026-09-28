import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { probeWorkQueue } from '../adapters/hermes.mjs';

test('Hermes work queue probe returns bounded state and safe defaults', async () => {
  const root = await mkdtemp(join(tmpdir(), 'crew-hermes-'));
  try {
    await writeFile(join(root, 'crew-work-queue.json'), JSON.stringify({
      current_task: 'Reviewing the launch plan', current_activity: 'reading',
      queue: Array.from({ length: 22 }, (_, i) => ({ text: `Task ${i}` })),
      activity: Array.from({ length: 22 }, (_, i) => ({ summary: `Update ${i}` })),
    }));
    const result = await probeWorkQueue(root);
    assert.equal(result.current_activity, 'reading');
    assert.equal(result.current_task, 'Reviewing the launch plan');
    assert.equal(result.queue.length, 20);
    assert.equal(result.activity.length, 20);
    await writeFile(join(root, 'crew-work-queue.json'), '{invalid');
    assert.deepEqual(await probeWorkQueue(root), { queue: [], activity: [], current_task: null, current_activity: null });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
