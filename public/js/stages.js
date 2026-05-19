/**
 * stages.js — 공사 12단계 정의 (PRD §3.3.2 / §3.3.3)
 *
 * 사업은 예산편성(1)부터 하자보수(12)까지 12단계를 순차 진행한다.
 * 각 단계는 표준 필수 서류 목록을 가진다.
 */

export const STAGES = [
  { number: 1,  name: '예산편성',  requiredDocs: ['예산편성 요구서', '예산 산정 근거'] },
  { number: 2,  name: '설계용역',  requiredDocs: ['과업지시서', '설계용역 계약서', '설계 성과품'] },
  { number: 3,  name: '일상감사',  requiredDocs: ['일상감사 의뢰서', '감사 결과 통지서'] },
  { number: 4,  name: '품의',      requiredDocs: ['사업추진 품의서', '예산집행 계획서'] },
  { number: 5,  name: '발주공고',  requiredDocs: ['입찰공고문', '입찰안내서', '설계도서'] },
  { number: 6,  name: '입찰·낙찰', requiredDocs: ['입찰 결과 조서', '낙찰자 결정 조서'] },
  { number: 7,  name: '계약',      requiredDocs: ['공사계약서', '이행보증서', '하자보증서', '선급금보증서'] },
  { number: 8,  name: '착공',      requiredDocs: ['착공계', '안전관리계획서', '품질관리계획서', '현장기술자 신고'] },
  { number: 9,  name: '시공',      requiredDocs: ['주간/월간 공정보고서', '시공계획서'] },
  { number: 10, name: '준공검사',  requiredDocs: ['준공계', '준공검사조서', '검사조사서'] },
  { number: 11, name: '준공·정산', requiredDocs: ['정산내역서', '준공정산 결의서'] },
  { number: 12, name: '하자보수',  requiredDocs: ['하자보수 계획서', '하자보수 완료 보고서'] },
];

export const TOTAL_STAGES = STAGES.length;

/** 단계 번호로 정의를 조회한다. */
export function getStage(number) {
  return STAGES[number - 1] || null;
}

/** 단계 이름 */
export function stageName(number) {
  const s = getStage(number);
  return s ? s.name : '-';
}

/** 단계 상태 라벨 */
export const STAGE_STATUS = {
  pending: '대기',
  in_progress: '진행 중',
  completed: '완료',
};

/**
 * 사업의 stages 맵 초기 구조를 생성한다.
 * 1단계는 in_progress, 나머지는 pending.
 */
export function buildInitialStages() {
  const stages = {};
  for (const s of STAGES) {
    stages[s.number] = {
      number: s.number,
      name: s.name,
      status: s.number === 1 ? 'in_progress' : 'pending',
      startedAt: s.number === 1 ? new Date().toISOString() : null,
      completedAt: null,
      requiredDocs: s.requiredDocs.map((name) => ({ name, uploaded: false, file: null })),
    };
  }
  return stages;
}
