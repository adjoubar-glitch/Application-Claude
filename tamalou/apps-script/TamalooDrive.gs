/**
 * Pont Google Drive pour Tamalou.
 * Range les sons, images de cartes, animations et le paramétrage de l'espace Admin
 * dans le dossier "Tamaloo" de TON Google Drive.
 *
 * Installation (5 minutes) : voir tamalou/README.md, section "Stockage dans Google Drive".
 * 1. script.google.com > Nouveau projet > colle ce fichier.
 * 2. Paramètres du projet > Propriétés du script > ajoute TAMALOU_KEY = une longue phrase secrète.
 * 3. Déployer > Nouveau déploiement > Application Web : Exécuter en tant que "Moi",
 *    Accès "Tout le monde". Copie l'URL : c'est DRIVE_BRIDGE_URL.
 */

var FOLDER_NAME = 'Tamaloo';

function doPost(e) {
  try {
    var req = JSON.parse(e.postData.contents);
    var key = PropertiesService.getScriptProperties().getProperty('TAMALOU_KEY');
    if (!key || req.key !== key) return reply({ ok: false, error: 'clé invalide' });
    var folder = getFolder();
    switch (req.action) {
      case 'list':
        return reply({ ok: true, files: listFiles(folder) });
      case 'get': {
        var f = findFile(folder, req.name);
        if (!f) return reply({ ok: false, error: 'introuvable : ' + req.name });
        return reply({ ok: true, base64: Utilities.base64Encode(f.getBlob().getBytes()) });
      }
      case 'put': {
        var blob = Utilities.newBlob(Utilities.base64Decode(req.base64), req.mimeType || 'application/octet-stream', req.name);
        var old = findFile(folder, req.name);
        if (old) old.setTrashed(true);
        folder.createFile(blob);
        return reply({ ok: true });
      }
      case 'delete': {
        var g = findFile(folder, req.name);
        if (g) g.setTrashed(true);
        return reply({ ok: true });
      }
      default:
        return reply({ ok: false, error: 'action inconnue' });
    }
  } catch (err) {
    return reply({ ok: false, error: String(err) });
  }
}

function doGet() {
  return reply({ ok: true, message: 'Pont Drive Tamalou actif. Dossier : ' + getFolder().getName() });
}

function getFolder() {
  var it = DriveApp.getRootFolder().getFoldersByName(FOLDER_NAME);
  return it.hasNext() ? it.next() : DriveApp.getRootFolder().createFolder(FOLDER_NAME);
}

function findFile(folder, name) {
  var it = folder.getFilesByName(name);
  return it.hasNext() ? it.next() : null;
}

function listFiles(folder) {
  var out = [];
  var it = folder.getFiles();
  while (it.hasNext()) {
    var f = it.next();
    out.push({ name: f.getName(), size: f.getSize() });
  }
  return out;
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
