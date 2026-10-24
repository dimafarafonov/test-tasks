import assert from 'node:assert/strict';
import { test } from 'node:test';
import { editDistance, similarity } from '../src/similarity.ts';

test('edit distance counts an adjacent swap as one edit', () => {
  assert.equal(editDistance('alice', 'alcie'), 1);
  assert.equal(editDistance('coffee', 'cofee'), 1);
  assert.equal(editDistance('', 'abc'), 3);
});

test('similarity normalizes case and spaces', () => {
  assert.equal(similarity('  Coffee   Shop ', 'coffee shop'), 1);
  assert.equal(similarity('abcd', 'abce'), 0.75);
});
