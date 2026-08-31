#!/usr/bin/env python3
"""Generate the Q Project database documentation as a dependency-free DOCX.

The generator intentionally uses only Python's standard library. A DOCX file is
an Open Packaging Convention ZIP archive containing WordprocessingML documents.
The script also validates the produced archive, all XML parts, and internal
relationships before reporting success.
"""

from __future__ import annotations

import hashlib
import posixpath
import re
import sys
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from xml.etree import ElementTree as ET


PROJECT_ROOT = Path(__file__).resolve().parents[1]
SOURCE_PATH = PROJECT_ROOT / "docs" / "STRUCTURE_BASE_DE_DONNEES.md"
OUTPUT_PATH = PROJECT_ROOT / "docs" / "Q-Project-Structure-Base-de-donnees.docx"

W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
R_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"
CT_NS = "http://schemas.openxmlformats.org/package/2006/content-types"
CP_NS = "http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
DC_NS = "http://purl.org/dc/elements/1.1/"
DCTERMS_NS = "http://purl.org/dc/terms/"
XSI_NS = "http://www.w3.org/2001/XMLSchema-instance"
EP_NS = "http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"
VT_NS = "http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"

for prefix, namespace in (
    ("w", W_NS),
    ("r", R_NS),
    ("", REL_NS),
    ("cp", CP_NS),
    ("dc", DC_NS),
    ("dcterms", DCTERMS_NS),
    ("xsi", XSI_NS),
    ("ep", EP_NS),
    ("vt", VT_NS),
):
    ET.register_namespace(prefix, namespace)


def qn(namespace: str, tag: str) -> str:
    return f"{{{namespace}}}{tag}"


def w(tag: str) -> str:
    return qn(W_NS, tag)


def set_w(element: ET.Element, attribute: str, value: str | int) -> None:
    element.set(w(attribute), str(value))


def xml_bytes(root: ET.Element) -> bytes:
    return ET.tostring(root, encoding="utf-8", xml_declaration=True)


def add_text_run(
    paragraph: ET.Element,
    text: str,
    *,
    bold: bool = False,
    italic: bool = False,
    code: bool = False,
    color: str | None = None,
    underline: bool = False,
    size: int | None = None,
) -> ET.Element:
    run = ET.SubElement(paragraph, w("r"))
    if bold or italic or code or color or underline or size:
        properties = ET.SubElement(run, w("rPr"))
        if bold:
            ET.SubElement(properties, w("b"))
        if italic:
            ET.SubElement(properties, w("i"))
        if code:
            fonts = ET.SubElement(properties, w("rFonts"))
            fonts.set(w("ascii"), "Consolas")
            fonts.set(w("hAnsi"), "Consolas")
            shade = ET.SubElement(properties, w("shd"))
            shade.set(w("fill"), "EEF2F4")
        if color:
            color_element = ET.SubElement(properties, w("color"))
            color_element.set(w("val"), color)
        if underline:
            underline_element = ET.SubElement(properties, w("u"))
            underline_element.set(w("val"), "single")
        if size:
            size_element = ET.SubElement(properties, w("sz"))
            size_element.set(w("val"), str(size))
            size_cs = ET.SubElement(properties, w("szCs"))
            size_cs.set(w("val"), str(size))
    text_element = ET.SubElement(run, w("t"))
    if text.startswith(" ") or text.endswith(" ") or "  " in text:
        text_element.set("{http://www.w3.org/XML/1998/namespace}space", "preserve")
    text_element.text = text
    return run


INLINE_TOKEN = re.compile(
    r"(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*|\[[^\]]+\]\([^)]+\))"
)


def add_inline_content(paragraph: ET.Element, text: str) -> None:
    position = 0
    for match in INLINE_TOKEN.finditer(text):
        if match.start() > position:
            add_text_run(paragraph, text[position : match.start()])
        token = match.group(0)
        if token.startswith("**"):
            add_text_run(paragraph, token[2:-2], bold=True)
        elif token.startswith("`"):
            add_text_run(paragraph, token[1:-1], code=True)
        elif token.startswith("["):
            link_match = re.fullmatch(r"\[([^\]]+)\]\(([^)]+)\)", token)
            if link_match:
                add_text_run(
                    paragraph,
                    f"{link_match.group(1)} ({link_match.group(2)})",
                    color="0B6B70",
                    underline=True,
                )
        else:
            add_text_run(paragraph, token[1:-1], italic=True)
        position = match.end()
    if position < len(text):
        add_text_run(paragraph, text[position:])


class WordDocument:
    def __init__(self) -> None:
        self.root = ET.Element(w("document"))
        self.body = ET.SubElement(self.root, w("body"))
        self.title_seen = False
        self.cover_subtitle_seen = False

    @staticmethod
    def paragraph_properties(
        paragraph: ET.Element,
        *,
        style: str | None = None,
        left_indent: int | None = None,
        hanging: int | None = None,
        before: int | None = None,
        after: int | None = None,
        keep_next: bool = False,
        shading: str | None = None,
    ) -> ET.Element:
        properties = ET.SubElement(paragraph, w("pPr"))
        if style:
            style_element = ET.SubElement(properties, w("pStyle"))
            style_element.set(w("val"), style)
        if left_indent is not None or hanging is not None:
            indent = ET.SubElement(properties, w("ind"))
            if left_indent is not None:
                indent.set(w("left"), str(left_indent))
            if hanging is not None:
                indent.set(w("hanging"), str(hanging))
        if before is not None or after is not None:
            spacing = ET.SubElement(properties, w("spacing"))
            if before is not None:
                spacing.set(w("before"), str(before))
            if after is not None:
                spacing.set(w("after"), str(after))
        if keep_next:
            ET.SubElement(properties, w("keepNext"))
        if shading:
            shade = ET.SubElement(properties, w("shd"))
            shade.set(w("fill"), shading)
        return properties

    def add_paragraph(
        self,
        text: str = "",
        *,
        style: str | None = None,
        bullet: bool = False,
        number: str | None = None,
        quote: bool = False,
    ) -> ET.Element:
        paragraph = ET.SubElement(self.body, w("p"))
        if bullet:
            self.paragraph_properties(
                paragraph,
                style="ListBullet",
                left_indent=520,
                hanging=280,
                after=70,
            )
            add_text_run(paragraph, "• ", bold=True, color="0B6B70")
        elif number is not None:
            self.paragraph_properties(
                paragraph,
                style="ListNumber",
                left_indent=520,
                hanging=280,
                after=70,
            )
            add_text_run(paragraph, f"{number}. ", bold=True, color="0B6B70")
        elif quote:
            properties = self.paragraph_properties(
                paragraph,
                style="Quote",
                left_indent=420,
                before=80,
                after=120,
                shading="F2F8F8",
            )
            borders = ET.SubElement(properties, w("pBdr"))
            left = ET.SubElement(borders, w("left"))
            left.set(w("val"), "single")
            left.set(w("sz"), "18")
            left.set(w("space"), "8")
            left.set(w("color"), "0B6B70")
        elif style:
            self.paragraph_properties(paragraph, style=style)
        add_inline_content(paragraph, text)
        return paragraph

    def add_heading(self, text: str, level: int) -> None:
        if level == 1 and not self.title_seen:
            self.add_paragraph(text, style="Title")
            self.title_seen = True
            return
        if level == 2 and self.title_seen and not self.cover_subtitle_seen:
            self.add_paragraph(text, style="Subtitle")
            self.cover_subtitle_seen = True
            return
        style_level = max(1, min(3, level - 1))
        self.add_paragraph(text, style=f"Heading{style_level}")

    def add_page_break(self) -> None:
        paragraph = ET.SubElement(self.body, w("p"))
        run = ET.SubElement(paragraph, w("r"))
        break_element = ET.SubElement(run, w("br"))
        break_element.set(w("type"), "page")

    def add_separator(self) -> None:
        paragraph = ET.SubElement(self.body, w("p"))
        properties = self.paragraph_properties(paragraph, before=140, after=140)
        borders = ET.SubElement(properties, w("pBdr"))
        bottom = ET.SubElement(borders, w("bottom"))
        bottom.set(w("val"), "single")
        bottom.set(w("sz"), "8")
        bottom.set(w("space"), "6")
        bottom.set(w("color"), "B7CED0")

    def add_code_block(self, lines: list[str]) -> None:
        paragraph = ET.SubElement(self.body, w("p"))
        properties = self.paragraph_properties(
            paragraph,
            style="CodeBlock",
            left_indent=260,
            before=100,
            after=140,
            shading="F3F6F7",
        )
        borders = ET.SubElement(properties, w("pBdr"))
        for side in ("top", "left", "bottom", "right"):
            border = ET.SubElement(borders, w(side))
            border.set(w("val"), "single")
            border.set(w("sz"), "4")
            border.set(w("space"), "6")
            border.set(w("color"), "D5E1E3")
        for index, line in enumerate(lines):
            if index:
                run = ET.SubElement(paragraph, w("r"))
                ET.SubElement(run, w("br"))
            add_text_run(paragraph, line or " ", code=True, size=18)

    def add_table(self, rows: list[list[str]]) -> None:
        if not rows:
            return
        column_count = max(len(row) for row in rows)
        table = ET.SubElement(self.body, w("tbl"))
        properties = ET.SubElement(table, w("tblPr"))
        width = ET.SubElement(properties, w("tblW"))
        width.set(w("w"), "0")
        width.set(w("type"), "auto")
        layout = ET.SubElement(properties, w("tblLayout"))
        layout.set(w("type"), "autofit")
        margins = ET.SubElement(properties, w("tblCellMar"))
        for side in ("top", "left", "bottom", "right"):
            margin = ET.SubElement(margins, w(side))
            margin.set(w("w"), "90")
            margin.set(w("type"), "dxa")
        borders = ET.SubElement(properties, w("tblBorders"))
        for side in ("top", "left", "bottom", "right", "insideH", "insideV"):
            border = ET.SubElement(borders, w(side))
            border.set(w("val"), "single")
            border.set(w("sz"), "4")
            border.set(w("color"), "CBD9DB")

        grid = ET.SubElement(table, w("tblGrid"))
        for _ in range(column_count):
            column = ET.SubElement(grid, w("gridCol"))
            column.set(w("w"), str(max(900, 9400 // column_count)))

        for row_index, values in enumerate(rows):
            row = ET.SubElement(table, w("tr"))
            if row_index == 0:
                row_properties = ET.SubElement(row, w("trPr"))
                ET.SubElement(row_properties, w("tblHeader"))
            for column_index in range(column_count):
                cell = ET.SubElement(row, w("tc"))
                cell_properties = ET.SubElement(cell, w("tcPr"))
                shade = ET.SubElement(cell_properties, w("shd"))
                if row_index == 0:
                    shade.set(w("fill"), "0B6B70")
                elif row_index % 2 == 0:
                    shade.set(w("fill"), "F5F8F8")
                else:
                    shade.set(w("fill"), "FFFFFF")
                paragraph = ET.SubElement(cell, w("p"))
                self.paragraph_properties(
                    paragraph,
                    style="TableHeader" if row_index == 0 else "TableText",
                    after=0,
                )
                value = values[column_index].strip() if column_index < len(values) else ""
                if row_index == 0:
                    add_text_run(paragraph, value, bold=True, color="FFFFFF", size=18)
                else:
                    add_inline_content(paragraph, value)

        spacer = ET.SubElement(self.body, w("p"))
        self.paragraph_properties(spacer, after=80)

    def finish(self) -> None:
        section = ET.SubElement(self.body, w("sectPr"))
        footer_reference = ET.SubElement(section, w("footerReference"))
        footer_reference.set(w("type"), "default")
        footer_reference.set(qn(R_NS, "id"), "rId3")
        page_size = ET.SubElement(section, w("pgSz"))
        page_size.set(w("w"), "11906")
        page_size.set(w("h"), "16838")
        margins = ET.SubElement(section, w("pgMar"))
        margins.set(w("top"), "1134")
        margins.set(w("right"), "1080")
        margins.set(w("bottom"), "1134")
        margins.set(w("left"), "1080")
        margins.set(w("header"), "540")
        margins.set(w("footer"), "540")
        columns = ET.SubElement(section, w("cols"))
        columns.set(w("space"), "708")
        document_grid = ET.SubElement(section, w("docGrid"))
        document_grid.set(w("linePitch"), "360")


def parse_table_row(line: str) -> list[str]:
    stripped = line.strip().strip("|")
    return [cell.strip() for cell in stripped.split("|")]


def is_table_separator(line: str) -> bool:
    cells = parse_table_row(line)
    return bool(cells) and all(re.fullmatch(r":?-{3,}:?", cell.replace(" ", "")) for cell in cells)


def markdown_to_document(markdown: str) -> ET.Element:
    document = WordDocument()
    lines = markdown.replace("\r\n", "\n").split("\n")
    index = 0
    paragraph_buffer: list[str] = []

    def flush_paragraph() -> None:
        nonlocal paragraph_buffer
        if paragraph_buffer:
            joined = " ".join(part.strip() for part in paragraph_buffer).strip()
            if joined:
                document.add_paragraph(joined)
            paragraph_buffer = []

    while index < len(lines):
        line = lines[index]
        stripped = line.strip()

        if not stripped:
            flush_paragraph()
            index += 1
            continue

        if stripped == "<!-- PAGEBREAK -->":
            flush_paragraph()
            document.add_page_break()
            index += 1
            continue

        if stripped.startswith("```"):
            flush_paragraph()
            code_lines: list[str] = []
            index += 1
            while index < len(lines) and not lines[index].strip().startswith("```"):
                code_lines.append(lines[index].rstrip())
                index += 1
            if index < len(lines):
                index += 1
            document.add_code_block(code_lines)
            continue

        heading_match = re.match(r"^(#{1,4})\s+(.+)$", stripped)
        if heading_match:
            flush_paragraph()
            document.add_heading(heading_match.group(2), len(heading_match.group(1)))
            index += 1
            continue

        if stripped == "---":
            flush_paragraph()
            document.add_separator()
            index += 1
            continue

        if (
            stripped.startswith("|")
            and index + 1 < len(lines)
            and is_table_separator(lines[index + 1].strip())
        ):
            flush_paragraph()
            rows = [parse_table_row(stripped)]
            index += 2
            while index < len(lines) and lines[index].strip().startswith("|"):
                rows.append(parse_table_row(lines[index].strip()))
                index += 1
            document.add_table(rows)
            continue

        bullet_match = re.match(r"^-\s+(.+)$", stripped)
        if bullet_match:
            flush_paragraph()
            document.add_paragraph(bullet_match.group(1), bullet=True)
            index += 1
            continue

        number_match = re.match(r"^(\d+)\.\s+(.+)$", stripped)
        if number_match:
            flush_paragraph()
            document.add_paragraph(number_match.group(2), number=number_match.group(1))
            index += 1
            continue

        if stripped.startswith("> "):
            flush_paragraph()
            document.add_paragraph(stripped[2:], quote=True)
            index += 1
            continue

        paragraph_buffer.append(stripped.rstrip("  "))
        index += 1

    flush_paragraph()
    document.finish()
    return document.root


def create_styles() -> ET.Element:
    styles = ET.Element(w("styles"))

    defaults = ET.SubElement(styles, w("docDefaults"))
    run_defaults = ET.SubElement(defaults, w("rPrDefault"))
    run_properties = ET.SubElement(run_defaults, w("rPr"))
    fonts = ET.SubElement(run_properties, w("rFonts"))
    fonts.set(w("ascii"), "Aptos")
    fonts.set(w("hAnsi"), "Aptos")
    fonts.set(w("cs"), "Aptos")
    size = ET.SubElement(run_properties, w("sz"))
    size.set(w("val"), "21")
    size_cs = ET.SubElement(run_properties, w("szCs"))
    size_cs.set(w("val"), "21")
    language = ET.SubElement(run_properties, w("lang"))
    language.set(w("val"), "fr-FR")
    paragraph_defaults = ET.SubElement(defaults, w("pPrDefault"))
    paragraph_properties = ET.SubElement(paragraph_defaults, w("pPr"))
    spacing = ET.SubElement(paragraph_properties, w("spacing"))
    spacing.set(w("after"), "130")
    spacing.set(w("line"), "285")
    spacing.set(w("lineRule"), "auto")

    def paragraph_style(
        style_id: str,
        name: str,
        *,
        base: str = "Normal",
        size_half_points: int | None = None,
        color: str | None = None,
        bold: bool = False,
        italic: bool = False,
        before: int | None = None,
        after: int | None = None,
        outline_level: int | None = None,
        keep_next: bool = False,
        font: str | None = None,
    ) -> None:
        style = ET.SubElement(styles, w("style"))
        style.set(w("type"), "paragraph")
        style.set(w("styleId"), style_id)
        name_element = ET.SubElement(style, w("name"))
        name_element.set(w("val"), name)
        if style_id != "Normal":
            based_on = ET.SubElement(style, w("basedOn"))
            based_on.set(w("val"), base)
        next_style = ET.SubElement(style, w("next"))
        next_style.set(w("val"), "Normal")
        if style_id == "Normal":
            style.set(w("default"), "1")
            style.set(w("qFormat"), "1")
        properties = ET.SubElement(style, w("pPr"))
        if before is not None or after is not None:
            spacing_element = ET.SubElement(properties, w("spacing"))
            if before is not None:
                spacing_element.set(w("before"), str(before))
            if after is not None:
                spacing_element.set(w("after"), str(after))
        if keep_next:
            ET.SubElement(properties, w("keepNext"))
        if outline_level is not None:
            outline = ET.SubElement(properties, w("outlineLvl"))
            outline.set(w("val"), str(outline_level))
        run_props = ET.SubElement(style, w("rPr"))
        if font:
            font_element = ET.SubElement(run_props, w("rFonts"))
            font_element.set(w("ascii"), font)
            font_element.set(w("hAnsi"), font)
        if bold:
            ET.SubElement(run_props, w("b"))
        if italic:
            ET.SubElement(run_props, w("i"))
        if color:
            color_element = ET.SubElement(run_props, w("color"))
            color_element.set(w("val"), color)
        if size_half_points:
            size_element = ET.SubElement(run_props, w("sz"))
            size_element.set(w("val"), str(size_half_points))
            size_cs_element = ET.SubElement(run_props, w("szCs"))
            size_cs_element.set(w("val"), str(size_half_points))

    paragraph_style("Normal", "Normal", color="243447")
    paragraph_style(
        "Title",
        "Title",
        size_half_points=58,
        color="073D43",
        bold=True,
        before=1800,
        after=180,
    )
    paragraph_style(
        "Subtitle",
        "Subtitle",
        size_half_points=32,
        color="0B6B70",
        before=0,
        after=500,
    )
    paragraph_style(
        "Heading1",
        "heading 1",
        size_half_points=34,
        color="073D43",
        bold=True,
        before=420,
        after=160,
        outline_level=0,
        keep_next=True,
    )
    paragraph_style(
        "Heading2",
        "heading 2",
        size_half_points=27,
        color="0B6B70",
        bold=True,
        before=300,
        after=120,
        outline_level=1,
        keep_next=True,
    )
    paragraph_style(
        "Heading3",
        "heading 3",
        size_half_points=23,
        color="355E62",
        bold=True,
        before=240,
        after=90,
        outline_level=2,
        keep_next=True,
    )
    paragraph_style("ListBullet", "List Bullet", after=60)
    paragraph_style("ListNumber", "List Number", after=60)
    paragraph_style("Quote", "Quote", italic=True, color="355E62")
    paragraph_style("CodeBlock", "Code Block", font="Consolas", size_half_points=18, color="203438")
    paragraph_style("TableText", "Table Text", size_half_points=18, after=0)
    paragraph_style("TableHeader", "Table Header", size_half_points=18, bold=True, color="FFFFFF", after=0)
    paragraph_style("Footer", "Footer", size_half_points=17, color="60777A", after=0)
    return styles


def create_settings() -> ET.Element:
    settings = ET.Element(w("settings"))
    zoom = ET.SubElement(settings, w("zoom"))
    zoom.set(w("percent"), "100")
    default_tab = ET.SubElement(settings, w("defaultTabStop"))
    default_tab.set(w("val"), "720")
    update_fields = ET.SubElement(settings, w("updateFields"))
    update_fields.set(w("val"), "true")
    language = ET.SubElement(settings, w("themeFontLang"))
    language.set(w("val"), "fr-FR")
    compatibility = ET.SubElement(settings, w("compat"))
    setting = ET.SubElement(compatibility, w("compatSetting"))
    setting.set(w("name"), "compatibilityMode")
    setting.set(w("uri"), "http://schemas.microsoft.com/office/word")
    setting.set(w("val"), "15")
    return settings


def create_footer() -> ET.Element:
    footer = ET.Element(w("ftr"))
    paragraph = ET.SubElement(footer, w("p"))
    properties = ET.SubElement(paragraph, w("pPr"))
    style = ET.SubElement(properties, w("pStyle"))
    style.set(w("val"), "Footer")
    alignment = ET.SubElement(properties, w("jc"))
    alignment.set(w("val"), "center")
    add_text_run(paragraph, "Q Project · Structure de la base de données · ", color="60777A", size=17)
    begin_run = ET.SubElement(paragraph, w("r"))
    begin = ET.SubElement(begin_run, w("fldChar"))
    begin.set(w("fldCharType"), "begin")
    instruction_run = ET.SubElement(paragraph, w("r"))
    instruction = ET.SubElement(instruction_run, w("instrText"))
    instruction.set("{http://www.w3.org/XML/1998/namespace}space", "preserve")
    instruction.text = " PAGE "
    separate_run = ET.SubElement(paragraph, w("r"))
    separate = ET.SubElement(separate_run, w("fldChar"))
    separate.set(w("fldCharType"), "separate")
    add_text_run(paragraph, "1", color="60777A", size=17)
    end_run = ET.SubElement(paragraph, w("r"))
    end = ET.SubElement(end_run, w("fldChar"))
    end.set(w("fldCharType"), "end")
    return footer


def create_content_types() -> ET.Element:
    root = ET.Element(qn(CT_NS, "Types"))
    for extension, content_type in (
        ("rels", "application/vnd.openxmlformats-package.relationships+xml"),
        ("xml", "application/xml"),
    ):
        default = ET.SubElement(root, qn(CT_NS, "Default"))
        default.set("Extension", extension)
        default.set("ContentType", content_type)
    overrides = {
        "/word/document.xml": "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml",
        "/word/styles.xml": "application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml",
        "/word/settings.xml": "application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml",
        "/word/footer1.xml": "application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml",
        "/docProps/core.xml": "application/vnd.openxmlformats-package.core-properties+xml",
        "/docProps/app.xml": "application/vnd.openxmlformats-officedocument.extended-properties+xml",
    }
    for part_name, content_type in overrides.items():
        override = ET.SubElement(root, qn(CT_NS, "Override"))
        override.set("PartName", part_name)
        override.set("ContentType", content_type)
    return root


def create_root_relationships() -> ET.Element:
    root = ET.Element(qn(REL_NS, "Relationships"))
    relationships = (
        (
            "rId1",
            "http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument",
            "word/document.xml",
        ),
        (
            "rId2",
            "http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties",
            "docProps/core.xml",
        ),
        (
            "rId3",
            "http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties",
            "docProps/app.xml",
        ),
    )
    for relation_id, relation_type, target in relationships:
        relationship = ET.SubElement(root, qn(REL_NS, "Relationship"))
        relationship.set("Id", relation_id)
        relationship.set("Type", relation_type)
        relationship.set("Target", target)
    return root


def create_document_relationships() -> ET.Element:
    root = ET.Element(qn(REL_NS, "Relationships"))
    relationships = (
        (
            "rId1",
            "http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles",
            "styles.xml",
        ),
        (
            "rId2",
            "http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings",
            "settings.xml",
        ),
        (
            "rId3",
            "http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer",
            "footer1.xml",
        ),
    )
    for relation_id, relation_type, target in relationships:
        relationship = ET.SubElement(root, qn(REL_NS, "Relationship"))
        relationship.set("Id", relation_id)
        relationship.set("Type", relation_type)
        relationship.set("Target", target)
    return root


def create_core_properties() -> ET.Element:
    root = ET.Element(qn(CP_NS, "coreProperties"))
    ET.SubElement(root, qn(DC_NS, "title")).text = "Q Project — Structure de la base de données"
    ET.SubElement(root, qn(DC_NS, "subject")).text = "Supabase, portail Specialist/Admin et provenance scientifique"
    ET.SubElement(root, qn(DC_NS, "creator")).text = "Q Project"
    ET.SubElement(root, qn(CP_NS, "lastModifiedBy")).text = "Q Project documentation generator"
    ET.SubElement(root, qn(DC_NS, "description")).text = (
        "Architecture, dictionnaire, permissions, workflow, sécurité et limites scientifiques."
    )
    ET.SubElement(root, qn(CP_NS, "keywords")).text = (
        "Supabase; PostgreSQL; RLS; calibration; spécialités médicales; audit"
    )
    created = ET.SubElement(root, qn(DCTERMS_NS, "created"))
    created.set(qn(XSI_NS, "type"), "dcterms:W3CDTF")
    created.text = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    modified = ET.SubElement(root, qn(DCTERMS_NS, "modified"))
    modified.set(qn(XSI_NS, "type"), "dcterms:W3CDTF")
    modified.text = created.text
    return root


def create_app_properties() -> ET.Element:
    root = ET.Element(qn(EP_NS, "Properties"))
    ET.SubElement(root, qn(EP_NS, "Application")).text = "Q Project OOXML generator"
    ET.SubElement(root, qn(EP_NS, "AppVersion")).text = "1.0"
    ET.SubElement(root, qn(EP_NS, "Company")).text = "Q Project"
    ET.SubElement(root, qn(EP_NS, "DocSecurity")).text = "0"
    ET.SubElement(root, qn(EP_NS, "ScaleCrop")).text = "false"
    return root


def validate_source(markdown: str) -> None:
    forbidden_patterns = {
        "adresse e-mail": re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.IGNORECASE),
        "clé Supabase": re.compile(r"\bsb_(?:publishable|secret)_[A-Za-z0-9_-]+"),
        "JWT": re.compile(r"\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}"),
        "URL de projet": re.compile(r"https://[a-z0-9]+\.supabase\.co", re.IGNORECASE),
    }
    findings = [label for label, pattern in forbidden_patterns.items() if pattern.search(markdown)]
    if findings:
        raise ValueError(f"Sensitive-looking content found in documentation: {', '.join(findings)}")
    migration_name = "20260831120000_specialist_admin_portal.sql"
    if migration_name not in markdown:
        raise ValueError(f"Documentation must cite {migration_name}")


def build_package(markdown: str) -> dict[str, bytes]:
    document = markdown_to_document(markdown)
    return {
        "[Content_Types].xml": xml_bytes(create_content_types()),
        "_rels/.rels": xml_bytes(create_root_relationships()),
        "docProps/core.xml": xml_bytes(create_core_properties()),
        "docProps/app.xml": xml_bytes(create_app_properties()),
        "word/document.xml": xml_bytes(document),
        "word/styles.xml": xml_bytes(create_styles()),
        "word/settings.xml": xml_bytes(create_settings()),
        "word/footer1.xml": xml_bytes(create_footer()),
        "word/_rels/document.xml.rels": xml_bytes(create_document_relationships()),
    }


def write_docx(parts: dict[str, bytes], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path = output_path.with_suffix(".docx.tmp")
    with zipfile.ZipFile(temporary_path, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for name, payload in parts.items():
            info = zipfile.ZipInfo(name)
            info.date_time = (2026, 8, 31, 12, 0, 0)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o600 << 16
            archive.writestr(info, payload)
    temporary_path.replace(output_path)


def relationship_source(path: str) -> str:
    if path == "_rels/.rels":
        return ""
    prefix, filename = path.rsplit("/_rels/", 1)
    source_name = filename[: -len(".rels")]
    return posixpath.join(prefix, source_name)


def validate_docx(path: Path) -> dict[str, object]:
    required_parts = {
        "[Content_Types].xml",
        "_rels/.rels",
        "docProps/core.xml",
        "docProps/app.xml",
        "word/document.xml",
        "word/styles.xml",
        "word/settings.xml",
        "word/footer1.xml",
        "word/_rels/document.xml.rels",
    }
    if not path.is_file():
        raise FileNotFoundError(path)
    with zipfile.ZipFile(path, "r") as archive:
        names = archive.namelist()
        if len(names) != len(set(names)):
            raise ValueError("DOCX contains duplicate ZIP entries")
        missing = sorted(required_parts.difference(names))
        if missing:
            raise ValueError(f"DOCX is missing required parts: {', '.join(missing)}")
        broken = archive.testzip()
        if broken:
            raise ValueError(f"Corrupted ZIP entry: {broken}")

        parsed: dict[str, ET.Element] = {}
        xml_names = [name for name in names if name.endswith(".xml") or name.endswith(".rels")]
        for name in xml_names:
            parsed[name] = ET.fromstring(archive.read(name))

        document_root = parsed["word/document.xml"]
        if document_root.tag != w("document") or document_root.find(w("body")) is None:
            raise ValueError("word/document.xml is not a WordprocessingML document")

        for rels_path in ("_rels/.rels", "word/_rels/document.xml.rels"):
            base_source = relationship_source(rels_path)
            base_directory = posixpath.dirname(base_source)
            for relationship in parsed[rels_path]:
                if relationship.get("TargetMode") == "External":
                    continue
                target = relationship.get("Target")
                if not target:
                    raise ValueError(f"Relationship without target in {rels_path}")
                resolved = posixpath.normpath(posixpath.join(base_directory, target))
                if resolved not in names:
                    raise ValueError(
                        f"Broken relationship {relationship.get('Id')} in {rels_path}: {resolved}"
                    )

    payload = path.read_bytes()
    return {
        "path": str(path),
        "size": len(payload),
        "sha256": hashlib.sha256(payload).hexdigest(),
        "zip_entries": len(names),
        "xml_parts": len(xml_names),
    }


def main() -> int:
    validate_only = "--validate-only" in sys.argv[1:]
    if not validate_only:
        markdown = SOURCE_PATH.read_text(encoding="utf-8")
        validate_source(markdown)
        package = build_package(markdown)
        write_docx(package, OUTPUT_PATH)

    result = validate_docx(OUTPUT_PATH)
    print(f"DOCX valid: {result['path']}")
    print(f"Size: {result['size']} bytes")
    print(f"ZIP entries: {result['zip_entries']}; XML parts: {result['xml_parts']}")
    print(f"SHA-256: {result['sha256']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
