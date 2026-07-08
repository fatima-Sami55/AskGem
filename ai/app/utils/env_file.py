"""Read/write single variables in the ai/.env file."""
import re
from pathlib import Path


def get_ai_env_path() -> Path:
    return Path(__file__).resolve().parents[2] / ".env"


def update_env_var(var_name: str, value: str | None) -> None:
    env_path = get_ai_env_path()
    normalized = (value or "").strip()
    content = env_path.read_text(encoding="utf-8") if env_path.exists() else ""
    pattern = re.compile(rf"^{re.escape(var_name)}=.*(?:\r?\n|$)", re.MULTILINE)

    if normalized:
        line = f"{var_name}={normalized}\n"
        if pattern.search(content):
            content = pattern.sub(line, content, count=1)
        else:
            if content and not content.endswith("\n"):
                content += "\n"
            content += line
    elif pattern.search(content):
        content = pattern.sub("", content)
        content = content.rstrip("\n")
        if content:
            content += "\n"

    env_path.parent.mkdir(parents=True, exist_ok=True)
    env_path.write_text(content, encoding="utf-8")
