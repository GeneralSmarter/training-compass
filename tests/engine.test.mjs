import test from 'node:test';
import assert from 'node:assert/strict';
import { readinessBand, suggestLoad, recommendDay, parseGarminExport, mergeRuns, weekSlots } from '../src/engine.mjs';

const lift = { id: 'bench', name: 'Bench press', baseKg: 60, reps: [5, 5], stepKg: 2.5 };

test('pain or illness veto hard training even when watch score is high', () => {
  assert.equal(readinessBand({ score: 92, feel: 5, pain: true }).band, 'red');
  assert.equal(readinessBand({ score: 92, feel: 5, ill: true }).band, 'red');
});

test('missing recovery inputs stay unknown rather than becoming green', () => {
  assert.equal(readinessBand({}).band, 'unknown');
  assert.equal(suggestLoad(lift, [], 'unknown').kg, 60);
});

test('poor sleep or low score reduces load and volume, not increases', () => {
  assert.equal(readinessBand({ score: 43, feel: 4, sleepHours: 5.5 }).band, 'amber');
  assert.ok(suggestLoad(lift, [], 'amber').kg < 60);
});

test('load rises only after all logged sets meet reps with two reps in reserve', () => {
  const logs = [{ exercises: [{ exerciseId: 'bench', sets: [{ kg: 60, reps: 5, rir: 2 }, { kg: 60, reps: 5, rir: 3 }] }] }];
  assert.equal(suggestLoad(lift, logs, 'green').kg, 62.5);
  assert.equal(suggestLoad(lift, [{ exercises: [{ exerciseId: 'bench', sets: [{ kg: 60, reps: 5, rir: 0 }] }] }], 'green').kg, 60);
  assert.equal(suggestLoad(lift, logs, 'amber').kg < 60, true);
});

test('stable week keeps four core gyms, three runs, optional pump', () => {
  const slots = weekSlots();
  assert.equal(slots.filter(x => x.gym && !x.optional).length, 4);
  assert.equal(slots.filter(x => x.run).length, 3);
  assert.equal(slots.find(x => x.gym === 'pump').optional, true);
});

test('low readiness swaps quality run for easy work; red means recovery', () => {
  assert.equal(recommendDay('2026-10-08', { score: 42, feel: 3 }, [], []).run.kind, 'easy');
  assert.equal(recommendDay('2026-10-08', { score: 95, pain: true }, [], []).gym, null);
});

test('spice changes accessory no more often than every two weeks', () => {
  const a = recommendDay('2026-10-06', {}, [], []);
  const b = recommendDay('2026-10-13', {}, [], []);
  assert.deepEqual(a.variation, b.variation);
});

test('Garmin JSON deduplicates runs and never treats strength as running', () => {
  const feed = { source: 'browser', activities: [
    { date: '2026-09-26', type: 'RUNNING', name: 'Race', url: 'https://connect.garmin.com/app/activity/123', metrics: { DISTANCE: '12.52 km', TIME: '54:47' } },
    { date: '2026-09-26', type: 'RUNNING', name: 'Race', url: 'https://connect.garmin.com/app/activity/123', metrics: { DISTANCE: '12.52 km' } },
    { date: '2026-09-26', type: 'STRENGTH TRAINING', name: 'Gym', url: 'https://connect.garmin.com/app/activity/124' }
  ] };
  const runs = parseGarminExport(feed);
  assert.equal(runs.length, 1);
  assert.equal(runs[0].distanceKm, 12.52);
  assert.equal(mergeRuns(runs, runs).length, 1);
});

test('invalid feed is rejected without erasing existing records', () => {
  assert.throws(() => parseGarminExport({ ok: false, error: 'login' }), /invalid/i);
});
