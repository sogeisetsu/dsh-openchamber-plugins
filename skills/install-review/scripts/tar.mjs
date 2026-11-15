// Minimal, defensive tar(.gz) reader used by the pre-install reviewer.
// No third-party deps, no shelling out, no execution of package content.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { gunzipSync } from 'node:zlib';

const BLOCK = 512;

function readString(buf, off, len) {
  return buf.toString('latin1', off, off + len).replace(/\0[\s\S]*$/, '').trim();
}

function readNumber(buf, off, len) {
  const raw = buf.subarray(off, off + len);
  if (raw.length === 0) return 0;
  // base-256 encoding
  if (raw[0] & 0x80) {
    let n = 0;
    for (let i = 0; i < raw.length; i += 1) n = n * 256 + (i === 0 ? raw[i] & 0x7f : raw[i]);
    return n;
  }
  const s = readString(buf, off, len);
  const n = parseInt(s, 8);
  return Number.isFinite(n) ? n : 0;
}

/** Strip the archive root dir (e.g. "package/") and reject traversal. */
export function sanitizeRelPath(raw, strip = 0) {
  let p = String(raw || '').replace(/\\/g, '/');
  p = p.replace(/^\/+/, '');
  const parts = p.split('/').filter((x) => x && x !== '.');
  if (parts.some((x) => x === '..')) return null;
  if (parts.some((x) => /^[a-zA-Z]:$/.test(x))) return null;
  const out = parts.slice(strip);
  if (out.length === 0) return null;
  return out.join('/');
}

function parsePax(data) {
  const out = {};
  let pos = 0;
  while (pos < data.length) {
    const sp = data.indexOf(0x20, pos);
    if (sp === -1) break;
    const len = parseInt(data.toString('latin1', pos, sp), 10);
    if (!Number.isFinite(len) || len <= 0) break;
    const rec = data.toString('utf8', sp + 1, pos + len - 1);
    const eq = rec.indexOf('=');
    if (eq > 0) out[rec.slice(0, eq)] = rec.slice(eq + 1);
    pos += len;
  }
  return out;
}

/**
 * @returns {{entries: {path:string,size:number}[], skipped: {path:string,reason:string}[]}}
 */
export function extractTarGz(buffer, destDir, options = {}) {
  const { strip = 0, maxBytes = 200 * 1024 * 1024, maxFiles = 20000 } = options;
  const tar = gunzipSync(buffer);
  const entries = [];
  const skipped = [];
  let pos = 0;
  let totalBytes = 0;
  let longName = null;
  let pax = null;

  while (pos + BLOCK <= tar.length) {
    const header = tar.subarray(pos, pos + BLOCK);
    if (header.every((b) => b === 0)) break;

    const size = readNumber(header, 124, 12);
    const typeflag = String.fromCharCode(header[156] || 0x30);
    const prefix = readString(header, 345, 155);
    const nameField = readString(header, 0, 100);
    const bodyStart = pos + BLOCK;
    const body = tar.subarray(bodyStart, bodyStart + size);
    pos = bodyStart + Math.ceil(size / BLOCK) * BLOCK;

    if (typeflag === 'L') {
      longName = body.toString('utf8').replace(/\0[\s\S]*$/, '');
      continue;
    }
    if (typeflag === 'x' || typeflag === 'g') {
      const parsed = parsePax(body);
      if (typeflag === 'x') pax = parsed;
      continue;
    }

    let fullName = pax?.path || longName || (prefix ? `${prefix}/${nameField}` : nameField);
    longName = null;
    pax = null;

    const rel = sanitizeRelPath(fullName, strip);
    if (!rel) {
      skipped.push({ path: fullName, reason: 'unsafe-path' });
      continue;
    }

    if (typeflag === '5') {
      mkdirSync(join(destDir, rel), { recursive: true });
      continue;
    }
    if (typeflag === '1' || typeflag === '2') {
      skipped.push({ path: rel, reason: typeflag === '1' ? 'hardlink' : 'symlink' });
      continue;
    }
    if (typeflag !== '0' && typeflag !== '\0' && typeflag !== '7') {
      skipped.push({ path: rel, reason: `type-${typeflag}` });
      continue;
    }

    totalBytes += size;
    if (totalBytes > maxBytes) throw new Error('archive too large after extraction (possible zip bomb)');
    if (entries.length >= maxFiles) throw new Error('archive has too many files');

    const target = join(destDir, rel);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, body);
    entries.push({ path: rel, size });
  }

  return { entries, skipped };
}
