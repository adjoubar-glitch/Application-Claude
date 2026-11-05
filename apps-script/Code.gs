// BakeScale, version autonome : Apps Script relié à la Google Sheet de l'atelier.
var SHEET_ID = '1ZRWyzaKoa19PQx4Ysn1gs2aUc9KRMtXa87s9thydQiU';
var TAB_PROD = 'App_Productions', TAB_STATUS = 'App_Statuts', TAB_INV = 'App_Invites', TAB_STOCK = 'App_Stock', TAB_MAT = 'App_Matériel', TAB_CMP = 'Comparatif Équipements';
var HEAD_PROD = ['Identifiant', 'Recette', 'Date', 'Terminée', 'Stock déduit', 'Créée le', 'Données'];
var HEAD_STATUS = ['Clé', 'Production', 'Bloc', 'État', 'Commentaire', 'Pris par', 'Mis à jour le'];
var HEAD_INV = ['Identifiant', 'Nom', 'Téléphone', 'E-mail', 'Jeton', 'Actif', 'Créé le', 'Lien personnel', 'Onglets'];
// Onglets qu'un invité peut ouvrir en plus de ses tâches (colonne I de App_Invites, séparés par des virgules).
var TABS_ = ['dose', 'stock', 'mat'];
function tabsOf_(v) { return String(v || '').split(/[,; ]+/).map(function (x) { return x.trim().toLowerCase(); }).filter(function (x) { return TABS_.indexOf(x) >= 0; }); }

var TAB_RULES = 'App_Regles', TAB_OK = 'App_Accords', TAB_CALLS = 'App_Appels';
var HEAD_OK = ['Identifiant', 'Nom', 'Version', 'Validé le'];
var HEAD_CALLS = ['Identifiant', 'Personne', 'Nom', 'Production', 'Bloc', 'Recette', 'Nom du bloc', 'Heure', 'Pris en charge'];

// Adresse de l'application installable (GitHub Pages). Les liens Chef et invités pointent vers elle.
var PWA_URL = 'https://adjoubar-glitch.github.io/Application-Claude/';
function linkBase_() { return PWA_URL || appUrl_(); }

function ss_() { return SpreadsheetApp.openById(SHEET_ID); }
function props_() { return PropertiesService.getScriptProperties(); }
function appUrl_() {
  var u = ScriptApp.getService().getUrl() || '', p = props_();
  if (/\/exec$/.test(u)) { if (p.getProperty('EXEC_URL') !== u) p.setProperty('EXEC_URL', u); return u; }
  return p.getProperty('EXEC_URL') || u;
}
function tab_(name, head) {
  var ss = ss_(), s = ss.getSheetByName(name);
  if (!s) { s = ss.insertSheet(name); s.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold'); s.setFrozenRows(1); }
  return s;
}
function withLock_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}
function clean_(rows) {
  return rows.map(function (r) { return r.map(function (c) { return c instanceof Date ? c.toISOString() : c; }); });
}

/* À lancer une fois après le déploiement : crée les onglets, le lien Chef et importe les schémas. */
function installer() {
  var p = props_();
  if (!p.getProperty('ADMIN_KEY')) p.setProperty('ADMIN_KEY', Utilities.getUuid());
  tab_(TAB_PROD, HEAD_PROD); tab_(TAB_STATUS, HEAD_STATUS); tab_(TAB_OK, HEAD_OK); tab_(TAB_CALLS, HEAD_CALLS);
  var inv = tab_(TAB_INV, HEAD_INV), url = linkBase_() + '?k=' + p.getProperty('ADMIN_KEY');
  var rows = inv.getDataRange().getValues(), at = -1;
  for (var i = 1; i < rows.length; i++) if (rows[i][0] === 'chef') at = i + 1;
  var row = ['chef', 'Chef', '', '', p.getProperty('ADMIN_KEY'), true, new Date(), url];
  if (at > 0) inv.getRange(at, 1, 1, row.length).setValues([row]); else inv.appendRow(row);
  var n = importSchemas_();
  Logger.log('Ton lien Chef (garde-le pour toi) : ' + url);
  Logger.log(n + ' schéma(s) importé(s).');
  return url;
}

function doGet(e) {
  var t = HtmlService.createTemplateFromFile('index');
  var token = (e && e.parameter && (e.parameter.k || e.parameter.i)) || '';
  appUrl_();
  t.token = auth_(token) ? token : '';
  return t.evaluate().setTitle('BakeScale')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/* API JSON pour l'application installable : POST {fn, args} -> {ok, result | error}. */
var API_NAMES_ = ["api_audio", "api_accept", "api_call", "api_calls", "api_ack", "api_ntfy", "api_load", "api_board", "api_rev", "api_setQty", "api_addStock", "api_saveProduction", "api_deleteProduction", "api_finishProduction", "api_status", "api_invite", "api_setTabs", "api_restore", "api_remove", "api_revoke", "api_schema", "api_importSchemas"];
function doPost(e) {
  var out;
  try {
    var b = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (API_NAMES_.indexOf(b.fn) < 0) throw new Error('Action inconnue.');
    out = { ok: true, result: globalThis[b.fn].apply(null, b.args || []) };
  } catch (err) {
    out = { ok: false, error: String((err && err.message) || err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function auth_(token) {
  if (!token) return null;
  if (token === props_().getProperty('ADMIN_KEY')) return { role: 'chef', id: 'chef', name: 'Chef', tabs: TABS_.slice() };
  var s = ss_().getSheetByName(TAB_INV); if (!s) return null;
  var rows = s.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) if (rows[i][4] === token && rows[i][5] === true && rows[i][0] !== 'chef') return { role: 'equipe', id: String(rows[i][0]), name: String(rows[i][1]), tabs: tabsOf_(rows[i][8]) };
  return null;
}
// perm : true = Chef seulement ; 'dose' | 'stock' | 'mat' = Chef ou invité ayant cet onglet.
function need_(token, perm) {
  var a = auth_(token);
  if (!a) throw new Error('Ce lien n\'est plus valide.');
  if (perm === true && a.role !== 'chef') throw new Error('Action réservée au chef.');
  if (typeof perm === 'string' && a.role !== 'chef' && a.tabs.indexOf(perm) < 0) throw new Error('Tu n\'as pas accès à cet onglet.');
  return a;
}
function revision_() { return DriveApp.getFileById(SHEET_ID).getLastUpdated().getTime(); }

function people_(withLinks) {
  var s = ss_().getSheetByName(TAB_INV); if (!s) return [];
  return s.getDataRange().getValues().slice(1).filter(function (r) { return r[0] && r[0] !== 'chef'; }).map(function (r) {
    var o = { id: String(r[0]), name: String(r[1]), active: r[5] === true };
    if (withLinks) { o.phone = String(r[2]); o.mail = String(r[3]); o.url = String(r[7]); o.tabs = tabsOf_(r[8]); o.created = r[6] instanceof Date ? r[6].toISOString() : String(r[6] || ''); }
    return o;
  });
}
function board_(me) {
  var prods = tab_(TAB_PROD, HEAD_PROD).getDataRange().getValues().slice(1).filter(function (r) { return r[0]; }).map(function (r) {
    var d = JSON.parse(r[6]); d.id = String(r[0]); d.finished = r[3] === true; d.deducted = r[4] === true; return d;
  });
  var status = {};
  tab_(TAB_STATUS, HEAD_STATUS).getDataRange().getValues().slice(1).forEach(function (r) {
    if (r[0]) status[r[0]] = { pid: String(r[1]), i: Number(r[2]), state: String(r[3]), comment: String(r[4]), claimedBy: String(r[5]) };
  });
  prods.sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
  var rules = rules_(), out = { productions: prods, status: status, rules: rules };
  if (me.role !== 'chef') {
    var ok = accepted_(me.id, rules.version);
    prods = prods.filter(function (p) { return !p.finished; });
    prods.forEach(function (p) {
      if (!ok) { p.steps = []; p.layers = []; p.legend = []; p.sketch = []; }
      p.blocks.forEach(function (b, i) {
        var a = (p.assign || {})[i] || {}, st = status[p.id + '~' + i] || {}, who = a.id || st.claimedBy;
        if (!ok || (who && who !== me.id)) { b.items = []; b.steps = []; }
      });
    });
    out.productions = prods; out.accepted = ok; out.calls = calls_().filter(function (c) { return c.who === me.id; });
  } else {
    out.calls = calls_(); out.accords = accords_(rules.version);
  }
  return out;
}

/* ---------- Règles d'hygiène et règlement intérieur ---------- */
function rules_() {
  var s = ss_().getSheetByName(TAB_RULES), rows = s ? s.getDataRange().getValues().slice(1) : [];
  var items = rows.filter(function (r) { return r[1]; }).map(function (r) { return { chapter: String(r[0]), text: String(r[1]) }; });
  var audio = audioFile_();
  var seed = JSON.stringify(items) + (audio ? audio.getId() + audio.getLastUpdated().getTime() : '');
  var version = Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_1, seed, Utilities.Charset.UTF_8)).slice(0, 12);
  return { items: items, version: version, hasAudio: !!audio };
}
function accepted_(id, version) {
  return tab_(TAB_OK, HEAD_OK).getDataRange().getValues().slice(1).some(function (r) { return r[0] === id && r[2] === version; });
}
function accords_(version) {
  return tab_(TAB_OK, HEAD_OK).getDataRange().getValues().slice(1).filter(function (r) { return r[2] === version; }).map(function (r) { return { id: String(r[0]), at: r[3] instanceof Date ? r[3].toISOString() : String(r[3]) }; });
}
function audioFile_() {
  var it = folder_().getFiles();
  while (it.hasNext()) { var f = it.next(); if (/^consignes\./i.test(f.getName())) return f; }
  return null;
}
function api_audio(token) {
  need_(token);
  var f = audioFile_();
  return f ? 'data:' + f.getMimeType() + ';base64,' + Utilities.base64Encode(f.getBlob().getBytes()) : '';
}
function api_accept(token) {
  var me = need_(token);
  return withLock_(function () {
    var v = rules_().version;
    if (me.role !== 'chef' && !accepted_(me.id, v)) tab_(TAB_OK, HEAD_OK).appendRow([me.id, me.name, v, new Date()]);
    return true;
  });
}

/* ---------- Appeler le Chef ---------- */
function calls_() {
  var limit = Date.now() - 12 * 3600 * 1000;
  return tab_(TAB_CALLS, HEAD_CALLS).getDataRange().getValues().slice(1).filter(function (r) { return r[0] && r[7] instanceof Date && r[7].getTime() > limit; }).map(function (r) {
    return { id: String(r[0]), who: String(r[1]), name: String(r[2]), pid: String(r[3]), i: Number(r[4]), recipe: String(r[5]), block: String(r[6]), at: r[7].getTime(), ack: r[8] === true };
  });
}
function api_call(token, pid, i) {
  var me = need_(token);
  return withLock_(function () {
    var p = prodRow_(pid), doc = JSON.parse(p.s.getRange(p.row, 7).getValue()), b = doc.blocks[Number(i)];
    if (!b) throw new Error('Bloc introuvable.');
    var recent = calls_().filter(function (c) { return c.who === me.id && !c.ack && Date.now() - c.at < 60000; });
    if (recent.length) return recent[0].id;
    var id = Utilities.getUuid().slice(0, 8);
    tab_(TAB_CALLS, HEAD_CALLS).appendRow([id, me.id, me.name, pid, Number(i), doc.recipeName, b.name, new Date(), false]);
    var msg = me.name + ' t\'appelle : ' + b.name + ' (' + doc.recipeName + ')';
    try { MailApp.sendEmail(Session.getEffectiveUser().getEmail(), 'BakeScale : ' + me.name + ' appelle le Chef', msg + '\n\n' + linkBase_()); } catch (e) {}
    var topic = props_().getProperty('NTFY_TOPIC');
    if (topic && props_().getProperty('NTFY_ON') === '1') {
      try { UrlFetchApp.fetch('https://ntfy.sh/' + topic, { method: 'post', payload: Utilities.newBlob(msg).getBytes(), headers: { Title: 'BakeScale', Priority: '5', Tags: 'bell' }, muteHttpExceptions: true }); } catch (e) {}
    }
    return id;
  });
}
function api_calls(token) { need_(token, true); return calls_().filter(function (c) { return !c.ack; }); }
function api_ack(token, id) {
  need_(token, true);
  return withLock_(function () {
    var s = tab_(TAB_CALLS, HEAD_CALLS), rows = s.getDataRange().getValues();
    for (var i = 1; i < rows.length; i++) if (String(rows[i][0]) === String(id)) { s.getRange(i + 1, 9).setValue(true); return true; }
    return false;
  });
}
function ntfyInfo_() {
  var p = props_();
  if (!p.getProperty('NTFY_TOPIC')) p.setProperty('NTFY_TOPIC', 'bakescale-' + Utilities.getUuid());
  return { on: p.getProperty('NTFY_ON') === '1', topic: p.getProperty('NTFY_TOPIC') };
}
function api_ntfy(token, on) {
  need_(token, true);
  props_().setProperty('NTFY_ON', on ? '1' : '0');
  return ntfyInfo_();
}

function api_load(token) {
  var me = need_(token), out = board_(me);
  out.me = me; out.rev = revision_(); out.images = schemaIds_(); out.url = linkBase_();
  out.people = people_(me.role === 'chef');
  if (me.role === 'chef') out.ntfy = ntfyInfo_();
  var can = function (t) { return me.tabs.indexOf(t) >= 0; };
  var ss = ss_(), stock = ss.getSheetByName(TAB_STOCK), mat = ss.getSheetByName(TAB_MAT);
  out.recipes = [];
  if (can('dose')) ss.getSheets().forEach(function (s) {
    var name = s.getName();
    if (/^App_/.test(name) || !/^Fiche Recette/i.test(String(s.getRange(1, 1).getValue()))) return;
    out.recipes.push({ title: name, id: String(s.getSheetId()), rows: clean_(s.getDataRange().getValues()) });
  });
  out.stock = stock && can('stock') ? clean_(stock.getDataRange().getValues()).slice(1) : [];
  out.mat = mat && can('mat') ? clean_(mat.getDataRange().getValues()).slice(1) : [];
  out.compare = can('mat') ? compare_() : null;
  return out;
}
function api_board(token) {
  var me = need_(token), out = board_(me);
  out.people = people_(me.role === 'chef');
  return out;
}
function api_rev(token) { need_(token); return revision_(); }

function compare_() {
  var s = ss_().getSheetByName(TAB_CMP); if (!s) return null;
  var r = s.getDataRange(), rich = r.getRichTextValues(), f = r.getFormulas();
  var links = rich.map(function (row, i) {
    return row.map(function (c, j) {
      var u = c.getLinkUrl(); if (u) return u;
      var m = String(f[i][j]).match(/HYPERLINK\("([^"]+)"/i); return m ? m[1] : '';
    });
  });
  return { rows: clean_(r.getValues()), links: links };
}

function api_setQty(token, kind, row, value) {
  need_(token, kind === 'stock' ? 'stock' : 'mat'); row = Number(row);
  if (!(row >= 2)) throw new Error('Ligne invalide.');
  var s = ss_().getSheetByName(kind === 'stock' ? TAB_STOCK : TAB_MAT);
  s.getRange(row, kind === 'stock' ? 3 : 2).setValue(value === null ? '' : Number(value));
  return true;
}
function api_addStock(token, name, qty, unit, min) {
  need_(token, 'stock');
  return withLock_(function () {
    var s = ss_().getSheetByName(TAB_STOCK);
    s.appendRow([String(name), '', Number(qty) || 0, String(unit), min === null ? '' : Number(min)]);
    return true;
  });
}
function api_saveProduction(token, doc) {
  need_(token, true);
  return withLock_(function () {
    var id = Utilities.getUuid().slice(0, 8), json = JSON.stringify(doc);
    if (json.length > 49000) throw new Error('Cette recette est trop longue pour être enregistrée.');
    tab_(TAB_PROD, HEAD_PROD).appendRow([id, doc.recipeName, "'" + doc.date, false, false, new Date(), json]);
    return id;
  });
}
function prodRow_(id) {
  var s = tab_(TAB_PROD, HEAD_PROD), rows = s.getRange(1, 1, s.getLastRow(), 1).getValues();
  for (var i = 1; i < rows.length; i++) if (String(rows[i][0]) === String(id)) return { s: s, row: i + 1 };
  throw new Error('Production introuvable.');
}
function api_deleteProduction(token, id) {
  need_(token, true);
  return withLock_(function () { var p = prodRow_(id); p.s.deleteRow(p.row); return true; });
}
/* lines: [{row, name, qty}] ; recontrôle le nom et la quantité dans la Sheet avant de déduire. */
function api_finishProduction(token, id, lines) {
  need_(token, true);
  return withLock_(function () {
    var p = prodRow_(id);
    if (p.s.getRange(p.row, 5).getValue() === true) throw new Error('Le stock de cette production est déjà déduit.');
    var stock = ss_().getSheetByName(TAB_STOCK), done = 0;
    (lines || []).forEach(function (l) {
      var r = stock.getRange(Number(l.row), 1, 1, 3).getValues()[0];
      if (String(r[0]) !== String(l.name) || typeof r[2] !== 'number') return;
      stock.getRange(Number(l.row), 3).setValue(Math.max(0, Math.round((r[2] - Number(l.qty)) * 1000) / 1000));
      done++;
    });
    p.s.getRange(p.row, 4, 1, 2).setValues([[true, true]]);
    return done;
  });
}
function api_status(token, pid, i, patch) {
  var me = need_(token);
  return withLock_(function () {
    var p = prodRow_(pid), doc = JSON.parse(p.s.getRange(p.row, 7).getValue()), s = tab_(TAB_STATUS, HEAD_STATUS);
    var key = pid + '~' + i, rows = s.getDataRange().getValues(), at = -1;
    for (var k = 1; k < rows.length; k++) if (rows[k][0] === key) at = k + 1;
    var cur = at > 0 ? rows[at - 1] : [key, pid, Number(i), 'todo', '', '', ''];
    var who = ((doc.assign || {})[i] || {}).id || cur[5];
    if (me.role !== 'chef' && !accepted_(me.id, rules_().version)) throw new Error('Valide d\'abord les règles d\'hygiène et le règlement.');
    if (me.role !== 'chef' && who && who !== me.id) throw new Error('Ce bloc est confié à une autre personne.');
    if (patch.claim) { if (who && who !== me.id) throw new Error('Ce bloc est déjà pris.'); cur[5] = me.id; }
    else if (me.role !== 'chef' && !who) throw new Error('Prends d\'abord ce bloc.');
    if (patch.state === 'todo' || patch.state === 'doing' || patch.state === 'done') cur[3] = patch.state;
    if (typeof patch.comment === 'string') cur[4] = patch.comment.slice(0, 500);
    cur[6] = new Date();
    if (at > 0) s.getRange(at, 1, 1, cur.length).setValues([cur]); else s.appendRow(cur);
    return true;
  });
}
function api_invite(token, name, phone, mail, tabs) {
  need_(token, true);
  return withLock_(function () {
    var s = invTab_(), id = 'p' + Utilities.getUuid().slice(0, 8), jeton = Utilities.getUuid(), url = linkBase_() + '?i=' + jeton, t = tabsOf_((tabs || []).join(','));
    s.appendRow([id, String(name), "'" + String(phone || ''), String(mail || ''), jeton, true, new Date(), url, t.join(',')]);
    return { id: id, name: String(name), phone: String(phone || ''), mail: String(mail || ''), url: url, active: true, tabs: t };
  });
}
// Ajoute l'en-tête « Onglets » aux anciens onglets App_Invites.
function invTab_() {
  var s = tab_(TAB_INV, HEAD_INV);
  if (String(s.getRange(1, 9).getValue()) !== 'Onglets') s.getRange(1, 9).setValue('Onglets').setFontWeight('bold');
  return s;
}
function invRow_(s, id) {
  var ids = s.getRange(1, 1, s.getLastRow(), 1).getValues();
  for (var i = 1; i < ids.length; i++) if (ids[i][0] === id && id !== 'chef') return i + 1;
  throw new Error('Personne introuvable.');
}
function api_setTabs(token, id, tabs) {
  need_(token, true);
  return withLock_(function () { var s = invTab_(), t = tabsOf_((tabs || []).join(',')); s.getRange(invRow_(s, id), 9).setValue(t.join(',')); return t; });
}
function api_restore(token, id) {
  need_(token, true);
  return withLock_(function () { var s = invTab_(); s.getRange(invRow_(s, id), 6).setValue(true); return true; });
}
// Supprime définitivement la ligne : le lien ne pourra plus jamais servir.
function api_remove(token, id) {
  need_(token, true);
  return withLock_(function () { var s = invTab_(); s.deleteRow(invRow_(s, id)); return true; });
}
function api_revoke(token, id) {
  need_(token, true);
  return withLock_(function () {
    var s = tab_(TAB_INV, HEAD_INV), rows = s.getDataRange().getValues();
    for (var i = 1; i < rows.length; i++) if (rows[i][0] === id && id !== 'chef') { s.getRange(i + 1, 6).setValue(false); return true; }
    return false;
  });
}

/* ---------- Schémas : les images posées sur les onglets sont extraites de l'export xlsx puis rangées dans Drive. ---------- */
function folder_() {
  var p = props_(), id = p.getProperty('FOLDER_ID');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) {} }
  var f = DriveApp.createFolder('BakeScale Schémas');
  p.setProperty('FOLDER_ID', f.getId());
  return f;
}
function schemaIds_() {
  var ids = [], it = folder_().getFiles();
  while (it.hasNext()) ids.push(it.next().getName().replace(/\..*$/, ''));
  return ids;
}
function api_schema(token, sheetId) {
  need_(token);
  var it = folder_().getFiles();
  while (it.hasNext()) {
    var f = it.next();
    if (f.getName().replace(/\..*$/, '') === String(sheetId)) return 'data:' + f.getMimeType() + ';base64,' + Utilities.base64Encode(f.getBlob().getBytes());
  }
  return '';
}
function api_importSchemas(token) { need_(token, true); return importSchemas_(); }
function attr_(tag, name) { var m = tag.match(new RegExp('(?:^|\\s)' + name + '="([^"]*)"')); return m ? m[1] : ''; }
function rels_(files, path) {
  var b = files[path]; if (!b) return [];
  return (b.getDataAsString('UTF-8').match(/<Relationship\s[^>]*>/g) || []).map(function (t) { return { id: attr_(t, 'Id'), type: attr_(t, 'Type'), target: attr_(t, 'Target') }; });
}
function resolve_(base, t) {
  var parts = (t.charAt(0) === '/' ? t.slice(1) : base + t).split('/'), out = [];
  parts.forEach(function (s) { if (s === '..') out.pop(); else out.push(s); });
  return out.join('/');
}
function unxml_(s) { return s.replace(/&amp;/g, '&').replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>'); }
function importSchemas_() {
  var res = UrlFetchApp.fetch('https://docs.google.com/spreadsheets/d/' + SHEET_ID + '/export?format=xlsx', { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error('Export de la Sheet refusé (' + res.getResponseCode() + ').');
  var files = {};
  Utilities.unzip(res.getBlob().setContentType('application/zip')).forEach(function (b) { files[b.getName()] = b; });
  // L'export coupe les noms à 31 caractères : les onglets sont donc repérés par leur position.
  var order = ss_().getSheets().map(function (s) { return String(s.getSheetId()); });
  var wbr = rels_(files, 'xl/_rels/workbook.xml.rels'), folder = folder_(), count = 0;
  (files['xl/workbook.xml'].getDataAsString('UTF-8').match(/<sheet\s[^>]*>/g) || []).forEach(function (tag, k) {
    var id = order[k]; if (!id) return;
    var wr = wbr.filter(function (r) { return r.id === attr_(tag, 'r:id'); })[0]; if (!wr) return;
    var fname = resolve_('xl/', wr.target).split('/').pop();
    var dr = rels_(files, 'xl/worksheets/_rels/' + fname + '.rels').filter(function (r) { return /drawing$/.test(r.type); })[0]; if (!dr) return;
    var dname = resolve_('xl/worksheets/', dr.target).split('/').pop();
    var im = rels_(files, 'xl/drawings/_rels/' + dname + '.rels').filter(function (r) { return /image$/.test(r.type); })[0]; if (!im) return;
    var blob = files[resolve_('xl/drawings/', im.target)]; if (!blob) return;
    var ext = /\.jpe?g$/i.test(blob.getName()) ? 'jpg' : 'png', old = folder.getFiles();
    while (old.hasNext()) { var f = old.next(); if (f.getName().replace(/\..*$/, '') === id) f.setTrashed(true); }
    folder.createFile(blob.copyBlob().setName(id + '.' + ext).setContentType(ext === 'jpg' ? 'image/jpeg' : 'image/png'));
    count++;
  });
  return count;
}
