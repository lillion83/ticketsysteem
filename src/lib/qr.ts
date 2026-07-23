import QRCode from 'qrcode'

// QR-generatie voor de ticketpagina (SVG) en de mail (PNG). Server-only:
// `qrcode` is een node-module en hoort niet in de client-bundle.

// Foutcorrectie M: genoeg redundantie voor een vieze of half beschenen
// telefoonschermscan, zonder de QR onnodig dicht te maken (PLAN §7.2).
const OPTIES = { errorCorrectionLevel: 'M', margin: 2 } as const

/** QR als inline SVG-string, voor de ticketpagina. */
export function qrSvg(inhoud: string): Promise<string> {
  return QRCode.toString(inhoud, { ...OPTIES, type: 'svg' })
}

/** QR als PNG-buffer, voor /t/{code}/qr.png en de mailbijlage. */
export function qrPng(inhoud: string): Promise<Buffer> {
  return QRCode.toBuffer(inhoud, { ...OPTIES, type: 'png', width: 600 })
}
