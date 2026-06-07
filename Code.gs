/**
 * 🌙 달의 위상 여행 — Apps Script (통합본)
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
const SHEET_GUIDE = '📖 선생님 가이드';
const TZ = 'Asia/Seoul';

// 🌐 GitHub Pages에 올린 학생용 앱 주소 (배포 후 직접 채워 넣으세요)
//    예: 'https://내아이디.github.io/moon-phase/'
//    선생님 가이드 시트에 학생 접속 안내로 표시됩니다. (비워 두어도 동작합니다)
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
      '<h2 style="color:#1a73e8;">🌙 달의 위상 여행 — 시트 연결 서버</h2>' +
      '<p>이 주소는 <b>데이터 연결용 API</b>입니다. 학습 화면은 여기가 아니라 ' +
      '공유받은 <b>앱 주소</b>로 접속하세요.</p>' +
      '<p style="color:#5f6368;font-size:13px;">앱 첫 화면 [⚙️ 시트 연결 설정]에 ' +
      '이 주소(.../exec)를 붙여넣으면 연결됩니다.</p>' +
      '</div>'
    ).setTitle('🌙 달의 위상 여행 — 연결 서버');
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
    .setTitle('🌙 달의 위상 여행')
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
    .createMenu('📊 달의 위상 여행 대시보드')
    .addItem('📖 선생님 가이드 보기/만들기', 'createTeacherGuide')
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
    '<p style="font-size:14px;"><b>🔧 (관리자 전용) 웹앱 주소</b><br>' +
    '<span style="font-size:12px; color:#5f6368;">GitHub의 index.html 맨 위 <b>DEFAULT_API_URL</b> 에 이 주소를 붙여넣고 배포하세요. (최초 1번)</span></p>' +
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

  // 선생님 가이드 시트가 없으면 처음 한 번 자동 생성
  if (!ss.getSheetByName(SHEET_GUIDE)) {
    buildTeacherGuide_(ss);
  }
}

// ════════════════════════════════════════════════
// 📖 선생님 가이드 시트 (색깔 입힌 안내) — 사본을 받은 다른 선생님용
// ════════════════════════════════════════════════
function createTeacherGuide() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  buildTeacherGuide_(ss);
  try {
    SpreadsheetApp.getUi().alert('📖 「선생님 가이드」 탭을 새로 만들었습니다.\n맨 앞 탭에서 안내를 확인하세요.');
  } catch (_) {}
}

function buildTeacherGuide_(ss) {
  // 기존 가이드가 있으면 지우고 새로 만든다
  let sh = ss.getSheetByName(SHEET_GUIDE);
  if (sh) ss.deleteSheet(sh);
  sh = ss.insertSheet(SHEET_GUIDE, 0); // 맨 앞에 배치

  // 색상 팔레트
  const NAVY = '#1a1f4e', GOLD = '#ffd166', BLUE = '#1a73e8';
  const GREEN = '#34a853', ORANGE = '#f9ab00', PURPLE = '#a142f4', RED = '#ea4335';
  const LIGHT = '#f1f3f4';

  // 격자/기본 서식 정리
  sh.setHiddenGridlines(true);
  sh.setColumnWidth(1, 40);
  sh.setColumnWidth(2, 760);
  sh.setColumnWidth(3, 40);
  sh.getRange('A:C').setVerticalAlignment('middle');

  let r = 1;
  // 한 줄(제목/본문/단계 등)을 추가하는 헬퍼
  function row(text, opts) {
    opts = opts || {};
    const cell = sh.getRange(r, 2);
    cell.setValue(text);
    cell.setWrap(true);
    cell.setFontSize(opts.size || 11);
    cell.setFontColor(opts.color || '#202124');
    if (opts.bg) sh.getRange(r, 1, 1, 3).setBackground(opts.bg);
    if (opts.bold) cell.setFontWeight('bold');
    if (opts.italic) cell.setFontStyle('italic');
    if (opts.height) sh.setRowHeight(r, opts.height);
    if (opts.align) cell.setHorizontalAlignment(opts.align);
    r++;
    return cell;
  }
  function spacer(h) { sh.setRowHeight(r, h || 10); r++; }
  // 색깔 박스로 된 단계 제목
  function stepHeader(text, bg) {
    sh.getRange(r, 1, 1, 3).setBackground(bg).setBorder(true, true, true, true, false, false, '#ffffff', SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
    const cell = sh.getRange(r, 2);
    cell.setValue(text).setFontColor('#ffffff').setFontWeight('bold').setFontSize(13).setWrap(true);
    sh.setRowHeight(r, 34);
    r++;
  }

  // ── 제목 배너 ──
  sh.getRange(r, 1, 1, 3).merge().setBackground(NAVY);
  sh.getRange(r, 1)
    .setValue('🌙  달의 위상 여행  ·  선생님 설정 가이드')
    .setFontColor(GOLD).setFontWeight('bold').setFontSize(20)
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setRowHeight(r, 56); r++;
  sh.getRange(r, 1, 1, 3).merge().setBackground('#2a3270');
  sh.getRange(r, 1)
    .setValue('이 시트 하나로 우리 반 학생 명단 관리 + 학습 결과 자동 수집이 됩니다. 선생님은 아래 3단계만!')
    .setFontColor('#f4f1de').setFontSize(11).setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setRowHeight(r, 30); r++;
  spacer(14);

  // ── 무엇인가요 ──
  row('💡 이 앱은 어떻게 쓰나요?', { bold: true, size: 14, color: BLUE });
  row('• 선생님은 따로 만들거나 설치할 것이 없습니다. 아래 3가지만 하면 끝!', { bold: true, color: GREEN });
  row('• 학생은 공유받은 "앱 주소" 하나만 누르면 됩니다. (설정·로그인·링크 만들기 전혀 없음)', {});
  row('• 학생이 이름을 고르고 도전하면, 결과가 이 스프레드시트 「학습기록」 탭에 자동으로 쌓입니다.', {});
  spacer(16);

  // ── 선생님 3단계 ──
  row('🚀 선생님은 이렇게만 하세요 (3단계)', { bold: true, size: 14, color: BLUE });
  spacer(6);

  stepHeader('1단계  ·  학생 이름 입력', BLUE);
  row('아래쪽 「학생명단」 탭을 열고, B열에 우리 반 학생 이름을 한 줄에 한 명씩 입력하세요.', {});
  row('→ 입력한 이름이 앱의 학생 선택 드롭다운에 자동으로 나타납니다.', { color: '#5f6368', italic: true });
  spacer(10);

  stepHeader('2단계  ·  학생에게 "앱 주소" 알려주기', GREEN);
  if (APP_BASE_URL) {
    row('학생들에게 아래 주소를 알려주세요. (학급 게시판·메신저·QR코드 등)', {});
    row(APP_BASE_URL, { bg: '#fff8e1', bold: true, color: '#bf6b00', size: 12, height: 28 });
  } else {
    row('학생들에게 "앱 주소"를 알려주세요. (관리자에게 주소를 받으세요)', {});
  }
  row('★ 학생은 이 주소만 누르면 끝! 이름만 고르고 바로 시작합니다. (초등학생도 쉬워요)', { bold: true, color: RED });
  spacer(10);

  stepHeader('3단계  ·  학습 결과 확인', ORANGE);
  row('「학습기록」 탭에 학생들의 도전 결과(점수·정답률·날짜)가 실시간으로 쌓입니다.', {});
  row('상단 [📊 달의 위상 여행 대시보드] 메뉴 → [📈 전체 통계 보기]로 그래프와 표도 볼 수 있어요.', {});
  spacer(16);

  // ── FAQ ──
  row('❓ 자주 묻는 질문', { bold: true, size: 14, color: BLUE });
  function faq(q, a) {
    row('Q. ' + q, { bold: true, color: NAVY, bg: LIGHT, height: 24 });
    row('A. ' + a, { height: 36 });
    spacer(4);
  }
  faq('선생님도 주소(웹앱)를 배포하거나 링크를 만들어야 하나요?',
      '아니요. 선생님은 아무것도 배포·설치하지 않습니다. ① 학생 이름 넣기 ② 앱 주소 알려주기 ③ 결과 보기, 이게 전부입니다.');
  faq('학생이 뭔가 설정해야 하나요?',
      '아니요. 학생은 앱 주소만 누르고 자기 이름만 고르면 됩니다.');
  faq('학생이 다시 도전하면 이전 기록이 사라지나요?',
      '사라지지 않습니다. 「학습기록」 탭에 매번 새 줄로 쌓이고, 「학생명단」에는 가장 최근 점수가 표시됩니다.');
  faq('학생 화면이 "예시 데이터"라고 나와요.',
      '관리자가 앱에 이 시트를 연결(아래 최초 설정)했는지 확인이 필요합니다.');
  spacer(14);

  // ── 관리자(개발자) 최초 설정 — 1번만 ──
  stepHeader('🔧 관리자(개발자) 전용 — 최초 1번만', NAVY);
  row('① 이 시트에서 [확장 프로그램]→[Apps Script]→[배포]→[새 배포]→[웹 앱] (실행: 나 / 액세스: 모든 사용자) → URL(.../exec) 복사', {});
  row('② GitHub의 index.html 맨 위 DEFAULT_API_URL 에 그 주소를 붙여넣고 GitHub Pages로 배포', {});
  row('③ 완성된 GitHub 앱 주소를 선생님들에게 공유 (위 2단계의 "앱 주소"가 바로 이것)', {});
  row('※ 이 한 번의 설정으로 모든 선생님·학생은 그 주소만 쓰면 됩니다. (이후엔 아무도 배포·링크 안 만듦)', { color: '#5f6368', italic: true });
  spacer(14);

  row('🌟 통계 보기: [📊 달의 위상 여행 대시보드] 메뉴에서 사이드바 요약과 전체 통계 대시보드를 볼 수 있어요.',
      { bg: '#e8f0fe', color: BLUE, bold: true, height: 30 });

  sh.setFrozenRows(2);
  sh.getRange(1, 1).activate();
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
  document.getElementById('loading').textContent = '⚠ 데이터 불러오기 실패: ' + err.message;
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
  📊 달의 위상 여행 — 전체 통계 대시보드
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
  document.getElementById('loading').textContent = '⚠ 데이터 불러오기 실패: ' + err.message;
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
