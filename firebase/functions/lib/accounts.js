/* Change a login email. The portal keys records by email (clients/, managers/, cleaners/, admins/, billing/, mgrlog/),
 * so a new address means moving every record — with all its sub-collections and the files stored under clients/<email>/ —
 * to the new key, and switching the Firebase sign-in to the new address. The uid and password stay the same, so a
 * manager's activated login keeps working. Admins only (portalApi "users.changeEmail").
 * Order: copy files, copy records, switch the sign-in, then delete the old records and files. If anything fails before the
 * sign-in switch, the old records are untouched. */
const fail = (code, msg) => Object.assign(new Error(msg), { code });
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const lc = s => String(s || "").trim().toLowerCase();
const KEYED = ["clients", "managers", "cleaners", "admins", "billing", "mgrlog"];
const ROLES = { clients: "owner", managers: "villa manager", cleaners: "cleaner", admins: "admin" };

// rewrite the old address inside copied data: the email itself and storage paths under clients/<old>/
function swap(v, from, to) {
  if (typeof v === "string") return v === from ? to : v.split(`clients/${from}/`).join(`clients/${to}/`);
  if (Array.isArray(v)) return v.map(x => swap(x, from, to));
  if (v && typeof v === "object" && Object.getPrototypeOf(v) === Object.prototype) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, swap(x, from, to)]));
  return v; // Timestamps and other Firestore values stay as they are
}
async function copyTree(src, dst, from, to) {
  const s = await src.get(); let n = 0;
  if (s.exists) { await dst.set(swap(s.data(), from, to)); n++; }
  for (const col of await src.listCollections()) for (const d of await col.listDocuments()) n += await copyTree(d, dst.collection(col.id).doc(d.id), from, to);
  return n;
}
async function deleteTree(ref) {
  for (const col of await ref.listCollections()) for (const d of await col.listDocuments()) await deleteTree(d);
  await ref.delete();
}

async function changeEmail({ db, auth, bucket, b }) {
  const from = lc(b.from), to = lc(b.to);
  if (!EMAIL.test(from) || !EMAIL.test(to)) throw fail("invalid-argument", "Enter a valid email address.");
  if (from === to) throw fail("invalid-argument", "That's the same email.");
  const [olds, news] = await Promise.all([Promise.all(KEYED.map(c => db.doc(`${c}/${from}`).get())), Promise.all(KEYED.map(c => db.doc(`${c}/${to}`).get()))]);
  const here = KEYED.filter((c, i) => olds[i].exists);
  if (!here.some(c => ROLES[c])) throw fail("not-found", `No owner, manager, cleaner or admin uses ${from}.`);
  const taken = KEYED.filter((c, i) => news[i].exists && ROLES[c]);
  if (taken.length) throw fail("already-exists", `${to} is already used by a ${ROLES[taken[0]]} login.`);
  const [oldUser, newUser] = await Promise.all([from, to].map(e => auth.getUserByEmail(e).catch(e2 => { if (e2.code === "auth/user-not-found") return null; throw e2; })));
  if (newUser) throw fail("already-exists", `${to} already has a Firebase login. Delete it in the Firebase console first, or use another email.`);

  // files under clients/<old>/ (documents, media, repair photos). An owner's files must move with the records that point at them.
  if (!bucket && here.includes("clients")) throw fail("unavailable", "File storage isn't reachable right now, so nothing was changed. Try again in a minute.");
  const files = bucket ? (await bucket.getFiles({ prefix: `clients/${from}/` }))[0] : [];
  for (const f of files) await f.copy(bucket.file(`clients/${to}/` + f.name.slice(`clients/${from}/`.length)));
  let records = 0;
  for (const c of KEYED) if (here.includes(c)) records += await copyTree(db.doc(`${c}/${from}`), db.doc(`${c}/${to}`), from, to);
  if (oldUser) await auth.updateUser(oldUser.uid, { email: to });
  for (const c of KEYED) if (here.includes(c)) await deleteTree(db.doc(`${c}/${from}`));
  for (const f of files) await f.delete().catch(() => {});
  return { from, to, roles: here.filter(c => ROLES[c]).map(c => ROLES[c]), records, files: files.length, login: oldUser ? "moved" : "none" };
}

/* Switch a client's portal access off or on. Off disables the Firebase sign-in for that email (all roles on it) and ends the
 * sessions they have open; on enables it again. The client record keeps accessOff so admins see it. Admins only ("users.setAccess"). */
async function setAccess({ db, auth, b }) {
  const email = lc(b.email), on = b.on !== false;
  if (!EMAIL.test(email)) throw fail("invalid-argument", "Enter a valid email address.");
  const ref = db.doc(`clients/${email}`), snap = await ref.get();
  if (!snap.exists) throw fail("not-found", `${email} isn't a client.`);
  const user = await auth.getUserByEmail(email).catch(e => { if (e.code === "auth/user-not-found") return null; throw e; });
  if (user) { await auth.updateUser(user.uid, { disabled: !on }); if (!on) await auth.revokeRefreshTokens(user.uid); }
  await ref.set({ accessOff: !on, accessChangedAt: new Date() }, { merge: true });
  return { email, on, login: user ? (on ? "on" : "off") : "none" };
}

module.exports = { changeEmail, setAccess, swap };
