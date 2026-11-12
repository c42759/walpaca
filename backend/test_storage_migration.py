import base64
import io
import json
import os
import tempfile
import unittest

from main import create_app
from models import Attachment, Chat, ChatFolder, Instance, Message, ModelPreferences, db
from routes.generate import _build_messages_payload
from utils.storage import resolve_storage_file


# Minimal valid 1x1 PNG bytes
SAMPLE_PNG_BYTES = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
)
SAMPLE_PNG_B64 = base64.b64encode(SAMPLE_PNG_BYTES).decode("utf-8")
SAMPLE_PNG_DATA_URI = f"data:image/png;base64,{SAMPLE_PNG_B64}"

# Minimal MP4 header containing ftypisom box
SAMPLE_MP4_BYTES = b"\x00\x00\x00\x18ftypisom\x00\x00\x02\x00isomiso2mp41"


class StorageMigrationTestCase(unittest.TestCase):
    def setUp(self):
        self._storage_tmp = tempfile.TemporaryDirectory()
        self._personas_tmp = tempfile.TemporaryDirectory()
        self.storage_dir = self._storage_tmp.name
        self.personas_dir = self._personas_tmp.name

        self._prev_personas_env = os.environ.get("PERSONAS_DIR_PATH")
        self._prev_storage_env = os.environ.get("STORAGE_DIR_PATH")
        os.environ["PERSONAS_DIR_PATH"] = self.personas_dir
        os.environ["STORAGE_DIR_PATH"] = self.storage_dir

        self.app = create_app(
            {
                "TESTING": True,
                "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
                "STORAGE_DIR_PATH": self.storage_dir,
                "PERSONAS_DIR_PATH": self.personas_dir,
            }
        )
        self.client = self.app.test_client()
        with self.app.app_context():
            db.create_all()

    def tearDown(self):
        with self.app.app_context():
            db.session.remove()
            db.drop_all()

        if self._prev_personas_env is None:
            os.environ.pop("PERSONAS_DIR_PATH", None)
        else:
            os.environ["PERSONAS_DIR_PATH"] = self._prev_personas_env

        if self._prev_storage_env is None:
            os.environ.pop("STORAGE_DIR_PATH", None)
        else:
            os.environ["STORAGE_DIR_PATH"] = self._prev_storage_env

        self._storage_tmp.cleanup()
        self._personas_tmp.cleanup()

    def test_avatar_upload_and_serve_png_and_mp4(self):
        # Upload PNG avatar
        res_png = self.client.post(
            "/api/personas/avatar",
            data={"file": (io.BytesIO(SAMPLE_PNG_BYTES), "avatar.png", "image/png")},
            content_type="multipart/form-data",
        )
        self.assertEqual(res_png.status_code, 200)
        png_url = res_png.get_json()["picture"]
        self.assertRegex(png_url, r"^/api/avatars/avatar_[0-9a-f]+\.png$")
        png_filename = png_url.rsplit("/", 1)[-1]
        self.assertTrue(
            os.path.isfile(os.path.join(self.storage_dir, "avatars", png_filename))
        )

        # Serve PNG avatar
        get_png = self.client.get(png_url)
        self.assertEqual(get_png.status_code, 200)
        self.assertEqual(get_png.data, SAMPLE_PNG_BYTES)
        self.assertTrue(get_png.content_type.startswith("image/png"))
        get_png.close()

        # Upload MP4 avatar
        res_mp4 = self.client.post(
            "/api/personas/avatar",
            data={"file": (io.BytesIO(SAMPLE_MP4_BYTES), "avatar.mp4", "video/mp4")},
            content_type="multipart/form-data",
        )
        self.assertEqual(res_mp4.status_code, 200)
        mp4_url = res_mp4.get_json()["picture"]
        self.assertRegex(mp4_url, r"^/api/avatars/avatar_[0-9a-f]+\.mp4$")
        mp4_filename = mp4_url.rsplit("/", 1)[-1]
        self.assertTrue(
            os.path.isfile(os.path.join(self.storage_dir, "avatars", mp4_filename))
        )

        # Serve MP4 avatar
        get_mp4 = self.client.get(mp4_url)
        self.assertEqual(get_mp4.status_code, 200)
        self.assertEqual(get_mp4.data, SAMPLE_MP4_BYTES)
        self.assertTrue(get_mp4.content_type.startswith("video/mp4"))
        get_mp4.close()

        # Traversal attempts must be rejected
        for bad_path in (
            "/api/avatars/../../etc/passwd",
            "/api/avatars/..%2F..%2Fetc%2Fpasswd",
            "/api/avatars/subdir/avatar.png",
        ):
            bad_res = self.client.get(bad_path)
            self.assertIn(bad_res.status_code, (400, 404))

    def test_persona_and_model_preference_normalize_inline_avatars(self):
        # 1. Persona creation with inline data URI picture and character.picture
        persona_payload = {
            "name": "Avatar Hero",
            "description": "Hero persona",
            "system_prompt": "Be helpful.",
            "picture": SAMPLE_PNG_DATA_URI,
            "character": {
                "name": "Avatar Hero",
                "picture": SAMPLE_PNG_DATA_URI,
            },
        }
        p_res = self.client.post("/api/personas", json=persona_payload)
        self.assertEqual(p_res.status_code, 201)
        p_data = p_res.get_json()
        self.assertTrue(p_data["picture"].startswith("/api/avatars/"))
        self.assertTrue(p_data["character"]["picture"].startswith("/api/avatars/"))

        persona_file = os.path.join(self.personas_dir, p_data["filename"])
        self.assertTrue(os.path.isfile(persona_file))
        with open(persona_file, "r", encoding="utf-8") as f:
            raw_persona_json = f.read()
        self.assertNotIn("data:image", raw_persona_json)
        parsed_persona = json.loads(raw_persona_json)
        self.assertTrue(parsed_persona["picture"].startswith("/api/avatars/"))
        self.assertTrue(
            parsed_persona["character"]["picture"].startswith("/api/avatars/")
        )

        avatar_fname = parsed_persona["picture"].rsplit("/", 1)[-1]
        self.assertTrue(
            os.path.isfile(os.path.join(self.storage_dir, "avatars", avatar_fname))
        )

        # 2. Model preference creation with inline data URI picture and character.picture
        with self.app.app_context():
            inst = Instance(id="inst-avatar-test", type="ollama", is_enabled=1)
            db.session.add(inst)
            db.session.commit()

        mp_payload = {
            "instance_id": "inst-avatar-test",
            "model_id": "llama3:latest",
            "picture": SAMPLE_PNG_DATA_URI,
            "character": {
                "name": "Llama Hero",
                "picture": SAMPLE_PNG_DATA_URI,
            },
        }
        mp_res = self.client.post("/api/model-preferences", json=mp_payload)
        self.assertEqual(mp_res.status_code, 200)
        mp_data = mp_res.get_json()
        self.assertTrue(mp_data["picture"].startswith("/api/avatars/"))
        self.assertTrue(mp_data["character"]["picture"].startswith("/api/avatars/"))

        with self.app.app_context():
            pref = db.session.get(ModelPreferences, mp_data["id"])
            self.assertIsNotNone(pref)
            self.assertTrue(pref.picture.startswith("/api/avatars/"))
            self.assertNotIn("data:image", pref.picture)
            self.assertNotIn("data:image", pref.character or "")
            self.assertTrue(
                pref.get_character()["picture"].startswith("/api/avatars/")
            )

    def test_message_attachments_stored_on_disk_and_served_directly(self):
        chat_res = self.client.post("/api/chats", json={"name": "Attachment Disk Chat"})
        self.assertEqual(chat_res.status_code, 201)
        chat_id = chat_res.get_json()["id"]

        code_text = "def greet():\n    return 'hello world'\n"
        msg_payload = {
            "role": "user",
            "content": "Check these attachments",
            "attachments": [
                {
                    "type": "image",
                    "name": "photo.png",
                    "content": SAMPLE_PNG_DATA_URI,
                },
                {
                    "type": "code",
                    "name": "app.py",
                    "content": code_text,
                },
                {
                    "type": "thought",
                    "name": "Thought",
                    "content": "Reasoning step",
                },
                {
                    "type": "metadata",
                    "name": "meta",
                    "content": '{"tokens": 12}',
                },
            ],
        }
        msg_res = self.client.post(f"/api/chats/{chat_id}/messages", json=msg_payload)
        self.assertEqual(msg_res.status_code, 201)
        msg_data = msg_res.get_json()
        atts_by_name = {a["name"]: a for a in msg_data["attachments"]}

        img_att_id = atts_by_name["photo.png"]["id"]
        code_att_id = atts_by_name["app.py"]["id"]
        thought_att_id = atts_by_name["Thought"]["id"]
        meta_att_id = atts_by_name["meta"]["id"]

        with self.app.app_context():
            img_db = db.session.get(Attachment, img_att_id)
            code_db = db.session.get(Attachment, code_att_id)
            thought_db = db.session.get(Attachment, thought_att_id)
            meta_db = db.session.get(Attachment, meta_att_id)

            self.assertEqual(img_db.content, "")
            self.assertIsNotNone(img_db.file_path)
            self.assertTrue(img_db.file_path.startswith(f"chats/{chat_id}/"))
            img_abs = resolve_storage_file(img_db.file_path)
            self.assertIsNotNone(img_abs)
            self.assertTrue(
                img_abs.startswith(os.path.join(self.storage_dir, "chats", chat_id))
            )

            self.assertEqual(code_db.content, "")
            self.assertIsNotNone(code_db.file_path)
            self.assertTrue(code_db.file_path.startswith(f"chats/{chat_id}/"))
            code_abs = resolve_storage_file(code_db.file_path)
            self.assertIsNotNone(code_abs)
            self.assertTrue(
                code_abs.startswith(os.path.join(self.storage_dir, "chats", chat_id))
            )

            self.assertIsNone(thought_db.file_path)
            self.assertEqual(thought_db.content, "Reasoning step")
            self.assertIsNone(meta_db.file_path)
            self.assertEqual(meta_db.content, '{"tokens": 12}')

        # Direct serving of image
        img_get = self.client.get(f"/api/attachments/{img_att_id}")
        self.assertEqual(img_get.status_code, 200)
        self.assertEqual(img_get.data, SAMPLE_PNG_BYTES)
        self.assertTrue(img_get.content_type.startswith("image/png"))
        img_get.close()

        # Direct serving of code file
        code_get = self.client.get(f"/api/attachments/{code_att_id}")
        self.assertEqual(code_get.status_code, 200)
        self.assertEqual(code_get.data.decode("utf-8"), code_text)
        code_get.close()

        # Download flag sets Content-Disposition: attachment
        dl_get = self.client.get(f"/api/attachments/{code_att_id}?download=1")
        self.assertEqual(dl_get.status_code, 200)
        cd = dl_get.headers.get("Content-Disposition", "")
        self.assertIn("attachment", cd)
        self.assertIn("app.py", cd)
        dl_get.close()

    def test_multipart_attachment_upload_and_delete_cleanup(self):
        chat_res = self.client.post("/api/chats", json={"name": "Multipart Chat"})
        chat_id = chat_res.get_json()["id"]
        msg_res = self.client.post(
            f"/api/chats/{chat_id}/messages",
            json={"role": "user", "content": "Empty message"},
        )
        msg_id = msg_res.get_json()["id"]

        up_res = self.client.post(
            f"/api/messages/{msg_id}/attachments",
            data={"file": (io.BytesIO(SAMPLE_PNG_BYTES), "upload.png", "image/png")},
            content_type="multipart/form-data",
        )
        self.assertEqual(up_res.status_code, 201)
        att_data = up_res.get_json()
        att_id = att_data["id"]
        self.assertTrue(att_data["is_file"])
        self.assertEqual(att_data["url"], f"/api/attachments/{att_id}")

        with self.app.app_context():
            att_db = db.session.get(Attachment, att_id)
            self.assertIsNotNone(att_db)
            self.assertTrue(att_db.file_path.startswith(f"chats/{chat_id}/"))
            abs_path = resolve_storage_file(att_db.file_path)
            self.assertIsNotNone(abs_path)
            self.assertTrue(os.path.isfile(abs_path))

        del_res = self.client.delete(f"/api/attachments/{att_id}")
        self.assertEqual(del_res.status_code, 200)
        self.assertFalse(os.path.exists(abs_path))
        with self.app.app_context():
            self.assertIsNone(db.session.get(Attachment, att_id))

    def test_duplicate_fork_and_delete_chat_folder_storage_lifecycle(self):
        parent_folder_res = self.client.post("/api/folders", json={"name": "Parent"})
        parent_folder_id = parent_folder_res.get_json()["id"]
        sub_folder_res = self.client.post(
            "/api/folders", json={"name": "Child", "parent": parent_folder_id}
        )
        sub_folder_id = sub_folder_res.get_json()["id"]

        orig_chat_res = self.client.post(
            "/api/chats", json={"name": "Original", "folder": parent_folder_id}
        )
        orig_chat_id = orig_chat_res.get_json()["id"]

        msg1_res = self.client.post(
            f"/api/chats/{orig_chat_id}/messages",
            json={
                "role": "user",
                "content": "First msg",
                "attachments": [
                    {"type": "image", "name": "pic.png", "content": SAMPLE_PNG_DATA_URI}
                ],
            },
        )
        msg1_id = msg1_res.get_json()["id"]
        self.client.post(
            f"/api/chats/{orig_chat_id}/messages",
            json={"role": "assistant", "content": "Second msg"},
        )

        # Duplicate chat
        dup_res = self.client.post(f"/api/chats/{orig_chat_id}/duplicate")
        self.assertEqual(dup_res.status_code, 201)
        dup_chat_id = dup_res.get_json()["id"]

        # Fork chat at msg1
        fork_res = self.client.post(
            f"/api/chats/{orig_chat_id}/fork", json={"message_id": msg1_id}
        )
        self.assertEqual(fork_res.status_code, 201)
        fork_chat_id = fork_res.get_json()["id"]

        # Move fork chat to child folder so folder delete covers nested subfolder too
        self.client.put(f"/api/chats/{fork_chat_id}", json={"folder": sub_folder_id})

        orig_dir = os.path.join(self.storage_dir, "chats", orig_chat_id)
        dup_dir = os.path.join(self.storage_dir, "chats", dup_chat_id)
        fork_dir = os.path.join(self.storage_dir, "chats", fork_chat_id)

        self.assertTrue(os.path.isdir(orig_dir))
        self.assertTrue(os.path.isdir(dup_dir))
        self.assertTrue(os.path.isdir(fork_dir))
        self.assertTrue(len(os.listdir(dup_dir)) >= 1)
        self.assertTrue(len(os.listdir(fork_dir)) >= 1)

        # Delete original chat -> only orig_dir removed
        del_orig = self.client.delete(f"/api/chats/{orig_chat_id}")
        self.assertEqual(del_orig.status_code, 200)
        self.assertFalse(os.path.exists(orig_dir))
        self.assertTrue(os.path.isdir(dup_dir))
        self.assertTrue(os.path.isdir(fork_dir))

        # Delete parent folder -> recursively removes dup_dir and fork_dir
        del_folder = self.client.delete(f"/api/folders/{parent_folder_id}")
        self.assertEqual(del_folder.status_code, 200)
        self.assertFalse(os.path.exists(dup_dir))
        self.assertFalse(os.path.exists(fork_dir))
        with self.app.app_context():
            self.assertIsNone(db.session.get(ChatFolder, parent_folder_id))
            self.assertIsNone(db.session.get(ChatFolder, sub_folder_id))
            self.assertIsNone(db.session.get(Chat, dup_chat_id))
            self.assertIsNone(db.session.get(Chat, fork_chat_id))

    def test_generate_reads_disk_attachments_for_llm(self):
        chat_res = self.client.post("/api/chats", json={"name": "LLM Disk Read Chat"})
        chat_id = chat_res.get_json()["id"]

        code_text = "x = 42\nprint(x)\n"
        msg_res = self.client.post(
            f"/api/chats/{chat_id}/messages",
            json={
                "role": "user",
                "content": "Explain image and code",
                "attachments": [
                    {
                        "type": "image",
                        "name": "diagram.png",
                        "content": SAMPLE_PNG_DATA_URI,
                    },
                    {
                        "type": "code",
                        "name": "script.py",
                        "content": code_text,
                    },
                ],
            },
        )
        self.assertEqual(msg_res.status_code, 201)

        with self.app.app_context():
            # Confirm both attachments are disk-backed with empty inline content
            atts = Attachment.query.all()
            self.assertEqual(len(atts), 2)
            for a in atts:
                self.assertEqual(a.content, "")
                self.assertIsNotNone(a.file_path)

            payload = _build_messages_payload({}, chat_id=chat_id)
            self.assertEqual(len(payload), 1)
            user_msg = payload[0]
            self.assertEqual(user_msg["role"], "user")
            self.assertIn("images", user_msg)
            self.assertEqual(user_msg["images"], [SAMPLE_PNG_B64])
            self.assertIn("Explain image and code", user_msg["content"])
            self.assertIn("```script.py (code)\n" + code_text + "\n```", user_msg["content"])


if __name__ == "__main__":
    unittest.main()
