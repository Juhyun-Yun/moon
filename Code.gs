/**
 * ============================================================
 * © 2026 GEG 화성(깊이 e끌림). All rights reserved.
 *
 * 본 코드는 「저작권법」상 보호받는 저작물입니다.
 * - 복제권(제16조)·공중송신권(제18조)·배포권(제20조)은
 *   저작권자에게 있습니다.
 * - 정식 경로로 받은 이용자라도 코드의 무단 복제·재배포·
 *   재판매·리브랜딩은 허용되지 않습니다.
 * - 무단 이용 시 「저작권법」 제136조(5년 이하 징역 또는
 *   5천만 원 이하 벌금) 및 제125조(손해배상) 적용 대상이
 *   될 수 있습니다.
 * - 이용 문의: bacusiki777@gmail.com, for2102@jimj.kr
 * ============================================================
 */

// 빌드 서명
const _BUILD_SIG = 'GEGHS-DEEPE-2026';

// 출처 확인용 함수
function getBuildInfo() {
  return {
    sig: _BUILD_SIG,
    owner: 'GEG 화성(깊이 e끌림)',
    year: 2026
  };
}

/**
 * 🌙 달 모양 탐험대 — Apps Script (통합본)
 *
 * 사이드바/대시보드 HTML이 이 파일 안에 모두 포함되어 있어
 * 따로 .html 파일을 만들 필요가 없습니다.
 *
 * 필요한 파일은 단 2개:
 *   1) Code.gs    ← 이 파일 (서버 + 사이드바 + 대시보드)
 *   2) Index.html ← 학생용 학습 페이지
 *
 * 시트 구조 (자동 생성):
 *   - "학생명단" : A=번호, B=이름, C=비고
 *   - "학습기록" : A=일시, B=학생이름, C=점수, D=총문제, E=정답률(%), F=세부내용
 */

const SHEET_ROSTER = '학생명단';
const SHEET_RECORDS = '학습기록';
const SHEET_USAGE = '사용 설명';
const TZ = 'Asia/Seoul';

// 🌐 GitHub Pages에 올린 학생용 앱 주소 (배포 후 직접 채워 넣으세요)
//    예: 'https://내아이디.github.io/moon-phase/'
//    「학생 접속 링크 보기」 메뉴에서 표시됩니다. (비워 두어도 동작합니다)
const APP_BASE_URL = '';

// ────────────────────────────────────────────────
// 웹 앱 진입점 (이 시트의 데이터 API)
//   • ?action=getStudents / ?action=save → JSONP API (GitHub 앱이 호출)
//   • 그 외 → 안내 메시지 (앱 본체는 GitHub에 있으므로 여기서 화면을 제공하지 않음)
//
//   ※ 코드 노출 방지: index.html(앱 본체)은 이 Apps Script에 넣지 않습니다.
//      앱 화면은 GitHub 주소로만 접속하고, 여기엔 시트 연결용 Code.gs만 둡니다.
// ────────────────────────────────────────────────
function doGet(e) {
  const action = e && e.parameter && e.parameter.action;
  if (action === 'getStudents') {
    return jsonpResponse(e, { ok: true, students: getStudents() });
  }
  if (action === 'save') {
    const ok = saveResult({
      student: e.parameter.student,
      score: e.parameter.score,
      total: e.parameter.total,
      details: e.parameter.details,
    });
    return jsonpResponse(e, { ok: ok === true });
  }

  // index 파일이 있으면 화면을 제공(선택), 없으면 안내만 한다 — 둘 다 정상 동작.
  let html;
  try {
    html = HtmlService.createHtmlOutputFromFile('index').getContent();
  } catch (err) {
    return HtmlService.createHtmlOutput(
      '<div style="font-family:sans-serif;padding:24px;line-height:1.6;color:#222;">' +
      '<h2 style="color:#1a73e8;">🌙 달 모양 탐험대 — 시트 연결 서버</h2>' +
      '<p>이 주소는 <b>데이터 연결용 API</b>입니다. 학습 화면은 여기가 아니라 ' +
      '공유받은 <b>앱 주소</b>로 접속하세요.</p>' +
      '<p style="color:#5f6368;font-size:13px;">앱 첫 화면 [⚙️ 시트 연결 설정]에 ' +
      '이 주소(.../exec)를 붙여넣으면 연결됩니다.</p>' +
      '</div>'
    ).setTitle('🌙 달 모양 탐험대 — 연결 서버');
  }

  // (선택) index 파일을 넣은 경우에만: 달 이미지 base64 주입 후 화면 제공
  let moonB64 = '';
  try {
    moonB64 = HtmlService.createHtmlOutputFromFile('moon_image_b64').getContent().trim();
  } catch (err) {
    moonB64 = '';
  }
  const inject = '<script>window.__MOON_IMAGE_BASE64__=' + JSON.stringify(moonB64) + ';</script>';
  if (html.indexOf('<!--__MOON_IMG_INJECT__-->') !== -1) {
    html = html.replace('<!--__MOON_IMG_INJECT__-->', inject);
  } else {
    html = html.replace('</head>', inject + '</head>');
  }
  return HtmlService.createHtmlOutput(html)
    .setTitle('🌙 달 모양 탐험대')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
}

// JSONP 응답 생성 — GitHub 앱이 CORS 없이 데이터를 받을 수 있게 한다.
//   ?callback=함수명 이 있으면  함수명({...})  형태로 감싸 반환,
//   없으면 순수 JSON을 반환한다.
function jsonpResponse(e, obj) {
  const json = JSON.stringify(obj);
  const cb = e && e.parameter && e.parameter.callback;
  if (cb) {
    return ContentService
      .createTextOutput(cb + '(' + json + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

// ────────────────────────────────────────────────
// 스프레드시트 메뉴
// ────────────────────────────────────────────────
function onOpen() {
  // 메뉴를 먼저 만든다 — 시트 작업에서 문제가 생겨도 메뉴는 항상 나타나도록.
  SpreadsheetApp.getUi()
    .createMenu('📊 달 모양 탐험대 대시보드')
    .addItem('📋 사용 설명 보기/만들기', 'setupGuideSheet')
    .addItem('🗂 시트 초기화 / 만들기', 'ensureSheets')
    .addSeparator()
    .addItem('🔍 간단 통계 (사이드바)', 'showSidebar')
    .addItem('📈 전체 통계 보기 (대시보드)', 'showDashboard')
    .addItem('🔄 학생명단 최신 기록 새로고침', 'refreshRosterLatest')
    .addItem('🔗 학생 접속 링크 보기', 'showWebAppLink')
    .addToUi();
  // 시트/가이드 자동 생성 시도 (권한·트리거 제약으로 실패해도 메뉴로 만들 수 있음)
  try { ensureSheets(); } catch (err) {}
}

// ────────────────────────────────────────────────
// 사이드바/대시보드 — 인라인 HTML 사용
// ────────────────────────────────────────────────
function showSidebar() {
  const html = HtmlService.createHtmlOutput(getSidebarHtml())
    .setTitle('🌙 학습 통계 요약');
  SpreadsheetApp.getUi().showSidebar(html);
}

function showDashboard() {
  const html = HtmlService.createHtmlOutput(getDashboardHtml())
    .setWidth(960)
    .setHeight(720);
  SpreadsheetApp.getUi().showModalDialog(html, '📊 학습 통계 대시보드');
}

function showWebAppLink() {
  const url = ScriptApp.getService().getUrl();
  const ui = SpreadsheetApp.getUi();
  if (!url) {
    ui.alert(
      '웹 앱이 아직 배포되지 않았습니다.\n\n' +
      '[배포 → 새 배포 → 유형:웹앱 → 액세스:모든 사용자]로 먼저 배포해 주세요.'
    );
    return;
  }
  const appLine = APP_BASE_URL
    ? '<p style="margin-top:14px; font-size:14px;"><b>👨‍🎓 학생 접속 앱 주소:</b></p>' +
      '<input type="text" readonly value="' + APP_BASE_URL + '" ' +
      'style="width:100%; padding:8px; font-size:13px;" onclick="this.select()">'
    : '';
  const html = HtmlService.createHtmlOutput(
    '<div style="font-family:sans-serif; padding:8px; line-height:1.5;">' +
    '<p style="font-size:14px;"><b>🔗 내 시트(웹앱) 주소</b><br>' +
    '<span style="font-size:12px; color:#5f6368;">앱 첫 화면 [⚙️ 시트 연결 설정]에 이 주소를 붙여넣고 저장하세요.</span></p>' +
    '<input type="text" readonly value="' + url + '" ' +
    'style="width:100%; padding:8px; font-size:13px;" onclick="this.select()">' +
    appLine +
    '</div>'
  ).setWidth(540).setHeight(APP_BASE_URL ? 240 : 150);
  ui.showModalDialog(html, '연결 주소 보기');
}

// ────────────────────────────────────────────────
// 시트 자동 생성
// ────────────────────────────────────────────────
function ensureSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let roster = ss.getSheetByName(SHEET_ROSTER);
  if (!roster) {
    roster = ss.insertSheet(SHEET_ROSTER);
    roster.getRange(1, 1, 1, 6).setValues([
      ['번호', '이름', '비고', '최근 학습일', '최근 점수', '정답률(%)']
    ]);
    roster.getRange(1, 1, 1, 6)
      .setBackground('#1a73e8').setFontColor('white').setFontWeight('bold');
    roster.setFrozenRows(1);
    roster.setColumnWidths(1, 3, 140);
    roster.setColumnWidth(4, 160);
    roster.setColumnWidths(5, 2, 110);
    // 최근 점수 컬럼(E)은 "8 / 10" 형태가 날짜로 해석되지 않도록 텍스트 형식
    roster.getRange('E2:E').setNumberFormat('@');
    // 첫 사용자가 어디에 이름을 입력해야 할지 알도록 셀 노트와 안내 행 추가
    roster.getRange('B2').setNote('← 여기부터 학생 이름을 한 명씩 한 줄에 한 명 입력하세요.');
    roster.getRange('C2').setValue('← B열에 학생 이름을 입력하세요');
    roster.getRange('C2').setFontColor('#888').setFontStyle('italic');
  } else {
    // 기존 시트에 D, E, F 열이 없으면 헤더 추가
    const lastCol = roster.getLastColumn();
    const currentHeaders = roster.getRange(1, 1, 1, Math.max(lastCol, 6)).getValues()[0];
    const newHeaders = ['최근 학습일', '최근 점수', '정답률(%)'];
    for (let i = 0; i < 3; i++) {
      if (!currentHeaders[3 + i]) {
        roster.getRange(1, 4 + i).setValue(newHeaders[i])
          .setBackground('#1a73e8').setFontColor('white').setFontWeight('bold');
      }
    }
    if (roster.getColumnWidth(4) < 140) roster.setColumnWidth(4, 160);
    if (roster.getLastRow() >= 2) {
      roster.getRange('E2:E').setNumberFormat('@');
    }
  }

  let records = ss.getSheetByName(SHEET_RECORDS);
  if (!records) {
    records = ss.insertSheet(SHEET_RECORDS);
    records.getRange(1, 1, 1, 6).setValues([
      ['일시', '학생 이름', '점수', '총 문제수', '정답률(%)', '세부 내용']
    ]);
    records.getRange(1, 1, 1, 6)
      .setBackground('#1a73e8').setFontColor('white').setFontWeight('bold');
    records.setFrozenRows(1);
    records.setColumnWidths(1, 6, 130);
    records.getRange('A:A').setNumberFormat('yyyy-MM-dd HH:mm');
  }

  // 안내 시트들은 Google Sheets UI 컨텍스트(메뉴·사이드바)에서만 자동 생성.
  // doGet/JSONP 호출 시에는 스킵하여 15초 타임아웃 안에 응답할 수 있게 한다.
  let isUiContext = false;
  try { SpreadsheetApp.getUi(); isUiContext = true; } catch (_) {}

  if (isUiContext && !ss.getSheetByName(SHEET_USAGE)) {
    try { setupGuideSheet(); } catch (_) {}
  }
}

// ════════════════════════════════════════════════
// 📋 사용 설명 시트 (시트 운영 안내) — 메뉴 또는 자동 생성
// ════════════════════════════════════════════════
function setupGuideSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const NAVY = '#1a1f4e', GOLD = '#ffd166', BLUE = '#1a73e8';
  const GREEN = '#34a853', LIGHT = '#f1f3f4';

  // 기존 안내 탭 삭제 (이름이 같거나 구버전 이름이면 제거)
  ['사용 설명', '📖 사용법'].forEach(function(name) {
    const old = ss.getSheetByName(name);
    if (!old) return;
    if (ss.getSheets().length <= 1) {
      const tmp = ss.insertSheet('__tmp_' + Date.now());
      ss.deleteSheet(old);
      tmp.setName(SHEET_USAGE);
      ss.setActiveSheet(tmp);
      ss.moveActiveSheet(1);
    } else {
      ss.deleteSheet(old);
    }
  });

  let sh = ss.getSheetByName(SHEET_USAGE);
  if (!sh) sh = ss.insertSheet(SHEET_USAGE, 0);

  sh.clear();
  sh.setHiddenGridlines(true);
  sh.setColumnWidth(1, 30);
  sh.setColumnWidth(2, 740);
  sh.setColumnWidth(3, 30);
  sh.getRange('A:C').setVerticalAlignment('top');

  let r = 1;

  function row123() { return sh.getRange(r, 1, 1, 3); }
  function cell2() { return sh.getRange(r, 2); }

  function banner(text, opts) {
    opts = opts || {};
    row123().merge().setBackground(opts.bg || NAVY);
    sh.getRange(r, 1).setValue(text)
      .setFontColor(opts.fg || GOLD).setFontSize(opts.size || 20)
      .setFontWeight('bold').setHorizontalAlignment('center')
      .setVerticalAlignment('middle').setWrap(true);
    r++;
  }

  function hdr(text, bg) {
    row123().setBackground(bg || BLUE);
    cell2().setValue(text)
      .setFontColor('#ffffff').setFontWeight('bold').setFontSize(12).setWrap(true);
    r++;
  }

  function body(text, opts) {
    opts = opts || {};
    if (opts.bg) row123().setBackground(opts.bg);
    const c = cell2();
    c.setValue(text).setWrap(true).setFontSize(11).setFontColor(opts.color || '#202124');
    if (opts.bold) c.setFontWeight('bold');
    if (opts.italic) c.setFontStyle('italic');
    r++;
  }

  function spacer() { r++; }

  // ── 제목 배너 ──
  banner('🌙  달 모양 탐험대  ·  시트 사용 설명');
  banner('데이터는 앱 화면이 아니라 해당 시트 탭에서 직접 수정하세요. 탭 이름은 코드와 연결되어 있으므로 삭제하거나 변경하지 마세요.', { bg: '#2a3270', fg: '#f4f1de', size: 11 });
  spacer();

  // ── 설정 단계 ──
  body('🚀 사본을 만든 뒤 설정하기 (처음 한 번)', { bold: true, size: 14, color: BLUE });
  spacer();
  hdr('단계  /  내용', BLUE);
  var steps = [
    ['1. 학생 이름 입력', '「학생명단」 탭 B열에 학생 이름을 한 줄에 한 명씩 입력하세요. (A열 번호, D~F열 최신 기록은 자동 관리)'],
    ['2. 웹앱 배포', '[확장 프로그램] → [Apps Script] → 오른쪽 위 [배포] → [새 배포] → ⚙️ → [웹 앱]\n   실행 계정: 나  /  액세스: 모든 사용자  →  [배포]  →  URL(.../exec) 복사'],
    ['3. 권한 허용 (처음 1회)', '[권한 검토] → 본인 계정 → "확인되지 않은 앱"에서 [고급] → [(안전하지 않음)으로 이동] → [허용] → 배포 URL 확인\n   (고급이 안 보이면 창 최대화 후 시도, 반드시 사본을 만든 계정으로 진행)'],
    ['4. 앱에 시트 연결', '앱 첫 화면 [⚙️ 선생님 설정] → 2단계 주소(.../exec) 붙여넣기 → [연결하기]\n   → "✓ 준비 완료" + 학생 명단이 드롭다운에 나오면 성공 🎉'],
    ['5. 학생용 링크 공유', '⚙️ 설정에서 연결 완료 후 "학생용 링크"가 자동 생성됩니다.\n   [복사] 버튼으로 복사해서 학생에게 공유하세요.\n   학생이 그 링크로 접속하면 어떤 기기에서든 설정 없이 이름만 골라 바로 입장합니다.'],
  ];
  steps.forEach(function(s, i) {
    body(s[0] + '\n' + s[1], { bg: i % 2 === 0 ? '#ffffff' : LIGHT });
  });
  spacer();

  // ── 탭 목록 ──
  body('📋 탭 목록', { bold: true, size: 14, color: BLUE });
  hdr('탭 이름  /  역할  /  주의사항', BLUE);
  var tabs = [
    ['사용 설명', '시트 사용 안내 (이 탭)', '탭 이름을 변경하지 마세요'],
    ['학생명단', '학생 이름 입력·관리 / 최신 학습 기록 자동 표시', 'B열에 이름만 입력, A·D~F열은 자동'],
    ['학습기록', '학생별 학습 결과 자동 기록', '직접 수정하지 마세요 (앱이 자동 입력)'],
  ];
  tabs.forEach(function(t, i) {
    body('【' + t[0] + '】  ' + t[1] + '\n⚠ ' + t[2], { bg: i % 2 === 0 ? '#ffffff' : LIGHT });
  });
  spacer();

  // ── 메뉴·버튼 사용법 ──
  body('📊 메뉴 · 버튼 사용법', { bold: true, size: 14, color: BLUE });
  hdr('📊 달 모양 탐험대 대시보드 (시트 상단 메뉴)', NAVY);
  var menuItems = [
    '📋 사용 설명 보기/만들기 — 이 탭 새로 만들기',
    '🗂 시트 초기화 / 만들기 — 학생명단·학습기록 탭 생성 또는 초기화',
    '🔍 간단 통계 (사이드바) — 학습 통계 요약을 오른쪽 사이드바에서 보기',
    '📈 전체 통계 보기 (대시보드) — 학생별·일별 상세 통계를 팝업으로 보기',
    '🔄 학생명단 최신 기록 새로고침 — 학습기록 기반으로 학생명단 최신 점수 갱신',
    '🔗 학생 접속 링크 보기 — 이 시트의 웹앱 주소(.../exec) 확인',
  ];
  menuItems.forEach(function(m, i) {
    body('  ' + m, { bg: i % 2 === 0 ? '#ffffff' : LIGHT });
  });
  spacer();

  // ── 사이드바 ──
  body('🔍 사이드바 사용법', { bold: true, size: 14, color: BLUE });
  body('[메뉴] → [🔍 간단 통계 (사이드바)] 클릭 → 참여 학생 수·총 도전 횟수·평균 점수·최근 학습 활동을 시트 오른쪽에서 확인합니다.\n[📈 자세한 통계 보기 →] 버튼을 누르면 전체 통계 대시보드 팝업이 열립니다.');
  spacer();

  // ── 저작권 ──
  hdr('저작권 안내', NAVY);
  body(
    '본 구글 시트 및 관련 자료(앱, 코드, 콘텐츠 포함)의 저작권은 GEG 화성(깊이 e끌림)에게 있습니다.\n\n' +
    '1. 본 자료는 책을 구입한 자에 한해 이용이 허락됩니다(교사일 경우는 해당 학급, 학부모일 경우 자녀).' +
    ' 정상 경로로 구매하거나 배포받은 이용자라 하더라도 앱 코드의 무단 수정 및 2차 배포는 허용되지 않습니다.\n' +
    '2. 다음 행위를 금합니다.\n' +
    '   · 무단 복제·전송·배포·공유(타인에게 시트 링크 또는 사본 전달 포함)\n' +
    '   · 영리 목적의 사용 또는 배포(학원에서의 사용 포함)\n' +
    '   · 영리 목적의 재판매 또는 재배포\n' +
    '   · 무단 수정·편집을 통한 2차적 저작물 작성\n' +
    '3. 「저작권법」 제136조(벌칙) 제1항 제1호에 따라, 저작재산권을 복제·공연·공중송신·전시·배포·대여·2차적저작물 작성의 방법으로 침해한 자는' +
    ' 5년 이하의 징역 또는 5천만원 이하의 벌금에 처하거나 이를 병과할 수 있습니다.\n\n' +
    'ⓒ 2026 GEG 화성(깊이 e끌림)',
    { italic: true, color: '#5f6368' }
  );

  sh.setFrozenRows(1);
  sh.getRange(1, 1).activate();

  try {
    SpreadsheetApp.getUi().alert('📋 「사용 설명」 탭을 새로 만들었습니다.\n맨 앞 탭에서 안내를 확인하세요.');
  } catch (_) {}
  return sh;
}

// ────────────────────────────────────────────────
// 학생용 클라이언트가 호출하는 함수들
// ────────────────────────────────────────────────
function getStudents() {
  ensureSheets();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const roster = ss.getSheetByName(SHEET_ROSTER);
  const records = ss.getSheetByName(SHEET_RECORDS);

  const rosterData = roster.getDataRange().getValues();
  const recordData = records.getLastRow() > 1 ? records.getDataRange().getValues() : [];

  const latestByName = {};
  for (let i = 1; i < recordData.length; i++) {
    const r = recordData[i];
    const name = String(r[1] || '').trim();
    if (!name) continue;
    const date = r[0] instanceof Date ? r[0] : new Date(r[0]);
    if (!latestByName[name] || date > latestByName[name].date) {
      latestByName[name] = { date: date, score: r[2], total: r[3] };
    }
  }

  const students = [];
  for (let i = 1; i < rosterData.length; i++) {
    const row = rosterData[i];
    const name = String(row[1] || '').trim();
    if (!name) continue;
    // 이전 버전에서 자동 삽입된 "예시:" 행은 무시
    if (name.indexOf('예시:') === 0 || name.indexOf('예시 :') === 0) continue;
    const latest = latestByName[name];
    students.push({
      name: name,
      lastDate: latest ? Utilities.formatDate(latest.date, TZ, 'yyyy-MM-dd') : null,
      lastScore: latest ? latest.score : null,
      lastTotal: latest ? latest.total : null,
    });
  }
  return students;
}

function saveResult(result) {
  ensureSheets();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const records = ss.getSheetByName(SHEET_RECORDS);
  const total = parseInt(result.total) || 10;
  const score = parseInt(result.score) || 0;
  const percentage = total > 0 ? Math.round((score / total) * 100) : 0;
  const now = new Date();
  const studentName = String(result.student || '').trim();

  // 1. 누적 학습 기록 시트에 한 줄 추가
  records.appendRow([
    now, studentName, score, total, percentage, String(result.details || ''),
  ]);

  // 2. 학생명단 시트의 해당 학생 행에 최신 기록 갱신
  updateLatestInRoster(studentName, now, score, total, percentage);

  return true;
}

// 학생명단 시트에서 특정 학생의 D~F열(최근 기록)을 갱신
function updateLatestInRoster(name, date, score, total, percentage) {
  if (!name) return;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const roster = ss.getSheetByName(SHEET_ROSTER);
  const lastRow = roster.getLastRow();
  if (lastRow < 2) return;

  const names = roster.getRange(2, 2, lastRow - 1, 1).getValues();
  for (let i = 0; i < names.length; i++) {
    if (String(names[i][0] || '').trim() === name) {
      const rowNum = i + 2;
      roster.getRange(rowNum, 4, 1, 3).setValues([[
        date, score + ' / ' + total, percentage,
      ]]);
      roster.getRange(rowNum, 4).setNumberFormat('yyyy-MM-dd HH:mm');
      roster.getRange(rowNum, 5).setNumberFormat('@');
      return;
    }
  }
}

// 메뉴에서 호출: 학습기록 시트의 모든 데이터를 읽어 학생명단의 최신 기록을 일괄 갱신
function refreshRosterLatest() {
  ensureSheets();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const roster = ss.getSheetByName(SHEET_ROSTER);
  const records = ss.getSheetByName(SHEET_RECORDS);

  const recordData = records.getLastRow() > 1 ? records.getDataRange().getValues() : [];
  const latestByName = {};
  for (let i = 1; i < recordData.length; i++) {
    const r = recordData[i];
    const name = String(r[1] || '').trim();
    if (!name) continue;
    const date = r[0] instanceof Date ? r[0] : new Date(r[0]);
    if (!latestByName[name] || date > latestByName[name].date) {
      latestByName[name] = {
        date: date,
        score: parseInt(r[2]) || 0,
        total: parseInt(r[3]) || 7,
        percent: parseInt(r[4]) || 0,
      };
    }
  }

  const lastRow = roster.getLastRow();
  if (lastRow < 2) {
    SpreadsheetApp.getUi().alert('학생명단이 비어있습니다. 먼저 학생 이름을 입력해 주세요.');
    return;
  }

  const names = roster.getRange(2, 2, lastRow - 1, 1).getValues();
  let updated = 0, cleared = 0;
  for (let i = 0; i < names.length; i++) {
    const name = String(names[i][0] || '').trim();
    if (!name) continue;
    const rowNum = i + 2;
    const latest = latestByName[name];
    if (latest) {
      roster.getRange(rowNum, 4, 1, 3).setValues([[
        latest.date,
        latest.score + ' / ' + latest.total,
        latest.percent,
      ]]);
      roster.getRange(rowNum, 4).setNumberFormat('yyyy-MM-dd HH:mm');
      roster.getRange(rowNum, 5).setNumberFormat('@');
      updated++;
    } else {
      roster.getRange(rowNum, 4, 1, 3).setValues([['', '', '']]);
      cleared++;
    }
  }
  SpreadsheetApp.getUi().alert(
    '✓ 학생명단의 최신 기록을 새로 고쳤습니다.\n\n' +
    '   • 기록 반영: ' + updated + '명\n' +
    '   • 기록 없음: ' + cleared + '명'
  );
}

// ────────────────────────────────────────────────
// 통계 데이터 (사이드바/대시보드에서 호출)
// ────────────────────────────────────────────────
function getStatsData() {
  ensureSheets();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const roster = ss.getSheetByName(SHEET_ROSTER);
  const records = ss.getSheetByName(SHEET_RECORDS);

  if (!roster || !records) {
    return {
      totalRoster: 0, participatedStudents: 0, totalAttempts: 0,
      avgScore: '0.0', avgPercent: 0, maxTotal: 7,
      scoreDistribution: [0, 0, 0, 0, 0, 0, 0, 0],
      recentActivity: [], studentList: [], dailyActivity: [],
    };
  }

  const rosterData = roster.getDataRange().getValues();
  const totalRoster = Math.max(0, rosterData.slice(1).filter(function (r) {
    return String(r[1] || '').trim().length > 0;
  }).length);

  if (records.getLastRow() < 2) {
    return {
      totalRoster: totalRoster,
      participatedStudents: 0,
      totalAttempts: 0,
      avgScore: '0.0',
      avgPercent: 0,
      maxTotal: 7,
      scoreDistribution: [0, 0, 0, 0, 0, 0, 0, 0],
      recentActivity: [],
      studentList: [],
      dailyActivity: [],
    };
  }

  const data = records.getDataRange().getValues();
  const rows = data.slice(1).filter(function (r) { return r[0] && r[1]; });

  let scoreSum = 0, percentSum = 0, maxTotal = 0;
  const distribution = [0, 0, 0, 0, 0, 0, 0, 0];
  const studentLatest = {}, studentBest = {};
  const dailyCount = {};
  const uniqueStudents = new Set();

  rows.forEach(function (row) {
    const date = row[0] instanceof Date ? row[0] : new Date(row[0]);
    const name = String(row[1] || '').trim();
    const score = parseInt(row[2]) || 0;
    const total = parseInt(row[3]) || 7;
    const percent = parseInt(row[4]) || 0;

    uniqueStudents.add(name);
    scoreSum += score;
    percentSum += percent;
    if (total > maxTotal) maxTotal = total;
    if (score >= 0 && score < distribution.length) distribution[score]++;

    if (!studentLatest[name] || date > studentLatest[name].date) {
      studentLatest[name] = { date: date, score: score, total: total, percent: percent };
    }
    if (!studentBest[name] || score > studentBest[name].score) {
      studentBest[name] = { score: score, total: total };
    }
    const dayKey = Utilities.formatDate(date, TZ, 'MM-dd');
    dailyCount[dayKey] = (dailyCount[dayKey] || 0) + 1;
  });

  const totalAttempts = rows.length;
  const recentActivity = rows.slice(-12).reverse().map(function (row) {
    const date = row[0] instanceof Date ? row[0] : new Date(row[0]);
    return {
      date: Utilities.formatDate(date, TZ, 'MM-dd HH:mm'),
      name: String(row[1] || ''),
      score: parseInt(row[2]) || 0,
      total: parseInt(row[3]) || 7,
      percent: parseInt(row[4]) || 0,
    };
  });

  const studentList = Object.keys(studentLatest).map(function (name) {
    const s = studentLatest[name], b = studentBest[name];
    return {
      name: name,
      date: Utilities.formatDate(s.date, TZ, 'yyyy-MM-dd'),
      score: s.score, total: s.total, percent: s.percent,
      bestScore: b.score, bestTotal: b.total,
    };
  });

  const dailyActivity = Object.keys(dailyCount).sort().map(function (k) {
    return { date: k, count: dailyCount[k] };
  });

  return {
    totalRoster: totalRoster,
    participatedStudents: uniqueStudents.size,
    totalAttempts: totalAttempts,
    avgScore: totalAttempts > 0 ? (scoreSum / totalAttempts).toFixed(1) : '0.0',
    avgPercent: totalAttempts > 0 ? Math.round(percentSum / totalAttempts) : 0,
    maxTotal: maxTotal || 7,
    scoreDistribution: distribution,
    recentActivity: recentActivity,
    studentList: studentList,
    dailyActivity: dailyActivity,
  };
}

// ════════════════════════════════════════════════
// 사이드바 HTML (선생님용 — 시트 오른쪽 사이드바)
// ════════════════════════════════════════════════
function getSidebarHtml() {
  return `<!DOCTYPE html>
<html>
<head>
<base target="_top">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Jua&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; }
  body {
    font-family: 'Jua', 'Malgun Gothic', sans-serif;
    padding: 12px; margin: 0; background: #fff; color: #222;
  }
  button { font-family: 'Jua', 'Malgun Gothic', sans-serif; }
  h2 {
    color: #1a73e8; font-size: 18px; margin-bottom: 14px;
    padding-bottom: 8px; border-bottom: 2px solid #1a73e8;
  }
  .stat-card {
    background: #f8f9fa; border-left: 4px solid #1a73e8;
    padding: 10px 14px; margin-bottom: 8px; border-radius: 4px;
  }
  .stat-card.green { border-left-color: #34a853; }
  .stat-card.orange { border-left-color: #f9ab00; }
  .stat-card.purple { border-left-color: #a142f4; }
  .stat-label { color: #5f6368; font-size: 13px; margin-bottom: 2px; }
  .stat-value { font-size: 26px; font-weight: bold; color: #1a73e8; }
  .stat-card.green .stat-value { color: #34a853; }
  .stat-card.orange .stat-value { color: #f9ab00; }
  .stat-card.purple .stat-value { color: #a142f4; }
  .stat-sub { font-size: 12px; color: #5f6368; margin-top: 2px; }
  .recent-section {
    margin-top: 16px; padding-top: 14px; border-top: 1px solid #e0e0e0;
  }
  .recent-title { font-size: 14px; color: #5f6368; margin-bottom: 8px; font-weight: bold; }
  .recent-item {
    font-size: 13px; padding: 6px 8px; background: #f1f3f4;
    border-radius: 4px; margin-bottom: 4px;
    display: flex; justify-content: space-between;
  }
  .recent-item .score { color: #1a73e8; font-weight: bold; }
  .btn {
    background: #1a73e8; color: white; border: none;
    padding: 10px 16px; border-radius: 4px; cursor: pointer;
    font-size: 14px; width: 100%; margin-top: 12px; font-weight: bold;
  }
  .btn:hover { background: #1557b0; }
  .btn.refresh { background: #f1f3f4; color: #1a73e8; margin-top: 6px; }
  .loading { color: #5f6368; font-size: 14px; padding: 16px 0; text-align: center; }
  .empty { color: #5f6368; font-size: 13px; font-style: italic; text-align: center; padding: 8px; }
</style>
</head>
<body>

<h2>📊 학습 통계 요약</h2>
<div id="loading" class="loading">⏳ 데이터 불러오는 중...</div>

<div id="content" style="display:none">
  <div class="stat-card">
    <div class="stat-label">참여 학생</div>
    <div class="stat-value"><span id="participated">0</span> / <span id="totalRoster">0</span> 명</div>
    <div class="stat-sub">전체 명단 중 도전한 학생 수</div>
  </div>
  <div class="stat-card green">
    <div class="stat-label">총 도전 횟수</div>
    <div class="stat-value" id="attempts">0</div>
  </div>
  <div class="stat-card orange">
    <div class="stat-label">평균 점수</div>
    <div class="stat-value"><span id="avg">0</span> 점</div>
    <div class="stat-sub">총 <span id="totalQ">7</span>문제 중</div>
  </div>
  <div class="stat-card purple">
    <div class="stat-label">평균 정답률</div>
    <div class="stat-value"><span id="avgPercent">0</span>%</div>
  </div>
  <div class="recent-section">
    <div class="recent-title">🕒 최근 학습 활동</div>
    <div id="recentList"></div>
  </div>
  <button class="btn" onclick="openDashboard()">📈 자세한 통계 보기 →</button>
  <button class="btn refresh" onclick="load()">🔄 새로 고침</button>
</div>

<script>
function load() {
  document.getElementById('loading').style.display = 'block';
  document.getElementById('content').style.display = 'none';
  google.script.run.withSuccessHandler(populate).withFailureHandler(onError).getStatsData();
}
function onError(err) {
  const msg = (err && err.message) || String(err) || '알 수 없는 오류';
  document.getElementById('loading').textContent = '⚠ 데이터 불러오기 실패: ' + msg;
}
function populate(data) {
  document.getElementById('participated').textContent = data.participatedStudents;
  document.getElementById('totalRoster').textContent = data.totalRoster;
  document.getElementById('attempts').textContent = data.totalAttempts;
  document.getElementById('avg').textContent = data.avgScore;
  document.getElementById('totalQ').textContent = data.maxTotal;
  document.getElementById('avgPercent').textContent = data.avgPercent;
  const recentEl = document.getElementById('recentList');
  recentEl.innerHTML = '';
  if (!data.recentActivity || data.recentActivity.length === 0) {
    recentEl.innerHTML = '<div class="empty">아직 학습 기록이 없습니다.</div>';
  } else {
    data.recentActivity.slice(0, 6).forEach(function (r) {
      const div = document.createElement('div');
      div.className = 'recent-item';
      div.innerHTML = '<span>' + r.date + ' · ' + r.name + '</span>' +
        '<span class="score">' + r.score + '/' + r.total + '</span>';
      recentEl.appendChild(div);
    });
  }
  document.getElementById('loading').style.display = 'none';
  document.getElementById('content').style.display = 'block';
}
function openDashboard() { google.script.run.showDashboard(); }
load();
</script>
</body>
</html>`;
}

// ════════════════════════════════════════════════
// 대시보드 HTML (선생님용 — 큰 모달 팝업)
// ════════════════════════════════════════════════
function getDashboardHtml() {
  return `<!DOCTYPE html>
<html>
<head>
<base target="_top">
<script src="https://www.gstatic.com/charts/loader.js"></` + `script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Jua&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; }
  body {
    font-family: 'Jua', 'Malgun Gothic', sans-serif;
    padding: 20px; margin: 0; background: #f5f6fa; color: #222;
  }
  button { font-family: 'Jua', 'Malgun Gothic', sans-serif; }
  h2 {
    color: #1a73e8; font-size: 24px; margin-bottom: 18px;
    padding-bottom: 10px; border-bottom: 3px solid #1a73e8;
    display: flex; justify-content: space-between; align-items: center;
  }
  h2 .refresh-btn {
    background: #1a73e8; color: white; border: none;
    padding: 6px 14px; border-radius: 4px; cursor: pointer;
    font-size: 14px; font-weight: normal;
  }
  .grid-4 {
    display: grid; grid-template-columns: 1fr 1fr 1fr 1fr;
    gap: 12px; margin-bottom: 18px;
  }
  .stat-card {
    background: white; border-radius: 8px; padding: 14px 18px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1); border-left: 4px solid #1a73e8;
  }
  .stat-card.green { border-left-color: #34a853; }
  .stat-card.orange { border-left-color: #f9ab00; }
  .stat-card.purple { border-left-color: #a142f4; }
  .stat-label { color: #5f6368; font-size: 14px; margin-bottom: 4px; }
  .stat-value { font-size: 32px; font-weight: bold; color: #1a73e8; }
  .stat-card.green .stat-value { color: #34a853; }
  .stat-card.orange .stat-value { color: #f9ab00; }
  .stat-card.purple .stat-value { color: #a142f4; }
  .row-2 {
    display: grid; grid-template-columns: 1fr 1fr;
    gap: 14px; margin-bottom: 18px;
  }
  .chart-section {
    background: white; border-radius: 8px; padding: 14px 18px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  }
  .chart-section h3 {
    font-size: 16px; color: #333; margin-bottom: 12px;
    padding-bottom: 8px; border-bottom: 1px solid #e0e0e0;
  }
  .chart-container { height: 260px; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  th, td { padding: 8px 10px; border-bottom: 1px solid #eee; text-align: left; }
  th { background: #f1f3f4; color: #333; font-weight: bold; position: sticky; top: 0; }
  tr:hover td { background: #f8f9fa; }
  .scroll-table { max-height: 280px; overflow-y: auto; }
  .badge {
    display: inline-block; padding: 2px 10px; border-radius: 10px;
    font-size: 12px; font-weight: bold; color: white;
  }
  .badge.high { background: #34a853; }
  .badge.mid { background: #f9ab00; }
  .badge.low { background: #ea4335; }
  .progress-bar {
    display: inline-block; width: 80px; height: 8px;
    background: #e8eaed; border-radius: 4px;
    vertical-align: middle; margin-right: 6px; overflow: hidden;
  }
  .progress-fill { height: 100%; background: #1a73e8; }
  .loading { text-align: center; padding: 40px; color: #5f6368; font-size: 15px; }
  .empty { color: #5f6368; font-style: italic; text-align: center; padding: 20px; }
</style>
</head>
<body>

<h2>
  📊 달 모양 탐험대 — 전체 통계 대시보드
  <button class="refresh-btn" onclick="load()">🔄 새로 고침</button>
</h2>

<div id="loading" class="loading">⏳ 데이터 불러오는 중...</div>

<div id="dashboard" style="display:none">
  <div class="grid-4">
    <div class="stat-card">
      <div class="stat-label">참여 학생</div>
      <div class="stat-value"><span id="participated">0</span>/<span id="totalRoster">0</span></div>
    </div>
    <div class="stat-card green">
      <div class="stat-label">총 도전 횟수</div>
      <div class="stat-value" id="attempts">0</div>
    </div>
    <div class="stat-card orange">
      <div class="stat-label">평균 점수</div>
      <div class="stat-value"><span id="avg">0</span><span style="font-size:16px;color:#5f6368;"> / <span id="maxTotal">7</span></span></div>
    </div>
    <div class="stat-card purple">
      <div class="stat-label">평균 정답률</div>
      <div class="stat-value"><span id="avgPercent">0</span>%</div>
    </div>
  </div>

  <div class="row-2">
    <div class="chart-section">
      <h3>📊 점수 분포 (도전 횟수별)</h3>
      <div id="distChart" class="chart-container"></div>
    </div>
    <div class="chart-section">
      <h3>📅 일별 학습 활동</h3>
      <div id="dailyChart" class="chart-container"></div>
    </div>
  </div>

  <div class="row-2">
    <div class="chart-section">
      <h3>🕒 최근 학습 활동 (최근 12건)</h3>
      <div class="scroll-table">
        <table>
          <thead><tr><th>일시</th><th>학생</th><th>점수</th><th>정답률</th></tr></thead>
          <tbody id="recentTableBody"></tbody>
        </table>
      </div>
    </div>
    <div class="chart-section">
      <h3>👥 학생별 학습 현황 (최신순)</h3>
      <div class="scroll-table">
        <table>
          <thead><tr><th>학생</th><th>최근 학습일</th><th>최근 점수</th><th>최고 점수</th></tr></thead>
          <tbody id="studentTableBody"></tbody>
        </table>
      </div>
    </div>
  </div>
</div>

<script>
google.charts.load('current', { packages: ['corechart'] });
let pendingData = null;

function load() {
  document.getElementById('loading').style.display = 'block';
  document.getElementById('dashboard').style.display = 'none';
  google.script.run.withSuccessHandler(onData).withFailureHandler(onError).getStatsData();
}
function onError(err) {
  const msg = (err && err.message) || String(err) || '알 수 없는 오류';
  document.getElementById('loading').textContent = '⚠ 데이터 불러오기 실패: ' + msg;
}
function onData(data) {
  pendingData = data;
  populate(data);
  google.charts.setOnLoadCallback(drawCharts);
}
function populate(d) {
  document.getElementById('participated').textContent = d.participatedStudents;
  document.getElementById('totalRoster').textContent = d.totalRoster;
  document.getElementById('attempts').textContent = d.totalAttempts;
  document.getElementById('avg').textContent = d.avgScore;
  document.getElementById('maxTotal').textContent = d.maxTotal;
  document.getElementById('avgPercent').textContent = d.avgPercent;
  const recentBody = document.getElementById('recentTableBody');
  recentBody.innerHTML = '';
  if (!d.recentActivity || d.recentActivity.length === 0) {
    recentBody.innerHTML = '<tr><td colspan="4" class="empty">아직 학습 기록이 없습니다.</td></tr>';
  } else {
    d.recentActivity.forEach(function (r) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td>' + r.date + '</td><td>' + r.name + '</td>' +
        '<td>' + r.score + '/' + r.total + '</td><td>' + badge(r.percent) + '</td>';
      recentBody.appendChild(tr);
    });
  }
  const studentBody = document.getElementById('studentTableBody');
  studentBody.innerHTML = '';
  if (!d.studentList || d.studentList.length === 0) {
    studentBody.innerHTML = '<tr><td colspan="4" class="empty">아직 참여한 학생이 없습니다.</td></tr>';
  } else {
    d.studentList.sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });
    d.studentList.forEach(function (s) {
      const tr = document.createElement('tr');
      const recentPct = s.total > 0 ? Math.round((s.score / s.total) * 100) : 0;
      tr.innerHTML = '<td><b>' + s.name + '</b></td><td>' + s.date + '</td>' +
        '<td>' + bar(recentPct) + s.score + '/' + s.total + '</td>' +
        '<td>' + s.bestScore + '/' + s.bestTotal + '</td>';
      studentBody.appendChild(tr);
    });
  }
  document.getElementById('loading').style.display = 'none';
  document.getElementById('dashboard').style.display = 'block';
}
function badge(p) {
  let cls = 'low';
  if (p >= 80) cls = 'high';
  else if (p >= 50) cls = 'mid';
  return '<span class="badge ' + cls + '">' + p + '%</span>';
}
function bar(p) {
  return '<span class="progress-bar"><span class="progress-fill" style="width:' + p + '%"></span></span>';
}
function drawCharts() {
  if (!pendingData) return;
  const d = pendingData;
  const distRows = [['점수', '도전 횟수', { role: 'style' }]];
  const colors = ['#ea4335', '#ea4335', '#f9ab00', '#f9ab00', '#1a73e8', '#1a73e8', '#34a853', '#34a853'];
  d.scoreDistribution.forEach(function (c, i) {
    distRows.push([i + '점', c, colors[i] || '#1a73e8']);
  });
  const distData = google.visualization.arrayToDataTable(distRows);
  const distChart = new google.visualization.ColumnChart(document.getElementById('distChart'));
  distChart.draw(distData, {
    legend: 'none',
    chartArea: { left: 50, top: 20, width: '85%', height: '75%' },
    vAxis: { title: '도전 횟수', minValue: 0 },
    hAxis: { title: '점수' },
    bar: { groupWidth: '75%' },
  });
  const dailyEl = document.getElementById('dailyChart');
  if (!d.dailyActivity || d.dailyActivity.length === 0) {
    dailyEl.innerHTML = '<div class="empty">학습 활동 기록이 없습니다.</div>';
  } else {
    const dailyRows = [['날짜', '도전 횟수']];
    d.dailyActivity.forEach(function (a) { dailyRows.push([a.date, a.count]); });
    const dailyData = google.visualization.arrayToDataTable(dailyRows);
    const dailyChart = new google.visualization.AreaChart(dailyEl);
    dailyChart.draw(dailyData, {
      legend: 'none', colors: ['#1a73e8'],
      chartArea: { left: 50, top: 20, width: '85%', height: '70%' },
      vAxis: { minValue: 0, format: '0' },
      areaOpacity: 0.3, pointSize: 5,
    });
  }
}
load();
</` + `script>
</body>
</html>`;
}
