/* 웹카드 사용측정 수집기 (Google Apps Script)
 * 1) 구글드라이브에서 새 스프레드시트 생성
 * 2) 확장 프로그램 > Apps Script > 이 코드 전체 붙여넣기 > 저장
 * 3) 배포 > 새 배포 > 유형:웹 앱 > 실행:나 / 액세스:모든 사용자 > 배포
 * 4) 나온 "웹 앱 URL"을 track.js의 ENDPOINT에 붙여넣기
 *    (같은 URL을 브라우저로 열면 대시보드가 보임)
 * ※ 코드를 고친 뒤엔 배포 > 배포 관리 > 연필 > 버전:새 버전 > 배포 (URL 유지)
 */
var SHEET = "log";
var HEAD = ["시각", "자료", "제목", "이벤트", "상세", "방문자", "세션", "기기", "재방문", "referrer"];
var EVLBL = { tap: "항목", term: "용어", check: "체크", go: "이동" };

function _sheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET);
  if (!sh) { sh = ss.insertSheet(SHEET); sh.appendRow(HEAD); }
  return sh;
}

function doPost(e) {
  try {
    var d = JSON.parse(e.postData.contents);
    var lock = LockService.getScriptLock();   // 동시 접속 시 행 유실 방지
    lock.waitLock(8000);
    try {
      _sheet().appendRow([new Date(), d.card || "", d.ttl || "", d.ev || "", d.detail || "",
        d.vid || "", d.sid || "", d.dev || "", d.ret || 0, d.ref || ""]);
    } finally { lock.releaseLock(); }
  } catch (err) {}
  return ContentService.createTextOutput("ok");
}

/* ---------- 대시보드 ---------- */
function doGet() {
  var sh = _sheet();
  var rows = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, HEAD.length).getValues() : [];
  var cards = {};
  function C(c) {
    return cards[c] || (cards[c] = {
      title: "", views: {}, sessions: {}, tapSess: {}, taps: {}, slideSess: {},
      dwell: [], mobile: 0, desktop: 0, ret: 0, retTot: 0, lastSlide: 0
    });
  }
  rows.forEach(function (r) {
    var card = r[1], ttl = r[2], ev = r[3], det = String(r[4]), vid = r[5], sid = r[6], dev = r[7], ret = r[8];
    var o = C(card);
    if (ttl) o.title = ttl;
    if (ev === "pageview") {
      o.views[vid] = 1; o.sessions[sid] = 1;
      if (dev === "m") o.mobile++; else o.desktop++;
      o.retTot++; if (ret == 1) o.ret++;
    } else if (ev === "slide") {
      var n = parseInt(det, 10) || 0;
      if (n > o.lastSlide) o.lastSlide = n;
      (o.slideSess[n] = o.slideSess[n] || {})[sid] = 1;
    } else if (ev === "dwell") {
      var s = parseInt(det, 10); if (s >= 0) o.dwell.push(s);
    } else if (EVLBL[ev]) {
      o.tapSess[sid] = 1;
      var k = ev + "\t" + det; o.taps[k] = (o.taps[k] || 0) + 1;
    }
  });

  // 표시 순서: home은 맨 뒤
  var names = Object.keys(cards).sort();
  names.sort(function (a, b) { return (a === "home") - (b === "home"); });

  function nn(o) { return Object.keys(o).length; }
  function avg(a) { return a.length ? Math.round(a.reduce(function (x, y) { return x + y; }, 0) / a.length) : 0; }
  function esc(s) { return String(s).replace(/[<>&]/g, function (c) { return { "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]; }); }
  function pct(n, d) { return d ? Math.round(n / d * 100) + "%" : "–"; }
  function ttlOf(name) { return cards[name].title || name; }

  // 카드별 파생 지표
  function M(name) {
    var o = cards[name];
    var ses = nn(o.sessions);
    var comp = (o.lastSlide && o.slideSess[o.lastSlide]) ? nn(o.slideSess[o.lastSlide]) : 0;
    return {
      vis: nn(o.views), ses: ses,
      tap: pct(nn(o.tapSess), ses),
      comp: o.lastSlide ? pct(comp, ses) : "–",
      dwell: avg(o.dwell) + "s",
      ret: pct(o.ret, o.retTot),
      dev: o.mobile + " / " + o.desktop
    };
  }

  var css = "body{font-family:-apple-system,'Apple SD Gothic Neo',sans-serif;margin:0;background:#f4f6fa;color:#1a2233;-webkit-text-size-adjust:100%}"
    + ".wrap{max-width:900px;margin:0 auto;padding:22px 14px 60px}"
    + "h1{font-size:20px;margin:6px 0 2px}.sub{color:#8a94a6;font-size:12px;margin-bottom:20px}"
    + ".box{background:#fff;border-radius:16px;padding:18px;margin-bottom:18px;box-shadow:0 2px 10px rgba(20,40,80,.06);overflow-x:auto}"
    + ".box>h2{font-size:14px;color:#12305C;margin:0 0 12px}"
    + ".ct{font-size:16px;font-weight:800;color:#12305C;margin:0 0 4px}.cslug{font-size:11px;color:#aab2c0;margin-bottom:12px}"
    + "table{border-collapse:collapse;width:100%;font-size:13px}"
    + "th,td{padding:9px 12px;text-align:right;white-space:nowrap}"
    + "th:first-child,td:first-child{text-align:left}"
    + "thead th{background:#12305C;color:#fff;font-weight:700;position:sticky;left:0}"
    + "tbody tr:nth-child(even){background:#f7f9fc}"
    + ".cmp th{background:#12305C;color:#fff}.cmp td:first-child{color:#667;font-weight:600}"
    + ".cmp .big{font-size:15px;font-weight:800;color:#12305C}"
    + ".mini{margin-top:6px}.mini caption{text-align:left;font-size:12px;font-weight:700;color:#556;padding:10px 0 6px}"
    + ".mini th{background:#eef1f6;color:#445}.tag{display:inline-block;font-size:11px;color:#12305C;background:#eaf0fb;border-radius:5px;padding:1px 6px;margin-right:6px}"
    + ".empty{color:#aab;font-size:13px}.two{display:grid;grid-template-columns:1fr 1fr;gap:22px}@media(max-width:640px){.two{grid-template-columns:1fr}}";

  var h = "<style>" + css + "</style><div class='wrap'><h1>웹카드 사용측정</h1>"
    + "<div class='sub'>총 " + rows.length + "행 · 새로고침하면 최신</div>";

  if (!names.length) { return HtmlService.createHtmlOutput(h + "<div class='box empty'>아직 데이터가 없습니다.</div></div>").setTitle("웹카드 사용측정"); }

  // ===== 1) 비교표 (엑셀식 한눈에) =====
  var metrics = [["방문자", "vis", 1], ["세션", "ses", 1], ["탭 참여율", "tap", 0],
    ["완주율", "comp", 0], ["평균 체류", "dwell", 0], ["재방문율", "ret", 0], ["모바일/PC", "dev", 0]];
  var Ms = {}; names.forEach(function (n) { Ms[n] = M(n); });
  h += "<div class='box'><h2>자료 비교</h2><table class='cmp'><thead><tr><th>지표</th>";
  names.forEach(function (n) { h += "<th>" + esc(ttlOf(n)) + "</th>"; });
  h += "</tr></thead><tbody>";
  metrics.forEach(function (m) {
    h += "<tr><td>" + m[0] + "</td>";
    names.forEach(function (n) { h += "<td" + (m[2] ? " class='big'" : "") + ">" + Ms[n][m[1]] + "</td>"; });
    h += "</tr>";
  });
  h += "</tbody></table></div>";

  // ===== 2) 카드별 상세 (퍼널 + 탭 랭킹) =====
  names.forEach(function (name) {
    var o = cards[name], ses = nn(o.sessions);
    h += "<div class='box'><div class='ct'>" + esc(ttlOf(name)) + "</div><div class='cslug'>" + esc(name) + "</div><div class='two'>";

    // 슬라이드 퍼널
    h += "<div>";
    if (o.lastSlide) {
      h += "<table class='mini'><caption>슬라이드 도달</caption><thead><tr><th>슬라이드</th><th>도달</th><th>유지율</th></tr></thead><tbody>";
      for (var i = 1; i <= o.lastSlide; i++) {
        var c = o.slideSess[i] ? nn(o.slideSess[i]) : 0;
        h += "<tr><td>" + i + "장</td><td>" + c + "</td><td>" + pct(c, ses) + "</td></tr>";
      }
      h += "</tbody></table>";
    } else { h += "<table class='mini'><caption>슬라이드 도달</caption></table><div class='empty'>슬라이드 없음</div>"; }
    h += "</div>";

    // 탭 랭킹
    h += "<div><table class='mini'><caption>탭 랭킹</caption>";
    var tk = Object.keys(o.taps).sort(function (a, b) { return o.taps[b] - o.taps[a]; });
    if (tk.length) {
      h += "<thead><tr><th>구분</th><th>항목</th><th>횟수</th></tr></thead><tbody>";
      tk.forEach(function (k) {
        var p = k.split("\t");
        h += "<tr><td><span class='tag'>" + (EVLBL[p[0]] || p[0]) + "</span></td><td>" + esc(p[1] || "") + "</td><td>" + o.taps[k] + "</td></tr>";
      });
      h += "</tbody>";
    } else { h += "<tbody><tr><td class='empty'>아직 탭 기록 없음</td></tr></tbody>"; }
    h += "</table></div>";

    h += "</div></div>";
  });

  h += "</div>";
  return HtmlService.createHtmlOutput(h).setTitle("웹카드 사용측정");
}
