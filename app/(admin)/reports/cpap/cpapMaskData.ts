/**
 * CPAP / BiPAP mask, cushion, and headgear data from manufacturer master list.
 * Organised by manufacturer → mask → cushion / headgear.
 */

export type CpapMaskEntry = {
  manufacturer: string;
  mask: string;
  maskType: string;
  cushion: string;
  headgear: string;
};

export const CPAP_MASK_DATA: CpapMaskEntry[] = [
  // ── ResMed ──────────────────────────────────────────
  { manufacturer: "ResMed", mask: "AirFit F20", maskType: "Full Face Mask", cushion: "AirFit F20 Cushion", headgear: "AirFit F20 Headgear" },
  { manufacturer: "ResMed", mask: "AirTouch F20", maskType: "Full Face Mask", cushion: "AirTouch F20 Memory Foam Cushion", headgear: "AirFit/AirTouch F20 Headgear" },
  { manufacturer: "ResMed", mask: "AirFit F30", maskType: "Full Face Mask", cushion: "AirFit F30 Cushion", headgear: "AirFit F30 Headgear" },
  { manufacturer: "ResMed", mask: "AirFit F30i", maskType: "Full Face Mask", cushion: "AirFit F30i Cushion", headgear: "AirFit F30i Headgear" },
  { manufacturer: "ResMed", mask: "AirFit F40", maskType: "Full Face Mask", cushion: "AirFit F40 Cushion", headgear: "AirFit F40 Headgear" },
  { manufacturer: "ResMed", mask: "AirTouch F30i", maskType: "Full Face Mask", cushion: "AirTouch F30i Cushion", headgear: "AirTouch F30i Headgear" },
  { manufacturer: "ResMed", mask: "AirFit N20", maskType: "Nasal Mask", cushion: "AirFit N20 Cushion", headgear: "AirFit N20 Headgear" },
  { manufacturer: "ResMed", mask: "AirTouch N20", maskType: "Nasal Mask", cushion: "AirTouch N20 Memory Foam Cushion", headgear: "AirTouch N20 Headgear" },
  { manufacturer: "ResMed", mask: "AirFit N30", maskType: "Nasal Cradle", cushion: "AirFit N30 Cushion", headgear: "AirFit N30 Headgear" },
  { manufacturer: "ResMed", mask: "AirFit N30i", maskType: "Nasal Cradle", cushion: "AirFit N30i Cushion", headgear: "AirFit N30i Headgear" },
  { manufacturer: "ResMed", mask: "AirTouch N30i", maskType: "Nasal Cradle", cushion: "AirTouch N30i Cushion", headgear: "AirTouch N30i Headgear" },
  { manufacturer: "ResMed", mask: "AirFit P10", maskType: "Nasal Pillows", cushion: "AirFit P10 Pillows", headgear: "AirFit P10 Headgear" },
  { manufacturer: "ResMed", mask: "AirFit P30i", maskType: "Nasal Pillows", cushion: "AirFit P30i Pillows", headgear: "AirFit P30i Headgear" },
  { manufacturer: "ResMed", mask: "Mirage FX", maskType: "Nasal Mask", cushion: "Mirage FX Cushion", headgear: "Mirage FX Headgear" },
  { manufacturer: "ResMed", mask: "Mirage Activa LT", maskType: "Nasal Mask", cushion: "Activa LT Cushion", headgear: "Activa LT Headgear" },

  // ── Philips Respironics ──────────────────────────────
  { manufacturer: "Philips Respironics", mask: "DreamWear Full Face", maskType: "Full Face Mask", cushion: "DreamWear Full Face Cushion", headgear: "DreamWear Headgear" },
  { manufacturer: "Philips Respironics", mask: "DreamWear Nasal", maskType: "Nasal Mask", cushion: "DreamWear Nasal Cushion", headgear: "DreamWear Headgear" },
  { manufacturer: "Philips Respironics", mask: "DreamWear Silicone Pillows", maskType: "Nasal Pillows", cushion: "DreamWear Silicone Pillows", headgear: "DreamWear Headgear" },
  { manufacturer: "Philips Respironics", mask: "DreamWisp", maskType: "Nasal Mask", cushion: "DreamWisp Cushion", headgear: "DreamWisp Headgear" },
  { manufacturer: "Philips Respironics", mask: "Wisp", maskType: "Nasal Mask", cushion: "Wisp Cushion", headgear: "Wisp Headgear" },
  { manufacturer: "Philips Respironics", mask: "Pico", maskType: "Nasal Mask", cushion: "Pico Cushion", headgear: "Pico Headgear" },
  { manufacturer: "Philips Respironics", mask: "Nuance Pro Gel", maskType: "Nasal Pillows", cushion: "Nuance Pro Gel Pillows", headgear: "Nuance Pro Headgear" },
  { manufacturer: "Philips Respironics", mask: "Amara View", maskType: "Full Face Mask", cushion: "Amara View Cushion", headgear: "Amara View Headgear" },
  { manufacturer: "Philips Respironics", mask: "Amara Gel", maskType: "Full Face Mask", cushion: "Amara Gel Cushion", headgear: "Amara Gel Headgear" },
  { manufacturer: "Philips Respironics", mask: "ComfortGel Blue", maskType: "Nasal Mask", cushion: "ComfortGel Blue Cushion", headgear: "ComfortGel Blue Headgear" },
  { manufacturer: "Philips Respironics", mask: "ComfortGel Blue Full", maskType: "Full Face Mask", cushion: "ComfortGel Blue Full Cushion", headgear: "ComfortGel Blue Full Headgear" },
  { manufacturer: "Philips Respironics", mask: "TrueBlue", maskType: "Nasal Mask", cushion: "TrueBlue Cushion", headgear: "TrueBlue Headgear" },

  // ── Fisher & Paykel ──────────────────────────────────
  { manufacturer: "Fisher & Paykel", mask: "Evora Full", maskType: "Full Face Mask", cushion: "Evora Full Cushion", headgear: "Evora Full Headgear" },
  { manufacturer: "Fisher & Paykel", mask: "Evora Nasal", maskType: "Nasal Mask", cushion: "Evora Nasal Cushion", headgear: "Evora Nasal Headgear" },
  { manufacturer: "Fisher & Paykel", mask: "Vitera", maskType: "Full Face Mask", cushion: "Vitera Cushion", headgear: "Vitera Headgear" },
  { manufacturer: "Fisher & Paykel", mask: "Simplus", maskType: "Full Face Mask", cushion: "Simplus Cushion", headgear: "Simplus Headgear" },
  { manufacturer: "Fisher & Paykel", mask: "Forma", maskType: "Full Face Mask", cushion: "Forma Cushion", headgear: "Forma Headgear" },
  { manufacturer: "Fisher & Paykel", mask: "FlexiFit 431", maskType: "Full Face Mask", cushion: "FlexiFit 431 Cushion", headgear: "FlexiFit 431 Headgear" },
  { manufacturer: "Fisher & Paykel", mask: "FlexiFit 432", maskType: "Full Face Mask", cushion: "FlexiFit 432 Cushion", headgear: "FlexiFit 432 Headgear" },
  { manufacturer: "Fisher & Paykel", mask: "Eson", maskType: "Nasal Mask", cushion: "Eson Cushion", headgear: "Eson Headgear" },
  { manufacturer: "Fisher & Paykel", mask: "Eson 2", maskType: "Nasal Mask", cushion: "Eson 2 Cushion", headgear: "Eson 2 Headgear" },
  { manufacturer: "Fisher & Paykel", mask: "Solo Nasal", maskType: "Nasal Mask", cushion: "Solo Cushion", headgear: "Solo Headgear" },
  { manufacturer: "Fisher & Paykel", mask: "Brevida", maskType: "Nasal Pillows", cushion: "Brevida Pillows", headgear: "Brevida Headgear" },
  { manufacturer: "Fisher & Paykel", mask: "Nova Micro", maskType: "Nasal Pillows", cushion: "Nova Micro Cushion/Pillows", headgear: "Nova Micro Headgear" },
  { manufacturer: "Fisher & Paykel", mask: "Opus 360", maskType: "Nasal Pillows", cushion: "Opus 360 Pillows", headgear: "Opus 360 Headgear" },
  { manufacturer: "Fisher & Paykel", mask: "Pilairo Q", maskType: "Nasal Pillows", cushion: "Pilairo Q Pillows", headgear: "Pilairo Q Headgear" },
  { manufacturer: "Fisher & Paykel", mask: "Zest", maskType: "Nasal Mask", cushion: "Zest Cushion", headgear: "Zest Headgear" },
  { manufacturer: "Fisher & Paykel", mask: "Zest Q", maskType: "Nasal Mask", cushion: "Zest Q Cushion", headgear: "Zest Q Headgear" },
  { manufacturer: "Fisher & Paykel", mask: "FlexiFit 405", maskType: "Nasal Mask", cushion: "FlexiFit 405 Cushion", headgear: "FlexiFit 405 Headgear" },
  { manufacturer: "Fisher & Paykel", mask: "FlexiFit 407", maskType: "Nasal Mask", cushion: "FlexiFit 407 Cushion", headgear: "FlexiFit 407 Headgear" },

  // ── React Health ─────────────────────────────────────
  { manufacturer: "React Health", mask: "Rio II Full Face", maskType: "Full Face Mask", cushion: "Rio II Full Face Cushion", headgear: "Rio II Full Face Headgear" },
  { manufacturer: "React Health", mask: "Rio II Nasal", maskType: "Nasal Mask", cushion: "Rio II Nasal Cushion", headgear: "Rio II Nasal Headgear" },
  { manufacturer: "React Health", mask: "Rio II Nasal Pillows", maskType: "Nasal Pillows", cushion: "Rio II Pillows", headgear: "Rio II Headgear" },
  { manufacturer: "React Health", mask: "Siesta Full Face", maskType: "Full Face Mask", cushion: "Siesta Full Face Cushion", headgear: "Siesta Full Face Headgear" },
  { manufacturer: "React Health", mask: "Siesta 2 Full Face", maskType: "Full Face Mask", cushion: "Siesta 2 Cushion", headgear: "Siesta 2 Headgear" },
  { manufacturer: "React Health", mask: "Siesta Nasal", maskType: "Nasal Mask", cushion: "Siesta Nasal Cushion", headgear: "Siesta Nasal Headgear" },
  { manufacturer: "React Health", mask: "Viva Nasal", maskType: "Nasal Mask", cushion: "Viva Cushion", headgear: "Viva Headgear" },
  { manufacturer: "React Health", mask: "Numa Full Face", maskType: "Full Face Mask", cushion: "Numa Cushion", headgear: "Numa Headgear" },

  // ── Bleep ────────────────────────────────────────────
  { manufacturer: "Bleep", mask: "DreamPort", maskType: "Adhesive Interface", cushion: "DreamPort Port", headgear: "No Traditional Headgear" },
  { manufacturer: "Bleep", mask: "Eclipse", maskType: "Adhesive Interface", cushion: "Eclipse Port", headgear: "No Traditional Headgear" },
];

export function getUniqueManufacturers(): string[] {
  const set = new Set(CPAP_MASK_DATA.map((e) => e.manufacturer));
  return Array.from(set);
}

export function getMasksByManufacturer(manufacturer: string): CpapMaskEntry[] {
  return CPAP_MASK_DATA.filter((e) => e.manufacturer === manufacturer);
}

export function getMaskByName(manufacturer: string, mask: string): CpapMaskEntry | undefined {
  return CPAP_MASK_DATA.find((e) => e.manufacturer === manufacturer && e.mask === mask);
}

export function getMaskTypes(): string[] {
  const set = new Set(CPAP_MASK_DATA.map((e) => e.maskType));
  return Array.from(set);
}

export type MaskSelection = {
  manufacturer: string;
  mask: string;
  cushion: string;
  headgear: string;
};
