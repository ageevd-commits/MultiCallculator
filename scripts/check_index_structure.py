#!/usr/bin/env python3
"""Проверяет структуру статического index.html и iframe-калькуляторов."""

from __future__ import annotations

import re
import sys
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"

EXPECTED_CALCULATORS = {
    "fire": {
        "title": "Калькулятор пожара",
        "required_ids": {
            "area", "baseRate", "heightCoef", "clientCoef", "finishCoef", "accessCoef",
            "urgencyCoef", "nightCoef", "demArea", "demRate", "waste", "stairsArea",
            "stairsMult", "stairsRate", "voidArea", "voidRate", "hatches", "hatchRate",
            "reserve", "prodNorm", "manDayCost", "crew", "extraCostPct", "comment",
            "totalPrice", "ratePill", "daysPill", "marginPill", "baseSum", "coefSum",
            "demSum", "stairsSum", "voidSum", "reserveSum", "manDays", "duration",
            "costSum", "grossMargin", "warning", "clientText",
        },
        "required_text": {"Калькулятор работ после пожара", "Скопировать текст для клиента"},
    },
    "metal": {
        "title": "Калькулятор очистки металла",
        "required_ids": {
            "area", "posts", "basePrice", "geometry", "condition", "standard",
            "access", "production", "shiftsPerDay", "risk", "comment", "sumRange",
            "priceRange", "coef", "prodOne", "prodAll", "shifts", "days", "total",
            "warning", "clientText",
        },
        "required_text": {"Калькулятор очистки металла под покраску", "Скопировать текст для клиента"},
    },
    "facade": {
        "title": "Калькулятор АСТ кирпичного фасада",
        "required_ids": {
            "area", "baseRate", "heightCoef", "brickCoef", "dirtCoef", "accessCoef", "segmentCoef", "clientCoef",
            "cleanCoef", "spaceCoef", "coverCoef", "quietCoef", "netCoef", "reinfOn", "reinfArea",
            "reinfRate", "hydroOn", "hydroArea", "hydroRate", "hydroLayers", "jointOn",
            "jointArea", "jointRate", "reserve", "prodNorm", "crew", "comment", "totalPrice",
            "ratePill", "daysPill", "baseSum", "coefSum", "reinfSum", "hydroSum",
            "jointSum", "reserveSum", "duration", "warning", "clientText", "savedList",
        },
        "required_text": {"Калькулятор АСТ кирпичного фасада", "Сохранить расчёт", "Скопировать текст для клиента"},
    },
}


class CollectingHTMLParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.iframes: list[dict[str, str | None]] = []
        self.section_iframes: dict[str, list[dict[str, str | None]]] = {}
        self.sections: set[str] = set()
        self.ids: set[str] = set()
        self.tags: list[str] = []
        self.text_parts: list[str] = []
        self._section_stack: list[str | None] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attrs_dict = dict(attrs)
        self.tags.append(tag)
        if tag == "iframe":
            self.iframes.append(attrs_dict)
            section_id = self._section_stack[-1] if self._section_stack else None
            if section_id:
                self.section_iframes.setdefault(section_id, []).append(attrs_dict)
        if tag == "section" and attrs_dict.get("id"):
            section_id = attrs_dict["id"] or ""
            self.sections.add(section_id)
            self.section_iframes.setdefault(section_id, [])
            self._section_stack.append(section_id)
        elif tag == "section":
            self._section_stack.append(None)
        if attrs_dict.get("id"):
            self.ids.add(attrs_dict["id"] or "")

    def handle_endtag(self, tag: str) -> None:
        if tag == "section" and self._section_stack:
            self._section_stack.pop()

    def handle_data(self, data: str) -> None:
        if data.strip():
            self.text_parts.append(data)


def fail(message: str) -> None:
    print(f"❌ {message}", file=sys.stderr)
    raise SystemExit(1)


def parse_html(source: str) -> CollectingHTMLParser:
    parser = CollectingHTMLParser()
    parser.feed(source)
    parser.close()
    return parser


def assert_readable_index() -> str:
    if not INDEX.exists():
        fail("index.html отсутствует")
    if not INDEX.is_file():
        fail("index.html не является файлом")
    try:
        content = INDEX.read_text(encoding="utf-8")
    except OSError as error:
        fail(f"index.html не читается: {error}")
    if not content.strip():
        fail("index.html пуст")
    return content


def assert_srcdoc_complete(panel_id: str, srcdoc: str) -> None:
    stripped = srcdoc.strip()
    if not stripped:
        fail(f"srcdoc калькулятора {panel_id} пуст")
    required_fragments = ("<!DOCTYPE html>", "<html", "<head", "</head>", "<body", "</body>", "</html>")
    missing = [fragment for fragment in required_fragments if fragment.lower() not in stripped.lower()]
    if missing:
        fail(f"srcdoc калькулятора {panel_id} выглядит оборванным: нет {', '.join(missing)}")
    if not stripped.lower().endswith("</html>"):
        fail(f"srcdoc калькулятора {panel_id} не заканчивается закрывающим </html>")
    if stripped.count("<script>") != stripped.count("</script>"):
        fail(f"srcdoc калькулятора {panel_id} содержит незакрытый script")


def main() -> None:
    content = assert_readable_index()
    page = parse_html(content)

    missing_sections = set(EXPECTED_CALCULATORS) - page.sections
    if missing_sections:
        fail(f"в index.html отсутствуют секции калькуляторов: {', '.join(sorted(missing_sections))}")

    if len(page.iframes) != len(EXPECTED_CALCULATORS):
        fail(f"ожидалось {len(EXPECTED_CALCULATORS)} iframe-калькулятора, найдено {len(page.iframes)}")

    for panel_id, expected in EXPECTED_CALCULATORS.items():
        section_iframes = page.section_iframes.get(panel_id, [])
        if len(section_iframes) != 1:
            fail(f"в секции {panel_id} ожидался ровно один iframe, найдено {len(section_iframes)}")

        iframe = section_iframes[0]
        if iframe.get("title") != expected["title"]:
            fail(
                f"в секции {panel_id} найден iframe с title '{iframe.get('title')}', "
                f"ожидался '{expected['title']}'"
            )

        matching_elsewhere = [
            other_iframe for other_iframe in page.iframes
            if other_iframe is not iframe and other_iframe.get("title") == expected["title"]
        ]
        if matching_elsewhere:
            fail(f"iframe '{expected['title']}' продублирован вне секции {panel_id}")

        if iframe is None:
            # Defensive branch for type checkers; section_iframes[0] above should always provide iframe.
            fail(f"не найден iframe '{expected['title']}' для калькулятора {panel_id}")

        srcdoc = iframe.get("srcdoc") or ""
        assert_srcdoc_complete(panel_id, srcdoc)
        inner = parse_html(srcdoc)
        missing_ids = expected["required_ids"] - inner.ids
        if missing_ids:
            fail(f"в калькуляторе {panel_id} отсутствуют основные элементы: {', '.join(sorted(missing_ids))}")

        text = "\n".join(inner.text_parts)
        missing_text = [fragment for fragment in expected["required_text"] if fragment not in text]
        if missing_text:
            fail(f"в калькуляторе {panel_id} отсутствует текст интерфейса: {', '.join(missing_text)}")

        ids_match = re.search(r"const\s+ids\s*=\s*\[(.*?)\];", srcdoc, re.S)
        if ids_match is None:
            fail(f"в калькуляторе {panel_id} отсутствует обязательное объявление const ids = [...]")

        configured_ids = set(re.findall(r'"([A-Za-z][A-Za-z0-9]*)"', ids_match.group(1)))
        if not configured_ids:
            fail(f"в калькуляторе {panel_id} объявление const ids = [...] пустое")

        missing_configured = configured_ids - inner.ids
        if missing_configured:
            fail(f"в калькуляторе {panel_id} ids ссылается на отсутствующие элементы: {', '.join(sorted(missing_configured))}")

    print("✅ index.html читается; найдены 3 iframe-калькулятора; srcdoc и основные элементы интерфейса проверены.")


if __name__ == "__main__":
    main()
