// Pure, conservative training rules. Public code contains no personal loads.
export const DEFAULT_PROGRAM = {
  lower: { name: 'Lower · strength', exercises: [
    { id: 'deadlift', name: 'Barbell deadlift', sets: 3, reps: [5, 5, 5], stepKg: 2.5, baseKg: null, restSec: 180 },
    { id: 'goblet-squat', name: 'Goblet squat', sets: 3, reps: [8, 8, 8], stepKg: 2, baseKg: null, restSec: 120 },
    { id: 'split-squat', name: 'Bulgarian split squat', sets: 2, reps: [8, 8], stepKg: 1, baseKg: null, restSec: 90 },
    { id: 'calf-raise', name: 'Standing calf raise', sets: 3, reps: [12, 12, 12], stepKg: 2.5, baseKg: null, restSec: 60 }
  ] },
  upper: { name: 'Upper · heavy-ish', exercises: [
    { id: 'bench', name: 'Barbell bench press', sets: 5, reps: [5, 5, 5, 5, 5], stepKg: 2.5, baseKg: null, restSec: 150 },
    { id: 'bent-row', name: 'Barbell bent-over row', sets: 4, reps: [6, 6, 6, 6], stepKg: 2.5, baseKg: null, restSec: 120 },
    { id: 'incline-db', name: 'Incline dumbbell press', sets: 3, reps: [8, 8, 8], stepKg: 1, baseKg: null, restSec: 90 },
    { id: 'pulldown', name: 'Lat pulldown', sets: 3, reps: [8, 8, 8], stepKg: 2, baseKg: null, restSec: 90 },
    { id: 'face-pull', name: 'Face pull', sets: 2, reps: [12, 12], stepKg: 2, baseKg: null, restSec: 60 }
  ] },
  push: { name: 'Push · press & shoulders', exercises: [
    { id: 'db-bench', name: 'Dumbbell bench press', sets: 4, reps: [8, 8, 8, 8], stepKg: 1, baseKg: null, restSec: 120 },
    { id: 'db-shoulder', name: 'Seated dumbbell shoulder press', sets: 3, reps: [8, 8, 8], stepKg: 1, baseKg: null, restSec: 120 },
    { id: 'db-fly', name: 'Dumbbell fly', sets: 2, reps: [12, 12], stepKg: 1, baseKg: null, restSec: 60 },
    { id: 'lateral', name: 'Dumbbell lateral raise', sets: 3, reps: [12, 12, 12], stepKg: 1, baseKg: null, restSec: 60 },
    { id: 'rope-push', name: 'Rope tricep pushdown', sets: 3, reps: [10, 10, 10], stepKg: 2, baseKg: null, restSec: 60 }
  ] },
  pull: { name: 'Pull · back & arms', exercises: [
    { id: 'pulldown', name: 'Lat pulldown', sets: 3, reps: [8, 8, 8], stepKg: 2, baseKg: null, restSec: 90 },
    { id: 'seated-row', name: 'Seated cable row', sets: 3, reps: [10, 10, 10], stepKg: 2, baseKg: null, restSec: 90 },
    { id: 'chest-row', name: 'Chest-supported dumbbell row', sets: 3, reps: [10, 10, 10], stepKg: 1, baseKg: null, restSec: 90 },
    { id: 'rear-delt', name: 'Cable reverse fly', sets: 2, reps: [12, 12], stepKg: 1, baseKg: null, restSec: 60 },
    { id: 'ez-curl', name: 'EZ-bar curl', sets: 3, reps: [10, 10, 10], stepKg: 2.5, baseKg: null, restSec: 60 }
  ] },
  pump: { name: 'Short pump · optional', exercises: [
    { id: 'ez-curl', name: 'EZ-bar curl', sets: 2, reps: [12, 12], stepKg: 2.5, baseKg: null, restSec: 60 },
    { id: 'rope-push', name: 'Rope tricep pushdown', sets: 2, reps: [12, 12], stepKg: 2, baseKg: null, restSec: 60 },
    { id: 'hammer-curl', name: 'Dumbbell hammer curl', sets: 2, reps: [10, 10], stepKg: 1, baseKg: null, restSec: 60 },
    { id: 'leg-raise', name: 'Hanging leg raise', sets: 2, reps: [10, 10], stepKg: 0, baseKg: null, restSec: 60 }
  ] }
};

const SLOTS = [
  { day: 'Sunday', gym: 'pump', optional: true },
  { day: 'Monday', gym: 'lower' },
  { day: 'Tuesday', gym: 'upper', run: 'easy' },
  { day: 'Wednesday', recovery: true },
  { day: 'Thursday', gym: 'push', run: 'quality' },
  { day: 'Friday', gym: 'pull' },
  { day: 'Saturday', run: 'long' }
];
export function weekSlots() { return SLOTS.map(s => ({ ...s })); }

export function readinessBand(input = {}) {
  if (input.pain || input.ill) return { band: 'red', reason: 'Pain or illness: no hard training.' };
  const score = Number(input.score), feel = Number(input.feel), sleep = Number(input.sleepHours), soreness = Number(input.soreness);
  if ((input.score !== '' && input.score != null && Number.isFinite(score) && score <= 25) || (input.feel && feel <= 1)) return { band: 'red', reason: 'Very low readiness. Recovery first.' };
  if ((input.score !== '' && input.score != null && Number.isFinite(score) && score <= 50) ||
      (input.feel && feel <= 2) || (input.sleepHours && sleep < 6) || soreness >= 2) return { band: 'amber', reason: 'Keep the intent; reduce the dose.' };
  if ((input.score !== '' && input.score != null && Number.isFinite(score)) || (input.feel && feel >= 3)) return { band: 'green', reason: 'Normal session, with good technique.' };
  return { band: 'unknown', reason: 'Recovery data missing. Hold loads and calibrate by feel.' };
}

export function suggestLoad(exercise, gymLogs = [], band = 'unknown') {
  const latest = [...gymLogs].reverse().find(log => log.exercises?.some(e => e.exerciseId === exercise.id));
  const performed = latest?.exercises?.find(e => e.exerciseId === exercise.id);
  const sets = performed?.sets?.filter(s => Number.isFinite(Number(s.kg)) && Number(s.kg) > 0) || [];
  const base = sets.length ? Number(sets.at(-1).kg) : exercise.baseKg;
  if (!Number.isFinite(Number(base)) || base == null || base <= 0) return { kg: null, note: 'Calibrate: choose a controlled load, leave 2–3 reps in reserve.' };
  if (band === 'red') return { kg: null, note: 'No loaded work today.' };
  if (band === 'amber') return { kg: Math.round(base * .95 * 2) / 2, note: 'Reduced for recovery; keep 3+ reps in reserve.' };
  const target = exercise.reps || [];
  const passed = sets.length >= target.length && target.every((rep, i) => Number(sets[i]?.reps) >= rep && Number(sets[i]?.rir) >= 2);
  if (band === 'green' && passed && exercise.stepKg > 0) {
    const next = Math.min(base + exercise.stepKg, base * 1.05);
    return { kg: Math.round(next * 2) / 2, note: 'Small progression earned last session. Stop if form changes.' };
  }
  return { kg: base, note: sets.length ? 'Repeat until every set hits the target at 2+ RIR.' : 'Reference load only; verify with warm-ups.' };
}

function variant(dateString) {
  const anchor = Date.UTC(2026, 9, 5);
  const index = Math.floor((Date.parse(dateString + 'T12:00:00Z') - anchor) / (14 * 86400000));
  return ((index % 2) + 2) % 2 ? 'Try a different curl or rear-delt accessory this fortnight; keep main lifts.' : 'Keep your usual accessories this fortnight.';
}

export function recommendDay(dateString, recovery = {}, gymLogs = [], runs = [], program = DEFAULT_PROGRAM) {
  const slot = SLOTS[new Date(dateString + 'T12:00:00Z').getUTCDay()];
  const readiness = readinessBand(recovery);
  const variation = variant(dateString);
  if (readiness.band === 'red') return { readiness, title: 'Recovery day', reason: readiness.reason, gym: null, run: null, variation };
  const gym = slot.gym && (readiness.band !== 'amber' || !slot.optional) ? {
    id: slot.gym, name: program[slot.gym]?.name || slot.gym,
    optional: !!slot.optional,
    exercises: (program[slot.gym]?.exercises || []).map(e => ({ ...e,
      sets: readiness.band === 'amber' ? Math.max(1, e.sets - 1) : e.sets,
      prescription: suggestLoad(e, gymLogs, readiness.band) }))
  } : null;
  const runKind = slot.run === 'quality' && readiness.band === 'amber' ? 'easy' : slot.run;
  const run = runKind ? { kind: runKind, durationMin: runKind === 'quality' ? '25–40' : runKind === 'long' ? '50–70' : '25–40',
    effort: runKind === 'quality' ? 'Controlled tempo, RPE 7; never a race.' : 'Conversational, RPE 3–4. Walk hills if needed.' } : null;
  const latestRun = [...runs].sort((a,b) => b.date.localeCompare(a.date))[0];
  const gap = latestRun ? Math.floor((Date.parse(dateString) - Date.parse(latestRun.date)) / 86400000) : null;
  const stale = gap == null || gap > 14;
  return { readiness, title: gym?.name || (run ? `${run.kind[0].toUpperCase()}${run.kind.slice(1)} run` : 'Reset & recover'),
    reason: `${readiness.reason}${stale && run ? ' Recent run data is missing/stale; keep the first run easy and shorter.' : ''}`,
    gym, run: stale && run?.kind === 'quality' ? { ...run, kind: 'easy', durationMin: '20–30', effort: 'Conversational, RPE 3–4. Rebuild gradually.' } : run,
    variation, recovery: !!slot.recovery };
}

export function parseGarminExport(data) {
  if (!data || data.ok === false || !Array.isArray(data.activities)) throw new Error('Invalid Garmin export: expected activities array');
  const found = new Map();
  for (const item of data.activities) {
    if (!/RUNNING/i.test(item.type || '') || !/^\d{4}-\d{2}-\d{2}$/.test(item.date || '')) continue;
    const id = /\/activity\/(\d+)$/.exec(item.url || '')?.[1];
    if (!id) continue;
    const raw = item.metrics?.DISTANCE || '';
    const distance = Number.parseFloat(raw);
    found.set(`garmin:${id}`, { id: `garmin:${id}`, date: item.date, name: item.name || 'Run',
      kind: 'imported', distanceKm: Number.isFinite(distance) && /km\b/.test(raw) ? distance : null,
      duration: item.metrics?.TIME || null, source: 'Garmin export' });
  }
  return [...found.values()].sort((a,b) => b.date.localeCompare(a.date));
}
export function mergeRuns(oldRuns = [], incoming = []) {
  const map = new Map(oldRuns.map(run => [run.id, run]));
  for (const run of incoming) map.set(run.id, run);
  return [...map.values()].sort((a,b) => b.date.localeCompare(a.date));
}
