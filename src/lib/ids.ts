/**
 * uuid v4, supaya id lokal dan id baris Postgres identik. Itu membuat
 * sinkronisasi cukup membandingkan id — tidak perlu tabel pemetaan.
 *
 * Modul sendiri (bukan di store.ts) karena seed.ts juga memakainya, dan
 * store.ts sudah meng-import seed.ts.
 */
export function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback untuk konteks non-secure (http:// selain localhost).
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}
