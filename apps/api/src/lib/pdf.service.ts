/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable } from '@nestjs/common'
import React from 'react'
import { Document, Page, Text, View, StyleSheet, renderToBuffer, Font } from '@react-pdf/renderer'
import type { Style } from '@react-pdf/types'
import type { Prescription, PrescriptionItemRow, InvoiceWithDetails } from '@rezeta/shared'

// ─── Fonts ────────────────────────────────────────────────────────────────────
// Register system fonts as fallback (react-pdf bundles Helvetica by default)
// In production, embed custom fonts via GCS URLs.
Font.registerHyphenationCallback((word) => [word])

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

// ─── Shared styles ────────────────────────────────────────────────────────────
const base = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: T.n700,
    backgroundColor: '#FFFFFF',
    padding: 40,
  },
  // Header band
  headerBand: {
    borderBottomWidth: 2,
    borderBottomColor: T.teal,
    paddingBottom: 14,
    marginBottom: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  doctorName: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 16,
    color: T.teal,
    marginBottom: 2,
  },
  doctorMeta: {
    fontSize: 9,
    color: T.n500,
    marginBottom: 1,
  },
  dateRight: {
    fontSize: 9,
    color: T.n500,
    textAlign: 'right',
  },
  // Section label
  sectionLabel: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    color: T.n500,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  // Patient block
  patientBlock: {
    backgroundColor: T.n25,
    borderRadius: 4,
    padding: 10,
    marginBottom: 16,
  },
  patientName: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 13,
    color: T.n900,
    marginBottom: 3,
  },
  patientMeta: {
    fontSize: 9,
    color: T.n500,
  },
  // Table
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: T.n50,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: T.n200,
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: T.n100,
    paddingVertical: 7,
    paddingHorizontal: 8,
  },
  tableHeaderCell: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    color: T.n600,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  tableCell: {
    fontSize: 10,
    color: T.n700,
  },
  tableCellMuted: {
    fontSize: 9,
    color: T.n500,
  },
  // Footer
  footer: {
    marginTop: 'auto',
    borderTopWidth: 1,
    borderTopColor: T.n100,
    paddingTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  footerText: {
    fontSize: 8,
    color: T.n400,
  },
  signatureBlock: {
    alignItems: 'center',
  },
  signatureLine: {
    width: 160,
    borderTopWidth: 1,
    borderTopColor: T.n400,
    marginBottom: 4,
  },
  signatureLabel: {
    fontSize: 9,
    color: T.n500,
    textAlign: 'center',
  },
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Prescription PDF ─────────────────────────────────────────────────────────

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

function PrescriptionDocument({ data }: { data: PrescriptionPdfData }): React.ReactElement {
  const { prescription, doctor, patient, location } = data
  const items: PrescriptionItemRow[] = prescription.prescriptionItems ?? []
  const doctorName = doctor.fullName ?? 'Médico'
  const patientFullName = `${patient.firstName} ${patient.lastName}`.trim()
  const age = calcAge(patient.dateOfBirth)
  const docId = patient.documentNumber
    ? `${(patient.documentType ?? 'Doc.').toUpperCase()} ${patient.documentNumber}`
    : null
  const issuedDate = formatDate(prescription.createdAt)

  const col: Record<string, Style> = {
    drug: { flex: 3 },
    dose: { flex: 2 },
    route: { flex: 1.5 },
    frequency: { flex: 2 },
    duration: { flex: 1.5 },
  }

  return React.createElement(
    Document,
    { title: `Receta — ${patientFullName}` },
    React.createElement(
      Page,
      { size: 'LETTER', style: base.page },
      // Header
      React.createElement(
        View,
        { style: base.headerBand },
        React.createElement(
          View,
          null,
          React.createElement(Text, { style: base.doctorName }, `Dr. ${doctorName}`),
          doctor.specialty &&
            React.createElement(Text, { style: base.doctorMeta }, doctor.specialty),
          doctor.licenseNumber &&
            React.createElement(
              Text,
              { style: base.doctorMeta },
              `Matrícula: ${doctor.licenseNumber}`,
            ),
          location && React.createElement(Text, { style: base.doctorMeta }, location.name),
        ),
        React.createElement(
          View,
          null,
          React.createElement(Text, { style: base.dateRight }, issuedDate),
          prescription.groupTitle &&
            React.createElement(
              Text,
              { style: { ...base.dateRight, marginTop: 4 } },
              prescription.groupTitle,
            ),
        ),
      ),

      // Rx symbol + patient
      React.createElement(
        View,
        { style: base.patientBlock },
        React.createElement(
          View,
          { style: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 4 } },
          React.createElement(
            Text,
            {
              style: { fontFamily: 'Helvetica-Bold', fontSize: 18, color: T.teal, marginRight: 8 },
            },
            'Rx',
          ),
          React.createElement(Text, { style: base.patientName }, patientFullName),
        ),
        React.createElement(
          Text,
          { style: base.patientMeta },
          [age, docId].filter(Boolean).join('  ·  '),
        ),
      ),

      // Medications table
      React.createElement(Text, { style: base.sectionLabel }, 'Medicamentos prescritos'),
      React.createElement(
        View,
        { style: { borderWidth: 1, borderColor: T.n200, borderRadius: 3 } },
        // Table header
        React.createElement(
          View,
          { style: base.tableHeader },
          React.createElement(
            Text,
            { style: { ...base.tableHeaderCell, ...col.drug } },
            'Medicamento',
          ),
          React.createElement(Text, { style: { ...base.tableHeaderCell, ...col.dose } }, 'Dosis'),
          React.createElement(Text, { style: { ...base.tableHeaderCell, ...col.route } }, 'Vía'),
          React.createElement(
            Text,
            { style: { ...base.tableHeaderCell, ...col.frequency } },
            'Frecuencia',
          ),
          React.createElement(
            Text,
            { style: { ...base.tableHeaderCell, ...col.duration } },
            'Duración',
          ),
        ),
        // Rows
        ...items.map((item, idx) =>
          React.createElement(
            View,
            {
              key: item.id,
              style: {
                ...base.tableRow,
                backgroundColor: idx % 2 === 0 ? '#FFFFFF' : T.n25,
                borderBottomWidth: idx === items.length - 1 ? 0 : 1,
              },
            },
            React.createElement(
              View,
              { style: col.drug },
              React.createElement(
                Text,
                { style: { ...base.tableCell, fontFamily: 'Helvetica-Bold' } },
                item.drug,
              ),
              item.notes && React.createElement(Text, { style: base.tableCellMuted }, item.notes),
            ),
            React.createElement(Text, { style: { ...base.tableCell, ...col.dose } }, item.dose),
            React.createElement(Text, { style: { ...base.tableCell, ...col.route } }, item.route),
            React.createElement(
              Text,
              { style: { ...base.tableCell, ...col.frequency } },
              item.frequency,
            ),
            React.createElement(
              Text,
              { style: { ...base.tableCell, ...col.duration } },
              item.duration,
            ),
          ),
        ),
      ),

      // Notes
      prescription.notes &&
        React.createElement(
          View,
          { style: { marginTop: 14 } },
          React.createElement(Text, { style: base.sectionLabel }, 'Indicaciones adicionales'),
          React.createElement(
            Text,
            { style: { ...base.tableCell, lineHeight: 1.5 } },
            prescription.notes,
          ),
        ),

      // Footer / signature
      React.createElement(
        View,
        { style: base.footer },
        React.createElement(
          Text,
          { style: base.footerText },
          'Válida para uso médico exclusivamente.',
        ),
        React.createElement(
          View,
          { style: base.signatureBlock },
          React.createElement(View, { style: base.signatureLine }),
          React.createElement(Text, { style: base.signatureLabel }, `Dr. ${doctorName}`),
          doctor.licenseNumber &&
            React.createElement(
              Text,
              { style: base.signatureLabel },
              `Mat. ${doctor.licenseNumber}`,
            ),
        ),
      ),
    ),
  )
}

// ─── Invoice PDF ──────────────────────────────────────────────────────────────

export interface InvoicePdfData {
  invoice: InvoiceWithDetails
  doctor: {
    fullName: string | null
    specialty: string | null
    licenseNumber: string | null
  }
}

const invStyles = StyleSheet.create({
  totalsBlock: {
    marginTop: 16,
    alignSelf: 'flex-end',
    width: 220,
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  totalsLabel: {
    fontSize: 10,
    color: T.n600,
  },
  totalsValue: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    color: T.n800,
  },
  totalFinal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: T.n300,
    paddingTop: 6,
    marginTop: 4,
  },
  totalFinalLabel: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 12,
    color: T.teal,
  },
  totalFinalValue: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 12,
    color: T.teal,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 3,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
})

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

function InvoiceDocument({ data }: { data: InvoicePdfData }): React.ReactElement {
  const { invoice, doctor } = data
  const doctorName = doctor.fullName ?? 'Médico'
  const { bg, text: textColor } = statusColor(invoice.status)
  const col2: Record<string, Style> = {
    desc: { flex: 4 },
    qty: { flex: 1, textAlign: 'right' },
    unit: { flex: 2, textAlign: 'right' },
    total: { flex: 2, textAlign: 'right' },
  }

  return React.createElement(
    Document,
    { title: `Factura ${invoice.invoiceNumber} — ${invoice.patientName}` },
    React.createElement(
      Page,
      { size: 'LETTER', style: base.page },

      // Header
      React.createElement(
        View,
        { style: base.headerBand },
        React.createElement(
          View,
          null,
          React.createElement(Text, { style: base.doctorName }, `Dr. ${doctorName}`),
          doctor.specialty &&
            React.createElement(Text, { style: base.doctorMeta }, doctor.specialty),
          doctor.licenseNumber &&
            React.createElement(
              Text,
              { style: base.doctorMeta },
              `Matrícula: ${doctor.licenseNumber}`,
            ),
          React.createElement(Text, { style: base.doctorMeta }, invoice.locationName),
        ),
        React.createElement(
          View,
          { style: { alignItems: 'flex-end', gap: 4 } },
          React.createElement(
            View,
            { style: { ...invStyles.statusBadge, backgroundColor: bg } },
            React.createElement(
              Text,
              { style: { ...invStyles.statusText, color: textColor } },
              statusLabel(invoice.status),
            ),
          ),
          React.createElement(
            Text,
            { style: { fontFamily: 'Helvetica-Bold', fontSize: 14, color: T.n800 } },
            `Factura ${invoice.invoiceNumber}`,
          ),
          React.createElement(
            Text,
            { style: base.dateRight },
            formatDate(invoice.issuedAt ?? invoice.createdAt),
          ),
        ),
      ),

      // Patient block
      React.createElement(
        View,
        { style: base.patientBlock },
        React.createElement(Text, { style: { ...base.sectionLabel, marginBottom: 2 } }, 'Paciente'),
        React.createElement(Text, { style: base.patientName }, invoice.patientName),
      ),

      // Items table
      React.createElement(Text, { style: base.sectionLabel }, 'Detalle de servicios'),
      React.createElement(
        View,
        { style: { borderWidth: 1, borderColor: T.n200, borderRadius: 3 } },
        React.createElement(
          View,
          { style: base.tableHeader },
          React.createElement(
            Text,
            { style: { ...base.tableHeaderCell, ...col2.desc } },
            'Descripción',
          ),
          React.createElement(Text, { style: { ...base.tableHeaderCell, ...col2.qty } }, 'Cant.'),
          React.createElement(
            Text,
            { style: { ...base.tableHeaderCell, ...col2.unit } },
            'P. unit.',
          ),
          React.createElement(Text, { style: { ...base.tableHeaderCell, ...col2.total } }, 'Total'),
        ),
        ...invoice.items.map((item, idx) =>
          React.createElement(
            View,
            {
              key: item.id,
              style: {
                ...base.tableRow,
                backgroundColor: idx % 2 === 0 ? '#FFFFFF' : T.n25,
                borderBottomWidth: idx === invoice.items.length - 1 ? 0 : 1,
              },
            },
            React.createElement(
              Text,
              { style: { ...base.tableCell, ...col2.desc } },
              item.description,
            ),
            React.createElement(
              Text,
              { style: { ...base.tableCell, ...col2.qty } },
              String(item.quantity),
            ),
            React.createElement(
              Text,
              { style: { ...base.tableCell, ...col2.unit } },
              formatCurrency(item.unitPrice, invoice.currency),
            ),
            React.createElement(
              Text,
              { style: { ...base.tableCell, ...col2.total } },
              formatCurrency(item.total, invoice.currency),
            ),
          ),
        ),
      ),

      // Totals
      React.createElement(
        View,
        { style: invStyles.totalsBlock },
        React.createElement(
          View,
          { style: invStyles.totalsRow },
          React.createElement(Text, { style: invStyles.totalsLabel }, 'Subtotal'),
          React.createElement(
            Text,
            { style: invStyles.totalsValue },
            formatCurrency(invoice.subtotal, invoice.currency),
          ),
        ),
        invoice.tax > 0 &&
          React.createElement(
            View,
            { style: invStyles.totalsRow },
            React.createElement(Text, { style: invStyles.totalsLabel }, 'ITBIS (18%)'),
            React.createElement(
              Text,
              { style: invStyles.totalsValue },
              formatCurrency(invoice.tax, invoice.currency),
            ),
          ),
        invoice.commissionAmount > 0 &&
          React.createElement(
            View,
            { style: invStyles.totalsRow },
            React.createElement(
              Text,
              { style: invStyles.totalsLabel },
              `Comisión centro (${invoice.commissionPercent}%)`,
            ),
            React.createElement(
              Text,
              { style: { ...invStyles.totalsValue, color: T.errText } },
              `− ${formatCurrency(invoice.commissionAmount, invoice.currency)}`,
            ),
          ),
        React.createElement(
          View,
          { style: invStyles.totalFinal },
          React.createElement(Text, { style: invStyles.totalFinalLabel }, 'Total'),
          React.createElement(
            Text,
            { style: invStyles.totalFinalValue },
            formatCurrency(invoice.total, invoice.currency),
          ),
        ),
        invoice.netToDoctor !== invoice.total &&
          React.createElement(
            View,
            { style: { ...invStyles.totalsRow, marginTop: 4 } },
            React.createElement(
              Text,
              { style: { ...invStyles.totalsLabel, fontSize: 9 } },
              'Neto al médico',
            ),
            React.createElement(
              Text,
              { style: { ...invStyles.totalsValue, color: T.okText, fontSize: 9 } },
              formatCurrency(invoice.netToDoctor, invoice.currency),
            ),
          ),
      ),

      // Payment method
      invoice.paymentMethod &&
        React.createElement(
          View,
          { style: { marginTop: 12 } },
          React.createElement(
            Text,
            { style: base.footerText },
            `Método de pago: ${invoice.paymentMethod}`,
          ),
        ),

      // Footer
      React.createElement(
        View,
        { style: { ...base.footer, marginTop: 16 } },
        React.createElement(
          Text,
          { style: base.footerText },
          'Documento generado electrónicamente · Rezeta Medical ERP',
        ),
        React.createElement(
          View,
          { style: base.signatureBlock },
          React.createElement(View, { style: base.signatureLine }),
          React.createElement(Text, { style: base.signatureLabel }, `Dr. ${doctorName}`),
        ),
      ),
    ),
  )
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class PdfService {
  async generatePrescription(data: PrescriptionPdfData): Promise<Buffer> {
    const doc = React.createElement(PrescriptionDocument, { data })
    const buffer = await renderToBuffer(doc as Parameters<typeof renderToBuffer>[0])
    return Buffer.from(buffer)
  }

  async generateInvoice(data: InvoicePdfData): Promise<Buffer> {
    const doc = React.createElement(InvoiceDocument, { data })
    const buffer = await renderToBuffer(doc as Parameters<typeof renderToBuffer>[0])
    return Buffer.from(buffer)
  }
}
