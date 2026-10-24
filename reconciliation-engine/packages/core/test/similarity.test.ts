import assert from 'node:assert/strict';
import { test } from 'node:test';
import { editDistance, similarity } from '../src/similarity.ts';

test('fuzzy: two swapped neighbor letters count as one typo (README F2)', () => {
  assert.equal(editDistance('alice', 'alcie'), 1);
  assert.equal(editDistance('coffee', 'cofee'), 1);
  assert.equal(editDistance('', 'abc'), 3);
});

test('fuzzy: upper/lower case and extra spaces are not differences (README F5)', () => {
  assert.equal(similarity('  Coffee   Shop ', 'coffee shop'), 1);
  assert.equal(similarity('abcd', 'abce'), 0.75);
});
