// WhatsApp hand-off.
//
// Nothing here sends a message on its own — no browser can. The only ways
// to do that are a paid WhatsApp Business account with a server behind it,
// or an unofficial bridge that risks getting the number banned. What this
// module does instead is put the right recipient and the right text one tap
// away at the moment the reminder fires, which is the part that was
// actually costing you effort.

export const contactPickerSupported =
  typeof navigator !== "undefined" && "contacts" in navigator && "ContactsManager" in window;

// Chrome on Android only, and it has to be called straight from a tap —
// the browser refuses a picker that wasn't asked for by a person. Nothing
// is stored beyond the one contact you pick: there's no ongoing access to
// the address book, each pick is its own permission.
export async function pickContact() {
  if (!contactPickerSupported) return null;
  try {
    const picked = await navigator.contacts.select(["name", "tel"], { multiple: false });
    if (!picked || !picked.length) return null;
    const c = picked[0];
    return {
      name: (c.name && c.name[0]) || "",
      phone: (c.tel && c.tel[0]) || "",
    };
  } catch (e) {
    return null; // cancelled, or the browser blocked it
  }
}

// wa.me wants one unbroken international number: no +, no spaces, no
// leading zero. Phone books rarely hold it that way — "0300 1234567" and
// "+92 300 1234567" are the same number — so the local form gets converted
// using the country code from Settings.
export function normalizePhone(raw, countryCode) {
  const cc = String(countryCode || "").replace(/\D/g, "");
  let digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return "";

  if (digits.startsWith("00")) digits = digits.slice(2); // 00 is + spelled out
  else if (digits.startsWith("0")) digits = cc + digits.slice(1); // local form
  else if (cc && digits.length <= 10) digits = cc + digits; // local, minus its 0

  return digits;
}

export function prettyPhone(digits) {
  return digits ? "+" + digits : "";
}

// Given no number at all, WhatsApp asks who to send to itself — which is
// the fallback on any browser without a contact picker.
export function waLink(phone, text) {
  const base = phone ? `https://wa.me/${phone}` : "https://wa.me/";
  const msg = (text || "").trim();
  return msg ? `${base}?text=${encodeURIComponent(msg)}` : base;
}
