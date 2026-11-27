import {randomUUID} from 'node:crypto';

export const coloradoSources = new Map([
  ['nugget', 'The Gold Nugget newsletter'],
  ['goldputz', 'Gold Putz creator referral'],
]);

export function sourceForPath(path) {
  for (const source of coloradoSources.keys()) {
    if (path === '/co/' + source + '/') return source;
  }
  return null;
}

const sourceAction = source => 'co:source:' + source;
const sourceActions = [...coloradoSources.keys()].map(sourceAction);

// Call while holding the member account lock (or inside its signup transaction).
export async function creditSource(connection, accountId, source) {
  if (!coloradoSources.has(source)) return;
  await connection.query(`INSERT INTO member_audit_log(id, account_id, action)
    SELECT ?, ?, ? FROM DUAL
    WHERE NOT EXISTS (SELECT 1 FROM member_audit_log WHERE account_id=? AND action IN (?, ?))
      AND NOT EXISTS (SELECT 1 FROM member_subscriptions WHERE account_id=? AND livemode=1 AND paid_through IS NOT NULL)
      AND NOT EXISTS (SELECT 1 FROM billing_checkout_attempts WHERE account_id=? AND livemode=1 AND status IN ('creating','open','completed'))
      AND NOT EXISTS (SELECT 1 FROM member_memberships WHERE account_id=? AND grant_source IN ('payment','complimentary'))`,
    [randomUUID(), accountId, sourceAction(source), accountId, ...sourceActions, accountId, accountId, accountId]);
}

// Only the billing store calls this after checking the live paid invoice. Its
// account lock serializes webhook delivery, checkout completion and refreshes.
export async function creditPaidTerm(connection, accountId, paidThrough) {
  const term = 'co:term:' + paidThrough.toISOString();
  await connection.query(`INSERT INTO member_audit_log(id, account_id, action)
    SELECT ?, ?, ? FROM DUAL
    WHERE EXISTS (SELECT 1 FROM member_audit_log WHERE account_id=? AND action IN (?, ?))
      AND NOT EXISTS (SELECT 1 FROM member_audit_log WHERE account_id=? AND action=?)`,
    [randomUUID(), accountId, term, accountId, ...sourceActions, accountId, term]);
}

export async function coloradoReport(db) {
  const rows = await db.query(`SELECT source.action AS source_action,
      COUNT(DISTINCT term.account_id) AS members, COUNT(term.id) AS terms
    FROM member_audit_log source
    LEFT JOIN member_audit_log term ON term.account_id=source.account_id AND term.action LIKE 'co:term:%'
    WHERE source.action IN (?, ?) GROUP BY source.action`, sourceActions);
  return [...coloradoSources].map(([code, name]) => {
    const row = rows.find(row => row.source_action === sourceAction(code));
    const members = Number(row?.members || 0), terms = Number(row?.terms || 0);
    return {code, name, members, terms, renewals: terms - members};
  });
}

export function reportTable(rows) {
  return '<table><caption>Colorado Plus referrals, all time</caption><thead><tr><th>Source</th><th>Paying members</th><th>Subsequent paid months</th></tr></thead><tbody>' +
    rows.map(row => `<tr><th scope="row">${row.name}</th><td>${row.members}</td><td>${row.renewals}</td></tr>`).join('') +
    '</tbody></table><p>Each account counts once after its first confirmed live Plus payment. Later confirmed monthly terms count separately. Totals include members who later cancel. Review refunds and disputes in Stripe before settling a creator invoice.</p>';
}
