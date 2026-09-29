import unittest
from main import create_app
from models import db, ChatFolder, Chat, Message, Attachment


class DeleteCascadeTestCase(unittest.TestCase):
    def setUp(self):
        self.app = create_app({"TESTING": True, "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"})
        self.client = self.app.test_client()
        with self.app.app_context():
            db.create_all()

    def tearDown(self):
        with self.app.app_context():
            db.session.remove()
            db.drop_all()

    def test_delete_chat_removes_messages_and_attachments(self):
        with self.app.app_context():
            chat = Chat(id="chat1", name="Test Chat")
            db.session.add(chat)
            msg1 = Message(id="msg1", chat_id="chat1", role="user", content="Hello")
            db.session.add(msg1)
            att1 = Attachment(id="att1", message_id="msg1", type="file", name="test.txt", content="data")
            db.session.add(att1)
            db.session.commit()

            # Verify records exist before delete
            self.assertIsNotNone(Chat.query.get("chat1"))
            self.assertIsNotNone(Message.query.get("msg1"))
            self.assertIsNotNone(Attachment.query.get("att1"))

        # Execute DELETE chat API
        response = self.client.delete("/api/chats/chat1")
        self.assertEqual(response.status_code, 200)

        with self.app.app_context():
            # Verify all records purged
            self.assertIsNone(Chat.query.get("chat1"))
            self.assertIsNone(Message.query.get("msg1"))
            self.assertIsNone(Attachment.query.get("att1"))

    def test_delete_folder_recursively_removes_subfolders_chats_and_messages(self):
        with self.app.app_context():
            parent_folder = ChatFolder(id="folder1", name="Parent Folder")
            sub_folder = ChatFolder(id="folder2", name="Child Folder", parent="folder1")
            db.session.add_all([parent_folder, sub_folder])

            chat_in_parent = Chat(id="chat_p", name="Parent Chat", folder="folder1")
            chat_in_child = Chat(id="chat_c", name="Child Chat", folder="folder2")
            db.session.add_all([chat_in_parent, chat_in_child])

            msg_p = Message(id="msg_p", chat_id="chat_p", role="user", content="Msg Parent")
            msg_c = Message(id="msg_c", chat_id="chat_c", role="assistant", content="Msg Child")
            db.session.add_all([msg_p, msg_c])

            att_c = Attachment(id="att_c", message_id="msg_c", type="thought", name="T", content="C")
            db.session.add(att_c)
            db.session.commit()

        # Execute DELETE folder API on parent folder
        response = self.client.delete("/api/folders/folder1")
        self.assertEqual(response.status_code, 200)

        with self.app.app_context():
            # Verify parent & subfolder are deleted
            self.assertIsNone(ChatFolder.query.get("folder1"))
            self.assertIsNone(ChatFolder.query.get("folder2"))

            # Verify chats inside parent and child folders are deleted
            self.assertIsNone(Chat.query.get("chat_p"))
            self.assertIsNone(Chat.query.get("chat_c"))

            # Verify all messages & attachments are deleted
            self.assertIsNone(Message.query.get("msg_p"))
            self.assertIsNone(Message.query.get("msg_c"))
            self.assertIsNone(Attachment.query.get("att_c"))


if __name__ == "__main__":
    unittest.main()
