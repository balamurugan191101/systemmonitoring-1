import importlib.util
import unittest
from pathlib import Path

MODULE_PATH = Path(__file__).parents[1] / 'monitor' / 'storage_monitor.py'
spec = importlib.util.spec_from_file_location('storage_monitor', MODULE_PATH)
monitor = importlib.util.module_from_spec(spec)
spec.loader.exec_module(monitor)


class MonitorHelpersTest(unittest.TestCase):
    def test_human_size(self):
        self.assertEqual(monitor.human_size(42), '42 B')
        self.assertEqual(monitor.human_size(2048), '2.00 KB')

    def test_file_filters(self):
        self.assertTrue(monitor.is_ignored(r'C:\\temp\\upload.part'))
        self.assertTrue(monitor.is_ignored(r'C:\\Windows\\notes.txt'))
        self.assertFalse(monitor.is_ignored(r'D:\\Projects\\reports\\summary.csv'))


if __name__ == '__main__':
    unittest.main()
