import { Injectable } from '@nestjs/common'
import PDFDocument from 'pdfkit'
import type { Prescription, PrescriptionItemRow, InvoiceWithDetails } from '@rezeta/shared'

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  teal: '#2D5760',
  tealDark: '#1B3A41',
  n900: '#0E0E0D',
  n800: '#1C1C1A',
  n700: '#2E2E2B',
  n600: '#4A4A46',
  n500: '#6B6B66',
  n400: '#8E8E88',
  n300: '#B9B9B3',
  n200: '#D8D8D2',
  n100: '#EBEBE6',
  n50: '#F4F4F0',
  n25: '#FAFAF7',
  okText: '#2F5C28',
  warnText: '#6E5319',
  errText: '#7A2B22',
}

// ─── Layout constants ─────────────────────────────────────────────────────────
// LETTER: 612 x 792 pt
const PAGE_W = 612
const PAGE_H = 792
const MARGIN = 40
const CONTENT_W = PAGE_W - MARGIN * 2

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
    doc.end()
  })
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const months = [
    'enero',
    'febrero',
    'marzo',
    'abril',
    'mayo',
    'junio',
    'julio',
    'agosto',
    'septiembre',
    'octubre',
    'noviembre',
    'diciembre',
  ]
  return `${d.getDate()} de ${months[d.getMonth()]} de ${d.getFullYear()}`
}

function calcAge(dateOfBirth: string | null): string {
  if (!dateOfBirth) return ''
  const ageDiff = Date.now() - new Date(dateOfBirth).getTime()
  const age = Math.floor(ageDiff / (365.25 * 24 * 60 * 60 * 1000))
  return `${age} años`
}

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return [r, g, b]
}

function fillRect(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
): void {
  doc.save().rect(x, y, w, h).fill(color).restore()
}

function strokeLine(
  doc: PDFKit.PDFDocument,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  width = 1,
): void {
  doc.save().moveTo(x1, y1).lineTo(x2, y2).strokeColor(color).lineWidth(width).stroke().restore()
}

function truncate(text: string, maxChars: number): string {
  return text.length > maxChars ? text.slice(0, maxChars - 1) + '…' : text
}

// ─── PDF data types ───────────────────────────────────────────────────────────
export interface PrescriptionPdfData {
  prescription: Prescription
  doctor: {
    fullName: string | null
    specialty: string | null
    licenseNumber: string | null
  }
  patient: {
    firstName: string
    lastName: string
    dateOfBirth: string | null
    documentNumber: string | null
    documentType: string | null
  }
  location: {
    name: string
    address: string | null
  } | null
}

export interface InvoicePdfData {
  invoice: InvoiceWithDetails
  doctor: {
    fullName: string | null
    specialty: string | null
    licenseNumber: string | null
  }
}

// ─── Prescription PDF ─────────────────────────────────────────────────────────
function buildPrescription(doc: PDFKit.PDFDocument, data: PrescriptionPdfData): void {
  const { prescription, doctor, patient, location } = data
  const items: PrescriptionItemRow[] = prescription.prescriptionItems ?? []
  const doctorName = doctor.fullName ?? 'Médico'
  const patientFullName = `${patient.firstName} ${patient.lastName}`.trim()
  const age = calcAge(patient.dateOfBirth)
  const docId = patient.documentNumber
    ? `${(patient.documentType ?? 'Doc.').toUpperCase()} ${patient.documentNumber}`
    : null
  const issuedDate = formatDate(prescription.createdAt)

  let y = MARGIN

  // ── Header band ──
  // Doctor name (left)
  doc.font('Helvetica-Bold').fontSize(16).fillColor(T.teal)
  doc.text(`Dr. ${doctorName}`, MARGIN, y, { lineBreak: false })
  y += 18

  doc.font('Helvetica').fontSize(9).fillColor(T.n500)
  if (doctor.specialty) {
    doc.text(doctor.specialty, MARGIN, y, { lineBreak: false })
    y += 12
  }
  if (doctor.licenseNumber) {
    doc.text(`Matrícula: ${doctor.licenseNumber}`, MARGIN, y, { lineBreak: false })
    y += 12
  }
  if (location) {
    doc.text(location.name, MARGIN, y, { lineBreak: false })
    y += 12
  }

  // Date (right-aligned)
  doc.text(issuedDate, MARGIN, MARGIN + 2, { width: CONTENT_W, align: 'right', lineBreak: false })
  if (prescription.groupTitle) {
    doc.text(prescription.groupTitle, MARGIN, MARGIN + 14, {
      width: CONTENT_W,
      align: 'right',
      lineBreak: false,
    })
  }

  // Border under header
  y = Math.max(y, MARGIN + 44) + 10
  strokeLine(doc, MARGIN, y, MARGIN + CONTENT_W, y, T.teal, 2)
  y += 14

  // ── Patient block ──
  fillRect(doc, MARGIN, y, CONTENT_W, 48, T.n25)
  // "Rx" label
  doc.font('Helvetica-Bold').fontSize(18).fillColor(T.teal)
  doc.text('Rx', MARGIN + 10, y + 10, { lineBreak: false })
  // Patient name
  doc.font('Helvetica-Bold').fontSize(13).fillColor(T.n900)
  doc.text(patientFullName, MARGIN + 32, y + 12, { lineBreak: false })
  // Patient meta
  const meta = [age, docId].filter(Boolean).join('  ·  ')
  if (meta) {
    doc.font('Helvetica').fontSize(9).fillColor(T.n500)
    doc.text(meta, MARGIN + 10, y + 32, { lineBreak: false })
  }
  y += 62

  // ── Medications section label ──
  doc.font('Helvetica-Bold').fontSize(8).fillColor(T.n500)
  doc.text('MEDICAMENTOS PRESCRITOS', MARGIN, y, { lineBreak: false, characterSpacing: 0.8 })
  y += 14

  // ── Medications table ──
  const colWidths = {
    drug: CONTENT_W * 0.3,
    dose: CONTENT_W * 0.17,
    route: CONTENT_W * 0.13,
    freq: CONTENT_W * 0.23,
    dur: CONTENT_W * 0.17,
  }
  const colX = {
    drug: MARGIN,
    dose: MARGIN + colWidths.drug,
    route: MARGIN + colWidths.drug + colWidths.dose,
    freq: MARGIN + colWidths.drug + colWidths.dose + colWidths.route,
    dur: MARGIN + colWidths.drug + colWidths.dose + colWidths.route + colWidths.freq,
  }
  const ROW_H = 28
  const HEADER_H = 22

  // Table border
  doc
    .save()
    .rect(MARGIN, y, CONTENT_W, HEADER_H + ROW_H * items.length)
    .stroke(T.n200)
    .restore()

  // Header row
  fillRect(doc, MARGIN, y, CONTENT_W, HEADER_H, T.n50)
  doc.font('Helvetica-Bold').fontSize(8).fillColor(T.n600)
  doc.text('MEDICAMENTO', colX.drug + 8, y + 7, { lineBreak: false, characterSpacing: 0.5 })
  doc.text('DOSIS', colX.dose + 4, y + 7, { lineBreak: false, characterSpacing: 0.5 })
  doc.text('VÍA', colX.route + 4, y + 7, { lineBreak: false, characterSpacing: 0.5 })
  doc.text('FRECUENCIA', colX.freq + 4, y + 7, { lineBreak: false, characterSpacing: 0.5 })
  doc.text('DURACIÓN', colX.dur + 4, y + 7, { lineBreak: false, characterSpacing: 0.5 })
  y += HEADER_H

  // Data rows
  items.forEach((item, idx) => {
    const rowBg = idx % 2 === 0 ? '#FFFFFF' : T.n25
    fillRect(doc, MARGIN, y, CONTENT_W, ROW_H, rowBg)
    if (idx > 0) strokeLine(doc, MARGIN, y, MARGIN + CONTENT_W, y, T.n100)

    doc.font('Helvetica-Bold').fontSize(10).fillColor(T.n700)
    doc.text(truncate(item.drug, 22), colX.drug + 8, y + 5, { lineBreak: false })
    if (item.notes) {
      doc.font('Helvetica').fontSize(9).fillColor(T.n500)
      doc.text(truncate(item.notes, 24), colX.drug + 8, y + 16, { lineBreak: false })
    }

    doc.font('Helvetica').fontSize(10).fillColor(T.n700)
    doc.text(truncate(item.dose, 14), colX.dose + 4, y + 9, { lineBreak: false })
    doc.text(truncate(item.route, 10), colX.route + 4, y + 9, { lineBreak: false })
    doc.text(truncate(item.frequency, 18), colX.freq + 4, y + 9, { lineBreak: false })
    doc.text(truncate(item.duration, 12), colX.dur + 4, y + 9, { lineBreak: false })
    y += ROW_H
  })

  // ── Notes ──
  if (prescription.notes) {
    y += 14
    doc.font('Helvetica-Bold').fontSize(8).fillColor(T.n500)
    doc.text('INDICACIONES ADICIONALES', MARGIN, y, { lineBreak: false, characterSpacing: 0.8 })
    y += 12
    doc.font('Helvetica').fontSize(10).fillColor(T.n700)
    doc.text(prescription.notes, MARGIN, y, { width: CONTENT_W, lineGap: 3 })
    y = doc.y + 4
  }

  // ── Footer / signature ──
  const footerY = PAGE_H - MARGIN - 30
  strokeLine(doc, MARGIN, footerY, MARGIN + CONTENT_W, footerY, T.n100)

  doc.font('Helvetica').fontSize(8).fillColor(T.n400)
  doc.text('Válida para uso médico exclusivamente.', MARGIN, footerY + 8, { lineBreak: false })

  // Signature block (right)
  const sigX = MARGIN + CONTENT_W - 160
  strokeLine(doc, sigX, footerY + 4, sigX + 160, footerY + 4, T.n400)
  doc.font('Helvetica').fontSize(9).fillColor(T.n500)
  doc.text(`Dr. ${doctorName}`, sigX, footerY + 10, {
    width: 160,
    align: 'center',
    lineBreak: false,
  })
  if (doctor.licenseNumber) {
    doc.text(`Mat. ${doctor.licenseNumber}`, sigX, footerY + 20, {
      width: 160,
      align: 'center',
      lineBreak: false,
    })
  }
}

// ─── Invoice PDF ──────────────────────────────────────────────────────────────
function statusColor(status: string): { bg: string; text: string } {
  switch (status) {
    case 'paid':
      return { bg: '#EDF3EC', text: T.okText }
    case 'issued':
      return { bg: '#EAF0F1', text: T.teal }
    case 'cancelled':
      return { bg: '#F6EAE8', text: T.errText }
    default:
      return { bg: T.n50, text: T.n600 }
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case 'draft':
      return 'BORRADOR'
    case 'issued':
      return 'EMITIDA'
    case 'paid':
      return 'PAGADA'
    case 'cancelled':
      return 'CANCELADA'
    default:
      return status.toUpperCase()
  }
}

function formatCurrency(amount: number, currency: string): string {
  const sym = currency === 'USD' ? 'US$' : 'RD$'
  return `${sym} ${amount.toLocaleString('es-DO', { minimumFractionDigits: 2 })}`
}

function buildInvoice(doc: PDFKit.PDFDocument, data: InvoicePdfData): void {
  const { invoice, doctor } = data
  const doctorName = doctor.fullName ?? 'Médico'
  const { bg, text: textColor } = statusColor(invoice.status)

  let y = MARGIN

  // ── Header band ──
  doc.font('Helvetica-Bold').fontSize(16).fillColor(T.teal)
  doc.text(`Dr. ${doctorName}`, MARGIN, y, { lineBreak: false })
  y += 18

  doc.font('Helvetica').fontSize(9).fillColor(T.n500)
  if (doctor.specialty) {
    doc.text(doctor.specialty, MARGIN, y, { lineBreak: false })
    y += 12
  }
  if (doctor.licenseNumber) {
    doc.text(`Matrícula: ${doctor.licenseNumber}`, MARGIN, y, { lineBreak: false })
    y += 12
  }
  doc.text(invoice.locationName, MARGIN, y, { lineBreak: false })
  y += 12

  // Right side: status badge + invoice number + date
  const rightX = MARGIN + CONTENT_W - 160
  const badgeLabel = statusLabel(invoice.status)
  const [br, bg2, bb] = hexToRgb(bg)
  doc.save().rect(rightX, MARGIN, 160, 16).fill([br, bg2, bb]).restore()
  doc.font('Helvetica-Bold').fontSize(9).fillColor(textColor)
  doc.text(badgeLabel, rightX, MARGIN + 4, {
    width: 160,
    align: 'center',
    lineBreak: false,
    characterSpacing: 0.5,
  })

  doc.font('Helvetica-Bold').fontSize(14).fillColor(T.n800)
  doc.text(`Factura ${invoice.invoiceNumber}`, rightX, MARGIN + 22, {
    width: 160,
    align: 'right',
    lineBreak: false,
  })

  doc.font('Helvetica').fontSize(9).fillColor(T.n500)
  doc.text(formatDate(invoice.issuedAt ?? invoice.createdAt), rightX, MARGIN + 38, {
    width: 160,
    align: 'right',
    lineBreak: false,
  })

  y = Math.max(y, MARGIN + 54) + 6
  strokeLine(doc, MARGIN, y, MARGIN + CONTENT_W, y, T.teal, 2)
  y += 14

  // ── Patient block ──
  fillRect(doc, MARGIN, y, CONTENT_W, 36, T.n25)
  doc.font('Helvetica-Bold').fontSize(8).fillColor(T.n500)
  doc.text('PACIENTE', MARGIN + 10, y + 6, { lineBreak: false, characterSpacing: 0.8 })
  doc.font('Helvetica-Bold').fontSize(13).fillColor(T.n900)
  doc.text(invoice.patientName, MARGIN + 10, y + 18, { lineBreak: false })
  y += 50

  // ── Items table ──
  doc.font('Helvetica-Bold').fontSize(8).fillColor(T.n500)
  doc.text('DETALLE DE SERVICIOS', MARGIN, y, { lineBreak: false, characterSpacing: 0.8 })
  y += 14

  const col = {
    desc: CONTENT_W * 0.5,
    qty: CONTENT_W * 0.1,
    unit: CONTENT_W * 0.2,
    total: CONTENT_W * 0.2,
  }
  const colX2 = {
    desc: MARGIN,
    qty: MARGIN + col.desc,
    unit: MARGIN + col.desc + col.qty,
    total: MARGIN + col.desc + col.qty + col.unit,
  }
  const ROW_H = 24
  const HEADER_H = 22

  doc
    .save()
    .rect(MARGIN, y, CONTENT_W, HEADER_H + ROW_H * invoice.items.length)
    .stroke(T.n200)
    .restore()

  fillRect(doc, MARGIN, y, CONTENT_W, HEADER_H, T.n50)
  doc.font('Helvetica-Bold').fontSize(8).fillColor(T.n600)
  doc.text('DESCRIPCIÓN', colX2.desc + 8, y + 7, { lineBreak: false, characterSpacing: 0.5 })
  doc.text('CANT.', colX2.qty + 4, y + 7, { lineBreak: false, characterSpacing: 0.5 })
  doc.text('P. UNIT.', colX2.unit + 4, y + 7, { lineBreak: false, characterSpacing: 0.5 })
  doc.text('TOTAL', colX2.total + 4, y + 7, { lineBreak: false, characterSpacing: 0.5 })
  y += HEADER_H

  invoice.items.forEach((item, idx) => {
    const rowBg = idx % 2 === 0 ? '#FFFFFF' : T.n25
    fillRect(doc, MARGIN, y, CONTENT_W, ROW_H, rowBg)
    if (idx > 0) strokeLine(doc, MARGIN, y, MARGIN + CONTENT_W, y, T.n100)

    doc.font('Helvetica').fontSize(10).fillColor(T.n700)
    doc.text(truncate(item.description, 38), colX2.desc + 8, y + 7, { lineBreak: false })
    doc.text(String(item.quantity), colX2.qty + 4, y + 7, { lineBreak: false })
    doc.text(formatCurrency(item.unitPrice, invoice.currency), colX2.unit + 4, y + 7, {
      lineBreak: false,
    })
    doc.text(formatCurrency(item.total, invoice.currency), colX2.total + 4, y + 7, {
      lineBreak: false,
    })
    y += ROW_H
  })

  // ── Totals block ──
  y += 12
  const totX = MARGIN + CONTENT_W - 220
  const totW = 220

  const totRow = (label: string, value: string, color = T.n800, bold = false): void => {
    doc
      .font(bold ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(bold ? 12 : 10)
      .fillColor(T.n600)
    doc.text(label, totX, y, { lineBreak: false })
    doc
      .font(bold ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(bold ? 12 : 10)
      .fillColor(color)
    doc.text(value, totX, y, { width: totW, align: 'right', lineBreak: false })
    y += bold ? 20 : 16
  }

  totRow('Subtotal', formatCurrency(invoice.subtotal, invoice.currency))
  if (invoice.tax > 0) totRow('ITBIS (18%)', formatCurrency(invoice.tax, invoice.currency))
  if (invoice.commissionAmount > 0) {
    totRow(
      `Comisión centro (${invoice.commissionPercent}%)`,
      `− ${formatCurrency(invoice.commissionAmount, invoice.currency)}`,
      T.errText,
    )
  }
  strokeLine(doc, totX, y, totX + totW, y, T.n300)
  y += 6
  totRow('Total', formatCurrency(invoice.total, invoice.currency), T.teal, true)
  if (invoice.netToDoctor !== invoice.total) {
    doc.font('Helvetica').fontSize(9).fillColor(T.n600)
    doc.text('Neto al médico', totX, y, { lineBreak: false })
    doc.font('Helvetica').fontSize(9).fillColor(T.okText)
    doc.text(formatCurrency(invoice.netToDoctor, invoice.currency), totX, y, {
      width: totW,
      align: 'right',
      lineBreak: false,
    })
    y += 14
  }

  // ── Payment method ──
  if (invoice.paymentMethod) {
    y += 8
    doc.font('Helvetica').fontSize(8).fillColor(T.n400)
    doc.text(`Método de pago: ${invoice.paymentMethod}`, MARGIN, y, { lineBreak: false })
  }

  // ── Footer ──
  const footerY = PAGE_H - MARGIN - 30
  strokeLine(doc, MARGIN, footerY, MARGIN + CONTENT_W, footerY, T.n100)

  doc.font('Helvetica').fontSize(8).fillColor(T.n400)
  doc.text('Documento generado electrónicamente · Rezeta Medical ERP', MARGIN, footerY + 8, {
    lineBreak: false,
  })

  const sigX = MARGIN + CONTENT_W - 160
  strokeLine(doc, sigX, footerY + 4, sigX + 160, footerY + 4, T.n400)
  doc.font('Helvetica').fontSize(9).fillColor(T.n500)
  doc.text(`Dr. ${doctorName}`, sigX, footerY + 10, {
    width: 160,
    align: 'center',
    lineBreak: false,
  })
}

// ─── Service ──────────────────────────────────────────────────────────────────
@Injectable()
export class PdfService {
  async generatePrescription(data: PrescriptionPdfData): Promise<Buffer> {
    const doc = new PDFDocument({
      size: 'LETTER',
      margin: 0,
      info: { Title: `Receta — ${data.patient.firstName} ${data.patient.lastName}` },
    })
    buildPrescription(doc, data)
    return toBuffer(doc)
  }

  async generateInvoice(data: InvoicePdfData): Promise<Buffer> {
    const doc = new PDFDocument({
      size: 'LETTER',
      margin: 0,
      info: { Title: `Factura ${data.invoice.invoiceNumber}` },
    })
    buildInvoice(doc, data)
    return toBuffer(doc)
  }
}
