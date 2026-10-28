import unittest
from main import create_app
from models import db, Chat, Message, Attachment
from routes.generate import _build_messages_payload


class GenerateAttachmentsTestCase(unittest.TestCase):
    def setUp(self):
        self.app = create_app({"TESTING": True})
        self.client = self.app.test_client()
        with self.app.app_context():
            from models import Preference, db
            pref = Preference.query.get("attach_all_files")
            if pref:
                pref.set_value(False)
                db.session.commit()

    def tearDown(self):
        with self.app.app_context():
            from models import Preference, db
            pref = Preference.query.get("attach_all_files")
            if pref:
                pref.set_value(False)
                db.session.commit()

    def test_messages_payload_only_attaches_files_to_last_user_message(self):
        with self.app.app_context():
            # Scenario: multi-turn payload provided directly
            messages = [
                {
                    "role": "user",
                    "content": "First question",
                    "attachments": [
                        {"name": "doc1.txt", "type": "plain_text", "content": "secret document 1"},
                        {"name": "photo.png", "type": "image", "content": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="},
                    ],
                },
                {
                    "role": "assistant",
                    "content": "First answer",
                },
                {
                    "role": "user",
                    "content": "Follow-up question",
                    "attachments": [
                        {"name": "doc2.txt", "type": "plain_text", "content": "new document 2"},
                    ],
                },
            ]

            payload = _build_messages_payload({"messages": messages})
            self.assertEqual(len(payload), 3)

            # First user message should NOT have attachments or images
            self.assertEqual(payload[0]["role"], "user")
            self.assertEqual(payload[0]["content"], "First question")
            self.assertNotIn("images", payload[0])
            self.assertNotIn("secret document 1", payload[0]["content"])

            # Assistant message unchanged
            self.assertEqual(payload[1]["role"], "assistant")
            self.assertEqual(payload[1]["content"], "First answer")

            # Second (last) user message SHOULD have doc2.txt attached
            self.assertEqual(payload[2]["role"], "user")
            self.assertIn("Follow-up question", payload[2]["content"])
            self.assertIn("doc2.txt", payload[2]["content"])
            self.assertIn("new document 2", payload[2]["content"])

    def test_messages_payload_omits_files_when_last_user_message_has_no_attachments(self):
        with self.app.app_context():
            # Scenario: turn 1 has attachment, turn 2 has none
            messages = [
                {
                    "role": "user",
                    "content": "Initial prompt with file",
                    "attachments": [
                        {"name": "data.csv", "type": "csv", "content": "id,val\n1,100"},
                    ],
                    "images": ["fakebase64oldimage"],
                },
                {
                    "role": "assistant",
                    "content": "I received your data",
                },
                {
                    "role": "user",
                    "content": "What is the average?",
                    "attachments": [],
                },
            ]

            payload = _build_messages_payload({"messages": messages})
            self.assertEqual(len(payload), 3)

            # First message has no attached doc block or images
            self.assertEqual(payload[0]["content"], "Initial prompt with file")
            self.assertNotIn("images", payload[0])
            self.assertNotIn("data.csv", payload[0]["content"])

            # Last user message has clean text and no attachments
            self.assertEqual(payload[2]["content"], "What is the average?")
            self.assertNotIn("images", payload[2])

    def test_db_chat_only_attaches_files_to_last_user_message(self):
        with self.app.app_context():
            chat = Chat(id="test-chat-att-1", name="Attachment Test Chat")
            db.session.add(chat)

            msg1 = Message(
                id="msg-att-1",
                chat_id="test-chat-att-1",
                role="user",
                date_time="2026-10-28 10:00:00",
                content="Here is a file for you",
            )
            db.session.add(msg1)
            att1 = Attachment(
                id="att-1",
                message_id="msg-att-1",
                type="plain_text",
                name="notes.txt",
                content="Important meeting notes",
            )
            db.session.add(att1)

            msg2 = Message(
                id="msg-att-2",
                chat_id="test-chat-att-1",
                role="assistant",
                date_time="2026-10-28 10:01:00",
                content="Got the notes.",
            )
            db.session.add(msg2)

            msg3 = Message(
                id="msg-att-3",
                chat_id="test-chat-att-1",
                role="user",
                date_time="2026-10-28 10:02:00",
                content="Can you summarize them?",
            )
            db.session.add(msg3)
            db.session.commit()

            # When building payload from DB, only msg3 is the last user message
            payload = _build_messages_payload({}, chat_id="test-chat-att-1")
            self.assertEqual(len(payload), 3)

            # msg1 must NOT have notes.txt attached
            self.assertEqual(payload[0]["content"], "Here is a file for you")
            self.assertNotIn("notes.txt", payload[0]["content"])
            self.assertNotIn("Important meeting notes", payload[0]["content"])

            # msg3 is clean question
            self.assertEqual(payload[2]["content"], "Can you summarize them?")

            # Clean up test DB
            db.session.delete(att1)
            db.session.delete(msg1)
            db.session.delete(msg2)
            db.session.delete(msg3)
            db.session.delete(chat)
            db.session.commit()

    def test_db_chat_attaches_file_if_last_user_message_has_attachments(self):
        with self.app.app_context():
            chat = Chat(id="test-chat-att-2", name="Attachment Test Chat 2")
            db.session.add(chat)

            msg1 = Message(
                id="msg-att-2-1",
                chat_id="test-chat-att-2",
                role="user",
                date_time="2026-10-28 11:00:00",
                content="Old message with old file",
            )
            db.session.add(msg1)
            att1 = Attachment(
                id="att-2-1",
                message_id="msg-att-2-1",
                type="plain_text",
                name="old.txt",
                content="Old contents",
            )
            db.session.add(att1)

            msg2 = Message(
                id="msg-att-2-2",
                chat_id="test-chat-att-2",
                role="assistant",
                date_time="2026-10-28 11:01:00",
                content="Processed old file.",
            )
            db.session.add(msg2)

            msg3 = Message(
                id="msg-att-2-3",
                chat_id="test-chat-att-2",
                role="user",
                date_time="2026-10-28 11:02:00",
                content="New message with new file",
            )
            db.session.add(msg3)
            att2 = Attachment(
                id="att-2-2",
                message_id="msg-att-2-3",
                type="plain_text",
                name="new.txt",
                content="Brand new contents",
            )
            db.session.add(att2)
            db.session.commit()

            payload = _build_messages_payload({}, chat_id="test-chat-att-2")
            self.assertEqual(len(payload), 3)

            # msg1 must NOT have old.txt
            self.assertEqual(payload[0]["content"], "Old message with old file")
            self.assertNotIn("old.txt", payload[0]["content"])

            # msg3 MUST have new.txt
            self.assertIn("New message with new file", payload[2]["content"])
            self.assertIn("new.txt", payload[2]["content"])
            self.assertIn("Brand new contents", payload[2]["content"])

            # Clean up
            db.session.delete(att1)
            db.session.delete(att2)
            db.session.delete(msg1)
            db.session.delete(msg2)
            db.session.delete(msg3)
            db.session.delete(chat)
            db.session.commit()

    def test_messages_payload_attach_all_files_true(self):
        messages = [
            {
                "role": "user",
                "content": "First message",
                "attachments": [
                    {"name": "file1.py", "type": "code", "content": "print('hello')"},
                    {"name": "image1.png", "type": "image", "content": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="},
                ],
            },
            {
                "role": "assistant",
                "content": "First response",
            },
            {
                "role": "user",
                "content": "Second message",
                "attachments": [
                    {"name": "file2.py", "type": "code", "content": "print('world')"},
                ],
            },
        ]

        payload = _build_messages_payload({"messages": messages, "attach_all_files": True})
        self.assertEqual(len(payload), 3)

        # First message SHOULD have file1.py and image
        self.assertIn("file1.py", payload[0]["content"])
        self.assertIn("print('hello')", payload[0]["content"])
        self.assertIn("images", payload[0])

        # Second message SHOULD also have file2.py
        self.assertIn("file2.py", payload[2]["content"])
        self.assertIn("print('world')", payload[2]["content"])

    def test_db_chat_attach_all_files_preference_true(self):
        with self.app.app_context():
            from models import Preference
            pref = Preference.query.get("attach_all_files")
            if not pref:
                pref = Preference(key="attach_all_files")
                db.session.add(pref)
            pref.set_value(True)

            chat = Chat(id="test-chat-att-all", name="Attachment All Test Chat")
            db.session.add(chat)

            msg1 = Message(
                id="msg-att-all-1",
                chat_id="test-chat-att-all",
                role="user",
                date_time="2026-10-28 12:00:00",
                content="First user question",
            )
            db.session.add(msg1)
            att1 = Attachment(
                id="att-all-1",
                message_id="msg-att-all-1",
                type="plain_text",
                name="doc1.txt",
                content="Doc 1 text",
            )
            db.session.add(att1)

            msg2 = Message(
                id="msg-att-all-2",
                chat_id="test-chat-att-all",
                role="assistant",
                date_time="2026-10-28 12:01:00",
                content="Assistant reply",
            )
            db.session.add(msg2)

            msg3 = Message(
                id="msg-att-all-3",
                chat_id="test-chat-att-all",
                role="user",
                date_time="2026-10-28 12:02:00",
                content="Second user question",
            )
            db.session.add(msg3)
            att2 = Attachment(
                id="att-all-2",
                message_id="msg-att-all-3",
                type="plain_text",
                name="doc2.txt",
                content="Doc 2 text",
            )
            db.session.add(att2)
            db.session.commit()

            # When attach_all_files preference is True, both msg1 and msg3 retain attachments
            payload = _build_messages_payload({}, chat_id="test-chat-att-all")
            self.assertEqual(len(payload), 3)

            self.assertIn("doc1.txt", payload[0]["content"])
            self.assertIn("Doc 1 text", payload[0]["content"])

            self.assertIn("doc2.txt", payload[2]["content"])
            self.assertIn("Doc 2 text", payload[2]["content"])

            # Clean up
            pref.set_value(False)
            db.session.delete(att1)
            db.session.delete(att2)
            db.session.delete(msg1)
            db.session.delete(msg2)
            db.session.delete(msg3)
            db.session.delete(chat)
            db.session.commit()


if __name__ == "__main__":
    unittest.main()
