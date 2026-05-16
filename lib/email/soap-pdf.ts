import PDFDocument from "pdfkit";
import type { SoapNoteRecord } from "@/lib/types";

export async function buildSoapNotePdf(note: SoapNoteRecord): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "LETTER" });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(18).text("SOAP Note", { align: "center" });
    doc.moveDown(0.5);

    if (note.encounterDate) {
      doc
        .fontSize(10)
        .fillColor("#444444")
        .text(`Visit date: ${formatDisplayDate(note.encounterDate)}`, {
          align: "center",
        });
      doc.moveDown();
    }

    doc.fillColor("#000000");
    writeSection(doc, "Subjective", note.subjective);
    writeSection(doc, "Objective", note.objective);
    writeSection(doc, "Assessment", note.assessment);
    writeSection(doc, "Plan", note.plan);

    doc.end();
  });
}

export function soapNotePdfFilename(note: SoapNoteRecord): string {
  const datePart = note.encounterDate
    ? formatDisplayDate(note.encounterDate).replace(/\//g, "-")
    : note.id;
  return `soap-note-${datePart}.pdf`;
}

function writeSection(
  doc: InstanceType<typeof PDFDocument>,
  title: string,
  body: string | null
): void {
  doc.moveDown(0.5);
  doc.fontSize(12).font("Helvetica-Bold").text(title);
  doc.fontSize(10).font("Helvetica").text(body?.trim() || "—", {
    align: "left",
  });
}

function formatDisplayDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: process.env.APP_TIMEZONE ?? "America/New_York",
  });
}
