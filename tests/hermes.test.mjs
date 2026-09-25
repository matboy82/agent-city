import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveHermesWorkspace } from '../adapters/hermes.mjs';

test('Hermes workspace accepts BIS but rejects the parent and personal cognition', async () => {
  const root = await mkdtemp(join(tmpdir(), 'crew-hermes-'));
  try {
    const bis = join(root, 'BIS-Cognition');
    const personal = join(root, 'Personal-Cognition');
    await mkdir(bis);
    await mkdir(personal);
    assert.equal(await resolveHermesWorkspace(bis), bis);
    await assert.rejects(resolveHermesWorkspace(root), /Select BIS-Cognition/);
    await assert.rejects(resolveHermesWorkspace(personal), /Personal-Cognition/);
    await assert.rejects(resolveHermesWorkspace(join(root, 'missing')), /ENOENT/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
