import CryptoJS from 'crypto-js';

const KEY_TEXT = 'wrdvpnisthebest!';
const GATEWAY_HOST = 'd.buaa.edu.cn';

function encryptHost(host: string): string {
  const key = CryptoJS.enc.Utf8.parse(KEY_TEXT);
  const iv = CryptoJS.enc.Utf8.parse(KEY_TEXT);
  const plain = CryptoJS.enc.Utf8.parse(host);
  const padding = (16 - (plain.sigBytes % 16)) % 16;
  const padded = plain.clone();
  padded.concat(CryptoJS.enc.Utf8.parse('0'.repeat(padding)));
  const encrypted = CryptoJS.AES.encrypt(padded, key, {
    iv,
    mode: CryptoJS.mode.CFB,
    padding: CryptoJS.pad.NoPadding,
  });
  const cipherHex = encrypted.ciphertext.toString(CryptoJS.enc.Hex);
  return wordArrayHex(iv) + cipherHex.slice(0, plain.sigBytes * 2);
}

function decryptHost(encoded: string): string {
  const iv = CryptoJS.enc.Hex.parse(encoded.slice(0, 32));
  const cipherHex = encoded.slice(32);
  const cipher = CryptoJS.enc.Hex.parse(cipherHex);
  const decrypted = CryptoJS.AES.decrypt(
    CryptoJS.lib.CipherParams.create({ ciphertext: cipher }),
    CryptoJS.enc.Utf8.parse(KEY_TEXT),
    {
      iv,
      mode: CryptoJS.mode.CFB,
      padding: CryptoJS.pad.NoPadding,
    },
  );
  return CryptoJS.enc.Utf8.stringify(decrypted);
}

function wordArrayHex(value: CryptoJS.lib.WordArray): string {
  return value.toString(CryptoJS.enc.Hex);
}

export function toWebVpnUrl(rawUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return rawUrl;
  }
  if (parsed.hostname.toLowerCase() === GATEWAY_HOST) return rawUrl;

  const port = parsed.port;
  const protocolPart =
    (parsed.protocol === 'http:' && (!port || port === '80')) ||
    (parsed.protocol === 'https:' && (!port || port === '443'))
      ? parsed.protocol.slice(0, -1)
      : `${parsed.protocol.slice(0, -1)}${port ? `-${port}` : ''}`;

  return `https://${GATEWAY_HOST}/${protocolPart}/${encryptHost(parsed.hostname)}${parsed.pathname}${parsed.search}${parsed.hash}`;
}

export function fromWebVpnUrl(rawUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return rawUrl;
  }
  if (parsed.hostname.toLowerCase() !== GATEWAY_HOST) return rawUrl;

  const pathMatch = /^\/([^/]+)\/([^/]+)(\/.*)?$/.exec(parsed.pathname);
  if (!pathMatch) return rawUrl;
  const [, protocolPart, encodedHost, path = ''] = pathMatch;
  const [scheme, port] = protocolPart.split('-', 2);
  try {
    const host = decryptHost(encodedHost);
    return `${scheme}://${host}${port ? `:${port}` : ''}${path}${parsed.search}${parsed.hash}`;
  } catch {
    return rawUrl;
  }
}

export function isWebVpnUrl(rawUrl: string): boolean {
  try {
    return new URL(rawUrl).hostname.toLowerCase() === GATEWAY_HOST;
  } catch {
    return false;
  }
}
