import { reconcile, type ColumnSpec, type ReconcileInput } from '../src/index.ts';

export const SIMPLE = 'id,amount,timestamp,memo';
export const EXT = `${SIMPLE},currency,quantity,price_per_share,fx_rate,party_email`;
export const AS_OF = '2026-05-01T23:59:59.999Z';

// Runs the whole engine on CSV rows. header is used for both sides unless theirsHeader is given.
export function run(
  ours: string[],
  theirs: string[],
  opts: { manual?: string[]; asOf?: string; header?: string; theirsHeader?: string; columns?: ColumnSpec[] } = {},
) {
  const header = opts.header ?? SIMPLE;
  const input: ReconcileInput = {
    ours: { name: 'ours.csv', text: [header, ...ours].join('\n') },
    theirs: { name: 'theirs.csv', text: [opts.theirsHeader ?? header, ...theirs].join('\n') },
    manual: { name: 'manual.csv', text: ['ours_id,theirs_id', ...(opts.manual ?? [])].join('\n') },
    asOf: opts.asOf ?? AS_OF,
  };
  return reconcile(input, { columns: opts.columns });
}

export const kinds = (r: ReturnType<typeof run>) => r.report!.matches.map((m) => `${m.kind}:${m.ours_id}-${m.theirs_id}`);
export const codes = (r: ReturnType<typeof run>) => r.exceptions.map((i) => i.code);
