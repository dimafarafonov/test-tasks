// Field schema showcase: every extra column, written out in full. Reference only, not used by the engine.
// The engine uses DEFAULT_COLUMNS (packages/core/src/settings/columns.ts). Copy rows from here to extend it.
//
// column:  name in the header (and in the report).
// type:    'text'    → trimmed string
//          'integer' → number in the report
//          'decimal' → string in the report; compared by value (1.5 = 1.50)
// match:   'equal'   → must be equal in exact, rule_based and fuzzy
//          'similar' → equal in exact and rule_based; similar text in fuzzy
//          'none'    → not used in matching; only written to the report
// aliases: other header names for the same column (optional)
//
// Row order = column order in the report.
import type { ColumnSpec } from '../packages/core/src/index.ts';

const columns: ColumnSpec[] = [
  { column: 'currency', type: 'text', match: 'equal' },
  { column: 'quantity', type: 'integer', match: 'none' },
  { column: 'price_per_share', type: 'decimal', match: 'none' },
  { column: 'fx_rate', type: 'decimal', match: 'none' },
  { column: 'party_email', type: 'text', match: 'similar', aliases: ['email'] }, // alias: a file with header "email" is read as party_email
  { column: 'account', type: 'text', match: 'equal' }, // new column
  { column: 'fee', type: 'decimal', match: 'equal' }, // new column
];
