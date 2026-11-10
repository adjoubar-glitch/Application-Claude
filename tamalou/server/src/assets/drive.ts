// Pont vers Google Drive via un script Google Apps Script déployé en application web
// (voir apps-script/TamalooDrive.gs). Le script range tout dans le dossier "Tamaloo".

export interface DriveEntry {
  name: string;
  size: number;
}

export interface DriveBridge {
  list(): Promise<DriveEntry[]>;
  get(name: string): Promise<Buffer>;
  put(name: string, mimeType: string, body: Buffer): Promise<void>;
  remove(name: string): Promise<void>;
}

export function driveBridgeFromEnv(): DriveBridge | null {
  const url = process.env.DRIVE_BRIDGE_URL;
  const key = process.env.DRIVE_BRIDGE_KEY;
  if (!url || !key) return null;
  return new AppsScriptBridge(url, key);
}

class AppsScriptBridge implements DriveBridge {
  constructor(
    private url: string,
    private key: string,
  ) {}

  private async call<T>(action: string, extra: Record<string, unknown> = {}): Promise<T> {
    // Apps Script répond par une redirection : fetch la suit (en GET), c'est le comportement voulu.
    const res = await fetch(this.url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ key: this.key, action, ...extra }),
      redirect: 'follow',
    });
    const text = await res.text();
    let data: { ok: boolean; error?: string } & T;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`réponse inattendue du script Drive (HTTP ${res.status})`);
    }
    if (!data.ok) throw new Error(data.error ?? 'erreur Drive');
    return data;
  }

  async list() {
    return (await this.call<{ files: DriveEntry[] }>('list')).files;
  }

  async get(name: string) {
    return Buffer.from((await this.call<{ base64: string }>('get', { name })).base64, 'base64');
  }

  async put(name: string, mimeType: string, body: Buffer) {
    await this.call('put', { name, mimeType, base64: body.toString('base64') });
  }

  async remove(name: string) {
    await this.call('delete', { name });
  }
}
