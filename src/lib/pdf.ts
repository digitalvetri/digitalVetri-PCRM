import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb, type RGB } from "pdf-lib";
import { BRAND } from "@/lib/constants";

export const PDF_COLORS = {
  primary: rgb(48 / 255, 71 / 255, 202 / 255), // #3047CA — brand indigo
  dark: rgb(0.1, 0.12, 0.16),
  gray: rgb(0.45, 0.48, 0.53),
  light: rgb(0.94, 0.96, 0.99),
  white: rgb(1, 1, 1),
};

const PAGE = { width: 595.28, height: 841.89 }; // A4
const MARGIN = 50;

export interface PdfBuilder {
  doc: PDFDocument;
  page: PDFPage;
  y: number;
  font: PDFFont;
  bold: PDFFont;
  newPage(): void;
  ensureSpace(needed: number): void;
  heading(text: string, size?: number): void;
  subheading(text: string): void;
  paragraph(text: string, opts?: { size?: number; color?: RGB; bold?: boolean }): void;
  bullet(text: string): void;
  keyValue(key: string, value: string): void;
  divider(): void;
  spacer(h?: number): void;
  table(headers: string[], rows: string[][], colWidths?: number[]): void;
}

export async function createPdfBuilder(): Promise<PdfBuilder> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const builder: PdfBuilder = {
    doc,
    page: doc.addPage([PAGE.width, PAGE.height]),
    y: PAGE.height - MARGIN,
    font,
    bold,

    newPage() {
      builder.page = doc.addPage([PAGE.width, PAGE.height]);
      builder.y = PAGE.height - MARGIN;
    },

    ensureSpace(needed: number) {
      if (builder.y - needed < MARGIN + 30) builder.newPage();
    },

    heading(text: string, size = 18) {
      builder.ensureSpace(size + 16);
      builder.page.drawText(text, {
        x: MARGIN,
        y: builder.y - size,
        size,
        font: bold,
        color: PDF_COLORS.primary,
      });
      builder.y -= size + 14;
    },

    subheading(text: string) {
      builder.ensureSpace(30);
      builder.page.drawText(text, {
        x: MARGIN,
        y: builder.y - 13,
        size: 13,
        font: bold,
        color: PDF_COLORS.dark,
      });
      builder.y -= 24;
    },

    paragraph(text: string, opts = {}) {
      const size = opts.size ?? 10.5;
      const usedFont = opts.bold ? bold : font;
      const lines = wrapText(text, usedFont, size, PAGE.width - MARGIN * 2);
      for (const line of lines) {
        builder.ensureSpace(size + 5);
        builder.page.drawText(line, {
          x: MARGIN,
          y: builder.y - size,
          size,
          font: usedFont,
          color: opts.color ?? PDF_COLORS.dark,
        });
        builder.y -= size + 5;
      }
      builder.y -= 4;
    },

    bullet(text: string) {
      const size = 10.5;
      const lines = wrapText(text, font, size, PAGE.width - MARGIN * 2 - 16);
      lines.forEach((line, i) => {
        builder.ensureSpace(size + 5);
        if (i === 0) {
          builder.page.drawCircle({
            x: MARGIN + 4,
            y: builder.y - size + 3.5,
            size: 2,
            color: PDF_COLORS.primary,
          });
        }
        builder.page.drawText(line, {
          x: MARGIN + 16,
          y: builder.y - size,
          size,
          font,
          color: PDF_COLORS.dark,
        });
        builder.y -= size + 5;
      });
      builder.y -= 2;
    },

    keyValue(key: string, value: string) {
      builder.ensureSpace(18);
      builder.page.drawText(key, {
        x: MARGIN,
        y: builder.y - 10.5,
        size: 10.5,
        font: bold,
        color: PDF_COLORS.gray,
      });
      const lines = wrapText(value, font, 10.5, PAGE.width - MARGIN * 2 - 170);
      lines.forEach((line, i) => {
        if (i > 0) builder.ensureSpace(16);
        builder.page.drawText(line, {
          x: MARGIN + 170,
          y: builder.y - 10.5,
          size: 10.5,
          font,
          color: PDF_COLORS.dark,
        });
        if (i < lines.length - 1) builder.y -= 15;
      });
      builder.y -= 18;
    },

    divider() {
      builder.ensureSpace(16);
      builder.page.drawLine({
        start: { x: MARGIN, y: builder.y - 6 },
        end: { x: PAGE.width - MARGIN, y: builder.y - 6 },
        thickness: 0.75,
        color: rgb(0.85, 0.88, 0.92),
      });
      builder.y -= 18;
    },

    spacer(h = 10) {
      builder.y -= h;
    },

    table(headers: string[], rows: string[][], colWidths?: number[]) {
      const tableWidth = PAGE.width - MARGIN * 2;
      const widths =
        colWidths ?? headers.map(() => tableWidth / headers.length);
      const rowHeight = 22;

      builder.ensureSpace(rowHeight * 2);
      // header row
      builder.page.drawRectangle({
        x: MARGIN,
        y: builder.y - rowHeight,
        width: tableWidth,
        height: rowHeight,
        color: PDF_COLORS.primary,
      });
      let x = MARGIN;
      headers.forEach((h, i) => {
        builder.page.drawText(truncate(h, bold, 9.5, widths[i] - 12), {
          x: x + 6,
          y: builder.y - rowHeight + 7,
          size: 9.5,
          font: bold,
          color: PDF_COLORS.white,
        });
        x += widths[i];
      });
      builder.y -= rowHeight;

      rows.forEach((row, r) => {
        builder.ensureSpace(rowHeight);
        if (r % 2 === 0) {
          builder.page.drawRectangle({
            x: MARGIN,
            y: builder.y - rowHeight,
            width: tableWidth,
            height: rowHeight,
            color: PDF_COLORS.light,
          });
        }
        let cx = MARGIN;
        row.forEach((cell, i) => {
          builder.page.drawText(truncate(cell ?? "", font, 9.5, widths[i] - 12), {
            x: cx + 6,
            y: builder.y - rowHeight + 7,
            size: 9.5,
            font,
            color: PDF_COLORS.dark,
          });
          cx += widths[i];
        });
        builder.y -= rowHeight;
      });
      builder.y -= 10;
    },
  };

  return builder;
}

/** Standard branded cover page. */
export function drawCoverPage(
  builder: PdfBuilder,
  opts: { title: string; subtitle: string; forCompany?: string; date?: string }
) {
  const { page } = builder;
  page.drawRectangle({ x: 0, y: 0, width: PAGE.width, height: PAGE.height, color: PDF_COLORS.white });
  page.drawRectangle({ x: 0, y: PAGE.height - 220, width: PAGE.width, height: 220, color: PDF_COLORS.primary });
  page.drawText(BRAND.name, {
    x: MARGIN,
    y: PAGE.height - 90,
    size: 30,
    font: builder.bold,
    color: PDF_COLORS.white,
  });
  page.drawText(BRAND.productName, {
    x: MARGIN,
    y: PAGE.height - 115,
    size: 13,
    font: builder.font,
    color: rgb(0.85, 0.91, 1),
  });

  page.drawText(opts.title, {
    x: MARGIN,
    y: PAGE.height - 340,
    size: 26,
    font: builder.bold,
    color: PDF_COLORS.dark,
  });
  page.drawText(opts.subtitle, {
    x: MARGIN,
    y: PAGE.height - 372,
    size: 14,
    font: builder.font,
    color: PDF_COLORS.gray,
  });
  if (opts.forCompany) {
    page.drawText(`Prepared for: ${opts.forCompany}`, {
      x: MARGIN,
      y: PAGE.height - 420,
      size: 12,
      font: builder.bold,
      color: PDF_COLORS.primary,
    });
  }
  page.drawText(opts.date ?? new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" }), {
    x: MARGIN,
    y: PAGE.height - 442,
    size: 11,
    font: builder.font,
    color: PDF_COLORS.gray,
  });
  page.drawText(`${BRAND.website}  |  ${BRAND.email}`, {
    x: MARGIN,
    y: 60,
    size: 10,
    font: builder.font,
    color: PDF_COLORS.gray,
  });
  builder.newPage();
}

export function addPageFooters(builder: PdfBuilder) {
  const pages = builder.doc.getPages();
  pages.forEach((page, i) => {
    if (i === 0) return; // cover page has its own footer
    page.drawText(`${BRAND.name} - Confidential`, {
      x: MARGIN,
      y: 28,
      size: 8,
      font: builder.font,
      color: PDF_COLORS.gray,
    });
    page.drawText(`Page ${i} of ${pages.length - 1}`, {
      x: PAGE.width - MARGIN - 60,
      y: 28,
      size: 8,
      font: builder.font,
      color: PDF_COLORS.gray,
    });
  });
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const sanitized = sanitizePdfText(text);
  const words = sanitized.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function truncate(text: string, font: PDFFont, size: number, maxWidth: number): string {
  let t = sanitizePdfText(text);
  while (t.length > 1 && font.widthOfTextAtSize(t, size) > maxWidth) {
    t = t.slice(0, -2) + "…";
  }
  return t;
}

/** Helvetica (WinAnsi) can't encode ₹ or fancy unicode; swap common cases. */
function sanitizePdfText(text: string): string {
  return text
    .replace(/₹/g, "Rs. ")
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    .replace(/—/g, "-")
    .replace(/…/g, "...")
    // Drop anything else outside WinAnsi rather than crashing the export
    .replace(/[^\x20-\x7E -ÿ]/g, "");
}

export function pdfResponse(bytes: Uint8Array, filename: string): Response {
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
