"use client";

import {
  Box,
  Button,
  Chip,
  Container,
  Divider,
  Paper,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createEditor, Descendant, Editor, Element as SlateElement, Node, Path, Transforms } from "slate";
import { Editable, ReactEditor, RenderElementProps, Slate, withReact } from "slate-react";

type PresentationElement =
  | { type: "paragraph"; children: { text: string }[] }
  | { type: "heading"; children: { text: string }[] }
  | { type: "subtitle"; children: { text: string }[] }
  | { type: "slide-break"; children: { text: string }[] }
  | { type: "image"; url: string; alt?: string; width: number; children: { text: string }[] }
  | { type: "spreadsheet"; name: string; rows: string[][]; children: { text: string }[] };

const INITIAL_VALUE: Descendant[] = [
  {
    type: "heading",
    children: [{ text: "Presentation Title" }]
  } as PresentationElement,
  {
    type: "paragraph",
    children: [{ text: "Write the first slide content here." }]
  } as PresentationElement,
  {
    type: "slide-break",
    children: [{ text: "" }]
  } as PresentationElement,
  {
    type: "heading",
    children: [{ text: "Second Slide" }]
  } as PresentationElement,
  {
    type: "paragraph",
    children: [{ text: "Use the Add Slide button to create new slides." }]
  } as PresentationElement
];

type PresentationTheme = "light" | "dark" | "aurora";

const PRESENTATION_THEMES: Record<
  PresentationTheme,
  {
    label: string;
    slideBg: string;
    text: string;
    subtitle: string;
    border: string;
    leftBg: string;
    tableHeaderBg: string;
    tableText: string;
    tableBorder: string;
    deckBg: string;
  }
> = {
  light: {
    label: "Light",
    slideBg: "#ffffff",
    text: "#0f172a",
    subtitle: "#475569",
    border: "#d8dee7",
    leftBg: "#e5e7eb",
    tableHeaderBg: "#f1f5f9",
    tableText: "#0f172a",
    tableBorder: "#cbd5e1",
    deckBg: "#f8fafc"
  },
  dark: {
    label: "Dark",
    slideBg: "#0b1220",
    text: "#e2e8f0",
    subtitle: "#94a3b8",
    border: "#334155",
    leftBg: "#1e293b",
    tableHeaderBg: "#1f2937",
    tableText: "#e2e8f0",
    tableBorder: "#334155",
    deckBg: "#020617"
  },
  aurora: {
    label: "Aurora",
    slideBg: "linear-gradient(145deg, #e0f2fe 0%, #dcfce7 48%, #fef3c7 100%)",
    text: "#102a43",
    subtitle: "#28536b",
    border: "#93c5fd",
    leftBg: "#bfdbfe",
    tableHeaderBg: "#dbeafe",
    tableText: "#102a43",
    tableBorder: "#93c5fd",
    deckBg: "#e0f2fe"
  }
};

function isSlideBreak(node: Descendant): boolean {
  return SlateElement.isElement(node) && (node as PresentationElement).type === "slide-break";
}

function extractText(node: Node): string {
  return Node.string(node).trim();
}

function isMeaningful(node: Descendant): boolean {
  if (
    SlateElement.isElement(node) &&
    ((node as PresentationElement).type === "image" || (node as PresentationElement).type === "spreadsheet")
  ) {
    return true;
  }
  return extractText(node).length > 0;
}

function splitToSlides(value: Descendant[]): Descendant[][] {
  const slides: Descendant[][] = [[]];

  for (const node of value) {
    if (isSlideBreak(node)) {
      if (slides[slides.length - 1].length === 0) {
        continue;
      }
      slides.push([]);
      continue;
    }

    slides[slides.length - 1].push(node);
  }

  const filtered = slides
    .map((slide) => slide.filter((node) => !isSlideBreak(node)))
    .filter((slide) => slide.some((node) => isMeaningful(node)));

  return filtered.length ? filtered : [[{ type: "paragraph", children: [{ text: "Empty slide" }] } as PresentationElement]];
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

type SlideTemplate = {
  title: string;
  subtitle: string;
  text: string;
  imageUrl: string | null;
  imageAlt: string;
  tables: Array<{ name: string; rows: string[][] }>;
};

function parseSlideTemplate(nodes: Descendant[]): SlideTemplate {
  let title = "";
  let subtitle = "";
  let imageUrl: string | null = null;
  let imageAlt = "Slide image";
  const textParts: string[] = [];
  const tables: Array<{ name: string; rows: string[][] }> = [];

  for (const node of nodes) {
    if (!SlateElement.isElement(node)) continue;
    const element = node as PresentationElement;
    const nodeText = Node.string(node).trim();

    if (element.type === "heading" && !title) {
      title = nodeText || "Title";
      continue;
    }

    if (element.type === "subtitle" && !subtitle) {
      subtitle = nodeText || "Subtitle";
      continue;
    }

    if (element.type === "image" && !imageUrl) {
      imageUrl = element.url;
      imageAlt = element.alt ?? "Slide image";
      continue;
    }

    if (element.type === "paragraph" && nodeText) {
      textParts.push(nodeText);
    }

    if (element.type === "spreadsheet") {
      tables.push({
        name: element.name || "Sheet",
        rows: element.rows
      });
    }
  }

  return {
    title: title || "Title",
    subtitle: subtitle || "Subtitle",
    text: textParts.join("\n\n"),
    imageUrl,
    imageAlt,
    tables
  };
}

function buildPrintHtml(slides: Descendant[][], theme: PresentationTheme): string {
  const activeTheme = PRESENTATION_THEMES[theme];
  const slidesHtml = slides
    .map((slide) => {
      const data = parseSlideTemplate(slide);
      const leftBlock = data.imageUrl
        ? `<img src="${escapeHtml(data.imageUrl)}" alt="${escapeHtml(data.imageAlt)}" />`
        : `<div class="print-image-placeholder">Image</div>`;
      const text = data.text ? `<p>${escapeHtml(data.text)}</p>` : "";
      const tables = data.tables
        .map((table) => {
          const rowsHtml = table.rows
            .map((row, rowIndex) => {
              const tag = rowIndex === 0 ? "th" : "td";
              return `<tr>${row.map((cell) => `<${tag}>${escapeHtml(cell ?? "")}</${tag}>`).join("")}</tr>`;
            })
            .join("");
          return `<div class="print-table-wrap">
            <div class="print-table-title">${escapeHtml(table.name)}</div>
            <table class="print-table"><tbody>${rowsHtml}</tbody></table>
          </div>`;
        })
        .join("");

      return `<section class="print-slide">
        <div class="print-left">${leftBlock}</div>
        <div class="print-right">
          <div class="print-header">
            <h2>${escapeHtml(data.title)}</h2>
            <h3>${escapeHtml(data.subtitle)}</h3>
          </div>
          <div class="print-title-gap"></div>
          <div class="print-text">${text}</div>
          ${tables}
        </div>
      </section>`;
    })
    .join("");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Presentation Print</title>
    <style>
      @page { size: landscape; margin: 12mm; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
        color: ${activeTheme.text};
        background: ${activeTheme.deckBg};
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .print-slide {
        width: 100%;
        min-height: 170mm;
        border: 1px solid ${activeTheme.border};
        border-radius: 12px;
        margin: 0;
        display: grid;
        grid-template-columns: 25% 1fr;
        gap: 18px;
        break-after: page;
        page-break-after: always;
        page-break-inside: avoid;
      }
      .print-left {
        min-height: 170mm;
        background: ${activeTheme.leftBg};
      }
      .print-left img {
        width: 100%;
        height: 170mm;
        object-fit: cover;
      }
      .print-image-placeholder {
        width: 100%;
        min-height: 170mm;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #64748b;
        font-size: 20px;
      }
      .print-right {
        padding: 14mm 12mm;
        margin: 0;
        display: flex;
        flex-direction: column;
        min-height: 170mm;
        background: ${activeTheme.slideBg};
        overflow: visible;
      }
      .print-slide:last-child {
        break-after: auto;
        page-break-after: auto;
      }
      .print-header {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
      }
      h2 {
        margin: 0;
        font-size: 42px;
        line-height: 1.2;
      }
      h3 {
        margin: 6px 0 0;
        font-size: 26px;
        line-height: 1.3;
        color: ${activeTheme.subtitle};
        font-weight: 600;
      }
      .print-title-gap {
        height: 50px;
        flex: 0 0 auto;
      }
      .print-text {
        margin-top: 0;
      }
      p {
        margin: 0;
        font-size: 18px;
        line-height: 1.45;
        white-space: pre-wrap;
      }
      .print-table-wrap {
        margin-top: 14px;
        overflow-x: auto;
      }
      .print-table-title {
        font-size: 13px;
        color: ${activeTheme.subtitle};
        margin-bottom: 6px;
      }
      .print-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 14px;
      }
      .print-table th,
      .print-table td {
        border: 1px solid ${activeTheme.tableBorder};
        color: ${activeTheme.tableText};
        padding: 6px 8px;
        text-align: left;
        vertical-align: top;
      }
      .print-table th {
        background: ${activeTheme.tableHeaderBg};
      }
    </style>
  </head>
  <body>
    ${slidesHtml}
  </body>
</html>`;
}

function SlideContent({ nodes, theme }: { nodes: Descendant[]; theme: PresentationTheme }) {
  const slide = parseSlideTemplate(nodes);
  const activeTheme = PRESENTATION_THEMES[theme];

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: "25% 1fr",
        minHeight: 360,
        height: "100%",
        border: "1px solid",
        borderColor: activeTheme.border,
        borderRadius: 2,
        overflow: "hidden",
        bgcolor: activeTheme.slideBg,
        color: activeTheme.text
      }}
    >
      <Box sx={{ height: "100%", bgcolor: activeTheme.leftBg }}>
        {slide.imageUrl ? (
          <Box
            component="img"
            src={slide.imageUrl}
            alt={slide.imageAlt}
            sx={{
              width: "100%",
              height: "100%",
              objectFit: "cover"
            }}
          />
        ) : (
          <Box
            sx={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: activeTheme.subtitle
            }}
          >
            <Typography variant="body2">Image</Typography>
          </Box>
        )}
      </Box>

      <Box sx={{ p: { xs: 2, md: 3 }, display: "flex", flexDirection: "column", minHeight: "100%" }}>
        <Box sx={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>
          <Typography variant="h4" fontWeight={700} sx={{ lineHeight: 1.2 }}>
            {slide.title}
          </Typography>
          <Typography variant="h6" fontWeight={600} sx={{ mt: 0.75, color: activeTheme.subtitle }}>
            {slide.subtitle}
          </Typography>
        </Box>
        <Box sx={{ height: "3.3rem", flexShrink: 0 }} />
        <Typography variant="body1" sx={{ whiteSpace: "pre-wrap" }}>
          {slide.text}
        </Typography>
        {slide.tables.map((table, tableIndex) => (
          <Box key={`slide-table-${tableIndex}`} sx={{ mt: 2 }}>
            <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 0.75 }}>
              {table.name}
            </Typography>
            <Box sx={{ overflowX: "auto" }}>
              <Box component="table" sx={{ width: "100%", borderCollapse: "collapse", minWidth: 360 }}>
                <Box component="tbody">
                  {table.rows.map((row, rowIndex) => (
                    <Box component="tr" key={`slide-row-${tableIndex}-${rowIndex}`}>
                      {row.map((cell, colIndex) => (
                        <Box
                          component={rowIndex === 0 ? "th" : "td"}
                          key={`slide-cell-${tableIndex}-${rowIndex}-${colIndex}`}
                          sx={{
                            border: "1px solid",
                            borderColor: activeTheme.tableBorder,
                            px: 1,
                            py: 0.75,
                            fontSize: rowIndex === 0 ? 13 : 14,
                            fontWeight: rowIndex === 0 ? 700 : 400,
                            bgcolor: rowIndex === 0 ? activeTheme.tableHeaderBg : "transparent",
                            color: activeTheme.tableText,
                            textAlign: "left"
                          }}
                        >
                          {cell}
                        </Box>
                      ))}
                    </Box>
                  ))}
                </Box>
              </Box>
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function PresentationDeck({ slides, theme }: { slides: Descendant[][]; theme: PresentationTheme }) {
  const activeTheme = PRESENTATION_THEMES[theme];
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex((prev) => Math.min(prev, Math.max(slides.length - 1, 0)));
  }, [slides]);

  const canGoPrev = activeIndex > 0;
  const canGoNext = activeIndex < slides.length - 1;
  const currentSlide = slides[activeIndex] ?? slides[0] ?? [];

  return (
    <Stack spacing={1.25}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Button
          variant="outlined"
          size="small"
          onClick={() => setActiveIndex((prev) => Math.max(prev - 1, 0))}
          disabled={!canGoPrev}
        >
          Prev
        </Button>
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          Slide {slides.length ? activeIndex + 1 : 0} / {slides.length}
        </Typography>
        <Button
          variant="outlined"
          size="small"
          onClick={() => setActiveIndex((prev) => Math.min(prev + 1, Math.max(slides.length - 1, 0)))}
          disabled={!canGoNext}
        >
          Next
        </Button>
      </Stack>
      <Box
        sx={{
          border: "1px solid",
          borderColor: activeTheme.border,
          borderRadius: 2,
          overflow: "hidden",
          minHeight: 420,
          background: activeTheme.deckBg
        }}
      >
        <SlideContent nodes={currentSlide} theme={theme} />
      </Box>
    </Stack>
  );
}

export function PresentPage() {
  const editor = useMemo(() => {
    const base = withReact(createEditor());
    const { isVoid } = base;
    base.isVoid = (element) => {
      if (
        (element as PresentationElement).type === "slide-break" ||
        (element as PresentationElement).type === "image" ||
        (element as PresentationElement).type === "spreadsheet"
      ) {
        return true;
      }
      return isVoid(element);
    };
    return base;
  }, []);

  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const excelInputRef = useRef<HTMLInputElement | null>(null);
  const [value, setValue] = useState<Descendant[]>(INITIAL_VALUE);
  const [theme, setTheme] = useState<PresentationTheme>("light");
  const [selectedImagePath, setSelectedImagePath] = useState<Path | null>(null);
  const [selectedSheetPath, setSelectedSheetPath] = useState<Path | null>(null);
  const slides = useMemo(() => splitToSlides(value), [value]);
  const selectedSheet = useMemo(() => {
    if (!selectedSheetPath) return null;
    try {
      const node = Node.get(editor, selectedSheetPath);
      if (!SlateElement.isElement(node)) return null;
      const el = node as PresentationElement;
      if (el.type !== "spreadsheet") return null;
      return el;
    } catch {
      return null;
    }
  }, [editor, selectedSheetPath]);

  const renderElement = useCallback((props: RenderElementProps) => {
    const element = props.element as PresentationElement;

    if (element.type === "heading") {
      return (
        <Typography component="h2" variant="h6" sx={{ m: 0, fontWeight: 700 }} {...props.attributes}>
          {props.children}
        </Typography>
      );
    }

    if (element.type === "subtitle") {
      return (
        <Typography component="h3" variant="subtitle1" sx={{ m: 0, fontWeight: 600, color: "text.secondary" }} {...props.attributes}>
          {props.children}
        </Typography>
      );
    }

    if (element.type === "slide-break") {
      return (
        <Box
          {...props.attributes}
          contentEditable={false}
          sx={{
            my: 1.5,
            border: "1px dashed",
            borderColor: "primary.main",
            borderRadius: 1,
            px: 1,
            py: 0.5,
            color: "primary.main",
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 0.3,
            textTransform: "uppercase"
          }}
        >
          --- Slide Break ---
          {props.children}
        </Box>
      );
    }

    if (element.type === "image") {
      let isSelected = false;
      try {
        const currentPath = ReactEditor.findPath(editor, props.element);
        isSelected = !!selectedImagePath && Path.equals(selectedImagePath, currentPath);
      } catch {
        isSelected = false;
      }

      return (
        <Box
          {...props.attributes}
          contentEditable={false}
          onMouseDown={(event) => {
            event.preventDefault();
            const path = ReactEditor.findPath(editor, props.element);
            setSelectedImagePath(path);
            Transforms.select(editor, path);
            ReactEditor.focus(editor);
          }}
          sx={{
            my: 1,
            p: 1,
            border: "1px solid",
            borderColor: isSelected ? "primary.main" : "divider",
            borderRadius: 2,
            backgroundColor: "background.paper"
          }}
        >
          <Box
            component="img"
            src={element.url}
            alt={element.alt ?? "Slide image"}
            sx={{
              display: "block",
              maxWidth: "100%",
              maxHeight: 260,
              width: `${Math.max(20, Math.min(100, element.width ?? 70))}%`,
              objectFit: "contain",
              borderRadius: 1
            }}
          />
          {props.children}
        </Box>
      );
    }

    if (element.type === "spreadsheet") {
      let isSelected = false;
      try {
        const currentPath = ReactEditor.findPath(editor, props.element);
        isSelected = !!selectedSheetPath && Path.equals(selectedSheetPath, currentPath);
      } catch {
        isSelected = false;
      }

      return (
        <Box
          {...props.attributes}
          contentEditable={false}
          onMouseDown={(event) => {
            event.preventDefault();
            const path = ReactEditor.findPath(editor, props.element);
            setSelectedSheetPath(path);
            setSelectedImagePath(null);
            Transforms.select(editor, path);
            ReactEditor.focus(editor);
          }}
          sx={{
            my: 1,
            p: 1.25,
            border: "1px solid",
            borderColor: isSelected ? "primary.main" : "divider",
            borderRadius: 2,
            backgroundColor: "background.paper"
          }}
        >
          <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 0.75 }}>
            Excel: {element.name}
          </Typography>
          <Box sx={{ overflowX: "auto" }}>
            <Box component="table" sx={{ width: "100%", borderCollapse: "collapse", minWidth: 280 }}>
              <Box component="tbody">
                {element.rows.slice(0, 6).map((row, rowIndex) => (
                  <Box component="tr" key={`sheet-row-${rowIndex}`}>
                    {row.slice(0, 8).map((cell, colIndex) => (
                      <Box
                        component={rowIndex === 0 ? "th" : "td"}
                        key={`sheet-cell-${rowIndex}-${colIndex}`}
                        sx={{
                          border: "1px solid",
                          borderColor: "divider",
                          px: 0.75,
                          py: 0.5,
                          fontSize: 12,
                          fontWeight: rowIndex === 0 ? 700 : 400,
                          bgcolor: rowIndex === 0 ? "grey.100" : "transparent",
                          textAlign: "left"
                        }}
                      >
                        {cell}
                      </Box>
                    ))}
                  </Box>
                ))}
              </Box>
            </Box>
          </Box>
          {props.children}
        </Box>
      );
    }

    return (
      <Typography component="p" variant="body1" sx={{ my: 0.5 }} {...props.attributes}>
        {props.children}
      </Typography>
    );
  }, [editor, selectedImagePath, selectedSheetPath]);

  const insertSlideBreak = () => {
    if (!editor.selection) {
      const end = Editor.end(editor, []);
      Transforms.select(editor, end);
    }
    ReactEditor.focus(editor);

    Transforms.insertNodes(editor, {
      type: "slide-break",
      children: [{ text: "" }]
    } as PresentationElement);

    Transforms.insertNodes(editor, {
      type: "heading",
      children: [{ text: "New Slide" }]
    } as PresentationElement);

    Transforms.insertNodes(editor, {
      type: "paragraph",
      children: [{ text: "Describe this slide" }]
    } as PresentationElement);
  };

  const insertHeading = () => {
    if (!editor.selection) {
      const end = Editor.end(editor, []);
      Transforms.select(editor, end);
    }
    ReactEditor.focus(editor);

    Transforms.insertNodes(editor, {
      type: "heading",
      children: [{ text: "Slide Title" }]
    } as PresentationElement);
  };

  const insertSubtitle = () => {
    if (!editor.selection) {
      const end = Editor.end(editor, []);
      Transforms.select(editor, end);
    }
    ReactEditor.focus(editor);

    Transforms.insertNodes(editor, {
      type: "subtitle",
      children: [{ text: "Slide Subtitle" }]
    } as PresentationElement);
  };

  const insertTextBlock = () => {
    if (!editor.selection) {
      const end = Editor.end(editor, []);
      Transforms.select(editor, end);
    }
    ReactEditor.focus(editor);

    Transforms.insertNodes(editor, {
      type: "paragraph",
      children: [{ text: "Text block" }]
    } as PresentationElement);
  };

  const insertImage = (url: string, alt: string) => {
    if (!editor.selection) {
      const end = Editor.end(editor, []);
      Transforms.select(editor, end);
    }
    ReactEditor.focus(editor);

    Transforms.insertNodes(editor, {
      type: "image",
      url,
      alt,
      width: 70,
      children: [{ text: "" }]
    } as PresentationElement);
  };

  const insertSpreadsheet = (name: string, rows: string[][]) => {
    if (!editor.selection) {
      const end = Editor.end(editor, []);
      Transforms.select(editor, end);
    }
    ReactEditor.focus(editor);

    const normalizedRows = rows.length
      ? rows.map((row) => row.map((cell) => String(cell ?? "")))
      : [["Column 1", "Column 2"], ["", ""]];
    Transforms.insertNodes(editor, {
      type: "spreadsheet",
      name,
      rows: normalizedRows,
      children: [{ text: "" }]
    } as PresentationElement);
  };

  const insertSpreadsheetSlide = (name: string, rows: string[][], withSlideBreak: boolean) => {
    if (!editor.selection) {
      const end = Editor.end(editor, []);
      Transforms.select(editor, end);
    }
    ReactEditor.focus(editor);

    const normalizedRows = rows.length
      ? rows.map((row) => row.map((cell) => String(cell ?? "")))
      : [["Column 1", "Column 2"], ["", ""]];

    const nodes: PresentationElement[] = [];
    if (withSlideBreak) {
      nodes.push({
        type: "slide-break",
        children: [{ text: "" }]
      });
    }
    nodes.push(
      {
        type: "heading",
        children: [{ text: name || "Sheet" }]
      },
      {
        type: "subtitle",
        children: [{ text: "Excel sheet" }]
      },
      {
        type: "spreadsheet",
        name: name || "Sheet",
        rows: normalizedRows,
        children: [{ text: "" }]
      }
    );

    Transforms.insertNodes(editor, nodes as Descendant[]);
  };

  const handleImagePick = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") return;
      insertImage(result, file.name);
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const openImagePicker = () => {
    setSelectedSheetPath(null);
    imageInputRef.current?.click();
  };

  const openExcelPicker = () => {
    setSelectedImagePath(null);
    excelInputRef.current?.click();
  };

  const updateSelectedSheetRows = (rows: string[][]) => {
    if (!selectedSheetPath) return;
    Transforms.setNodes(
      editor,
      {
        rows
      } as Partial<PresentationElement>,
      { at: selectedSheetPath }
    );
  };

  const setCellValue = (rowIndex: number, colIndex: number, nextValue: string) => {
    if (!selectedSheet) return;
    const nextRows = selectedSheet.rows.map((row) => [...row]);
    if (!nextRows[rowIndex]) return;
    nextRows[rowIndex][colIndex] = nextValue;
    updateSelectedSheetRows(nextRows);
  };

  const addSheetRow = () => {
    if (!selectedSheet) return;
    const width = selectedSheet.rows[0]?.length ?? 2;
    const nextRows = [...selectedSheet.rows, Array.from({ length: width }, () => "")];
    updateSelectedSheetRows(nextRows);
  };

  const addSheetColumn = () => {
    if (!selectedSheet) return;
    const nextRows = selectedSheet.rows.map((row, index) => [
      ...row,
      index === 0 ? `Column ${row.length + 1}` : ""
    ]);
    updateSelectedSheetRows(nextRows);
  };

  const removeSheetRow = () => {
    if (!selectedSheet || selectedSheet.rows.length <= 1) return;
    updateSelectedSheetRows(selectedSheet.rows.slice(0, -1));
  };

  const removeSheetColumn = () => {
    if (!selectedSheet) return;
    const currentWidth = selectedSheet.rows[0]?.length ?? 0;
    if (currentWidth <= 1) return;
    updateSelectedSheetRows(selectedSheet.rows.map((row) => row.slice(0, -1)));
  };

  const printPresentation = () => {
    const html = buildPrintHtml(slides, theme);
    const frame = document.createElement("iframe");
    frame.style.position = "fixed";
    frame.style.right = "0";
    frame.style.bottom = "0";
    frame.style.width = "0";
    frame.style.height = "0";
    frame.style.border = "0";
    frame.setAttribute("aria-hidden", "true");
    document.body.appendChild(frame);

    const frameDoc = frame.contentDocument;
    const frameWindow = frame.contentWindow;

    if (!frameDoc || !frameWindow) {
      frame.remove();
      return;
    }

    frameDoc.open();
    frameDoc.write(html);
    frameDoc.close();

    const images = Array.from(frameDoc.images);
    const waitForImages = Promise.all(
      images.map(
        (image) =>
          new Promise<void>((resolve) => {
            if (image.complete) {
              resolve();
              return;
            }
            image.onload = () => resolve();
            image.onerror = () => resolve();
          })
      )
    );

    void waitForImages.then(() => {
      setTimeout(() => {
        frameWindow.focus();
        frameWindow.print();
        frame.remove();
      }, 120);
    });
  };

  const handleExcelPick = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const isCsv = file.name.toLowerCase().endsWith(".csv");
      if (isCsv) {
        const text = await file.text();
        const rows = text
          .split(/\r?\n/)
          .filter((line) => line.length > 0)
          .map((line) => line.split(","));
        insertSpreadsheet(file.name, rows);
        return;
      }

      const xlsx = await import("xlsx");
      const arrayBuffer = await file.arrayBuffer();
      const workbook = xlsx.read(arrayBuffer, { type: "array" });
      const sheetNames = workbook.SheetNames;
      if (!sheetNames.length) {
        insertSpreadsheet(file.name, [["Sheet is empty"]]);
        return;
      }

      sheetNames.forEach((sheetName, index) => {
        const sheet = workbook.Sheets[sheetName];
        const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, raw: false }) as unknown[][];
        const normalized = rows.map((row) => row.map((cell) => String(cell ?? "")));
        insertSpreadsheetSlide(sheetName, normalized, index > 0);
      });
    } catch {
      insertSpreadsheet(file.name, [["Cannot parse file"], ["Try CSV or a simple XLSX sheet"]]);
    } finally {
      event.target.value = "";
    }
  };

  return (
    <Container maxWidth={false} sx={{ py: 3 }}>
      <Stack spacing={2.5}>
        <Paper
          variant="outlined"
          sx={{
            p: 2.5,
            borderRadius: 3,
            "@media print": {
              display: "none"
            }
          }}
        >
          <Stack direction={{ xs: "column", md: "row" }} alignItems={{ xs: "flex-start", md: "center" }} spacing={1}>
            <Typography variant="h5" fontWeight={700}>
              Presentation Builder
            </Typography>
            <Chip size="small" color="primary" label="Next.js" />
            <Chip size="small" color="primary" variant="outlined" label="Slate.js editor" />
            <Chip size="small" color="primary" variant="outlined" label="Slides layout" />
            <Chip size="small" color="primary" variant="outlined" label="Reveal renderer" />
          </Stack>
          <Stack direction="row" spacing={1} sx={{ mt: 1.25 }}>
            {(Object.keys(PRESENTATION_THEMES) as PresentationTheme[]).map((themeKey) => (
              <Button
                key={themeKey}
                size="small"
                variant={theme === themeKey ? "contained" : "outlined"}
                onClick={() => setTheme(themeKey)}
              >
                {PRESENTATION_THEMES[themeKey].label}
              </Button>
            ))}
          </Stack>
          <Typography sx={{ mt: 1, color: "text.secondary" }}>
            Use &quot;Add Slide&quot; or insert a separator &quot;---&quot; (Slide Break) to split content into slides.
          </Typography>
        </Paper>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", lg: "1fr 1.2fr" },
            gap: 2
          }}
        >
          <Paper
            variant="outlined"
            sx={{
              p: 2,
              borderRadius: 3,
              minHeight: 560,
              display: "flex",
              flexDirection: "column",
              maxHeight: { xs: "none", lg: "calc(100vh - 140px)" },
              overflow: "hidden",
              "@media print": {
                display: "none"
              }
            }}
          >
            <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
              <Button variant="contained" size="small" onClick={insertSlideBreak}>
                Add Slide
              </Button>
              <Button variant="outlined" size="small" onClick={insertHeading}>
                Add Title
              </Button>
              <Button variant="outlined" size="small" onClick={insertSubtitle}>
                Add Subtitle
              </Button>
              <Button variant="outlined" size="small" onClick={insertTextBlock}>
                Add Text
              </Button>
              <Button variant="outlined" size="small" onClick={openImagePicker}>
                Add Image
              </Button>
              <Button variant="outlined" size="small" onClick={openExcelPicker}>
                Add Excel
              </Button>
            </Stack>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={handleImagePick}
            />
            <input
              ref={excelInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              style={{ display: "none" }}
              onChange={(event) => {
                void handleExcelPick(event);
              }}
            />
            {selectedSheet && (
              <Paper variant="outlined" sx={{ p: 1.25, mb: 1.5, borderRadius: 2 }}>
                <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                  <Button variant="outlined" size="small" onClick={addSheetRow}>
                    Row +
                  </Button>
                  <Button variant="outlined" size="small" onClick={removeSheetRow}>
                    Row -
                  </Button>
                  <Button variant="outlined" size="small" onClick={addSheetColumn}>
                    Col +
                  </Button>
                  <Button variant="outlined" size="small" onClick={removeSheetColumn}>
                    Col -
                  </Button>
                </Stack>
                <Box sx={{ overflowX: "auto" }}>
                  <Box sx={{ display: "grid", gap: 0.75, minWidth: 520 }}>
                    {selectedSheet.rows.map((row, rowIndex) => (
                      <Box
                        key={`edit-row-${rowIndex}`}
                        sx={{ display: "grid", gridTemplateColumns: `repeat(${row.length || 1}, minmax(120px, 1fr))`, gap: 0.75 }}
                      >
                        {row.map((cell, colIndex) => (
                          <TextField
                            key={`edit-cell-${rowIndex}-${colIndex}`}
                            size="small"
                            value={cell}
                            onChange={(e) => setCellValue(rowIndex, colIndex, e.target.value)}
                          />
                        ))}
                      </Box>
                    ))}
                  </Box>
                </Box>
              </Paper>
            )}
            <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", pr: 0.5 }}>
              <Divider sx={{ mb: 1.5 }} />
              <Slate editor={editor} initialValue={value} onChange={setValue}>
                <Editable
                  renderElement={renderElement}
                  spellCheck
                  autoFocus
                  placeholder="Type slide content..."
                  onKeyDown={(event) => {
                    if (!(event.ctrlKey || event.metaKey)) return;
                    if (event.key.toLowerCase() === "-") {
                      event.preventDefault();
                      insertSlideBreak();
                    }
                    if (event.key.toLowerCase() === "h") {
                      event.preventDefault();
                      insertHeading();
                    }
                    if (event.key.toLowerCase() === "s") {
                      event.preventDefault();
                      insertSubtitle();
                    }
                    if (event.key.toLowerCase() === "t") {
                      event.preventDefault();
                      insertTextBlock();
                    }
                    if (event.key.toLowerCase() === "i") {
                      event.preventDefault();
                      openImagePicker();
                    }
                  }}
                  style={{ minHeight: 480, outline: "none" }}
                />
              </Slate>
            </Box>
          </Paper>

          <Stack spacing={2}>
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                borderRadius: 3,
                "@media print": {
                  display: "none"
                }
              }}
            >
              <Typography variant="h6" fontWeight={700} sx={{ mb: 1.25 }}>
                Slides Layout ({slides.length})
              </Typography>
              <Stack spacing={1.25} sx={{ maxHeight: 280, overflowY: "auto", pr: 0.5 }}>
                {slides.map((slide, index) => (
                  <Paper key={`layout-slide-${index}`} variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                    <Typography variant="caption" sx={{ color: "text.secondary", mb: 0.5, display: "block" }}>
                      Slide {index + 1}
                    </Typography>
                    <SlideContent nodes={slide} theme={theme} />
                  </Paper>
                ))}
              </Stack>
            </Paper>

            <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.25 }}>
                <Typography variant="h6" fontWeight={700}>
                  Presentation Viewer
                </Typography>
                <Button
                  variant="contained"
                  size="small"
                  onClick={printPresentation}
                  sx={{
                    "@media print": {
                      display: "none"
                    }
                  }}
                >
                  Print
                </Button>
              </Stack>
              <PresentationDeck slides={slides} theme={theme} />
            </Paper>
          </Stack>
        </Box>
      </Stack>
    </Container>
  );
}
