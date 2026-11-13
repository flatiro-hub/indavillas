/* Portal settings (system/portal) and optional emails.
 * Emails go out only when the "Trigger Email from Firestore" Firebase extension is installed and
 * emails are switched on in Billing → Settings. The extension sends whatever lands in the mail collection. */
const { Timestamp } = require("firebase-admin/firestore");

const DEFAULT_SETTINGS = {
  companyName: "IndaVillas", companyAddress: "", taxId: "", email: "", phone: "",
  bankName: "", bankHolder: "", bankAccount: "", bankSwift: "", paymentNote: "Please pay by bank transfer within the due date. Use the invoice number as the reference.",
  invoicePrefix: "IV", nextInvoiceNo: 1, dueDays: 14, defaultCurrency: "USD",
  portalUrl: "https://indavillas.com/portal/", emailEnabled: false, mailCollection: "mail", adminEmails: "",
  autoReports: false,
};

async function getSettings(db) {
  const s = await db.doc("system/portal").get();
  return { ...DEFAULT_SETTINGS, ...(s.exists ? s.data() : {}) };
}

async function notify(db, to, subject, lines, settings) {
  try {
    const st = settings || (await getSettings(db));
    const list = [].concat(to).map(x => String(x || "").trim()).filter(x => /@/.test(x));
    if (!st.emailEnabled || !list.length) return false;
    const text = [...lines, "", "Open the portal: " + st.portalUrl, "", "— " + st.companyName].join("\n");
    const esc = s => String(s).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
    const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.55;color:#23261F">${lines.map(l => `<p style="margin:0 0 10px">${esc(l)}</p>`).join("")}<p style="margin:18px 0"><a href="${esc(st.portalUrl)}" style="background:#13564F;color:#fff;padding:10px 18px;border-radius:4px;text-decoration:none">Open the portal</a></p><p style="color:#8A8A7E;font-size:13px">${esc(st.companyName)}</p></div>`;
    await db.collection(st.mailCollection || "mail").add({ to: list, message: { subject, text, html }, createdAt: Timestamp.now() });
    return true;
  } catch (e) { return false; }
}
const adminList = st => String(st.adminEmails || "").split(/[,\s]+/).filter(x => /@/.test(x));

module.exports = { DEFAULT_SETTINGS, getSettings, notify, adminList };
