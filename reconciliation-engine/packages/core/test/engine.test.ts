import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Temporal } from 'temporal-polyfill';
import { D } from '../src/helpers/numbers.ts';
import { readAsOf, runEngine, type AsOf, type Transaction } from '../src/index.ts';

// A record built in code: no file, no CSV. Shows the engine does not depend on the input format.
function record(id: string, amount: string, timestamp: string): Transaction {
  return {
    id, row: 0, amountText: amount, amount: new D(amount), timestampText: timestamp,
    instant: Temporal.Instant.from(timestamp), memo: '', extra: {}, matchKeys: {},
  };
}

test('engine works on records from any source, not only CSV (DECISIONS S6)', () => {
  const asOf = readAsOf('2026-05-01T23:59:59.999Z') as { ok: true } & AsOf;
  const { report, exceptions } = runEngine({
    ours: { name: 'api:ours', records: [record('o1', '5.00', '2026-05-01T10:00:00Z')], columnNames: [] },
    theirs: { name: 'api:theirs', records: [record('t1', '5.01', '2026-05-01T10:00:01Z')], columnNames: [] },
    manual: { name: 'api:manual', pins: [] },
    asOf,
  });
  assert.deepEqual(exceptions, []);
  assert.deepEqual(report.matches.map((m) => `${m.kind}:${m.ours_id}-${m.theirs_id}`), ['rule_based:o1-t1']);
});
