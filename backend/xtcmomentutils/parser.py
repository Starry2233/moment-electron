import argparse, json, sqlite3, tempfile, sys
from pathlib import Path


class MomentDBParser:
    def __init__(self, source: str | Path | bytes):
        self._conn, self._tmp_path = self._connect(source)

    def _connect(self, source):
        if isinstance(source, bytes):
            tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
            tmp.write(source)
            tmp.close()
            conn = sqlite3.connect(tmp.name)
            return conn, Path(tmp.name)
        return sqlite3.connect(str(source)), None

    @staticmethod
    def _decode(val):
        if isinstance(val, bytes):
            try:
                return val.decode("utf-8")
            except UnicodeDecodeError:
                return val.hex()
        return val

    def tables(self) -> list[str]:
        cur = self._conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
        )
        return [
            row[0] for row in cur.fetchall()
            if row[0] not in ("sqlite_sequence", "android_metadata")
        ]

    def parse(self, name: str | None = None) -> dict[str, list[dict]]:
        if name and name != "moment_all":
            cur = self._conn.execute(f'SELECT * FROM "{name}"')
            cols = [desc[0] for desc in cur.description]
            return {name: [dict(zip(cols, map(self._decode, row))) for row in cur.fetchall()]}
        result = {}
        for name in self.tables():
            cur = self._conn.execute(f'SELECT * FROM "{name}"')
            cols = [desc[0] for desc in cur.description]
            result[name] = [
                dict(zip(cols, map(self._decode, row))) for row in cur.fetchall()
            ]
        return result

    def get_json_object(self, name: str) -> dict:
        return self.parse(name)

    def export_json(self, output_dir: str | Path = "output") -> Path:
        out = Path(output_dir)
        out.mkdir(parents=True, exist_ok=True)
        all_data = self.parse()

        for name, rows in all_data.items():
            (out / f"{name}.json").write_text(
                json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8"
            )
            print(f"[{len(rows):>5}] {name}")

        (out / "moment_all.json").write_text(
            json.dumps(all_data, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        return out

    def close(self):
        self._conn.close()
        if self._tmp_path:
            self._tmp_path.unlink(missing_ok=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Parse moment.db to JSON")
    parser.add_argument("source", nargs="?", default=None, help="Path to moment.db or - for stdin bytes")
    parser.add_argument("-o", "--output", default="output", help="Output directory (default: output)")
    parser.add_argument("-t", "--table", default=None, help="Export single table (default: all)")
    parser.add_argument("-p", "--print", action="store_true", dest="print_", help="Print JSON to stdout instead of writing files")
    args = parser.parse_args()

    if args.source == "-":
        source = sys.stdin.buffer.read()
    elif args.source:
        source = Path(args.source)
    else:
        source = Path(__file__).resolve().parent.parent / "moment.db"

    db = MomentDBParser(source)

    if args.print_:
        data = db.get_json_object(args.table) if args.table else db.parse()
        print(json.dumps(data, ensure_ascii=False, indent=2))
    elif args.table:
        data = db.get_json_object(args.table)
        out = Path(args.output)
        out.mkdir(parents=True, exist_ok=True)
        (out / f"{args.table}.json").write_text(json.dumps(data[args.table], ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"[{len(data[args.table])}] {args.table} -> {out / f'{args.table}.json'}")
    else:
        out_dir = db.export_json(args.output)
        print(f"\nDone. Output -> {out_dir}/")

    db.close()
