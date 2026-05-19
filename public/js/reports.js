/**
 * reports.js — 보고서 생성 (DOCX · XLSX)
 *
 * docx.js / SheetJS 를 CDN 에서 동적 로드하여
 * 워드(서식 중심) · 엑셀(수치 중심) 보고서를 생성한다.
 */

import { TOTAL_STAGES, STAGES } from './stages.js';
import { calcProgress, formatBudget, formatDate } from './projects.js';
import { PROJECT_STATUS } from './constants.js';

const DOCX_CDN = 'https://cdn.jsdelivr.net/npm/docx@8.5.0/build/index.umd.js';
const XLSX_CDN = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if ([...document.scripts].some((s) => s.src === src)) return resolve();
    const el = document.createElement('script');
    el.src = src;
    el.onload = resolve;
    el.onerror = () => reject(new Error('스크립트 로드 실패: ' + src));
    document.head.appendChild(el);
  });
}

async function getDocx() {
  if (!window.docx) await loadScript(DOCX_CDN);
  if (!window.docx) throw new Error('docx 라이브러리를 불러오지 못했습니다.');
  return window.docx;
}
async function getXLSX() {
  if (!window.XLSX) await loadScript(XLSX_CDN);
  if (!window.XLSX) throw new Error('SheetJS 라이브러리를 불러오지 못했습니다.');
  return window.XLSX;
}

/** Blob 을 파일로 다운로드한다. */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function dateStamp() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

/* ============================================================
 * DOCX — 사업 추진 현황 보고서
 * ============================================================ */

export async function generateProjectStatusDocx(project) {
  const docx = await getDocx();
  const {
    Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
    Table, TableRow, TableCell, WidthType, BorderStyle,
  } = docx;

  const b = project.basicInfo;
  const m = project.members || {};

  const heading = (text) => new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 120 },
    children: [new TextRun({ text, bold: true })],
  });
  const line = (label, value) => new Paragraph({
    spacing: { after: 60 },
    children: [
      new TextRun({ text: `${label}: `, bold: true }),
      new TextRun({ text: String(value == null || value === '' ? '-' : value) }),
    ],
  });

  const cell = (text, opts = {}) => new TableCell({
    width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    shading: opts.header ? { fill: 'E8EDF3' } : undefined,
    children: [new Paragraph({
      alignment: opts.center ? AlignmentType.CENTER : AlignmentType.LEFT,
      children: [new TextRun({ text: String(text), bold: !!opts.header, size: 18 })],
    })],
  });
  const stageRows = [
    new TableRow({ children: [
      cell('단계', { header: true, center: true, width: 12 }),
      cell('명칭', { header: true, center: true, width: 28 }),
      cell('상태', { header: true, center: true, width: 20 }),
      cell('진입일', { header: true, center: true, width: 20 }),
      cell('완료일', { header: true, center: true, width: 20 }),
    ] }),
    ...STAGES.map((s) => {
      const stg = (project.stages && project.stages[s.number]) || {};
      const statusText = stg.status === 'completed' ? '완료' : stg.status === 'in_progress' ? '진행 중' : '대기';
      return new TableRow({ children: [
        cell(s.number, { center: true }),
        cell(s.name),
        cell(statusText, { center: true }),
        cell(stg.startedAt ? formatDate(stg.startedAt) : '-', { center: true }),
        cell(stg.completedAt ? formatDate(stg.completedAt) : '-', { center: true }),
      ] });
    }),
  ];

  const doc = new Document({
    styles: { default: { document: { run: { font: '맑은 고딕', size: 20 } } } },
    sections: [{
      children: [
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 },
          children: [new TextRun({ text: '시설공사 통합관리시스템', size: 18, color: '888888' })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 400 },
          children: [new TextRun({ text: '사업 추진 현황 보고서', bold: true, size: 36 })] }),

        heading('1. 사업 개요'),
        line('사업명', b.name),
        line('사업 ID', project.projectId),
        line('사업 유형', b.type),
        line('발주 부서', b.department),
        line('총사업비', formatBudget(b.totalBudget)),
        line('회계연도', b.fiscalYear),
        line('사업 위치', (project.location && project.location.address) || '-'),
        line('진행률', calcProgress(project) + '%'),
        line('사업 상태', PROJECT_STATUS[project.status] || project.status),

        heading('2. 단계별 진행 현황'),
        new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: stageRows }),
        new Paragraph({ spacing: { before: 80 },
          children: [new TextRun({ text: `현재 단계: ${project.currentStage}. ${STAGES[project.currentStage - 1] ? STAGES[project.currentStage - 1].name : '-'}`, bold: true })] }),

        heading('3. 참여자 정보'),
        line('담당자', m.officer && m.officer.name),
        line('과장', m.manager && m.manager.name),
        line('시공사', m.contractor && m.contractor.company),
        line('감리', m.supervisor && m.supervisor.company),

        heading('4. 사업 일정'),
        line('착수 예정일', formatDate(b.startDate)),
        line('준공 예정일', formatDate(b.endDate)),

        new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { before: 600 },
          children: [new TextRun({ text: `발행일: ${formatDate(new Date().toISOString())}`, size: 18, color: '888888' })] }),
        new Paragraph({ alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: '발행처: 도시주택국', size: 18, color: '888888' })] }),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  return { blob, filename: `${b.name}_사업추진현황보고서_${dateStamp()}.docx` };
}

/* ============================================================
 * XLSX — 사업 일람
 * ============================================================ */

export async function generateProjectListXlsx(projects) {
  const XLSX = await getXLSX();

  const header = ['사업ID', '사업명', '유형', '발주부서', '현재단계', '진행률(%)', '총사업비(원)', '착수일', '준공예정일', '담당자', '상태'];
  const rows = projects.map((p) => [
    p.projectId,
    p.basicInfo.name,
    p.basicInfo.type,
    p.basicInfo.department,
    `${p.currentStage}. ${STAGES[p.currentStage - 1] ? STAGES[p.currentStage - 1].name : ''}`,
    calcProgress(p),
    p.basicInfo.totalBudget || 0,
    p.basicInfo.startDate || '',
    p.basicInfo.endDate || '',
    (p.members && p.members.officer && p.members.officer.name) || '',
    PROJECT_STATUS[p.status] || p.status,
  ]);
  const ws1 = XLSX.utils.aoa_to_sheet([header, ...rows]);
  ws1['!cols'] = header.map((h, i) => ({ wch: i === 1 ? 26 : 14 }));

  // 단계별 통계 시트
  const stageCount = {};
  for (let n = 1; n <= TOTAL_STAGES; n++) stageCount[n] = 0;
  projects.forEach((p) => { stageCount[p.currentStage] = (stageCount[p.currentStage] || 0) + 1; });
  const statRows = [['단계', '단계명', '사업 수']];
  for (let n = 1; n <= TOTAL_STAGES; n++) {
    statRows.push([n, STAGES[n - 1].name, stageCount[n] || 0]);
  }
  const ws2 = XLSX.utils.aoa_to_sheet(statRows);
  ws2['!cols'] = [{ wch: 8 }, { wch: 16 }, { wch: 10 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws1, '사업목록');
  XLSX.utils.book_append_sheet(wb, ws2, '단계별통계');

  const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return {
    blob: new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    filename: `사업일람_${dateStamp()}.xlsx`,
  };
}
