// 管理后台的两步验证（TOTP，Google Authenticator / Microsoft Authenticator 等通用）
// 以及登录后的短期会话（8 小时），会话用服务器密钥签名，改不了、造不出来。
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Decode(s) {
  const clean = String(s || '').toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let val = 0;
  const out = [];
  for (const c of clean) {
    val = (val << 5) | B32.indexOf(c);
    bits += 5;
    if (bits >= 8) {
      out.push((val >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

export async function totpAt(secretB32, counter) {
  const key = await crypto.subtle.importKey('raw', base32Decode(secretB32), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const msg = new Uint8Array(8);
  let c = counter;
  for (let i = 7; i >= 0; i--) {
    msg[i] = c & 255;
    c = Math.floor(c / 256);
  }
  const h = new Uint8Array(await crypto.subtle.sign('HMAC', key, msg));
  const o = h[19] & 15;
  const n = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1e6).padStart(6, '0');
}

/** 验证 6 位数字：允许前后各差 30 秒（手机时间稍有误差） */
export async function verifyTotp(secretB32, code, now = Date.now()) {
  if (!/^\d{6}$/.test(String(code || '')) || base32Decode(secretB32).length < 10) return false;
  const c = Math.floor(now / 30000);
  for (const d of [-1, 0, 1]) if ((await totpAt(secretB32, c + d)) === code) return true;
  return false;
}

const b64u = (u8) => btoa(String.fromCharCode(...u8)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
async function hmac(keyText, msg) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(keyText), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg)));
}
export const SESSION_MS = 8 * 3600e3;

/** 发一个会话：过期时间 + 签名 */
export async function makeSession(serverKey, now = Date.now()) {
  const payload = String(now + SESSION_MS);
  return payload + '.' + b64u(await hmac(serverKey, 'session:' + payload));
}

export async function checkSession(serverKey, token, now = Date.now()) {
  const m = /^(\d{13})\.([A-Za-z0-9_-]{43})$/.exec(String(token || ''));
  if (!m || Number(m[1]) < now || Number(m[1]) > now + SESSION_MS + 60e3) return false;
  const want = b64u(await hmac(serverKey, 'session:' + m[1]));
  let d = want.length ^ m[2].length;
  for (let i = 0; i < Math.min(want.length, m[2].length); i++) d |= want.charCodeAt(i) ^ m[2].charCodeAt(i);
  return d === 0;
}
