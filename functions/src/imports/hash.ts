import crypto from "crypto";

const DEFAULT_SHORT_HASH_LENGTH = 24;

export function sha256(
  input: string | Buffer,
  encoding: crypto.BinaryToTextEncoding = "hex"
): string {
  return crypto.createHash("sha256").update(input).digest(encoding);
}

export function shortHash(
  input: string | Buffer,
  length = DEFAULT_SHORT_HASH_LENGTH
): string {
  const safeLength =
    Number.isFinite(length) && length > 0
      ? Math.floor(length)
      : DEFAULT_SHORT_HASH_LENGTH;

  return sha256(input).slice(0, safeLength);
}

export function md5(
  input: string | Buffer,
  encoding: crypto.BinaryToTextEncoding = "hex"
): string {
  return crypto.createHash("md5").update(input).digest(encoding);
}

export function randomId(length = 16): string {
  const byteLength = Math.ceil(length / 2);

  return crypto.randomBytes(byteLength).toString("hex").slice(0, length);
}

export function stableJson(value: unknown): string {
  return internalStableJson(value, new WeakSet<object>());
}

function internalStableJson(
  value: unknown,
  seen: WeakSet<object>
): string {
  if (value === null || value === undefined) {
    return JSON.stringify(value);
  }

  const valueType = typeof value;

  if (
    valueType === "string" ||
    valueType === "number" ||
    valueType === "boolean"
  ) {
    return JSON.stringify(value);
  }

  if (valueType === "bigint") {
    return JSON.stringify(value.toString());
  }

  if (valueType === "function") {
    return JSON.stringify("[Function]");
  }

  if (valueType === "symbol") {
    return JSON.stringify(value.toString());
  }

  if (value instanceof Date) {
    return JSON.stringify(value.toISOString());
  }

  if (Buffer.isBuffer(value)) {
    return JSON.stringify(value.toString("base64"));
  }

  if (Array.isArray(value)) {
    return `[${value
      .map((item) => internalStableJson(item, seen))
      .join(",")}]`;
  }

  if (valueType === "object") {
    const objectValue = value as Record<string, unknown>;

    if (seen.has(objectValue)) {
      return JSON.stringify("[Circular]");
    }

    seen.add(objectValue);

    const serialized = `{${Object.keys(objectValue)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${internalStableJson(
            objectValue[key],
            seen
          )}`
      )
      .join(",")}}`;

    seen.delete(objectValue);

    return serialized;
  }

  return JSON.stringify(String(value));
}

export function stableHash(value: unknown): string {
  return sha256(stableJson(value));
}

export function shortStableHash(
  value: unknown,
  length = DEFAULT_SHORT_HASH_LENGTH
): string {
  return shortHash(stableJson(value), length);
}

export function timingSafeEqual(
  a: string,
  b: string
): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);

  if (bufferA.length !== bufferB.length) {
    return false;
  }

  return crypto.timingSafeEqual(bufferA, bufferB);
}