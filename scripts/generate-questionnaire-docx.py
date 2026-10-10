#!/usr/bin/env python3
"""Create an editable questionnaire DOCX using the existing OOXML helpers."""
from __future__ import annotations

import json
import sys
from pathlib import Path
from xml.etree import ElementTree as ET

from generate_database_docx import (
    WordDocument, add_text_run, build_package, qn, w, xml_bytes,
    write_docx, validate_docx, DC_NS, CP_NS, DCTERMS_NS,
)


def paragraph(body: ET.Element, text: str, *, size: int = 20, bold: bool = False,
              after: int = 80, keep_next: bool = False, color: str = "243447") -> ET.Element:
    node = ET.SubElement(body, w("p"))
    WordDocument.paragraph_properties(node, after=after, keep_next=keep_next)
    add_text_run(node, text, bold=bold, size=size, color=color)
    return node


def table(body: ET.Element, rows: list[dict]) -> None:
    node = ET.SubElement(body, w("tbl"))
    props = ET.SubElement(node, w("tblPr"))
    ET.SubElement(props, w("tblW"), {w("w"): "15020", w("type"): "dxa"})
    ET.SubElement(props, w("tblLayout"), {w("type"): "fixed"})
    margins = ET.SubElement(props, w("tblCellMar"))
    for side, size in (("top", 100), ("bottom", 100), ("left", 130), ("right", 130)):
        ET.SubElement(margins, w(side), {w("w"): str(size), w("type"): "dxa"})
    borders = ET.SubElement(props, w("tblBorders"))
    for side in ("top", "left", "bottom", "right", "insideH", "insideV"):
        ET.SubElement(borders, w(side), {w("val"): "single", w("sz"): "4", w("color"): "D1DEE8"})
    grid = ET.SubElement(node, w("tblGrid"))
    widths = [740, 4760, 4760, 4760]
    for width in widths:
        ET.SubElement(grid, w("gridCol"), {w("w"): str(width)})
    for index, cells in enumerate([["# / ID", "English", "Română", "Français"]] + [
        [row["label"], row["text"]["en"], row["text"]["ro"], row["text"]["fr"]] for row in rows
    ]):
        row = ET.SubElement(node, w("tr"))
        row_properties = ET.SubElement(row, w("trPr"))
        ET.SubElement(row_properties, w("cantSplit"))
        if index == 0:
            ET.SubElement(row_properties, w("tblHeader"))
        for column, text in enumerate(cells):
            cell = ET.SubElement(row, w("tc"))
            properties = ET.SubElement(cell, w("tcPr"))
            ET.SubElement(properties, w("tcW"), {w("w"): str(widths[column]), w("type"): "dxa"})
            ET.SubElement(properties, w("shd"), {w("fill"): "163E6D" if index == 0 else "F3F7FA" if index % 2 == 0 else "FFFFFF"})
            p = paragraph(cell, text, size=18 if column == 0 else 20, bold=index == 0,
                          after=0, color="FFFFFF" if index == 0 else "243447")
            run_properties = p.find(w("r")).find(w("rPr"))
            ET.SubElement(run_properties, w("lang"), {w("val"): ["en-GB", "en-GB", "ro-RO", "fr-FR"][column]})
            spacing = p.find(w("pPr")).find(w("spacing"))
            spacing.set(w("line"), "240")
            spacing.set(w("lineRule"), "auto")
    paragraph(body, "", size=2, after=0)


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("Usage: python scripts/generate-questionnaire-docx.py source.json output.docx")
    source_path = Path(sys.argv[1]).resolve()
    output_path = Path(sys.argv[2]).resolve()
    source = json.loads(source_path.read_text(encoding="utf-8"))
    document = WordDocument()
    for index, page in enumerate(source["pages"]):
        if index:
            document.add_page_break()
        paragraph(document.body, "MEDCOMPASS · QUESTIONNAIRE · 10 OCTOBER 2026", size=16, bold=True, color="356FA6", after=140)
        paragraph(document.body, page["title"], size=34, bold=True, color="163E6D", after=140, keep_next=True)
        if page.get("description"):
            paragraph(document.body, page["description"], size=20, after=180, keep_next=True)
        for text in page.get("paragraphs", []):
            paragraph(document.body, text, after=180)
        if page.get("rows"):
            table(document.body, page["rows"])
        if page.get("note"):
            paragraph(document.body, page["note"], size=17, color="536775", after=0)
    document.finish()
    section = document.body.find(w("sectPr"))
    size = section.find(w("pgSz"))
    size.set(w("w"), "16838")
    size.set(w("h"), "11906")
    size.set(w("orient"), "landscape")
    margins = section.find(w("pgMar"))
    for side in ("top", "right", "bottom", "left"):
        margins.set(w(side), "850")
    parts = build_package("")
    parts["word/document.xml"] = xml_bytes(document.root)
    styles = ET.fromstring(parts["word/styles.xml"])
    for fonts in styles.iter(w("rFonts")):
        for attribute in ("ascii", "hAnsi", "cs"):
            fonts.set(w(attribute), "Arial")
    for language in styles.iter(w("lang")):
        language.set(w("val"), "en-GB")
    parts["word/styles.xml"] = xml_bytes(styles)
    core = ET.fromstring(parts["docProps/core.xml"])
    for namespace, key, value in (
        (DC_NS, "title", "MedCompass — Questionnaire — English / Română / Français"),
        (DC_NS, "subject", "Exact application questionnaire snapshot, 10 October 2026"),
        (DC_NS, "description", "81 rating items and active participant prompts extracted from application source."),
        (CP_NS, "keywords", "MedCompass; questionnaire; English; Romanian; French; source snapshot"),
        (DCTERMS_NS, "created", "2026-10-10T12:00:00Z"),
        (DCTERMS_NS, "modified", "2026-10-10T12:00:00Z"),
    ):
        core.find(qn(namespace, key)).text = value
    parts["docProps/core.xml"] = xml_bytes(core)
    footer = ET.fromstring(parts["word/footer1.xml"])
    footer.find(f".//{w('t')}").text = "MedCompass · Questionnaire EN / RO / FR · 10 October 2026 · "
    parts["word/footer1.xml"] = xml_bytes(footer)
    write_docx(parts, output_path)
    validation = validate_docx(output_path)
    document_text = "\n".join(node.text or "" for node in document.root.iter(w("t")))
    for item in source["ratings"]:
        for language in source["languages"]:
            if item["text"][language] not in document_text:
                raise ValueError(f"DOCX omitted {item['id']} in {language}")
    for page in source["pages"]:
        for row in page.get("rows", []):
            for text in row["text"].values():
                if text not in document_text:
                    raise ValueError(f"DOCX omitted a prompt from {page['title']}")
    print(json.dumps({"docx": validation, "ratingItemsPerLanguage": 81, "languages": source["languages"], "exactTextVerified": True}))


if __name__ == "__main__":
    main()
