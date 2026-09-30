import unittest
from routes.api import clean_base64_image

class ImageHandlingTestCase(unittest.TestCase):
    def test_clean_base64_image_with_data_uri(self):
        raw_b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
        data_uri = f"data:image/png;base64,{raw_b64}"
        self.assertEqual(clean_base64_image(data_uri), raw_b64)

    def test_clean_base64_image_raw(self):
        raw_b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
        self.assertEqual(clean_base64_image(raw_b64), raw_b64)

    def test_clean_base64_image_empty(self):
        self.assertEqual(clean_base64_image(""), "")

if __name__ == "__main__":
    unittest.main()
