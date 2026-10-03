import { DEFAULT_PROGRAM, weekSlots, recommendDay, readinessBand, suggestLoad, parseGarminExport, mergeRuns } from './engine.mjs';

const KEY = 'training-compass-v1';
const $ = (id) => document.getElementById(id);
const clone = (value) => JSON.parse(JSON.stringify(value));
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const localDate = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const today = localDate();
const emptyState = () => ({ version: 1, program: clone(DEFAULT_PROGRAM), gymLogs: [], runs: [], recovery: {}, imports: {}, override: null });
let state;
let activeGym = null;
let fileHandle = null;
let toastTimer;

function validateState(data) {
  return data && data.version === 1 && data.program?.upper?.exercises && data.program?.lower?.exercises &&
    Array.isArray(data.gymLogs) && Array.isArray(data.runs) && data.recovery && data.imports;
}
function upgradeProgram(data) {
  const pull = data.program?.pull?.exercises;
  if (!Array.isArray(pull)) return false;
  let changed = false;
  if (!pull.some(ex => ex.id === 'deadlift')) {
    const old = data.program.lower?.exercises?.find(ex => ex.id === 'deadlift');
    pull.unshift({ ...clone(DEFAULT_PROGRAM.pull.exercises[0]), baseKg: old?.baseKg ?? null });
    changed = true;
  }
  const lower = data.program.lower?.exercises;
  if (lower?.map(ex => ex.id).join(',') === 'deadlift,goblet-squat,split-squat,calf-raise') {
    data.program.lower = clone(DEFAULT_PROGRAM.lower);
    changed = true;
  }
  return changed;
}
function save() { localStorage.setItem(KEY, JSON.stringify(state)); }
function toast(message, error = false) {
  const el = $('toast'); el.textContent = message; el.classList.toggle('error', error); el.classList.remove('hidden');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.add('hidden'), 4400);
}
function load() {
  const raw = localStorage.getItem(KEY);
  if (!raw) { state = emptyState(); return true; }
  try { const value = JSON.parse(raw); if (!validateState(value)) throw new Error('invalid'); state = value; if (upgradeProgram(state)) save(); return true; }
  catch { $('normal-app').classList.add('hidden'); $('recovery-block').classList.remove('hidden'); return false; }
}
function badge(band) {
  const el = $('readiness-badge'); el.textContent = `READINESS ${band.toUpperCase()}`;
  el.className = band;
}
function recommendation() {
  const rec = recommendDay(today, state.recovery[today] || {}, state.gymLogs, state.runs, state.program);
  const choice = state.override?.date === today ? state.override.value : null;
  if (!choice || rec.readiness.band === 'red') return rec;
  if (choice === 'rest') return { ...rec, title: 'Recovery day', gym: null, run: null, reason: 'A deliberate rest day. Resume the sequence rather than cramming.' };
  if (choice.startsWith('run-')) {
    const kind = choice === 'run-long' ? 'long' : 'easy';
    return { ...rec, title: `${kind === 'long' ? 'Long easy' : 'Easy'} run`, gym: null,
      run: { kind, durationMin: kind === 'long' ? '50–70' : '25–40', effort: 'Conversational, RPE 3–4.' },
      reason: 'Moved by you. Keep the effort easy and protect recovery.' };
  }
  const day = state.program[choice];
  if (!day) return rec;
  return { ...rec, title: day.name, run: null, reason: 'Moved by you. Avoid cramming missed hard sessions.',
    gym: { id: choice, name: day.name, optional: choice === 'pump', exercises: day.exercises.map(ex => ({ ...ex,
      sets: rec.readiness.band === 'amber' ? Math.max(1, ex.sets - 1) : ex.sets,
      prescription: suggestLoad(ex, state.gymLogs, rec.readiness.band) })) } };
}
function renderToday() {
  const recovery = state.recovery[today] || {};
  const rec = recommendation(); badge(rec.readiness.band);
  $('hero-title').textContent = rec.title;
  $('hero-reason').textContent = rec.reason;
  $('hero-kicker').textContent = rec.readiness.band === 'red' ? 'RECOVER NOW · BUILD LATER' : 'YOUR NEXT MOVE';
  $('hero-tags').innerHTML = [rec.gym ? 'GYM / ' + rec.gym.exercises.length + ' MOVES' : null,
    rec.run ? `RUN / ${rec.run.kind.toUpperCase()}` : null, rec.gym?.optional ? 'OPTIONAL' : null,
    rec.readiness.band === 'unknown' ? 'NO LIVE READINESS' : null].filter(Boolean).map(x => `<span>${escapeHtml(x)}</span>`).join('');
  $('score').value = recovery.score ?? ''; $('sleep').value = recovery.sleepHours ?? '';
  $('feel').value = recovery.feel ?? ''; $('soreness').value = recovery.soreness ?? '';
  $('pain').checked = !!recovery.pain; $('ill').checked = !!recovery.ill;
  $('recovery-source').textContent = recovery.source === 'Garmin export' ? 'Readiness score imported from your selected Garmin export. Verify today’s date.' :
    state.imports.garminAt ? 'Garmin export connected. Missing watch metrics remain blank; your check-in still matters.' : 'No Garmin export linked yet. Your check-in works without it.';
  $('session-override').value = state.override?.date === today ? state.override.value : '';
  const parts = [];
  if (rec.run) parts.push(`<div class="rx highlight"><strong>${escapeHtml(rec.run.kind.toUpperCase())} RUN</strong><span>${escapeHtml(rec.run.durationMin)} min · ${escapeHtml(rec.run.effort)}</span></div>`);
  if (rec.gym) {
    parts.push(...rec.gym.exercises.map(ex => `<div class="rx"><strong>${escapeHtml(ex.name)}</strong><span>${ex.sets} × ${escapeHtml(ex.reps.slice(0,ex.sets).join(' / '))} · ${ex.prescription.kg == null ? 'calibrate' : `${ex.prescription.kg} kg`}<br>${Math.round(ex.restSec / 60 * 10) / 10} min rest</span></div>`));
    parts.push('<button id="start-workout" class="button primary" type="button">Log this workout <span>↗</span></button>');
  }
  if (!parts.length) parts.push('<p class="empty">Rest, walk or easy mobility. Nothing to make up tomorrow.</p>');
  parts.push(`<p class="micro">${escapeHtml(rec.variation)} ${rec.gym ? 'Loads are suggestions, not commands; use warm-ups and sound technique.' : ''}</p>`);
  $('session-details').innerHTML = parts.join('');
  $('start-workout')?.addEventListener('click', () => startWorkout(rec.gym));
}
function startWorkout(gym) {
  activeGym = gym;
  $('exercise-log').innerHTML = gym.exercises.map((ex, i) => `<div class="exercise-block"><h3>${escapeHtml(ex.name)}</h3><p>${escapeHtml(ex.prescription.note)} · target ${escapeHtml(ex.reps.slice(0,ex.sets).join(' / '))} reps</p>${Array.from({length:ex.sets},(_,j)=>`<div class="set-row" data-ex="${i}" data-set="${j}"><span class="set-no">SET ${j+1}</span><label>kg<input class="kg" type="number" min="0" max="500" step="0.5" value="${ex.prescription.kg ?? ''}" aria-label="${escapeHtml(ex.name)} set ${j+1} kilograms"></label><label>reps<input class="reps" type="number" min="0" max="100" value="${ex.reps[j] ?? ex.reps.at(-1)}" aria-label="${escapeHtml(ex.name)} set ${j+1} repetitions"></label><label>RIR<input class="rir" type="number" min="0" max="10" placeholder="2" aria-label="${escapeHtml(ex.name)} set ${j+1} reps in reserve"></label></div>`).join('')}</div>`).join('');
  $('workout-log').classList.remove('hidden'); $('workout-log').scrollIntoView({behavior:'smooth',block:'start'});
}
function saveWorkout(event) {
  event.preventDefault(); if (!activeGym) return;
  const exercises = activeGym.exercises.map((ex,i) => ({ exerciseId: ex.id, name: ex.name,
    sets: [...document.querySelectorAll(`.set-row[data-ex="${i}"]`)].map(row => ({
      kg: row.querySelector('.kg').value === '' ? null : Number(row.querySelector('.kg').value),
      reps: Number(row.querySelector('.reps').value),
      rir: row.querySelector('.rir').value === '' ? null : Number(row.querySelector('.rir').value)
    })).filter(s => Number.isFinite(s.reps) && s.reps > 0) })).filter(e => e.sets.length);
  if (!exercises.length) { toast('Enter at least one completed set.', true); return; }
  state.gymLogs.push({ id: crypto.randomUUID(), date: today, gymId: activeGym.id, name: activeGym.name, exercises });
  save(); activeGym = null; $('workout-log').classList.add('hidden'); renderToday(); renderHistory(); toast('Workout logged. Next load will use these sets.');
}
function renderPlan() {
  $('week-grid').innerHTML = weekSlots().slice(1).concat(weekSlots()[0]).map(slot => {
    const dateDay = new Date(today + 'T12:00:00').getDay();
    const pieces = [slot.gym && state.program[slot.gym]?.name, slot.run && `${slot.run} run`].filter(Boolean);
    return `<article class="day-card ${dateDay === weekSlots().findIndex(s=>s.day===slot.day)?'active':''}"><span class="day-name">${slot.day}</span><strong>${escapeHtml(pieces[0] || 'Recovery')}</strong><p>${escapeHtml(pieces.slice(1).join(' + ') || (slot.optional ? 'Optional · skip on low recovery' : slot.recovery ? 'Walk / mobility' : 'One focused session'))}</p></article>`;
  }).join('');
}
function renderHistory() {
  $('history-summary').textContent = `${state.gymLogs.length} logged gym sessions · ${state.runs.length} recorded runs. Imported and manual entries stay on this device.`;
  $('gym-history').innerHTML = state.gymLogs.length ? [...state.gymLogs].reverse().slice(0,10).map(log=>`<div class="history-entry"><strong>${escapeHtml(log.name)}</strong><span>${escapeHtml(log.date)} · ${log.exercises?.length || 0} moves</span></div>`).join('') : '<p class="empty">No gym sessions yet. Log your first one from Today.</p>';
  $('run-history').innerHTML = state.runs.length ? state.runs.slice(0,12).map(run=>`<div class="history-entry"><strong>${escapeHtml(run.name)}</strong><span>${escapeHtml(run.date)} · ${run.distanceKm ?? '—'} km<br>${escapeHtml(run.source || 'Manual')}</span></div>`).join('') : '<p class="empty">No runs imported yet. Connect a Garmin export or add one below.</p>';
  $('run-date').value ||= today;
}
function renderSync() {
  const stamp = state.imports.garminAt ? new Date(state.imports.garminAt).toLocaleString() : null;
  const latest = state.runs[0]?.date;
  $('sync-status').textContent = stamp ? `Last read: ${stamp}. ${state.runs.length} runs stored. Newest recorded run: ${latest || 'none'}. ${fileHandle ? 'Export linked for re-reading.' : 'Choose the file to re-read.'}` : 'No Garmin export connected.';
  $('starter-status').textContent = state.imports.starterAt ? `Private JEFIT reference loaded: ${new Date(state.imports.starterAt).toLocaleDateString()}. Verify every load with warm-ups.` : 'Reference loads not imported; choose your private starter JSON.';
}
function render() { renderToday(); renderPlan(); renderHistory(); renderSync(); $('today-date').textContent = new Date(today+'T12:00:00').toLocaleDateString('en-NZ',{weekday:'short',day:'numeric',month:'short',year:'numeric'}).toUpperCase(); }
function showTab(name) { document.querySelectorAll('.view').forEach(el=>el.classList.toggle('hidden',el.id!==`view-${name}`)); document.querySelectorAll('.tabs button').forEach(el=>el.classList.toggle('active',el.dataset.tab===name)); window.scrollTo(0,0); }
async function readJSON(file) { if (file.size > 5_000_000) throw new Error('File too large for a workout export.'); return JSON.parse(await file.text()); }
function importGarmin(data) {
  const incoming = parseGarminExport(data);
  if (!incoming.length) throw new Error('No valid Garmin runs in this file; existing runs untouched.');
  const previous = state.runs.length;
  state.runs = mergeRuns(state.runs, incoming);
  const snapshot = data.current_recovery;
  if (snapshot?.date === today && Number.isFinite(Number(snapshot.training_readiness)) && snapshot.training_readiness != null) {
    const old = state.recovery[today] || {};
    state.recovery[today] = { ...old, score: Number(snapshot.training_readiness), source:'Garmin export' };
  }
  state.imports.garminAt = new Date().toISOString(); save(); render(); toast(`Garmin read: ${incoming.length} runs in file, ${state.runs.length - previous} new.`);
}
async function importGarminFile(file) { try { importGarmin(await readJSON(file)); } catch (e) { toast(e.message, true); } }
function dbOpen() { return new Promise((resolve,reject)=>{ const request=indexedDB.open('training-compass-files',1); request.onupgradeneeded=()=>request.result.createObjectStore('handles'); request.onsuccess=()=>resolve(request.result); request.onerror=()=>reject(request.error); }); }
async function getHandle() { const db=await dbOpen(); return new Promise((resolve,reject)=>{ const tx=db.transaction('handles'); const r=tx.objectStore('handles').get('garmin'); r.onsuccess=()=>{resolve(r.result);db.close();}; r.onerror=()=>{reject(r.error);db.close();}; }); }
async function setHandle(handle) { const db=await dbOpen(); return new Promise((resolve,reject)=>{ const tx=db.transaction('handles','readwrite'); tx.objectStore('handles').put(handle,'garmin'); tx.oncomplete=()=>{db.close();resolve();}; tx.onerror=()=>{db.close();reject(tx.error);}; }); }
async function syncFile() {
  try {
    if (!fileHandle) fileHandle = await getHandle();
    if (!fileHandle) return $('garmin-file').click();
    if (await fileHandle.queryPermission({mode:'read'}) !== 'granted' && await fileHandle.requestPermission({mode:'read'}) !== 'granted') throw new Error('File permission not granted.');
    await importGarminFile(await fileHandle.getFile()); renderSync();
  } catch (e) { toast(`Could not re-read export: ${e.message}`, true); }
}
async function linkGarmin() {
  if (!window.showOpenFilePicker) return $('garmin-file').click();
  try { [fileHandle] = await showOpenFilePicker({types:[{description:'Garmin JSON',accept:{'application/json':['.json']}}]}); await setHandle(fileHandle); await syncFile(); }
  catch (e) { if (e.name !== 'AbortError') toast(`Connect failed: ${e.message}. Try the file chooser.`, true); }
}
function download(name, content) { const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([content],{type:'application/json'})); a.download=name; document.body.append(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),1000); }
function wire() {
  document.querySelectorAll('.tabs button').forEach(btn=>btn.addEventListener('click',()=>showTab(btn.dataset.tab)));
  $('readiness-form').addEventListener('submit', e=>{ e.preventDefault(); state.recovery[today]={ score: $('score').value === '' ? null : Number($('score').value), sleepHours: $('sleep').value === '' ? null : Number($('sleep').value), feel: $('feel').value === '' ? null : Number($('feel').value), soreness: $('soreness').value === '' ? null : Number($('soreness').value), pain: $('pain').checked, ill: $('ill').checked, source:'manual' }; save(); renderToday(); toast('Today’s call updated.'); });
  $('session-override').addEventListener('change',e=>{state.override=e.target.value?{date:today,value:e.target.value}:null;save();renderToday();});
  $('workout-form').addEventListener('submit',saveWorkout);
  $('manual-run-form').addEventListener('submit',e=>{e.preventDefault(); const distance=Number($('run-distance').value),minutes=Number($('run-minutes').value); if (!(distance>0&&distance<=200&&minutes>0&&minutes<=1440)) return toast('Check your distance and time.',true); const run={id:`manual:${crypto.randomUUID()}`,date:$('run-date').value,name:`${$('run-effort').value} run`,distanceKm:distance,duration:`${minutes} min`,kind:$('run-effort').value,source:'Manual'}; state.runs=mergeRuns(state.runs,[run]);save();render();showTab('history');$('manual-run-form').reset();toast('Run logged.'); });
  $('link-garmin').addEventListener('click',linkGarmin); $('sync-now').addEventListener('click',syncFile);
  $('garmin-file').addEventListener('change',async e=>{if(e.target.files[0]) await importGarminFile(e.target.files[0]);e.target.value='';});
  $('import-starter').addEventListener('click',()=>$('starter-file').click());
  $('starter-file').addEventListener('change',async e=>{try{const data=await readJSON(e.target.files[0]);if(data.version!==1||!data.program?.upper?.exercises||!data.program?.lower?.exercises)throw Error('Not a valid starter file.');for(const day of Object.values(data.program))for(const ex of day.exercises)if(!Number.isFinite(Number(ex.sets))||ex.sets<1||ex.sets>10||ex.baseKg!=null&&(!Number.isFinite(Number(ex.baseKg))||ex.baseKg<0||ex.baseKg>500))throw Error('Invalid exercise in starter.');state.program=data.program;upgradeProgram(state);state.imports.starterAt=new Date().toISOString();save();render();toast('Private starter loaded. Check loads before lifting.');}catch(err){toast(err.message,true);}e.target.value='';});
  $('export-backup').addEventListener('click',()=>download(`training-compass-backup-${today}.json`,JSON.stringify(state,null,2)));
  $('import-backup').addEventListener('click',()=>$('backup-file').click());
  $('backup-file').addEventListener('change',async e=>{try{const data=await readJSON(e.target.files[0]);if(!validateState(data))throw Error('Invalid backup; current data untouched.');if(!confirm('Replace this browser’s workout data with the backup? Export your current data first.'))return;upgradeProgram(data);localStorage.setItem(KEY,JSON.stringify(data));state=data;render();toast('Backup restored.');}catch(err){toast(err.message,true);}e.target.value='';});
}
$('raw-export').addEventListener('click',()=>download('training-compass-raw-recovery.json',localStorage.getItem(KEY)||''));
if (load()) { wire(); render(); getHandle().then(handle=>{fileHandle=handle;renderSync();}).catch(()=>{}); }
