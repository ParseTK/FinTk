"""Write the API contract to ``openapi.json`` (or verify it is current with ``--check``).

The committed file is the single source the frontend generates its TypeScript client from, so it
must always match the code. CI runs ``--check``.
"""

import json
import sys
from pathlib import Path

from app.core.config import Settings
from app.main import create_app

CONTRACT_PATH = Path(__file__).resolve().parent.parent / "openapi.json"


def render() -> str:
    schema = create_app(Settings(environment="test", sec_contact_email=None)).openapi()
    return json.dumps(schema, indent=2, sort_keys=True) + "\n"


def main() -> int:
    rendered = render()
    if "--check" in sys.argv:
        current = CONTRACT_PATH.read_text(encoding="utf-8") if CONTRACT_PATH.exists() else ""
        if current != rendered:
            print("openapi.json is out of date. Run: uv run python -m scripts.export_openapi")
            return 1
        print("openapi.json is up to date.")
        return 0
    CONTRACT_PATH.write_text(rendered, encoding="utf-8", newline="\n")
    print(f"Wrote {CONTRACT_PATH.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
