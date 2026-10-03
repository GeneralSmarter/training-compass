import unittest
from tools.private_export import build_starter


class StarterTests(unittest.TestCase):
    def test_extracts_known_working_weights_without_publishing_user_data(self):
        source = {"routines": [{"name": "New Workout", "days": [
            {"name": "Upper (Heavyish)", "exercises": [
                {"name": "Barbell Bench Press", "planned_sets": [{"weight_kg": 40, "reps": 12}, {"weight_kg": 60, "reps": 5}]}
            ]}, {"name": "Pull", "exercises": [
                {"name": "Barbell Deadlift", "planned_sets": [{"weight_kg": 80, "reps": 5}]}
            ]}]}]}
        starter = build_starter(source)
        self.assertEqual(starter["program"]["upper"]["exercises"][0]["baseKg"], 60)
        self.assertEqual(starter["program"]["lower"]["exercises"][0]["baseKg"], 80)
        self.assertIsNone(starter["program"]["lower"]["exercises"][1]["baseKg"])
        self.assertNotIn("routines", starter)


if __name__ == '__main__':
    unittest.main()
