import unittest

from main import create_app
from models import db, Chat, ChatFolder


class ChatsApiTestCase(unittest.TestCase):
    def setUp(self):
        self.app = create_app(
            {"TESTING": True, "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"}
        )
        self.client = self.app.test_client()
        with self.app.app_context():
            db.create_all()
            folder = ChatFolder(id="folder-1", name="Work")
            db.session.add(folder)
            db.session.add_all(
                [
                    Chat(id="c-null", name="Root Null", folder=None),
                    Chat(id="c-none", name="Root None Str", folder="none"),
                    Chat(id="c-empty", name="Root Empty Str", folder=""),
                    Chat(id="c-folder", name="Folder Chat", folder="folder-1"),
                ]
            )
            db.session.commit()

    def tearDown(self):
        with self.app.app_context():
            db.session.remove()
            db.drop_all()

    def test_get_chats_unfoldered_queries(self):
        for param in ("none", "NONE", "null", ""):
            res = self.client.get(f"/api/chats?folder={param}")
            self.assertEqual(res.status_code, 200)
            ids = {c["id"] for c in res.get_json()}
            self.assertEqual(ids, {"c-null", "c-none", "c-empty"})

    def test_get_chats_specific_folder(self):
        res = self.client.get("/api/chats?folder=folder-1")
        self.assertEqual(res.status_code, 200)
        ids = [c["id"] for c in res.get_json()]
        self.assertEqual(ids, ["c-folder"])

    def test_get_chats_all(self):
        res = self.client.get("/api/chats")
        self.assertEqual(res.status_code, 200)
        ids = {c["id"] for c in res.get_json()}
        self.assertEqual(ids, {"c-null", "c-none", "c-empty", "c-folder"})


if __name__ == "__main__":
    unittest.main()
