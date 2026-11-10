// Unit tests for the integration API: run with `npm test` (Node 18+)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCSV } from '../routes/analyzeRoute.js';
import { Limiter, QueueFullError } from '../limiter.js';
import { templateInterpretation } from '../interpretation.js';

test('parseCSV handles quoted commas, blanks and numbers', () => {
  const rows = parseCSV('name,score,city\n"Smith, Jo",91.5,"Raleigh, NC"\nLee,,Durham\n');
  assert.deepEqual(rows, [
    { name: 'Smith, Jo', score: 91.5, city: 'Raleigh, NC' },
    { name: 'Lee', score: null, city: 'Durham' },
  ]);
});

test('limiter runs queued jobs instead of dropping them', async () => {
  const limiter = new Limiter({ maxConcurrent: 1, maxQueue: 5 });
  const order = [];
  const job = (n, ms) => limiter.run(`j${n}`, async () => {
    await new Promise((r) => setTimeout(r, ms));
    order.push(n);
    return n;
  });
  const results = await Promise.all([job(1, 30), job(2, 10), job(3, 5)]);
  assert.deepEqual(results, [1, 2, 3]);
  assert.deepEqual(order, [1, 2, 3]);
  assert.equal(limiter.getStatus().active, 0);
});

test('limiter rejects when the queue is full', async () => {
  const limiter = new Limiter({ maxConcurrent: 1, maxQueue: 1 });
  let release;
  const blocker = limiter.run('a', () => new Promise((r) => { release = r; }));
  const waiting = limiter.run('b', async () => 'b');
  await assert.rejects(limiter.run('c', async () => 'c'), QueueFullError);
  release();
  await blocker;
  assert.equal(await waiting, 'b');
});

test('logistic template reports odds ratios, not unit changes', () => {
  const text = templateInterpretation({
    modelType: 'logistic',
    dependentVar: 'voted',
    successLevel: 'Yes',
    tidy: [
      { term: '(Intercept)', estimate: -1, 'p.value': 0.2 },
      { term: 'age', estimate: Math.log(1.5), odds_ratio: 1.5, 'p.value': 0.01 },
    ],
    glance: [{ AIC: 120.4 }],
  });
  assert.match(text, /multiplies the odds of voted = Yes by \*\*1\.5\*\*/);
  assert.match(text, /50% higher/);
  assert.doesNotMatch(text, /increases by/);
});
