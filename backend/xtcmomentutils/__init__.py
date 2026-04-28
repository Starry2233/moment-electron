from pathlib import Path

try:
    from .parser import MomentDBParser
    from .sort_json import MomentProcessor
except ImportError:
    from parser import MomentDBParser
    from sort_json import MomentProcessor


class MomentParser:
    def __init__(self, source: str | Path | bytes):
        self._db = MomentDBParser(source)

    def parse(self, table: str | None = None) -> dict:
        if table:
            return self._db.get_json_object(table)
        return self._db.parse()

    def sort_moments(self, data: list[dict] | None = None, reverse: bool = True) -> list[dict]:
        if data is None:
            data = self._db.get_json_object("moment").get("moment", [])
        return MomentProcessor(data).process_content().sort_by_time(reverse=reverse).get()

    def close(self):
        self._db.close()
