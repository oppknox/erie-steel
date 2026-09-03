/** Short plain-English tips for 18xx jargon shown in the HUD. */
export const JARGON: Record<string, string> = {
  charter: "A private company you can buy in the opening auction. It pays income each stock round.",
  float: "A company floats when enough shares have been sold; its treasury fills and it can operate.",
  OR: "Operating round — companies lay track, token, run trains, and buy trains in order.",
  withhold: "Keep run earnings in the company treasury instead of paying shareholders.",
  loans: "Borrow $100 from the bank into the company treasury. Interest and limits apply later.",
  private: "Same as a charter — a small company sold in the opening auction.",
  par: "The starting share price you set when you float a company.",
  IPO: "Initial public offering pool — shares still held by the company for sale.",
  dividend: "Cash paid to each share when the company runs trains and does not withhold.",
  token: "A station marker on a city. It claims a route stop and blocks rivals from that slot.",
  stock: "Stock round — players buy and sell shares and may start new companies.",
  auction: "Opening round where players buy private charters one at a time.",
};

export function tip(key: keyof typeof JARGON | string): string {
  return JARGON[key] ?? "";
}

export function tipAttr(key: string): string {
  const t = tip(key);
  return t ? ` title="${t.replace(/"/g, "&quot;")}"` : "";
}
