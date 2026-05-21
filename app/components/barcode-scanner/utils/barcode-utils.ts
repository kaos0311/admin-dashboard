export function cleanBarcode(value: string): string {
  return value.replace(/[\r\n\t]+/g, "").trim();
}

export function isValidBarcode(value: string): boolean {
  return cleanBarcode(value).length >= 3;
}