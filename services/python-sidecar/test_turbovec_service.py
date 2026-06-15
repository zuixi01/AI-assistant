import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(__file__))

from turbovec_service import TurbovecService


class TurbovecServiceTest(unittest.TestCase):
    def test_search_reports_stale_when_index_is_unavailable(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            service = TurbovecService(index_dir=tmpdir, enabled=True)

            result = service.search(
                tenant_id="tenant-1",
                embedding=[0.1, 0.2],
                top_k=3,
            )

            self.assertFalse(result["success"])
            self.assertTrue(result["stale"])
            self.assertEqual(result["provider"], "turbovec")


if __name__ == "__main__":
    unittest.main()
