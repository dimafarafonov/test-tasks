import assert from 'node:assert/strict';
import { test } from 'node:test';
import { READERS, readerFor } from '../../src/index.ts';

test('reader is chosen by file extension; unknown or no extension falls back to csv (DECISIONS S6)', () => {
  assert.equal(readerFor('ours.csv'), READERS.csv);
  assert.equal(readerFor('OURS.CSV'), READERS.csv);
  assert.equal(readerFor('ours.txt'), READERS.csv);
  assert.equal(readerFor('ours'), READERS.csv);
});
