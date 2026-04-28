import argparse, json
from pathlib import Path


class MomentProcessor:
    def __init__(self, data: list[dict]):
        self.data = data

    def process_content(self):
        for entry in self.data:
            c = entry.get("content")
            if c is not None and isinstance(c, str):
                try:
                    parsed = json.loads(c)
                    entry["content"] = parsed if isinstance(parsed, dict) else {"text": c}
                except (json.JSONDecodeError, ValueError):
                    entry["content"] = {"text": c}

            lbs = entry.get("momentLbsStr")
            if lbs is not None and isinstance(lbs, str):
                try:
                    parsed = json.loads(lbs)
                    entry["momentLbsStr"] = parsed if isinstance(parsed, dict) else {"original_str": lbs}
                except (json.JSONDecodeError, ValueError):
                    entry["momentLbsStr"] = {"original_str": lbs}
        return self

    def sort_by_time(self, reverse=True):
        self.data.sort(key=lambda x: x.get("createTime", 0) or 0, reverse=reverse)
        return self

    def get(self) -> list[dict]:
        return self.data


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Process and sort moment.json by time")
    parser.add_argument("source", nargs="?", default=None, help="Input JSON file (default: output/moment.json)")
    parser.add_argument("-o", "--output", default=None, help="Output file (default: output/moment_sorted.json)")
    parser.add_argument("-p", "--print", action="store_true", dest="print_", help="Print JSON to stdout instead of writing file")
    parser.add_argument("--no-sort", action="store_true", help="Skip sorting, only process content fields")
    parser.add_argument("--asc", action="store_true", help="Sort ascending (oldest first)")
    args = parser.parse_args()

    src = Path(args.source) if args.source else Path(__file__).resolve().parent.parent / "output" / "moment.json"
    dst = Path(args.output) if args.output else Path(__file__).resolve().parent.parent / "output" / "moment_sorted.json"

    raw = json.loads(src.read_text(encoding="utf-8"))
    processor = MomentProcessor(raw).process_content()

    if not args.no_sort:
        processor.sort_by_time(reverse=not args.asc)

    result = processor.get()

    if args.print_:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        dst.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"Processed {len(result)} entries -> {dst}")
