import json
import os
import shutil
import sys
from pathlib import Path


def _safe_save_cached(path: Path, result: dict, root: Path = Path(".")) -> None:
    from graphify.cache import cache_dir, file_hash

    h = file_hash(path, root)
    entry = cache_dir(root) / f"{h}.json"
    tmp = entry.with_suffix(".tmp")
    tmp.write_text(json.dumps(result), encoding="utf-8")
    try:
      os.replace(tmp, entry)
    except PermissionError:
      shutil.copy2(tmp, entry)
      try:
        tmp.unlink(missing_ok=True)
      except PermissionError:
        pass
    except Exception:
      try:
        tmp.unlink(missing_ok=True)
      except PermissionError:
        pass
      raise


def main() -> int:
    target = Path(sys.argv[1] if len(sys.argv) > 1 else ".").resolve()

    import graphify.cache as graphify_cache
    import graphify.extract as graphify_extract
    from graphify.watch import _rebuild_code

    graphify_cache.save_cached = _safe_save_cached
    graphify_extract.save_cached = _safe_save_cached

    ok = _rebuild_code(target)
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
