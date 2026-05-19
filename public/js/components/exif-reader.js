/**
 * exif-reader.js — JPEG EXIF 메타데이터(촬영시각·GPS) 파서
 *
 * 외부 라이브러리 없이 JPEG APP1(Exif) 세그먼트를 직접 파싱한다.
 * 사진의 위변조 방어를 위해 촬영시각·위치 정보를 보존한다 (PRD §4.3).
 *
 * 파싱 실패 시에도 절대 throw 하지 않고 { capturedAt: null, gps: null } 을 반환한다.
 */

function readAscii(view, offset, length) {
  let str = '';
  for (let i = 0; i < length; i++) {
    const code = view.getUint8(offset + i);
    if (code === 0) break;
    str += String.fromCharCode(code);
  }
  return str;
}

const TYPE_SIZE = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };

/** IFD(Image File Directory)를 읽어 { tag: {type,count,valueOffset} } 맵을 만든다. */
function readIfd(view, ifdOffset, tiffStart, little) {
  const entries = {};
  const count = view.getUint16(ifdOffset, little);
  for (let i = 0; i < count; i++) {
    const entry = ifdOffset + 2 + i * 12;
    if (entry + 12 > view.byteLength) break;
    const tag = view.getUint16(entry, little);
    const type = view.getUint16(entry + 2, little);
    const num = view.getUint32(entry + 4, little);
    const byteLength = (TYPE_SIZE[type] || 1) * num;
    const valueOffset = byteLength <= 4 ? entry + 8 : tiffStart + view.getUint32(entry + 8, little);
    entries[tag] = { type, count: num, valueOffset };
  }
  return entries;
}

function readRational(view, offset, little) {
  const numerator = view.getUint32(offset, little);
  const denominator = view.getUint32(offset + 4, little);
  return denominator ? numerator / denominator : 0;
}

/** "YYYY:MM:DD HH:MM:SS" → Date */
function parseExifDate(str) {
  const m = String(str).match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
  return isNaN(d.getTime()) ? null : d;
}

function readGps(view, gpsEntries, tiffStart, little) {
  try {
    const lat = gpsEntries[2];
    const lng = gpsEntries[4];
    const latRef = gpsEntries[1];
    const lngRef = gpsEntries[4 - 1]; // tag 3
    if (!lat || !lng) return null;

    const dms = (entry) => {
      const o = entry.valueOffset;
      return (
        readRational(view, o, little) +
        readRational(view, o + 8, little) / 60 +
        readRational(view, o + 16, little) / 3600
      );
    };
    let latitude = dms(lat);
    let longitude = dms(lng);
    if (latRef && readAscii(view, latRef.valueOffset, 2).toUpperCase().startsWith('S')) latitude = -latitude;
    if (lngRef && readAscii(view, lngRef.valueOffset, 2).toUpperCase().startsWith('W')) longitude = -longitude;
    if (!latitude && !longitude) return null;
    return { lat: +latitude.toFixed(6), lng: +longitude.toFixed(6) };
  } catch {
    return null;
  }
}

/**
 * 파일에서 EXIF 촬영시각·GPS 를 읽는다.
 * @param {File|Blob} file
 * @returns {Promise<{capturedAt: Date|null, gps: {lat:number,lng:number}|null}>}
 */
export async function readExif(file) {
  const empty = { capturedAt: null, gps: null };
  try {
    if (!file || !/jpe?g/i.test(file.type || '')) return empty;
    const buffer = await file.arrayBuffer();
    const view = new DataView(buffer);
    if (view.byteLength < 12 || view.getUint16(0) !== 0xffd8) return empty;

    // APP1(Exif) 세그먼트 탐색
    let offset = 2;
    let app1 = -1;
    while (offset + 4 < view.byteLength) {
      if (view.getUint8(offset) !== 0xff) break;
      const marker = view.getUint8(offset + 1);
      if (marker === 0xda || marker === 0xd9) break; // SOS / EOI
      const segmentSize = view.getUint16(offset + 2);
      if (marker === 0xe1 && readAscii(view, offset + 4, 4) === 'Exif') {
        app1 = offset + 4;
        break;
      }
      offset += 2 + segmentSize;
    }
    if (app1 < 0) return empty;

    const tiff = app1 + 6; // "Exif\0\0" 이후
    const little = readAscii(view, tiff, 2) === 'II';
    if (view.getUint16(tiff + 2, little) !== 0x002a) return empty;

    const ifd0Offset = tiff + view.getUint32(tiff + 4, little);
    const ifd0 = readIfd(view, ifd0Offset, tiff, little);

    let capturedAt = null;
    let gps = null;

    // Exif SubIFD → DateTimeOriginal(0x9003)
    if (ifd0[0x8769]) {
      const exifIfd = readIfd(view, tiff + view.getUint32(ifd0[0x8769].valueOffset, little), tiff, little);
      const dto = exifIfd[0x9003] || exifIfd[0x9004];
      if (dto) capturedAt = parseExifDate(readAscii(view, dto.valueOffset, dto.count));
    }
    // DateTime(0x0132) 폴백
    if (!capturedAt && ifd0[0x0132]) {
      capturedAt = parseExifDate(readAscii(view, ifd0[0x0132].valueOffset, ifd0[0x0132].count));
    }
    // GPS IFD(0x8825)
    if (ifd0[0x8825]) {
      const gpsIfd = readIfd(view, tiff + view.getUint32(ifd0[0x8825].valueOffset, little), tiff, little);
      gps = readGps(view, gpsIfd, tiff, little);
    }

    return { capturedAt, gps };
  } catch {
    return empty;
  }
}
