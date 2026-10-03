import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PROGRAM, readinessBand, suggestLoad, recommendDay, parseGarminExport, mergeRuns, weekSlots } from '../src/engine.mjs';

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

test('active Pull keeps its deadlift; inactive Lower has no copied Pull lift', () => {
  assert.equal(DEFAULT_PROGRAM.pull.exercises[0].id, 'deadlift');
  assert.equal(DEFAULT_PROGRAM.lower.exercises.some(x => x.id === 'deadlift'), false);
});

test('active JEFIT week uses Upper, Push, Pull; lower is never auto-scheduled', () => {
  const slots = weekSlots();
  assert.deepEqual(slots.filter(x => x.gym && !x.optional).map(x => x.gym), ['upper', 'push', 'pull']);
  assert.equal(slots.filter(x => x.run).length, 3);
  assert.equal(slots.find(x => x.gym === 'pump').optional, true);
  assert.equal(slots.some(x => x.gym === 'lower'), false);
});

test('low readiness swaps quality run for easy work; red means recovery', () => {
  const preceding = [{ date: '2026-10-05', gymId: 'lower' }, { date: '2026-10-06', gymId: 'upper' }];
  assert.equal(recommendDay('2026-10-08', { score: 42, feel: 3 }, preceding, []).run.kind, 'easy');
  assert.equal(recommendDay('2026-10-08', { score: 95, pain: true }, [], []).gym, null);
});

test('spice changes accessory no more often than every two weeks', () => {
  const a = recommendDay('2026-10-06', {}, [], []);
  const b = recommendDay('2026-10-13', {}, [], []);
  assert.deepEqual(a.variation, b.variation);
});

test('fortnightly variation changes one accessory but keeps the main lift and its load', () => {
  const first = recommendDay('2026-10-05', { feel: 4 }, [], []);
  const next = recommendDay('2026-10-19', { feel: 4 }, [], []);
  assert.equal(first.gym.exercises[0].id, 'bench');
  assert.equal(next.gym.exercises[0].id, 'bench');
  assert.notEqual(first.gym.exercises.at(-1).id, next.gym.exercises.at(-1).id);
});

test('missed core gym day is resumed on the next gym slot without cramming', () => {
  const wednesday = recommendDay('2026-10-07', { feel: 4 }, [], []);
  assert.equal(wednesday.gym.id, 'upper');
  const friday = recommendDay('2026-10-09', { feel: 4 }, [{ date: '2026-10-05', gymId: 'upper' }], []);
  assert.equal(friday.gym.id, 'push');
  assert.notEqual(friday.gym.id, 'lower');
});

test('invalid watch score does not produce a green signal', () => {
  assert.equal(readinessBand({ score: 1000 }).band, 'unknown');
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
