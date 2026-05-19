/**
 * image-compressor.js — 이미지 자동 압축 + 썸네일 생성
 *
 * - 긴 변 1280px, 500KB 이하로 자동 압축 (JPEG 품질 자동 조정)
 * - 200px 썸네일 생성
 * - 가로/세로 비율 유지
 * - EXIF(촬영시각·GPS) 메타데이터 추출 및 보존
 *
 * 의존성: browser-image-compression (CDN의 전역 변수 window.imageCompression)
 */

import { readExif } from './exif-reader.js';

const MAX_SIZE_MB = 0.5;          // 500KB
const MAX_DIMENSION = 1280;       // 긴 변
const THUMBNAIL_DIMENSION = 200;

const COMPRESS_OPTIONS = {
  maxSizeMB: MAX_SIZE_MB,
  maxWidthOrHeight: MAX_DIMENSION,
  useWebWorker: true,
  fileType: 'image/jpeg',
  initialQuality: 0.85,
  preserveExif: true, // 압축 후에도 EXIF 보존
};

const THUMBNAIL_OPTIONS = {
  maxSizeMB: 0.05,
  maxWidthOrHeight: THUMBNAIL_DIMENSION,
  useWebWorker: true,
  fileType: 'image/jpeg',
  initialQuality: 0.7,
};

/** 바이트 수를 사람이 읽기 쉬운 문자열로 변환 */
export function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/** Blob/File 의 픽셀 크기를 구한다. */
function getImageDimensions(blob) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
      URL.revokeObjectURL(url);
    };
    image.onerror = () => {
      resolve({ width: 0, height: 0 });
      URL.revokeObjectURL(url);
    };
    image.src = url;
  });
}

/**
 * 이미지를 압축한다.
 * @param {File} file 원본 이미지 파일
 * @param {{ onProgress?: (percent:number)=>void }} [opts]
 * @returns {Promise<{compressedFile: File, thumbnail: File, metadata: object}>}
 */
export async function compressImage(file, { onProgress } = {}) {
  if (typeof window.imageCompression !== 'function') {
    throw new Error('browser-image-compression 라이브러리가 로드되지 않았습니다.');
  }
  if (!file || !String(file.type).startsWith('image/')) {
    throw new Error('이미지 파일이 아닙니다.');
  }

  const report = (p) => { if (typeof onProgress === 'function') onProgress(Math.round(p)); };
  report(0);

  // EXIF 추출 (원본 기준)
  const exif = await readExif(file);

  // 본 이미지 압축 (0~80% 구간)
  const compressedFile = await window.imageCompression(file, {
    ...COMPRESS_OPTIONS,
    onProgress: (p) => report(p * 0.8),
  });

  // 썸네일 생성 (압축본 기준, 80~100% 구간)
  const thumbnail = await window.imageCompression(compressedFile, {
    ...THUMBNAIL_OPTIONS,
    onProgress: (p) => report(80 + p * 0.2),
  });
  report(100);

  const dimensions = await getImageDimensions(compressedFile);
  const capturedAt = exif.capturedAt
    ? exif.capturedAt.toISOString()
    : new Date(file.lastModified || Date.now()).toISOString();

  return {
    compressedFile,
    thumbnail,
    metadata: {
      name: file.name,
      type: compressedFile.type,
      originalSize: file.size,
      resizedSize: compressedFile.size,
      thumbnailSize: thumbnail.size,
      width: dimensions.width,
      height: dimensions.height,
      capturedAt,
      gps: exif.gps,
    },
  };
}

/**
 * 여러 이미지를 순차 압축한다.
 * @param {File[]} files
 * @param {{ onItemProgress?: (index:number, percent:number)=>void, onItemDone?: (index:number, result:object)=>void }} [opts]
 */
export async function compressImages(files, { onItemProgress, onItemDone } = {}) {
  const results = [];
  for (let i = 0; i < files.length; i++) {
    const result = await compressImage(files[i], {
      onProgress: (p) => onItemProgress && onItemProgress(i, p),
    });
    results.push(result);
    if (onItemDone) onItemDone(i, result);
  }
  return results;
}
