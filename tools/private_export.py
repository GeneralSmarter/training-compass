"""Generate local-only workout starter and Garmin sync files; never commit outputs."""
from __future__ import annotations
import argparse
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PRIVATE = Path.home() / 'AppData/Local/hermes/training-compass'
JEFIT = Path.home() / 'AppData/Local/hermes/jefit/out/workout-progression.json'
GARMIN_BRIDGE = ROOT.parent / 'garmin-bridge/garmin_bridge.py'
GARMIN_OUT = Path.home() / 'AppData/Local/hermes/garmin/out/tc-activities.json'
NAMES = {
    'bench': 'Barbell Bench Press', 'bent-row': 'Barbell Bent-Over Row',
    'incline-db': 'Dumbbell Incline Bench Press', 'pulldown': 'Cable Lat Pulldown (Wide Grip)',
    'face-pull': 'Cable Rope Face Pull', 'db-bench': 'Dumbbell Bench Press',
    'db-shoulder': 'Dumbbell Seated Shoulder Press', 'db-fly': 'Dumbbell Fly',
    'lateral': 'Dumbbell Lateral Raise', 'rope-push': 'Cable Tricep Pushdown (Rope)',
    'seated-row': 'Cable Seated Row', 'chest-row': 'Dumbbell Incline Bench Row',
    'rear-delt': 'Cable Reverse Fly', 'ez-curl': 'EZ Bar Curl',
    'hammer-curl': 'Dumbbell Hammer Curl', 'leg-raise': 'Hanging Leg Raise',
    'deadlift': 'Barbell Deadlift'
}


def build_starter(source):
    js = "import {DEFAULT_PROGRAM} from './src/engine.mjs'; console.log(JSON.stringify(DEFAULT_PROGRAM))"
    result = subprocess.run(['node', '--input-type=module', '-e', js], cwd=ROOT,
                            check=True, text=True, capture_output=True)
    program = json.loads(result.stdout)
    routine = next((r for r in source.get('routines', []) if r.get('name') == 'New Workout'
                    and any(d.get('name', '').startswith('Upper') for d in r.get('days', []))), None)
    if not routine:
        raise ValueError('Active JEFIT routine not found; refusing invented loads')
    active = {e['name'].strip().lower(): e for day in routine['days']
              if day.get('name') in ('Upper (Heavyish)', 'Push', 'Pull', 'Short Pump')
              for e in day.get('exercises', [])}
    for day in program.values():
        for exercise in day['exercises']:
            match = active.get(NAMES.get(exercise['id'], '').lower())
            weights = [float(s['weight_kg']) for s in match.get('planned_sets', [])
                       if s.get('weight_kg') and 0 < float(s['weight_kg']) < 400] if match else []
            if weights:
                exercise['baseKg'] = max(weights)
    return {'version': 1, 'program': program, 'source': 'Private JEFIT reference; verify all working loads with warm-ups'}


def run_bridge(*parts):
    cmd = ['uv', 'run', '--no-project', '--python', '3.14', '--with', 'websocket-client',
           str(GARMIN_BRIDGE), '--source', 'browser', *parts]
    result = subprocess.run(cmd, check=True, text=True, capture_output=True, timeout=180)
    return json.loads(result.stdout)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('action', choices=['seed', 'sync'])
    args = parser.parse_args()
    PRIVATE.mkdir(parents=True, exist_ok=True)
    if args.action == 'seed':
        data = build_starter(json.loads(JEFIT.read_text(encoding='utf-8')))
        target = PRIVATE / 'private-starter.json'
        count = sum(e['baseKg'] is not None for day in data['program'].values() for e in day['exercises'])
        print(f'Prepared private starter with {count} reference loads: {target}')
    else:
        run_bridge('activities', '--limit', '100', '--out', GARMIN_OUT.name)
        activities = json.loads(GARMIN_OUT.read_text(encoding='utf-8'))['activities']
        if not activities:
            raise RuntimeError('No activities returned; refusing to overwrite last good export')
        try:
            recovery = run_bridge('today')
        except (subprocess.CalledProcessError, ValueError):
            recovery = None
        data = {'ok': True, 'source': 'browser', 'activities': activities, 'current_recovery': recovery}
        target = PRIVATE / 'garmin-sync.json'
        print(f'Refreshed local Garmin export with {len(activities)} activities: {target}')
    target.write_text(json.dumps(data, indent=2), encoding='utf-8')


if __name__ == '__main__':
    main()
