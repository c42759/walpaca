import unittest

from main import create_app
from models import db, ModelPreferences
from routes.api import evaluate_lorebook_entries


class LorebookEvaluationTestCase(unittest.TestCase):
    def setUp(self):
        self.app = create_app({"TESTING": True, "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"})
        self.client = self.app.test_client()
        with self.app.app_context():
            db.create_all()

    def tearDown(self):
        with self.app.app_context():
            db.session.remove()
            db.drop_all()

    def test_evaluate_lorebook_no_model_preferences(self):
        with self.app.app_context():
            res = evaluate_lorebook_entries("unknown_model", [], "Base prompt")
            self.assertEqual(res, "Base prompt")

    def test_evaluate_lorebook_keyword_triggering(self):
        with self.app.app_context():
            pref = ModelPreferences(id="char_model")
            pref.set_character({
                "name": "Wizard Guide",
                "description": "A wise elder mage.",
                "character_book": {
                    "entries": [
                        {
                            "name": "Eldoria",
                            "keys": "eldoria, kingdom",
                            "content": "Eldoria is an ancient realm of high magic.",
                            "enabled": True,
                        },
                        {
                            "name": "Dragons",
                            "keys": "dragon, drake",
                            "content": "Dragons sleep in the Red Peak mountains.",
                            "enabled": True,
                        },
                        {
                            "name": "Disabled Entry",
                            "keys": "eldoria",
                            "content": "This should not appear.",
                            "enabled": False,
                        },
                    ]
                }
            })
            db.session.add(pref)
            db.session.commit()

            # Test message mentioning "Eldoria"
            messages = [{"role": "user", "content": "Tell me about the history of Eldoria."}]
            res = evaluate_lorebook_entries("char_model", messages, "Custom system instructions")

            self.assertIn("Custom system instructions", res)
            self.assertIn("Character Persona (Wizard Guide):", res)
            self.assertIn("A wise elder mage.", res)
            self.assertIn("World Information & Lore:", res)
            self.assertIn("[Eldoria: Eldoria is an ancient realm of high magic.]", res)
            self.assertNotIn("Dragons sleep in the Red Peak", res)
            self.assertNotIn("This should not appear", res)

    def test_evaluate_lorebook_constant_entry(self):
        with self.app.app_context():
            pref = ModelPreferences(id="const_model")
            pref.set_character({
                "character_book": [
                    {
                        "name": "Always Active Rules",
                        "constant": True,
                        "content": "Magic costs mana to cast.",
                        "enabled": True,
                    }
                ]
            })
            db.session.add(pref)
            db.session.commit()

            # Message does not mention keywords
            messages = [{"role": "user", "content": "Hello!"}]
            res = evaluate_lorebook_entries("const_model", messages, "")

            self.assertIn("World Information & Lore:", res)
            self.assertIn("[Always Active Rules: Magic costs mana to cast.]", res)


if __name__ == "__main__":
    unittest.main()
