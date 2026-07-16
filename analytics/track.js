/* 웹카드 사용측정 — 경량 비컨 (개인정보 수집 안 함, 랜덤 id만)
 * 배포 후 아래 ENDPOINT에 Apps Script 웹앱 URL을 붙여넣으면 켜진다.
 * URL이 비어있으면 아무 것도 하지 않는다(안전한 no-op).
 */
(function () {
  var ENDPOINT = "https://script.google.com/macros/s/AKfycbzm0PSVdHvp5ZRkLPa9kwgp1g2Eks96ykW2FGfDVqnY4gajOXwwUXavlwZWFEWVnlPaWA/exec";
  if (ENDPOINT.indexOf("script.google") < 0) return; // 미설정 시 끔

  function rid() { return Math.random().toString(36).slice(2, 10); }

  // 방문자 id(영구) / 세션 id(이번 방문) / 재방문 여부
  var vid = "", ret = 0;
  try {
    vid = localStorage.getItem("wc_vid") || "";
    if (!vid) { vid = rid() + rid(); localStorage.setItem("wc_vid", vid); }
    ret = localStorage.getItem("wc_seen") ? 1 : 0;
    localStorage.setItem("wc_seen", "1");
  } catch (e) { vid = rid() + rid(); }
  var sid = rid();

  // 자료 슬러그: /webcard/2607/si-uw/ -> "2607/si-uw", 루트 -> "home"
  var parts = location.pathname.replace(/\/index\.html$/, "").replace(/\/$/, "").split("/").filter(Boolean);
  if (parts[0] === "webcard") parts.shift();
  var card = parts.length ? parts.join("/") : "home";

  var dev = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? "m" : "d";

  // 대시보드에 표시할 사람이 읽는 제목 (각 카드 <meta name="wc-title">에서)
  var mt = document.querySelector('meta[name="wc-title"]');
  var ttl = mt ? (mt.getAttribute("content") || "") : "";

  var t0 = Date.now();
  var maxSlide = 0;

  function send(ev, detail) {
    var body = JSON.stringify({
      vid: vid, sid: sid, card: card, ttl: ttl, ev: ev,
      detail: detail == null ? "" : String(detail),
      dev: dev, ret: ret, ref: document.referrer || ""
    });
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon(ENDPOINT, new Blob([body], { type: "text/plain;charset=UTF-8" }));
      } else {
        fetch(ENDPOINT, { method: "POST", body: body, mode: "no-cors", keepalive: true });
      }
    } catch (e) {}
  }
  window.wc = send; // 수동 이벤트: wc('tap','breast')

  // 방문 1건
  send("pageview");

  // 슬라이드 도달 깊이(자동) — 카드 페이지에만 .slide 존재
  var deck = document.getElementById("deck");
  var opt = { threshold: [0.55] };
  if (deck) opt.root = deck;
  var slides = document.querySelectorAll(".slide");
  slides.forEach(function (s, i) {
    new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.intersectionRatio > 0.55 && i + 1 > maxSlide) {
          maxSlide = i + 1;
          send("slide", maxSlide);
        }
      });
    }, opt).observe(s);
  });

  // 체류시간(이탈 시 1건) — 총 초 + 최종 도달 슬라이드
  var byeSent = false;
  function bye() {
    if (byeSent) return; byeSent = true;
    send("dwell", Math.round((Date.now() - t0) / 1000) + "|max" + maxSlide);
  }
  addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") bye();
  });
  addEventListener("pagehide", bye);
})();
