import pdfParse from "pdf-parse";

type DeliveryTicketItem = {
  itemId?: string;
  itemName?: string;
  hcpc?: string;
  quantity?: number;
  serialNumber?: string;
  lotNumber?: string;
};

export type ParsedDeliveryTicket = {
  fullText: string;
  lines: string[];
  ticketIndex?: number;
  patientName?: string;
  patientId?: string;
  dob?: string;
  phone?: string;
  address?: string;
  salesOrderId?: string;
  deliveryTicketNumber?: string;
  deliveryDate?: string;
  scheduledDeliveryDate?: string;
  deliveryTechName?: string;
  insuranceName?: string;
  policyNumber?: string;
  hospiceDetected: boolean;
  items: DeliveryTicketItem[];
  tickets?: ParsedDeliveryTicket[];
};

function cleanText(value: unknown): string {
  return String(value ?? "").replace(/\u0000/g, "").replace(/\s+/g, " ").trim();
}

function cleanLine(value: unknown): string {
  return String(value ?? "")
    .replace(/\u0000/g, "")
    .replace(/[|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeDate(value: string): string {
  if (!value) return "";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value.trim() : parsed.toISOString().slice(0, 10);
}

function firstMatch(text: string, patterns: RegExp[]): string {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const value = cleanText(match?.[1]);
    if (value) return value;
  }
  return "";
}

function firstMatchFromLines(lines: string[], patterns: RegExp[]): string {
  for (const line of lines) {
    const value = firstMatch(line, patterns);
    if (value) return value;
  }
  return "";
}

function lineAfter(lines: string[], labels: string[]): string {
  const normalizedLabels = labels.map((label) => label.toLowerCase());

  for (const line of lines) {
    const lower = line.toLowerCase();
    const label = normalizedLabels.find((item) => lower.startsWith(item));
    if (!label) continue;

    const stripped = cleanText(line.slice(label.length).replace(/^[:#\s-]+/, ""));
    if (stripped) return stripped;
  }

  return "";
}

function toNumber(value: string): number | undefined {
  const parsed = Number(value.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function cleanIdentifier(value: string): string {
  const cleaned = cleanText(value);
  if (!cleaned || /^[_-]+$/.test(cleaned) || /^n\/?a$/i.test(cleaned) || /^no\.?$/i.test(cleaned)) {
    return "";
  }
  return cleaned;
}

function extractItems(lines: string[]): DeliveryTicketItem[] {
  const items: DeliveryTicketItem[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const quantityLine = lines[index] ?? "";
    const typeLine = lines[index + 1] ?? "";
    const itemLine = lines[index + 2] ?? "";

    if (!/^\d+(?:\.\d+)?$/.test(quantityLine)) continue;
    if (!/^(Rental|Purchase|Sale|Service)$/i.test(typeLine)) continue;
    if (!/\b[A-Z]\d{4}[A-Z0-9]{0,2}\b/.test(itemLine)) continue;

    const hcpc = firstMatch(itemLine, [/\b([A-Z]\d{4}[A-Z0-9]{0,2})\b/i]);
    const itemName = cleanText(itemLine.replace(/\b[A-Z]\d{4}[A-Z0-9]{0,2}\b\s*\/?\s*/i, ""));
    const detailLine = lines[index + 4] ?? lines[index + 3] ?? "";
    const serialNumber = cleanIdentifier(firstMatch(detailLine, [
      /\bSN\s*:?\s*([A-Z0-9._-]{3,40})/i,
      /\bSerial(?:\s*(?:Number|No|#))?\s*:?\s*([A-Z0-9._-]{3,40})/i,
    ]));
    const lotNumber = cleanIdentifier(firstMatch(detailLine, [
      /\bLot(?:\s*(?:Number|No|#))?\s*:?\s*([A-Z0-9._-]{2,40})/i,
    ]));

    items.push({
      itemId: hcpc || undefined,
      itemName: itemName || undefined,
      hcpc: hcpc || undefined,
      quantity: toNumber(quantityLine),
      serialNumber: serialNumber || undefined,
      lotNumber: lotNumber || undefined,
    });
  }

  const seen = new Set<string>();
  return items.filter((item) => {
    const key = [item.itemId, item.hcpc, item.serialNumber, item.lotNumber, item.itemName].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 50);
}

function splitTicketSegments(lines: string[]): string[][] {
  const segments: string[][] = [];
  let current: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const next = lines[index + 1] ?? "";
    const startsTicket =
      /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(line) &&
      /delivery ticket/i.test(next);

    if (startsTicket && current.length > 0) {
      segments.push(current);
      current = [];
    }

    current.push(line);
  }

  if (current.length > 0) segments.push(current);

  return segments.filter((segment) =>
    segment.some((line) => /delivery ticket/i.test(line)) &&
    segment.some((line) => /sales order/i.test(line))
  );
}

function parseTicketSegment(segment: string[], ticketIndex: number): ParsedDeliveryTicket {
  const textWithBreaks = segment.join("\n");
  const fullText = cleanText(textWithBreaks);
  const patientName =
    firstMatchFromLines(segment, [
      /^Customer\s*:?\s*(.+)$/i,
      /^Customer(.+)$/i,
    ]) ||
    lineAfter(segment, ["Patient Name", "Patient", "Name"]);
  const patientId = firstMatchFromLines(segment, [
    /^Customer\s*ID\s*:?\s*([A-Z0-9-]+)/i,
    /^Customer ID([A-Z0-9-]+)/i,
  ]);
  const dob = normalizeDate(firstMatchFromLines(segment, [
    /DOB\s*:?\s*([0-9]{1,2}[/-][0-9]{1,2}[/-][0-9]{2,4})/i,
    /HeightWeightDOB([0-9]{1,2}[/-][0-9]{1,2}[/-][0-9]{2,4})/i,
  ]));
  const billTo = firstMatchFromLines(segment, [
    /^Bill to\s*:?\s*(.+)$/i,
    /^Bill to(.+)$/i,
  ]);
  const deliverTo = firstMatchFromLines(segment, [
    /^Deliver to\s*:?\s*(.+)$/i,
    /^Deliver to(.+)$/i,
  ]);
  const insuranceName = firstMatchFromLines(segment, [
    /^Insurance\s*:?\s*(.+)$/i,
    /^Insurance(.+)$/i,
  ]);

  return {
    fullText,
    lines: segment,
    ticketIndex,
    patientName,
    patientId,
    dob,
    phone: firstMatchFromLines(segment, [
      /(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/,
    ]),
    address: deliverTo || billTo,
    salesOrderId: firstMatchFromLines(segment, [
      /^Sales\s*Order\s*:?\s*([A-Z0-9-]+)/i,
      /^Sales Order([A-Z0-9-]+)/i,
    ]),
    deliveryTicketNumber: firstMatchFromLines(segment, [
      /^Doc\s*ID\s*:?\s*([A-Z0-9-]+)/i,
      /^Doc ID([A-Z0-9-]+)/i,
    ]),
    deliveryDate: normalizeDate(firstMatchFromLines(segment, [
      /^([0-9]{1,2}\/[0-9]{1,2}\/[0-9]{4})$/,
    ])),
    scheduledDeliveryDate: "",
    deliveryTechName: firstMatchFromLines(segment, [
      /^CSRBranch\s*$/i,
    ]) ? firstMatchFromLines(segment, [/^([A-Z]+)Advanced Home Medical/i]) : "",
    insuranceName,
    policyNumber: firstMatch(insuranceName, [/\(([A-Z0-9-]+)\)\s*$/i]),
    hospiceDetected: /hospice/i.test(fullText),
    items: extractItems(segment),
  };
}

function mergeTicketCopies(tickets: ParsedDeliveryTicket[]): ParsedDeliveryTicket[] {
  const map = new Map<string, ParsedDeliveryTicket>();

  for (const ticket of tickets) {
    const key = [
      ticket.salesOrderId,
      ticket.patientId,
      ticket.patientName,
      ticket.deliveryDate,
    ].join("|");
    const existing = map.get(key);

    if (!existing) {
      map.set(key, ticket);
      continue;
    }

    const itemMap = new Map<string, DeliveryTicketItem>();
    for (const item of [...existing.items, ...ticket.items]) {
      itemMap.set([item.itemId, item.itemName, item.serialNumber, item.lotNumber].join("|"), item);
    }

    existing.items = Array.from(itemMap.values());
    existing.fullText = `${existing.fullText}\n${ticket.fullText}`;
    existing.lines = [...existing.lines, ...ticket.lines];
    existing.hospiceDetected = existing.hospiceDetected || ticket.hospiceDetected;
  }

  return Array.from(map.values());
}

export async function parseDeliveryTicketsPdf(buffer: Buffer): Promise<ParsedDeliveryTicket[]> {
  const parsed = await pdfParse(buffer);
  const fullText = cleanText(parsed.text);

  if (!fullText) {
    throw new Error("PDF contained no readable text.");
  }

  const lines = parsed.text
    .split(/\r?\n/g)
    .map(cleanLine)
    .filter((line) => line.length > 0);

  const segments = splitTicketSegments(lines);
  const tickets = segments.map((segment, index) => parseTicketSegment(segment, index + 1));

  return mergeTicketCopies(tickets).filter((ticket) =>
    Boolean(ticket.patientName || ticket.patientId || ticket.salesOrderId || ticket.items.length)
  );
}

export async function parseDeliveryTicketPdf(buffer: Buffer): Promise<ParsedDeliveryTicket> {
  const tickets = await parseDeliveryTicketsPdf(buffer);
  const first = tickets[0];

  if (!first) {
    throw new Error("No delivery tickets could be parsed from this PDF.");
  }

  return {
    ...first,
    tickets,
  };
}
