require('dotenv').config();
// SSL 인증서 검증 비활성화 (la2fdoci.com 등 자체 인증서 사이트 대응)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const express = require('express');
const http = require('http');
const https = require('https');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
let puppeteer;
try { puppeteer = require('puppeteer'); } catch(e) { 
  try { puppeteer = require('puppeteer-core'); } catch(e2) {
    console.log('⚠️ Puppeteer 없음 — 크롤링 비활성 (Vercel 모드)');
    puppeteer = null;
  }
}
var cheerio;
try { cheerio = require('cheerio'); } catch(e) { console.log('cheerio 미설치 → npm install cheerio'); }
var sbSync = require('./supabase_sync');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
app.use(express.json({ limit: '20mb' }));

// ═══ 보안: 민감 파일 접근 차단 ═══
app.use(function(req, res, next) {
  var blocked = ['.env', '.git', '_sales_data.json', '_gen_excel.py', '.kakao_msg'];
  var reqPath = req.path.toLowerCase();
  for (var i = 0; i < blocked.length; i++) {
    if (reqPath.indexOf(blocked[i]) >= 0) {
      return res.status(403).json({ error: 'Access denied' });
    }
  }
  next();
});

app.use(function(req, res, next) {
  if (req.path.endsWith('.html') || req.path === '/') {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
  }
  next();
});
app.use(express.static(path.join(__dirname, 'public')));

// ═══ 전역 상태 ═══
const STATE = {
  tickets: [],
  posLog: [],
  logs: [],
  reviews: [],  // 리뷰 이벤트 리워드
  rewardConfig: {
    enabled: true,
    rewards: [
      { id: 'juice', name: '오디쥬스', emoji: '🧃', desc: '신선한 오디쥬스 1잔' },
      { id: 'jelly', name: '오디젤리', emoji: '🍬', desc: '수제 오디젤리 1봉' },
      { id: 'ticket', name: '재방문 입장권', emoji: '🎫', desc: '다음날부터 본인만 사용가능 입장권 1매' },
    ],
    platforms: ['naver', 'momcafe', 'sns'],
  },
  crawlStatus: { la2fdoci: 'idle', naver: 'idle', okpos: 'idle' },
  sessions: { la2fdoci: false, naver: false, okpos: false },
  isRunning: false,
  totalCrawls: 0,
  browsers: {},
  pages: {},
  // ═══ 예약 관리 확장 ═══
  staff: [
    { id: 'admin', name: '관리자', pin: '1234', role: 'admin' },
    { id: 'staff1', name: '김직원', pin: '5678', role: 'staff' },
    { id: 'staff2', name: '이직원', pin: '9012', role: 'staff' },
  ],
  experiences: [
    { id: 'exp1', name: '누에 먹이주기 체험', duration: 40, capacity: 15, price: 8000, color: '#10b981' },
    { id: 'exp2', name: '실크 손수건 만들기', duration: 60, capacity: 10, price: 12000, color: '#8b5cf6' },
    { id: 'exp3', name: '동물먹이 체험', duration: 30, capacity: 20, price: 5000, color: '#f59e0b' },
    { id: 'exp4', name: '전통 물레체험', duration: 45, capacity: 8, price: 10000, color: '#ec4899' },
  ],
  expBookings: [],
  rentals: [
    { id: 'bench-back-1', name: '등받이평상 A', type: 'bench', subtype: 'back', price: 50000, color: '#10b981', desc: '물놀이장 앞 · 등받이 있음', deposit: 10000 },
    { id: 'bench-back-2', name: '등받이평상 B', type: 'bench', subtype: 'back', price: 50000, color: '#059669', desc: '물놀이장 앞 · 등받이 있음', deposit: 10000 },
    { id: 'bench-normal-1', name: '일반평상 A', type: 'bench', subtype: 'normal', price: 40000, color: '#3b82f6', desc: '물놀이장 앞 · 등받이 없음', deposit: 10000 },
    { id: 'bench-normal-2', name: '일반평상 B', type: 'bench', subtype: 'normal', price: 40000, color: '#2563eb', desc: '물놀이장 앞 · 등받이 없음', deposit: 10000 },
    { id: 'bench-deck-1', name: '데크평상 A', type: 'bench', subtype: 'deck', price: 40000, color: '#6366f1', desc: '사계절썰매장 앞 데크 위', deposit: 10000 },
    { id: 'bench-deck-2', name: '데크평상 B', type: 'bench', subtype: 'deck', price: 40000, color: '#4f46e5', desc: '사계절썰매장 앞 데크 위', deposit: 10000 },
    { id: 'bench-vip-1', name: 'VIP평상 A', type: 'bench', subtype: 'vip', price: 50000, color: '#f59e0b', desc: '물놀이장 바로 앞 · 바람막이', deposit: 10000 },
    { id: 'bench-vip-2', name: 'VIP평상 B', type: 'bench', subtype: 'vip', price: 50000, color: '#d97706', desc: '물놀이장 바로 앞 · 바람막이', deposit: 10000 },
    { id: 'cabin-1', name: '오두막 A', type: 'cabin', price: 70000, color: '#ef4444', desc: '종일권', deposit: 10000 },
    { id: 'cabin-2', name: '오두막 B', type: 'cabin', price: 70000, color: '#dc2626', desc: '종일권', deposit: 10000 },
    { id: 'camping-1', name: '캠핑테이블 A', type: 'camping', price: 40000, color: '#8b5cf6', desc: '4인기준 · 의자추가 5천원', deposit: 10000 },
    { id: 'camping-2', name: '캠핑테이블 B', type: 'camping', price: 40000, color: '#7c3aed', desc: '4인기준 · 의자추가 5천원', deposit: 10000 },
  ],
  rentalBookings: [],
  spotScans: {},
  spotScanLogs: [],
  config: {
    la2fdoci: { loginUrl: process.env.LA2F_URL || 'https://la2fdoci.com/partner/login.do', orderUrl: process.env.LA2F_ORDER || 'https://la2fdoci.com/partner/order/orderList.do', id: process.env.LA2F_ID || 'jamsa', pw: process.env.LA2F_PW || '1234' },
    naver: { bookingUrl: process.env.NAVER_URL || '', id: process.env.NAVER_ID || 'jamsa0433', pw: process.env.NAVER_PW || 'skyeduc0089@', placeId: process.env.NAVER_PLACE_ID || '4789821', bizId: process.env.NAVER_BIZ_ID || '507900', partnerBizId: process.env.NAVER_PARTNER_BIZ_ID || '784618', bizName: process.env.NAVER_BIZ_NAME || '한국잠사플레이팝', dateFrom: '', dateTo: '' },
    okpos: { aspUrl: process.env.OKPOS_URL || 'https://nice.okpos.co.kr', id: process.env.OKPOS_ID || 'hhbq', pw: process.env.OKPOS_PW || 'a2351267!!', storeCode: process.env.OKPOS_STORE || '', auto: false, dateFrom: '2025-05-01', dateTo: '', priceMap: (function(){ try { return JSON.parse(process.env.OKPOS_PRICE_MAP || '{}'); } catch(e) { return {}; } })(),
      accounts: (function(){ try { var env = JSON.parse(process.env.OKPOS_ACCOUNTS || '[]'); return env.length > 0 ? env : [
        { id: 'b92773', pw: 'a2351267!', name: 'b92773', storeCode: '', enabled: true, dateFrom: '2021-01-01', dateTo: '2025-05-22' },
        { id: 'b92775', pw: 'a2351267!', name: 'b92775', storeCode: '', enabled: true, dateFrom: '2021-01-01', dateTo: '2025-05-22' },
        { id: 'k46548', pw: 'a2351267!', name: 'k46548', storeCode: '', enabled: true, dateFrom: '2023-03-22', dateTo: '2025-05-22' },
        { id: 'n45125', pw: 'a2351267!!', name: 'n45125', storeCode: '', enabled: true, dateFrom: '2026-03-21', dateTo: '' }
      ]; } catch(e) { return [
        { id: 'b92773', pw: 'a2351267!', name: 'b92773', storeCode: '', enabled: true, dateFrom: '2021-01-01', dateTo: '2025-05-22' },
        { id: 'b92775', pw: 'a2351267!', name: 'b92775', storeCode: '', enabled: true, dateFrom: '2021-01-01', dateTo: '2025-05-22' },
        { id: 'k46548', pw: 'a2351267!', name: 'k46548', storeCode: '', enabled: true, dateFrom: '2023-03-22', dateTo: '2025-05-22' },
        { id: 'n45125', pw: 'a2351267!!', name: 'n45125', storeCode: '', enabled: true, dateFrom: '2026-03-21', dateTo: '' }
      ]; } })()
    },
    telegram: { botToken: process.env.TELEGRAM_BOT_TOKEN || '', chatId: process.env.TELEGRAM_CHAT_ID || '', enabled: !!(process.env.TELEGRAM_BOT_TOKEN) },
    kakao: { room: process.env.KAKAO_ROOM || '잠사 예성씨', dailyRoom: process.env.KAKAO_DAILY_ROOM || '', dailyAutoTime: process.env.KAKAO_DAILY_AUTO_TIME || '', dailyAutoEnabled: process.env.KAKAO_DAILY_AUTO_ENABLED === '1', sectionRooms: (function(){try{return JSON.parse(process.env.KAKAO_SECTION_ROOMS||'{}');}catch(e){return {};}})(), timeRoom: process.env.KAKAO_TIME_ROOM || '', timeAutoTime: process.env.KAKAO_TIME_AUTO_TIME || '', timeAutoEnabled: process.env.KAKAO_TIME_AUTO_ENABLED === '1', enabled: true },
    crawlInterval: parseInt(process.env.CRAWL_INTERVAL) || 120,
    crawlDateFrom: '',
    crawlDateTo: '',
    msg: {
      provider: process.env.MSG_PROVIDER || 'ppurio',  // ppurio, aligo, coolsms, kakao, direct
      baseUrl: process.env.BASE_URL || '',  // 외부 접속 URL (예: https://jamsabak.kr)
      aligoKey: process.env.ALIGO_KEY || '',
      aligoId: process.env.ALIGO_ID || '',
      aligoSender: process.env.ALIGO_SENDER || '',
      coolsmsKey: process.env.COOLSMS_KEY || '',
      coolsmsSecret: process.env.COOLSMS_SECRET || '',
      coolsmsSender: process.env.COOLSMS_SENDER || '',
      kakaoKey: process.env.KAKAO_KEY || '',
      kakaoSenderKey: process.env.KAKAO_SENDER_KEY || '',
      kakaoTemplateCode: process.env.KAKAO_TEMPLATE || '',
      autoSend: false,        // 크롤링 감지 시 자동 발송
      naverPlaceUrl: process.env.NAVER_PLACE_URL || 'https://map.naver.com/p/search/%EC%9E%A0%EC%82%AC%EB%B0%95%EB%AC%BC%EA%B4%80/place/1591058710',
      naverNotice: process.env.NAVER_NOTICE || '운영 10:00~18:00(입장마감17시)/24개월미만 무료(증빙지참)/매표소 핸드링착용 후 입장/주차가능/반려동물 불가',
      templates: [
        { id: 'welcome', name: '입장권 안내', type: 'sms',
          body: '[한국잠사박물관]\n{buyer}님 입장권이 확인되었습니다.\n\n■ 상품: {product}\n■ 매수: {qty}매\n■ QR코드: {qrUrl}\n\n📱 스마트 방문센터\n{visitUrl}\nQR입장·AI추천일정·체험예약·매점주문을 한번에!\n\n즐거운 관람 되세요!' },
        { id: 'remind', name: '방문 리마인드', type: 'sms',
          body: '[한국잠사박물관]\n{buyer}님, 오늘 방문 예정입니다.\n\n■ 상품: {product}\n■ 매수: {qty}매\n\n운영시간: 09:00~18:00\n주소: 충북 청주시 흥덕구' },
        { id: 'complete', name: '이용완료 감사', type: 'sms',
          body: '[한국잠사박물관]\n{buyer}님 이용해주셔서 감사합니다.\n\n방문 후기를 남겨주시면 다음 방문 시 할인 혜택을 드립니다.\n\n감사합니다.' },
        { id: 'kakao_welcome', name: '카카오 입장안내', type: 'kakao',
          body: '{buyer}님의 입장권이 확인되었습니다.\n상품: {product}\n매수: {qty}매' },
      ],
    },
  },
  msgHistory: [],  // 발송 이력
  useHistory: [],  // 사용처리 이력
  crawlAborted: false,
  // ═══ 크롤링 단계별 설정 (UI에서 수정 가능) ═══
  crawlSteps: {
    la2fdoci: {
      login: {
        label: '① 로그인',
        idSelector: 'input[name="id"], input[name="userId"], input#id',
        pwSelector: 'input[type="password"]',
        submitMethod: 'form.submit() 또는 .login_btn 클릭',
        waitAfter: 2000,
        enabled: true
      },
      search: {
        label: '② 검색조건 설정',
        urlParams: 'dateType=1&dateAll=false&use=true&useComplete=true&cancel=true&expire=true',
        dateFormat: 'YYYY-MM-DD',
        waitAfter: 1500,
        enabled: true
      },
      parse: {
        label: '③ 테이블 파싱',
        tableSelector: 'table tbody tr',
        rowNoCol: 0,
        orderNoCol: 1,
        productCol: 2,
        reserveDateCol: 3,
        priceCol: 4,
        supplyPriceCol: 5,
        couponNoCol: 6,
        validDateCol: 7,
        lastUseCol: 8,
        buyerCol: 9,
        phoneCol: 10,
        sentDateCol: 11,
        statusCol: 14,
        enabled: true
      },
      pagination: {
        label: '④ 페이지네이션',
        method: 'goPage → 다음버튼 → URL',
        nextBtnText: '다음',
        rowsPerPage: 30,
        pollInterval: 1000,
        pollAttempts: 8,
        enabled: true
      },
      markUsed: {
        label: '⑤ 사용완료 처리',
        searchSelectOpt: '주문번호',
        searchBtnText: '검색',
        statusDropdownOpt: '사용완료',
        waitAfterChange: 1500,
        enabled: true
      }
    },
    naver: {
      login: {
        label: '① 로그인',
        loginUrl: 'https://new-m.pay.naver.com/pcpay/main',
        idSelector: '#id',
        pwSelector: '#pw',
        waitAfter: 3000,
        enabled: true
      },
      navigate: {
        label: '② 예약관리 이동',
        method: 'HTML추출 → 사이드바클릭 → URL직접',
        bookingUrlPattern: '/booking/booking/bookingList',
        waitAfter: 2000,
        enabled: true
      },
      filter: {
        label: '③ 필터 설정',
        dateFilter: 'USEDATE',
        statusCodes: 'RC01',
        retryStatusCodes: ['RC01,RC02', 'RC01,RC02,RC03', ''],
        waitAfter: 2000,
        enabled: true
      },
      parse: {
        label: '④ 테이블 파싱',
        tableSelector: 'table tbody tr',
        enabled: true
      },
      markUsed: {
        label: '⑤ 이용완료 처리',
        method: '이용완료 버튼 클릭',
        enabled: true
      }
    }
  },
  crawlLive: { la2fdoci: null, naver: null },  // 실시간 스크린샷
};
let crawlTimer = null;

// ═══════════════════════════════════════════════════════════════
//  로컬 영구 저장 — 크롤링 데이터 서버 재시작해도 유지
// ═══════════════════════════════════════════════════════════════
var LOCAL_DATA_DIR = path.join(__dirname, '.data');
if (!fs.existsSync(LOCAL_DATA_DIR)) fs.mkdirSync(LOCAL_DATA_DIR, { recursive: true });
var LOCAL_TICKETS_FILE = path.join(LOCAL_DATA_DIR, 'tickets.json');
var LOCAL_USEHISTORY_FILE = path.join(LOCAL_DATA_DIR, 'use_history.json');

// 저장 (디바운스: 2초 내 중복 호출 방지)
var _saveTimer = null;
function saveTicketsLocal() {
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(function() {
    try {
      var data = {
        tickets: STATE.tickets,
        useHistory: STATE.useHistory || [],
        savedAt: new Date().toISOString(),
        count: STATE.tickets.length,
      };
      fs.writeFileSync(LOCAL_TICKETS_FILE, JSON.stringify(data), 'utf-8');
    } catch(e) { /* 저장 실패 무시 */ }
  }, 2000);
}

// 복원 (서버 시작 시)
function loadTicketsLocal() {
  try {
    if (fs.existsSync(LOCAL_TICKETS_FILE)) {
      var raw = fs.readFileSync(LOCAL_TICKETS_FILE, 'utf-8');
      var data = JSON.parse(raw);
      if (Array.isArray(data.tickets) && data.tickets.length > 0) {
        // 기존 STATE.tickets과 병합 (ID 기준 중복 제거)
        var existingIds = {};
        STATE.tickets.forEach(function(t) { existingIds[t.id] = true; });
        var added = 0;
        data.tickets.forEach(function(t) {
          if (!existingIds[t.id]) {
            STATE.tickets.push(t);
            existingIds[t.id] = true;
            added++;
          }
        });
        console.log('  💾 로컬 복원: ' + data.tickets.length + '건 (신규 ' + added + '건 추가)');
        if (data.savedAt) console.log('  💾 저장시각: ' + data.savedAt);
      }
      if (Array.isArray(data.useHistory) && (!STATE.useHistory || STATE.useHistory.length === 0)) {
        STATE.useHistory = data.useHistory;
      }
    }
  } catch(e) { console.log('  💾 로컬 복원 실패: ' + e.message); }
}
loadTicketsLocal();

// ═══ 크롤링 중단 메커니즘 ═══
class CrawlAbortError extends Error { constructor() { super('크롤링 중단됨'); this.name = 'CrawlAbortError'; } }
function checkAbort() { if (STATE.crawlAborted) throw new CrawlAbortError(); }

// ═══ 유틸 ═══
function log(cat, msg, status) {
  status = status || 'info';
  const entry = { id: Date.now() + Math.random(), time: new Date().toISOString(), cat: cat, msg: msg, status: status };
  STATE.logs.unshift(entry);
  if (STATE.logs.length > 500) STATE.logs.length = 500;
  broadcast({ type: 'log', data: entry });
  var icon = status === 'success' ? '✅' : status === 'error' ? '❌' : status === 'warning' ? '⚠️' : 'ℹ️';
  console.log(icon + ' [' + cat + '] ' + msg);
}

function broadcast(data) {
  var msg = JSON.stringify(data);
  wss.clients.forEach(function(c) { if (c.readyState === WebSocket.OPEN) c.send(msg); });
}

// 크롤링 실시간 스크린샷 전송
async function crawlLive(key, stepLabel) {
  try {
    var url = '';
    var base64 = null;
    
    if (STATE.pages[key]) {
      var page = STATE.pages[key];
      try { url = page.url(); } catch(e) {}
      base64 = await page.screenshot({ encoding: 'base64', type: 'jpeg', quality: 40 }).catch(function() { return null; });
    }
    
    // 스크린샷 없어도 상태는 전송 (HTTP 크롤러용)
    STATE.crawlLive[key] = { img: base64, step: stepLabel, url: url, time: Date.now() };
    broadcast({ type: 'crawlLive', key: key, step: stepLabel, url: url, img: base64, time: Date.now() });
  } catch(e) {}
}

var _sendStateTimer = null;
function sendState() {
  // debounce: 500ms 이내 연속 호출 시 마지막 것만 실행
  if (_sendStateTimer) clearTimeout(_sendStateTimer);
  _sendStateTimer = setTimeout(function() {
    _sendStateTimer = null;
    _sendStateNow();
  }, 500);
}
function sendStateImmediate() { if (_sendStateTimer) clearTimeout(_sendStateTimer); _sendStateTimer = null; _sendStateNow(); }
function _sendStateNow() {
  saveTicketsLocal(); // ★ 상태 변경 시 자동 로컬 저장
  broadcast({ type: 'state', data: {
    tickets: STATE.tickets,
    posLog: STATE.posLog,
    crawlStatus: STATE.crawlStatus,
    isRunning: STATE.isRunning,
    totalCrawls: STATE.totalCrawls,
    sessions: STATE.sessions,
    experiences: STATE.experiences,
    expBookings: STATE.expBookings,
    rentals: STATE.rentals,
    rentalBookings: STATE.rentalBookings,
    config: {
      la2fdoci: { id: STATE.config.la2fdoci.id, loginUrl: STATE.config.la2fdoci.loginUrl, orderUrl: STATE.config.la2fdoci.orderUrl },
      naver: { id: STATE.config.naver.id, bookingUrl: STATE.config.naver.bookingUrl },
      okpos: { id: STATE.config.okpos.id, aspUrl: STATE.config.okpos.aspUrl, storeCode: STATE.config.okpos.storeCode, auto: STATE.config.okpos.auto, dateFrom: STATE.config.okpos.dateFrom||'', dateTo: STATE.config.okpos.dateTo||'', accounts: STATE.config.okpos.accounts||[] },
      kakao: { room: STATE.config.kakao.room, dailyRoom: STATE.config.kakao.dailyRoom||'', dailyAutoTime: STATE.config.kakao.dailyAutoTime||'', dailyAutoEnabled: !!STATE.config.kakao.dailyAutoEnabled, sectionRooms: STATE.config.kakao.sectionRooms||{}, timeRoom: STATE.config.kakao.timeRoom||'', timeAutoTime: STATE.config.kakao.timeAutoTime||'', timeAutoEnabled: !!STATE.config.kakao.timeAutoEnabled, enabled: STATE.config.kakao.enabled },
      anthropicKeyMasked: (process.env.ANTHROPIC_API_KEY ? process.env.ANTHROPIC_API_KEY.substring(0,8)+'...'+process.env.ANTHROPIC_API_KEY.slice(-4) : ''), crawlInterval: STATE.config.crawlInterval,
      crawlDateFrom: STATE.config.crawlDateFrom || '',
      crawlDateTo: STATE.config.crawlDateTo || '',
      msg: { provider: STATE.config.msg.provider, ppurioId: STATE.config.msg.ppurioId||'', ppurioKey: STATE.config.msg.ppurioKey||'', ppurioSender: STATE.config.msg.ppurioSender||'', aligoId: STATE.config.msg.aligoId, aligoSender: STATE.config.msg.aligoSender, coolsmsSender: STATE.config.msg.coolsmsSender, kakaoSenderKey: STATE.config.msg.kakaoSenderKey, kakaoTemplateCode: STATE.config.msg.kakaoTemplateCode, autoSend: STATE.config.msg.autoSend, templates: STATE.config.msg.templates, aligoKey: STATE.config.msg.aligoKey||'', coolsmsKey: STATE.config.msg.coolsmsKey||'', coolsmsSecret: STATE.config.msg.coolsmsSecret||'', kakaoKey: STATE.config.msg.kakaoKey||'', naverNotice: STATE.config.msg.naverNotice||'', naverPlaceUrl: STATE.config.msg.naverPlaceUrl||'', baseUrl: STATE.config.msg.baseUrl||'' },
    },
    crawlSteps: STATE.crawlSteps,
    crawlLive: { la2fdoci: STATE.crawlLive.la2fdoci ? { step: STATE.crawlLive.la2fdoci.step, url: STATE.crawlLive.la2fdoci.url, time: STATE.crawlLive.la2fdoci.time } : null, naver: STATE.crawlLive.naver ? { step: STATE.crawlLive.naver.step, url: STATE.crawlLive.naver.url, time: STATE.crawlLive.naver.time } : null },
    lastSyncVerify: STATE.lastSyncVerify || null,
    lastPosCompare: STATE.lastPosCompare || null,
    salesData: STATE.salesData || null,
    timeSalesData: STATE.timeSalesData || null,
    lastSalesCrawl: STATE.lastSalesCrawl || null,
    reviews: STATE.reviews || [],
  }});
}

// ═══ 브라우저 관리 ═══

// ═══ AI 자가진단 시스템 ═══
const AI_KEY = process.env.ANTHROPIC_API_KEY || '';
var aiDiagHistory = []; // 진단 이력 (최근 20건)

async function screenshotBase64(key) {
  try {
    if (!STATE.pages[key]) return null;
    var buf = await STATE.pages[key].screenshot({ encoding: 'base64', type: 'jpeg', quality: 50 });
    return buf;
  } catch(e) { return null; }
}

async function getPageContext(key) {
  try {
    if (!STATE.pages[key]) return { url: '(없음)', html: '', title: '' };
    var page = STATE.pages[key];
    var url = page.url();
    var title = await page.title().catch(function() { return ''; });
    var html = await page.evaluate(function() {
      // 핵심 구조만 추출 (2000자 제한)
      var body = document.body;
      if (!body) return '(body없음)';
      // 테이블 구조
      var tables = [];
      document.querySelectorAll('table').forEach(function(t, i) {
        var rows = t.querySelectorAll('tr').length;
        var firstRow = t.querySelector('tr');
        var cols = firstRow ? firstRow.querySelectorAll('td,th').length : 0;
        var headers = [];
        t.querySelectorAll('th').forEach(function(th) { headers.push(th.textContent.trim().substring(0, 20)); });
        tables.push('table' + i + '(' + rows + 'x' + cols + ')[' + headers.join(',') + ']');
      });
      // 버튼/링크
      var btns = [];
      document.querySelectorAll('button, input[type="button"], input[type="submit"], a.btn').forEach(function(b) {
        var t = (b.textContent || b.value || '').trim();
        if (t && t.length < 20) btns.push(t);
      });
      // 에러 메시지
      var errors = [];
      document.querySelectorAll('.error, .alert, .warning, [class*="err"], [class*="fail"]').forEach(function(el) {
        var t = el.textContent.trim().substring(0, 100);
        if (t) errors.push(t);
      });
      // form 정보
      var forms = [];
      document.querySelectorAll('form').forEach(function(f) {
        var inputs = [];
        f.querySelectorAll('input, select, textarea').forEach(function(inp) {
          inputs.push((inp.type||'text') + ':' + (inp.name||inp.id||'?'));
        });
        forms.push('form[' + inputs.join(',') + ']');
      });
      return JSON.stringify({ tables: tables, buttons: btns.slice(0, 15), errors: errors, forms: forms, bodyLen: body.innerHTML.length });
    }).catch(function() { return '(evaluate실패)'; });
    return { url: url, title: title, html: html };
  } catch(e) { return { url: '(오류)', html: e.message, title: '' }; }
}

async function aiDiagnose(service, errorMsg, options) {
  options = options || {};
  if (!process.env.ANTHROPIC_API_KEY) {
    log('ai', 'API 키 미설정 → 기본 복구 시도', 'warning');
    return await defaultRepair(service, errorMsg);
  }

  log('ai', '🤖 [' + service + '] 자가진단 시작: ' + errorMsg.substring(0, 80));
  broadcast({ type: 'aiDiag', status: 'diagnosing', service: service });

  try {
    var ctx = await getPageContext(service);
    var img64 = await screenshotBase64(service);
    var recentLogs = STATE.logs.filter(function(l) { return l.cat === service; }).slice(0, 10)
      .map(function(l) { return '[' + l.status + '] ' + l.msg; }).join('\n');

    var content = [];
    // 스크린샷 첨부
    if (img64) {
      content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: img64 } });
    }
    content.push({ type: 'text', text: '크롤링 서비스 [' + service + ']에서 오류 발생:\n\n'
      + '【오류】' + errorMsg + '\n'
      + '【현재URL】' + ctx.url + '\n'
      + '【페이지제목】' + ctx.title + '\n'
      + '【페이지구조】' + ctx.html + '\n'
      + '【최근로그】\n' + recentLogs + '\n'
      + (options.extra || '')
      + '\n\n위 정보를 분석하여 JSON으로 답해주세요:'
    });

    var https = require('https');
    var body = JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: '당신은 웹 크롤링 시스템의 자가진단 AI입니다.\n'
        + '크롤링 대상: la2fdoci(입장권 판매관리), naver(네이버 스마트플레이스 예약), okpos(POS시스템)\n'
        + 'puppeteer 기반 헤드리스 크롤러이며 로그인→페이지이동→테이블파싱→티켓등록 순서입니다.\n\n'
        + '반드시 아래 JSON 형식으로만 답하세요(다른 텍스트 없이):\n'
        + '{\n'
        + '  "diagnosis": "문제 원인 (한국어, 1-2문장)",\n'
        + '  "severity": "low|medium|high|critical",\n'
        + '  "actions": [\n'
        + '    {"type": "action_type", "detail": "설명", "params": {}}\n'
        + '  ],\n'
        + '  "preventTip": "재발방지 팁"\n'
        + '}\n\n'
        + 'action_type 종류:\n'
        + '- "relogin": 재로그인 (세션만료, 로그인페이지 리다이렉트)\n'
        + '- "reload": 페이지 새로고침 (일시적 오류, 빈페이지)\n'
        + '- "restart_browser": 브라우저 재시작 (크래시, 메모리 부족)\n'
        + '- "wait_retry": N초 후 재시도 (서버 과부하, 일시적 장애) params: {"seconds": N}\n'
        + '- "change_selector": 셀렉터 변경 (DOM 구조 변경) params: {"old": "...", "new": "..."}\n'
        + '- "clear_cookies": 쿠키 삭제 (인증 캐시 문제)\n'
        + '- "navigate": 특정 URL로 이동 params: {"url": "..."}\n'
        + '- "skip": 이번 크롤 건너뛰기 (점검 등)\n'
        + '- "alert_admin": 관리자 알림 필요 (수동 조치 필요)\n',
      messages: [{ role: 'user', content: content }],
    });

    var result = await new Promise(function(resolve, reject) {
      var req = https.request({
        hostname: 'api.anthropic.com', port: 443, path: '/v1/messages', method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        timeout: 15000,
      }, function(res) {
        var chunks = [];
        res.on('data', function(c) { chunks.push(c); });
        res.on('end', function() {
          try {
            var data = JSON.parse(Buffer.concat(chunks).toString());
            if (data.content && data.content[0]) {
              var text = data.content[0].text || '';
              // JSON 추출
              var jsonMatch = text.match(/\{[\s\S]*\}/);
              if (jsonMatch) resolve(JSON.parse(jsonMatch[0]));
              else reject(new Error('JSON 파싱 실패: ' + text.substring(0, 200)));
            } else if (data.error) {
              reject(new Error('API 오류: ' + (data.error.message || JSON.stringify(data.error))));
            } else {
              reject(new Error('응답 형식 오류'));
            }
          } catch(e) { reject(e); }
        });
      });
      req.on('error', reject);
      req.on('timeout', function() { req.destroy(); reject(new Error('API 타임아웃')); });
      req.write(body);
      req.end();
    });

    // 진단 결과 저장
    var diag = {
      id: Date.now(),
      time: new Date().toISOString(),
      service: service,
      error: errorMsg,
      diagnosis: result.diagnosis || '(분석 없음)',
      severity: result.severity || 'medium',
      actions: result.actions || [],
      preventTip: result.preventTip || '',
      executed: [],
      status: 'diagnosed',
    };
    aiDiagHistory.unshift(diag);
    if (aiDiagHistory.length > 20) aiDiagHistory.length = 20;

    log('ai', '🔍 진단: ' + diag.diagnosis + ' [' + diag.severity + ']');
    log('ai', '🔧 처방: ' + diag.actions.map(function(a) { return a.type; }).join(' → '));
    broadcast({ type: 'aiDiag', status: 'diagnosed', diag: diag });

    // 자동 복구 실행
    await executeRepair(service, diag);
    return diag;

  } catch(e) {
    log('ai', 'AI 진단 실패: ' + e.message + ' → 기본 복구', 'warning');
    broadcast({ type: 'aiDiag', status: 'fallback', service: service });
    return await defaultRepair(service, errorMsg);
  }
}

async function executeRepair(service, diag) {
  for (var i = 0; i < diag.actions.length; i++) {
    var action = diag.actions[i];
    var result = 'skip';
    try {
      switch(action.type) {
        case 'relogin':
          log('ai', '🔄 [' + service + '] 재로그인 실행');
          STATE.sessions[service] = false;
          if (service === 'la2fdoci') result = (await la2fLogin()) ? 'success' : 'failed';
          else if (service === 'naver') { STATE._naver2FAFailedAt = null; result = (await naverLogin()) ? 'success' : 'failed'; }
          else if (service === 'okpos') result = (await okposLogin()) ? 'success' : 'failed';
          break;

        case 'reload':
          log('ai', '🔄 [' + service + '] 페이지 새로고침');
          if (STATE.pages[service]) {
            await STATE.pages[service].reload({ waitUntil: 'domcontentloaded', timeout: 10000 }).catch(function(){});
            await new Promise(function(r) { setTimeout(r, 150); });
            result = 'success';
          } else result = 'no-page';
          break;

        case 'restart_browser':
          log('ai', '🔄 [' + service + '] 브라우저 재시작');
          if (STATE.browsers[service]) { try { await STATE.browsers[service].close(); } catch(e){} }
          STATE.browsers[service] = null;
          STATE.pages[service] = null;
          STATE.sessions[service] = false;
          // getPage가 자동으로 새 브라우저를 시작함
          await getPage(service);
          result = 'success';
          break;

        case 'wait_retry':
          var secs = (action.params && action.params.seconds) || 30;
          log('ai', '⏳ [' + service + '] ' + secs + '초 대기 후 재시도');
          await new Promise(function(r) { setTimeout(r, secs * 1000); });
          result = 'waited';
          break;

        case 'clear_cookies':
          log('ai', '🍪 [' + service + '] 쿠키 삭제');
          if (STATE.pages[service]) {
            var client = await STATE.pages[service].target().createCDPSession();
            await client.send('Network.clearBrowserCookies');
            STATE.sessions[service] = false;
            result = 'success';
          } else result = 'no-page';
          break;

        case 'navigate':
          var url = action.params && action.params.url;
          if (url && STATE.pages[service]) {
            log('ai', '🔗 [' + service + '] 이동: ' + url.substring(0, 80));
            await STATE.pages[service].goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(function(){});
            await new Promise(function(r) { setTimeout(r, 300); });
            result = 'success';
          } else result = 'no-url-or-page';
          break;

        case 'skip':
          log('ai', '⏭ [' + service + '] 이번 크롤 스킵');
          result = 'skipped';
          break;

        case 'alert_admin':
          log('ai', '🚨 [' + service + '] 관리자 수동 조치 필요: ' + (action.detail || ''), 'warning');
          broadcast({ type: 'aiAlert', service: service, message: action.detail || '수동 확인 필요' });
          result = 'alerted';
          break;

        default:
          log('ai', '❓ 알 수 없는 액션: ' + action.type, 'warning');
          result = 'unknown';
      }
    } catch(e) {
      log('ai', '복구 실패 [' + action.type + ']: ' + e.message, 'error');
      result = 'error: ' + e.message;
    }
    diag.executed.push({ action: action.type, result: result });
    log('ai', '  → ' + action.type + ': ' + result, result === 'success' ? 'success' : 'info');
  }
  diag.status = 'repaired';
  broadcast({ type: 'aiDiag', status: 'repaired', diag: diag });
}

async function defaultRepair(service, errorMsg) {
  // API 키 없거나 API 실패 시 기본 복구 로직
  var diag = {
    id: Date.now(), time: new Date().toISOString(), service: service,
    error: errorMsg, diagnosis: '기본 복구 (AI 미사용)',
    severity: 'medium', actions: [], executed: [], status: 'default',
  };

  var err = errorMsg.toLowerCase();
  if (err.indexOf('timeout') >= 0 || err.indexOf('타임아웃') >= 0) {
    diag.diagnosis = '페이지 로딩 타임아웃 → 새로고침 후 재로그인';
    diag.actions = [{ type: 'reload', detail: '타임아웃 복구' }, { type: 'relogin', detail: '세션 재설정' }];
  } else if (err.indexOf('session') >= 0 || err.indexOf('세션') >= 0 || err.indexOf('login') >= 0 || err.indexOf('로그인') >= 0) {
    diag.diagnosis = '세션 만료 → 재로그인';
    diag.actions = [{ type: 'relogin', detail: '세션만료 복구' }];
  } else if (err.indexOf('target closed') >= 0 || err.indexOf('destroyed') >= 0 || err.indexOf('detach') >= 0) {
    diag.diagnosis = '브라우저 크래시 → 재시작';
    diag.actions = [{ type: 'restart_browser', detail: '브라우저 크래시 복구' }];
  } else if (err.indexOf('navigation') >= 0 || err.indexOf('net::') >= 0) {
    diag.diagnosis = '네트워크 오류 → 대기 후 재시도';
    diag.actions = [{ type: 'wait_retry', detail: '네트워크 대기', params: { seconds: 15 } }, { type: 'reload', detail: '새로고침' }];
  } else {
    diag.diagnosis = '알 수 없는 오류 → 브라우저 재시작';
    diag.actions = [{ type: 'restart_browser', detail: '범용 복구' }, { type: 'relogin', detail: '재로그인' }];
  }

  aiDiagHistory.unshift(diag);
  if (aiDiagHistory.length > 20) aiDiagHistory.length = 20;

  log('ai', '🔧 기본복구: ' + diag.diagnosis);
  broadcast({ type: 'aiDiag', status: 'default', diag: diag });
  await executeRepair(service, diag);
  return diag;
}

// ═══ 브라우저 관리 (원본) ═══
async function getPage(key) {
  if (STATE.pages[key]) {
    try { 
      await STATE.pages[key].title(); 
      // 추가: url도 체크 (detached frame은 title은 되지만 url에서 실패할 수 있음)
      STATE.pages[key].url();
      return STATE.pages[key]; 
    } catch(e) {
      // 프레임 분리 → 기존 브라우저에서 페이지 재획득 시도
      if (STATE.browsers[key]) {
        try {
          var pages = await STATE.browsers[key].pages();
          if (pages && pages.length > 0) {
            STATE.pages[key] = pages[pages.length - 1];
            try { await STATE.pages[key].title(); return STATE.pages[key]; } catch(e2) {}
          }
        } catch(pe) {}
      }
    }
  }
  if (STATE.browsers[key]) { try { await STATE.browsers[key].close(); } catch(e) {} }
  
  log(key, '브라우저 시작...');
  if (!puppeteer) { log(key, '⚠️ Puppeteer 없음 (Vercel 모드) — 크롤링 불가', 'warning'); return false; }
  STATE.browsers[key] = await puppeteer.launch({
    headless: process.env.NO_BROWSER === '1' || process.env.NODE_ENV === 'production' ? 'new' : false,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--window-size=1366,900', '--disable-blink-features=AutomationControlled', '--disable-infobars', '--disable-notifications', '--lang=ko-KR'],
    defaultViewport: null,
  });
  STATE.pages[key] = await STATE.browsers[key].newPage();
  await STATE.pages[key].setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');
  await STATE.pages[key].setViewport({ width: 1366, height: 900 });
  // 자동화 감지 방지
  await STATE.pages[key].evaluateOnNewDocument(function() {
    Object.defineProperty(navigator, 'webdriver', { get: function() { return false; } });
  });
  STATE.pages[key].on('dialog', async function(d) { await d.accept(); });
  return STATE.pages[key];
}

async function screenshot(key, stepLabel) {
  if (!STATE.pages[key]) return;
  try {
    await STATE.pages[key].screenshot({ path: path.join(__dirname, 'public', 'debug_' + key + '.png'), fullPage: false });
    // 실시간 방송 (크롤링 모니터용)
    await crawlLive(key, stepLabel || key);
  } catch(e) {}
}

// ═══ la2fdoci 크롤러 (HTTP API 기반) ═══
async function la2fLogin() {
  var c = STATE.config.la2fdoci;
  if (!c.id || !c.pw) { log('la2fdoci', '❌ ID/PW 미설정 → 설정탭에서 입력하세요 (현재 ID: ' + (c.id || '없음') + ')', 'error'); return false; }
  try {
    log('la2fdoci', '🔄 HTTP 로그인 시작: ' + c.id + ' @ la2fdoci.com');
    STATE._la2fCookies = '';
    
    // ═══ 0단계: GET 로그인 페이지 → 세션 쿠키(JSESSIONID) 획득 ═══
    var cookieJar = {};
    var preResp = await new Promise(function(resolve, reject) {
      var req = https.request({
        hostname: 'la2fdoci.com', port: 443, rejectUnauthorized: false,
        path: '/partner/login.do', method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        timeout: 15000,
      }, function(res) {
        var sc = res.headers['set-cookie'];
        if (sc) sc.forEach(function(c) { var p = c.split(';')[0].split('='); if (p[0]) cookieJar[p[0].trim()] = p.slice(1).join('='); });
        var chunks = [];
        res.on('data', function(ch) { chunks.push(ch); });
        res.on('end', function() { resolve({ status: res.statusCode, data: Buffer.concat(chunks).toString('utf8') }); });
      });
      req.on('error', reject);
      req.on('timeout', function() { req.destroy(); reject(new Error('pre-login timeout')); });
      req.end();
    });
    log('la2fdoci', '로그인 페이지 GET: HTTP ' + preResp.status + ', 세션쿠키: ' + Object.keys(cookieJar).join(','));
    
    var sessionCookie = Object.keys(cookieJar).map(function(k) { return k + '=' + cookieJar[k]; }).join('; ');
    
    // ═══ 0.5단계: 로그인 폼 파싱 (hidden 필드/CSRF 토큰 추출) ═══
    var postData = 'userId=' + encodeURIComponent(c.id) + '&userPw=' + encodeURIComponent(c.pw);
    var loginPath = '/partner/login.do';
    
    if (cheerio && preResp.data) {
      try {
        var $lf = cheerio.load(preResp.data);
        var $form = $lf('form');
        if ($form.length > 0) {
          var act = ($form.attr('action') || '').trim();
          if (act) {
            if (act.startsWith('/')) loginPath = act;
            else if (act.startsWith('http')) { try { loginPath = new URL(act).pathname; } catch(ue) {} }
            else loginPath = '/partner/' + act;
            log('la2fdoci', '폼 action: ' + act + ' → ' + loginPath);
          }
          var parts = [];
          $form.find('input[type="hidden"]').each(function() {
            var n = $lf(this).attr('name'), v = $lf(this).attr('value') || '';
            if (n) parts.push(encodeURIComponent(n) + '=' + encodeURIComponent(v));
          });
          // 필드명 감지
          var idF = 'userId', pwF = 'userPw';
          $form.find('input').each(function() {
            var n = $lf(this).attr('name') || '', t = ($lf(this).attr('type') || '').toLowerCase();
            if (t === 'text' || t === 'tel') idF = n || idF;
            if (t === 'password') pwF = n || pwF;
          });
          parts.push(encodeURIComponent(idF) + '=' + encodeURIComponent(c.id));
          parts.push(encodeURIComponent(pwF) + '=' + encodeURIComponent(c.pw));
          postData = parts.join('&');
          log('la2fdoci', '폼 필드: ' + idF + '/' + pwF + (parts.length > 2 ? ' + hidden ' + (parts.length - 2) + '개' : ''));
        }
      } catch(pe) {
        log('la2fdoci', '폼 파싱 오류: ' + pe.message, 'warning');
      }
    }
    var loginResp = await new Promise(function(resolve, reject) {
      var options = {
        hostname: 'la2fdoci.com', port: 443, rejectUnauthorized: false,
        path: loginPath, method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData),
          'Cookie': sessionCookie,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'ko-KR,ko;q=0.9',
          'Referer': 'https://la2fdoci.com/partner/login.do',
          'Origin': 'https://la2fdoci.com',
        },
        timeout: 15000,
      };
      var req = https.request(options, function(res) {
        var sc = res.headers['set-cookie'];
        if (sc) sc.forEach(function(c) { var p = c.split(';')[0].split('='); if (p[0]) cookieJar[p[0].trim()] = p.slice(1).join('='); });
        var chunks = [];
        res.on('data', function(chunk) { chunks.push(chunk); });
        res.on('end', function() {
          var data = Buffer.concat(chunks).toString('utf8');
          resolve({ status: res.statusCode, data: data, headers: res.headers, cookies: cookieJar, location: res.headers.location });
        });
      });
      req.on('error', reject);
      req.on('timeout', function() { req.destroy(); reject(new Error('login timeout')); });
      req.write(postData);
      req.end();
    });
    
    // 쿠키 저장 (cookieJar에 누적됨)
    STATE._la2fCookies = Object.keys(cookieJar).map(function(k) { return k + '=' + cookieJar[k]; }).join('; ');
    log('la2fdoci', '로그인 응답: HTTP ' + loginResp.status + ', 쿠키: ' + (STATE._la2fCookies ? '있음' : '없음'));
    
    // ═══ 2단계: 리다이렉트 체인 따라가기 (302/301 → 연속 리다이렉트 전부 처리) ═══
    var maxRedirects = 5;
    var redStatus = loginResp.status;
    var redLocation = loginResp.location || (loginResp.headers && loginResp.headers.location);
    while ((redStatus === 302 || redStatus === 301) && redLocation && maxRedirects-- > 0) {
      var redirectPath = redLocation.replace('https://la2fdoci.com', '').replace('http://la2fdoci.com', '');
      if (redirectPath.indexOf('/') !== 0) redirectPath = '/' + redirectPath;
      log('la2fdoci', '리다이렉트: ' + redirectPath);
      var redResp = await la2fHttpRequest(redirectPath, 'GET');
      redStatus = redResp.status;
      redLocation = redResp.headers ? redResp.headers.location : null;
    }
    
    // ═══ 3단계: 로그인 확인 (주문목록 접근 테스트) ═══
    // ★ HTTP 500도 쿠키가 있으면 세션 성공일 수 있음 → 바로 확인 진행
    var testResp = await la2fHttpRequest('/partner/order/orderList.do?dateType=1&dateAll=true&dateAll=false&startDate=&endDate=&datespan=&use=true&use=false&useComplete=true&useComplete=false&cancel=true&cancel=false&expire=true&expire=false&state=', 'GET');
    
    if (testResp.status === 200 && (testResp.data.indexOf('주문') >= 0 || testResp.data.indexOf('orderList') >= 0 || testResp.data.indexOf('<table') >= 0)) {
      STATE.sessions.la2fdoci = true;
      log('la2fdoci', '✅ HTTP 로그인 성공!', 'success');
      await crawlLive('la2fdoci', '① 로그인 성공');
      return true;
    }
    
    // 로그인 페이지로 돌아갔는지 확인
    if (testResp.data.indexOf('login') >= 0 && testResp.data.indexOf('비밀번호') >= 0) {
      log('la2fdoci', '로그인 실패: 인증 거부 (ID/PW 확인 필요)', 'error');
    } else if (testResp.status === 302) {
      log('la2fdoci', '로그인 실패: 세션 미인증 (302 → ' + (testResp.headers ? testResp.headers.location || '' : '') + ')', 'error');
      log('la2fdoci', 'POST 응답 HTTP ' + loginResp.status + ', body: ' + (loginResp.data || '').substring(0, 200), 'warning');
    } else {
      // 주문 키워드가 없어도 200이면 성공으로 간주
      if (testResp.status === 200) {
        STATE.sessions.la2fdoci = true;
        log('la2fdoci', '✅ HTTP 로그인 성공 (추정)', 'success');
        await crawlLive('la2fdoci', '① 로그인 성공');
        return true;
      }
      log('la2fdoci', '로그인 실패: HTTP ' + testResp.status, 'error');
    }
    
    STATE.sessions.la2fdoci = false;
    await crawlLive('la2fdoci', '① 로그인 실패');
    return false;
  } catch(e) {
    log('la2fdoci', '❌ 로그인 오류: ' + e.message, 'error');
    if (e.message.indexOf('timeout') >= 0) {
      log('la2fdoci', '💡 la2fdoci.com 서버 응답 없음. 사이트가 다운되었거나 네트워크 문제일 수 있습니다.', 'warning');
    } else if (e.message.indexOf('ENOTFOUND') >= 0 || e.message.indexOf('getaddrinfo') >= 0) {
      log('la2fdoci', '💡 DNS 조회 실패. 인터넷 연결을 확인해주세요.', 'warning');
    } else if (e.message.indexOf('ECONNREFUSED') >= 0) {
      log('la2fdoci', '💡 la2fdoci.com 서버가 연결을 거부했습니다.', 'warning');
    } else if (e.message.indexOf('certificate') >= 0 || e.message.indexOf('SSL') >= 0) {
      log('la2fdoci', '💡 SSL 인증서 오류. NODE_TLS_REJECT_UNAUTHORIZED=0 으로 우회 가능', 'warning');
    }
    log('la2fdoci', '💡 확인사항: 1) 브라우저에서 https://la2fdoci.com/partner/login.do 접속 되는지 확인 2) ID: ' + c.id + ' / PW 확인', 'warning');
    STATE.sessions.la2fdoci = false;
    return false;
  }
}

async function la2fCrawl() {
  var c = STATE.config.la2fdoci;
  if (!c.id) { log('la2fdoci', 'ID 미설정', 'warning'); return []; }
  STATE.crawlStatus.la2fdoci = 'crawling';
  broadcast({ type: 'crawlStatus', data: STATE.crawlStatus });

  try {
    // 로그인 확인
    if (!STATE.sessions.la2fdoci || !STATE._la2fCookies) {
      if (!(await la2fLogin())) { STATE.crawlStatus.la2fdoci = 'error'; return []; }
    }

    // ═══ Step 1: HTTP 주문목록 조회 (cheerio 파싱) ═══
    var dateFrom = STATE.config.crawlDateFrom || '';
    var dateTo = STATE.config.crawlDateTo || new Date().toISOString().split('T')[0];
    // ★ 날짜 미설정 시 최근 30일 검색 (기존: 오늘만 → 수정: 30일)
    if (!dateFrom) {
      var d30 = new Date();
      d30.setDate(d30.getDate() - 30);
      dateFrom = d30.toISOString().split('T')[0];
    }
    log('la2fdoci', '크롤링 기간: ' + dateFrom + ' ~ ' + dateTo + ' (30일)');
    
    var searchParams = 'dateType=1&dateAll=true'
      + '&startDate=&endDate='
      + '&datespan='
      + '&use=true&useComplete=true&cancel=true&expire=true'
      + '&state=';
    log('la2fdoci', '검색: 전체기간 (dateAll=true), 모든 상태 포함');
    
    // HTML 파싱 함수 (cheerio 또는 regex 폴백)
    function parseOrderHtml(html) {
      var orders = [];
      var summary = { total: 0, totalQty: 0 };
      
      // 요약 정보 파싱
      var sumMatch = html.match(/주문\s*:\s*([\d,]+)\s*건/);
      if (sumMatch) summary.total = parseInt(sumMatch[1].replace(/,/g, ''));
      var qtyMatch = html.match(/수량\s*:\s*([\d,]+)\s*장/);
      if (qtyMatch) summary.totalQty = parseInt(qtyMatch[1].replace(/,/g, ''));
      
      if (cheerio) {
        // ★ cheerio 기반 파싱 (정확)
        var $ = cheerio.load(html);
        var table = $('table');
        if (table.length === 0) return { orders: orders, summary: summary };
        
        table.find('tr').each(function() {
          var tds = $(this).find('td');
          if (tds.length < 10) return;
          
          var cells = [];
          tds.each(function() { cells.push($(this).text().trim()); });
          
          // checkbox value → internalId
          var internalId = 0;
          var cb = $(this).find('input[type="checkbox"]');
          var offset = 0;
          if (cb.length > 0) {
            offset = 1;
            try { internalId = parseInt(cb.attr('value')) || 0; } catch(e2){}
          }
          
          var rowNo = (cells[offset + 0] || '').trim();
          var orderCode = (cells[offset + 1] || '').trim();
          var product = (cells[offset + 2] || '').trim();
          var reserveDate = (cells[offset + 3] || '').trim();
          var sellPrice = (cells[offset + 4] || '').trim();
          var couponNo = (cells[offset + 6] || '').trim();
          var validDate = (cells[offset + 7] || '').trim();
          var buyer = (cells[offset + 9] || '').trim();
          var phone = (cells[offset + 10] || '').trim();
          var sentDate = (cells[offset + 11] || '').trim();
          var qtyStr = (cells[offset + 12] || '').trim();
          var status = (cells[offset + 13] || '').trim();
          
          if (!/^\d+$/.test(rowNo)) return;
          var price = parseInt((sellPrice || '0').replace(/[,원]/g, '')) || 0;
          var qty = 1;
          var qm = qtyStr.match(/(\d+)\s*\/\s*(\d+)/);
          if (qm) qty = parseInt(qm[2]);
          if (['확정','예약확정','입금완료','결제완료','미사용'].indexOf(status) >= 0) status = '사용가능';
          if (['완료','이용완료','사용완료','사용'].indexOf(status) >= 0) status = '사용완료';
          if (['취소','예매취소','환불','환불완료'].indexOf(status) >= 0) status = '취소';
          var smsSent = sentDate.length > 0;
          var uniqueId = couponNo || (rowNo + '_' + orderCode);
          var purchaseDate = sentDate ? sentDate.substring(0, 10) : reserveDate;
          
          orders.push({
            rowNo: rowNo, orderNo: orderCode, couponNo: uniqueId,
            internalId: internalId,
            buyer: buyer, phone: phone, product: product.substring(0, 80),
            price: price, qty: qty, status: status || '사용가능',
            smsSent: smsSent, validDate: validDate,
            bookDate: purchaseDate, reserveDate: reserveDate,
          });
        });
      } else {
        // regex 폴백 (cheerio 미설치)
        var trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
        var trMatch;
        while ((trMatch = trRegex.exec(html)) !== null) {
          var rowHtml = trMatch[1];
          var cbMatch = rowHtml.match(/<input[^>]*type=['"]?checkbox['"]?[^>]*value=['"]?(\d+)['"]?/i);
          if (!cbMatch) cbMatch = rowHtml.match(/value=['"]?(\d+)['"]?[^>]*type=['"]?checkbox['"]?/i);
          var intId = cbMatch ? parseInt(cbMatch[1]) : 0;
          
          var tdRegex2 = /<td[^>]*>([\s\S]*?)<\/td>/gi;
          var cells2 = []; var tdM2;
          while ((tdM2 = tdRegex2.exec(rowHtml)) !== null) {
            cells2.push(tdM2[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim());
          }
          if (cells2.length < 10) continue;
          var off2 = cbMatch ? 1 : 0;
          var rowNo2 = (cells2[off2 + 0] || '').trim();
          if (!/^\d+$/.test(rowNo2)) continue;
          var orderCode2 = (cells2[off2 + 1] || '').trim();
          var product2 = (cells2[off2 + 2] || '').trim();
          var reserveDate2 = (cells2[off2 + 3] || '').trim();
          var sellPrice2 = (cells2[off2 + 4] || '').trim();
          var couponNo2 = (cells2[off2 + 6] || '').trim();
          var validDate2 = (cells2[off2 + 7] || '').trim();
          var buyer2 = (cells2[off2 + 9] || '').trim();
          var phone2 = (cells2[off2 + 10] || '').trim();
          var sentDate2 = (cells2[off2 + 11] || '').trim();
          var qtyStr2 = (cells2[off2 + 12] || '').trim();
          var status2 = (cells2[off2 + 13] || '').trim();
          var price2 = parseInt((sellPrice2 || '0').replace(/[,원]/g, '')) || 0;
          var qty2 = 1;
          var qm2 = qtyStr2.match(/(\d+)\s*\/\s*(\d+)/);
          if (qm2) qty2 = parseInt(qm2[2]);
          if (['확정','예약확정','입금완료','결제완료','미사용'].indexOf(status2) >= 0) status2 = '사용가능';
          if (['완료','이용완료','사용완료','사용'].indexOf(status2) >= 0) status2 = '사용완료';
          if (['취소','예매취소','환불','환불완료'].indexOf(status2) >= 0) status2 = '취소';
          
          orders.push({
            rowNo: rowNo2, orderNo: orderCode2, couponNo: couponNo2 || (rowNo2 + '_' + orderCode2),
            internalId: intId, buyer: buyer2, phone: phone2,
            product: product2.substring(0, 80), price: price2, qty: qty2,
            status: status2 || '사용가능', smsSent: sentDate2.length > 0,
            validDate: validDate2, bookDate: sentDate2 ? sentDate2.substring(0, 10) : reserveDate2,
            reserveDate: reserveDate2,
          });
        }
      }
      return { orders: orders, summary: summary };
    }
    
    // ═══ Step 1-1: 첫 페이지 로드 ═══
    var firstUrl = '/partner/order/orderList.do?' + searchParams;
    log('la2fdoci', '검색 URL: https://la2fdoci.com' + firstUrl.substring(0, 100));
    var firstResp = await la2fHttpRequest(firstUrl, 'GET');
    checkAbort();
    
    // 세션 만료 체크 (로그인 페이지로 리다이렉트)
    if (firstResp.status !== 200 || (firstResp.data.indexOf('login') >= 0 && firstResp.data.indexOf('비밀번호') >= 0 && firstResp.data.indexOf('<table') < 0)) {
      log('la2fdoci', '세션 만료 → 재로그인', 'warning');
      STATE.sessions.la2fdoci = false;
      if (!(await la2fLogin())) { STATE.crawlStatus.la2fdoci = 'error'; return []; }
      firstResp = await la2fHttpRequest(firstUrl, 'GET');
      checkAbort();
      if (firstResp.status !== 200) {
        log('la2fdoci', '재로그인 후에도 조회 실패: HTTP ' + firstResp.status, 'error');
        STATE.crawlStatus.la2fdoci = 'error';
        return [];
      }
    }
    
    await crawlLive('la2fdoci', '② 검색 결과 로딩');
    
    var firstResult = parseOrderHtml(firstResp.data);
    var allOrders = firstResult.orders;
    var summary = firstResult.summary;
    log('la2fdoci', '1페이지: ' + allOrders.length + '건 파싱' + (allOrders.length > 0 ? ' (행#' + allOrders[0].rowNo + '~' + allOrders[allOrders.length-1].rowNo + ')' : ''));
    
    // ★ 데이터 없으면 즉시 완료 처리 → 다음 크롤링으로 넘어감
    if (allOrders.length === 0) {
      log('la2fdoci', '📭 해당 기간(' + dateFrom + '~' + dateTo + ') 데이터 없음 → 완료', 'info');
      STATE.crawlStatus.la2fdoci = 'idle';
      await crawlLive('la2fdoci', '✅ 완료 (0건)');
      sendState();
      return [];
    }
    
    // ═══ Step 1-2: 페이지네이션 (2페이지부터) ═══
    var actualRowsPerPage = allOrders.length;
    var totalItems = Math.max(summary.totalQty || 0, summary.total || 0);
    var maxPages = totalItems > 0 && actualRowsPerPage > 0 ? Math.ceil(totalItems / actualRowsPerPage) : 1;
    maxPages = Math.min(maxPages, 200);
    
    // 페이지링크에서 최대 페이지 추출
    if (cheerio) {
      var $f = cheerio.load(firstResp.data);
      $f('a[onclick], a[href*="page"]').each(function() {
        var oc = $f(this).attr('onclick') || '';
        var href = $f(this).attr('href') || '';
        var txt = $f(this).text().trim();
        var m = oc.match(/\((\d+)\)/);
        if (m && parseInt(m[1]) > maxPages) maxPages = parseInt(m[1]);
        var hm = href.match(/page[=](\d+)/i);
        if (hm && parseInt(hm[1]) > maxPages) maxPages = parseInt(hm[1]);
        if (/^\d+$/.test(txt) && parseInt(txt) > maxPages) maxPages = parseInt(txt);
      });
    }
    maxPages = Math.min(maxPages, 200);
    
    log('la2fdoci', '📖 페이지네이션: 총' + totalItems + '건/' + actualRowsPerPage + '행/페이지 = 최종' + maxPages + '페이지');
    
    if (maxPages > 1 && allOrders.length > 0) {
      var prevFirstRow = allOrders[0].rowNo;
      var consecutiveFailures = 0;
      
      for (var pg = 2; pg <= maxPages; pg++) {
        try {
          checkAbort();
          var pageUrl = '/partner/order/orderList.do?' + searchParams + '&page=' + pg;
          var pageResp = await la2fHttpRequest(pageUrl, 'GET');
          
          if (pageResp.status !== 200) {
            log('la2fdoci', '  ' + pg + '페이지: HTTP ' + pageResp.status + ' → 중단', 'warning');
            break;
          }
          
          var pageResult = parseOrderHtml(pageResp.data);
          var pageOrders = pageResult.orders;
          
          if (pageOrders.length === 0) {
            log('la2fdoci', '  ' + pg + '페이지: 0건 → 순회 종료');
            break;
          }
          
          if (pageOrders[0].rowNo === prevFirstRow) {
            consecutiveFailures++;
            if (consecutiveFailures >= 2) {
              log('la2fdoci', '  동일 데이터 반복 → 순회 종료');
              break;
            }
            continue;
          }
          
          consecutiveFailures = 0;
          prevFirstRow = pageOrders[0].rowNo;
          allOrders = allOrders.concat(pageOrders);
          log('la2fdoci', '  ✅ ' + pg + '/' + maxPages + '페이지: ' + pageOrders.length + '건, 누적 ' + allOrders.length + '건');
          
          // 서버 부하 방지
          await new Promise(function(r) { setTimeout(r, 300); });
        } catch(e) {
          if (e.message === 'CRAWL_ABORTED') throw e;
          log('la2fdoci', '  ' + pg + '페이지 오류: ' + e.message, 'warning');
          break;
        }
      }
    }
    
    var orders = allOrders;

    // 상태 분포 로그
    var statusMap = {};
    orders.forEach(function(o) { statusMap[o.status||'(없음)'] = (statusMap[o.status||'(없음)']||0) + 1; });
    var statusStr = Object.keys(statusMap).map(function(k) { return k + ':' + statusMap[k]; }).join(', ');
    log('la2fdoci', '전체 ' + orders.length + '건 파싱됨 [' + statusStr + ']');
    
    if (orders.length > 0) {
      log('la2fdoci', '첫번째: 행#' + orders[0].rowNo + ' 주문:' + orders[0].orderNo + ' 쿠폰:' + (orders[0].couponNo||'').substring(0,15) + ' | ' + orders[0].buyer + ' | ' + orders[0].qty + '매 | ' + orders[0].price + '원 | [' + orders[0].status + ']');
    }

    // ═══ Step 3: 주문번호 기준 그룹핑 후 티켓 등록 ═══
    var grouped = {};
    orders.forEach(function(o) {
      var key = o.orderNo + '_' + o.buyer;
      if (!grouped[key]) {
        grouped[key] = {
          orderNo: o.orderNo, buyer: o.buyer, phone: o.phone,
          product: o.product, price: o.price, status: o.status,
          smsSent: o.smsSent, validDate: o.validDate, bookDate: o.bookDate,
          couponNos: [], internalIds: [], totalQty: 0, rowNos: [],
        };
      }
      grouped[key].couponNos.push(o.couponNo);
      grouped[key].rowNos.push(o.rowNo);
      if (o.internalId) grouped[key].internalIds.push(o.internalId);
      grouped[key].totalQty += (o.qty || 1);
      if (o.product && o.product.length > (grouped[key].product || '').length) grouped[key].product = o.product;
      if (o.price > 0 && grouped[key].price === 0) grouped[key].price = o.price;
      if (o.status === '사용완료') grouped[key].usedCount = (grouped[key].usedCount || 0) + 1;
      if (o.status === '사용가능') grouped[key].availCount = (grouped[key].availCount || 0) + 1;
      if (o.status === '취소') grouped[key].cancelCount = (grouped[key].cancelCount || 0) + 1;
      if (o.smsSent) grouped[key].smsSent = true;
    });

    var groupedOrders = Object.keys(grouped).map(function(k) { return grouped[k]; });
    
    // ★ 날짜 범위 필터: 크롤링 기간 외 티켓 제외
    var filterFrom = STATE.config.crawlDateFrom || '';
    var filterTo = STATE.config.crawlDateTo || '';
    if (filterFrom || filterTo) {
      var beforeCount = groupedOrders.length;
      groupedOrders = groupedOrders.filter(function(g) {
        var gDate = (g.bookDate || g.validDate || g.reserveDate || '').substring(0, 10);
        if (!gDate) return true; // 날짜 없으면 포함
        if (filterFrom && gDate < filterFrom) return false;
        if (filterTo && gDate > filterTo) return false;
        return true;
      });
      if (beforeCount !== groupedOrders.length) {
        log('la2fdoci', '📅 날짜 필터: ' + beforeCount + '건 → ' + groupedOrders.length + '건 (' + filterFrom + '~' + filterTo + ')');
      }
    }
    // ★ 그룹 상태 결정: 사용가능이 1건이라도 있으면 사용가능, 전부 사용완료면 사용완료
    groupedOrders.forEach(function(g) {
      if (g.availCount > 0 && g.usedCount > 0) g.status = '부분사용';
      else if (g.availCount > 0) g.status = '사용가능';
      else if (g.usedCount > 0) g.status = '사용완료';
      else if (g.cancelCount > 0) g.status = '취소';
    });
    log('la2fdoci', '그룹핑: ' + orders.length + '행 → ' + groupedOrders.length + '건 (주문번호 기준)');

    var newTickets = [];
    groupedOrders.forEach(function(g) {
      var existing = STATE.tickets.find(function(t) {
        if (t.source === 'la2fdoci' && t.orderNo === g.orderNo && t.buyer === g.buyer) return true;
        if (t.couponNos && g.couponNos) {
          for (var ci = 0; ci < g.couponNos.length; ci++) {
            if (t.couponNos.indexOf(g.couponNos[ci]) >= 0) return true;
          }
        }
        if (t.couponNo && g.couponNos && g.couponNos.indexOf(t.couponNo) >= 0) return true;
        return false;
      });
      if (existing) {
        var changed = false;
        if (g.smsSent && !existing.smsSent) { existing.smsSent = true; changed = true; }
        if (g.totalQty !== (existing.qty||1)) { existing.qty = g.totalQty; existing.personCount = g.totalQty; changed = true; }
        if (g.price && g.price !== existing.price) { existing.price = g.price; existing.items = [{ n: g.product || existing.product, p: g.price }]; changed = true; }
        if (g.product && g.product.length > (existing.product||'').length) { existing.product = g.product; changed = true; }
        if (g.phone && !existing.phone) { existing.phone = g.phone; changed = true; }
        if (g.status === '사용완료' && existing.status === '사용가능') { existing.status = '사용완료'; existing.usedAt = existing.usedAt || new Date().toISOString(); changed = true; }
        if (g.couponNos.length > (existing.couponNos||[]).length) { existing.couponNos = g.couponNos; changed = true; }
        if (g.internalIds && g.internalIds.length > 0 && (!existing.internalIds || g.internalIds.length > existing.internalIds.length)) {
          existing.internalIds = g.internalIds; changed = true;
        }
        if (g.bookDate && !existing.bookDate) { existing.bookDate = g.bookDate; changed = true; }
        if (g.validDate && !existing.validDate) { existing.validDate = g.validDate; changed = true; }
        if (existing.source !== 'la2fdoci' && !existing.crossMatch) { existing.crossMatch = 'la2fdoci'; changed = true; }
        if (changed) { broadcast({ type: 'ticketUpdate', data: existing }); sbSync.saveTicket(existing).catch(function(){}); }
        return;
      }
      // ★ 사용완료/취소도 등록 (서버 재시작 시 이력 보존)
      if (!g.status) g.status = '사용가능';

      var tk = {
        id: 'L' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        orderNo: g.orderNo,
        couponNo: g.couponNos[0],
        couponNos: g.couponNos,
        internalIds: g.internalIds || [],
        rowNos: g.rowNos,
        source: 'la2fdoci',
        product: g.product || '',
        buyer: g.buyer,
        phone: g.phone,
        price: g.price,
        qty: g.totalQty,
        status: g.status || '사용가능',
        qrIssued: true,
        detectedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        items: [{ n: g.product, p: g.price }],
        personCount: g.totalQty,
        smsSent: g.smsSent || false,
        smsTime: '',
        bookDate: g.bookDate || '',
        validDate: g.validDate || '',
        // ★ 사용완료 상태면 usedAt 기록
        usedAt: (g.status === '사용완료' || g.status === '부분사용') ? (g.bookDate || new Date().toISOString()) : null,
        // ★ 진행이력 자동 생성
        history: [
          { action: '신청', time: g.bookDate || new Date().toISOString().substring(0, 16), by: 'la2fdoci' },
          (g.status === '사용완료' || g.status === '부분사용')
            ? { action: g.status, time: g.bookDate || new Date().toISOString().substring(0, 16), by: 'la2fdoci' }
            : null
        ].filter(Boolean),
      };
      var naverMatch = STATE.tickets.find(function(t) {
        return t.source === 'naver' && t.buyer === g.buyer && t.phone === g.phone && g.phone;
      });
      if (naverMatch) {
        tk.crossMatch = 'naver';
        if (!naverMatch.crossMatch) { naverMatch.crossMatch = 'la2fdoci'; broadcast({ type: 'ticketUpdate', data: naverMatch }); }
        log('la2fdoci', '🔗 크로스매치: ' + g.buyer + ' ← 네이버 #' + naverMatch.orderNo);
      }
      STATE.tickets.unshift(tk);
      newTickets.push(tk);
      sbSync.saveTicket(tk).catch(function(){});
      log('la2fdoci', '🆕 ' + tk.buyer + ' | #' + tk.orderNo + ' | ' + tk.qty + '매(쿠폰' + g.couponNos.length + '장) | ' + (tk.price||0).toLocaleString() + '원' + (tk.smsSent ? ' 📱' : '') + (g.internalIds.length > 0 ? ' [ID:' + g.internalIds.join(',') + ']' : ''), 'success');
      broadcast({ type: 'newTicket', data: tk });
    });

    if (newTickets.length === 0) log('la2fdoci', '신규 없음');
    STATE.crawlStatus.la2fdoci = 'connected';
    return newTickets;
  } catch(e) {
    if (e.message === 'CRAWL_ABORTED') throw e;
    log('la2fdoci', '크롤링 오류: ' + e.message, 'error');
    STATE.crawlStatus.la2fdoci = 'error';
    STATE.sessions.la2fdoci = false;
    try { await aiDiagnose('la2fdoci', e.message); } catch(ae) {}
    return [];
  }
}


// ═══ la2fdoci HTTP API 헬퍼 (changeStatus.do 연동) ═══
// HTTP 세션 쿠키 기반 직접 호출 → Puppeteer 불필요
function la2fGetCookies() {
  return STATE._la2fCookies || '';
}

function la2fHttpRequest(urlPath, method, body) {
  return new Promise(function(resolve, reject) {
    var url = new URL('https://la2fdoci.com' + urlPath);
    var isJson = body && typeof body === 'object';
    var postData = isJson ? JSON.stringify(body) : (body || '');
    
    var options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: method || 'GET',
      rejectUnauthorized: false,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9',
        'Cookie': STATE._la2fCookies || '',
      },
      timeout: 30000,
    };
    
    if (isJson) {
      options.headers['Content-Type'] = 'application/json';
      options.headers['X-Requested-With'] = 'XMLHttpRequest';
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }
    
    var req = https.request(options, function(res) {
      var chunks = [];
      res.on('data', function(chunk) { chunks.push(chunk); });
      res.on('end', function() {
        var data = Buffer.concat(chunks).toString('utf8');
        // 쿠키 업데이트 (세션 유지)
        var setCookies = res.headers['set-cookie'];
        if (setCookies) {
          var existing = (STATE._la2fCookies || '').split('; ').reduce(function(m, c) {
            var p = c.split('='); if (p[0]) m[p[0]] = p.slice(1).join('='); return m;
          }, {});
          setCookies.forEach(function(sc) {
            var part = sc.split(';')[0]; var p2 = part.split('=');
            if (p2[0]) existing[p2[0].trim()] = p2.slice(1).join('=');
          });
          STATE._la2fCookies = Object.keys(existing).map(function(k) { return k + '=' + existing[k]; }).join('; ');
        }
        resolve({ status: res.statusCode, data: data, headers: res.headers });
      });
    });
    req.on('error', function(e) { reject(e); });
    req.on('timeout', function() { req.destroy(); reject(new Error('timeout')); });
    if (postData && method !== 'GET') req.write(postData);
    req.end();
  });
}

// changeStatus.do API: status 0=사용가능, 1=사용완료, 2=취소
async function la2fApiChangeStatus(internalIds, statusCode) {
  try {
    // 쿠키 확인 (HTTP 세션에서 직접)
    if (!STATE._la2fCookies) {
      log('la2fdoci', 'API: 쿠키 없음 → 재로그인 시도', 'warning');
      if (!(await la2fLogin())) return false;
    }
    var statusNames = { 0: '사용가능', 1: '사용완료', 2: '취소' };
    log('la2fdoci', 'API: changeStatus ids=[' + internalIds.join(',') + '] → ' + (statusNames[statusCode] || statusCode));
    
    var resp = await la2fHttpRequest('/partner/order/changeStatus.do', 'POST', {
      status: statusCode,
      ids: internalIds,
    });
    
    if (resp.status === 200) {
      log('la2fdoci', 'API: ✅ 상태변경 성공 (' + internalIds.length + '건 → ' + (statusNames[statusCode] || statusCode) + ')', 'success');
      return true;
    } else {
      log('la2fdoci', 'API: ❌ 상태변경 실패 HTTP ' + resp.status, 'error');
      return false;
    }
  } catch(e) {
    log('la2fdoci', 'API: 상태변경 오류: ' + e.message, 'error');
    return false;
  }
}

// 주문목록 HTTP 검색 → internalId + status 추출
async function la2fApiSearchOrders(phone, orderNo) {
  try {
    if (!STATE._la2fCookies) {
      if (!(await la2fLogin())) return [];
    }
    
    // 검색 파라미터 조립
    var params = 'dateType=1&dateAll=true&dateAll=false'
      + '&startDate=&endDate=&datespan='
      + '&use=true&use=false&useComplete=true&useComplete=false'
      + '&cancel=true&cancel=false&expire=true&expire=false'
      + '&state=';
    
    if (phone) {
      var cleanPhone = phone.replace(/[-\s]/g, '');
      var fmtPhone = cleanPhone;
      if (/^01\d{8,9}$/.test(cleanPhone)) {
        fmtPhone = cleanPhone.substring(0, 3) + '-' + cleanPhone.substring(3, cleanPhone.length - 4) + '-' + cleanPhone.substring(cleanPhone.length - 4);
      }
      params += '&searchCnd=recvPhone&searchWrd=' + encodeURIComponent(fmtPhone) + '&btSearch=' + encodeURIComponent('검색');
    } else if (orderNo) {
      params += '&searchCnd=orderNo&searchWrd=' + encodeURIComponent(orderNo) + '&btSearch=' + encodeURIComponent('검색');
    }
    
    var resp = await la2fHttpRequest('/partner/order/orderList.do?' + params, 'GET');
    if (resp.status !== 200) {
      // 세션 만료 → 재로그인 후 재시도
      if (resp.status === 302 || (resp.data && resp.data.indexOf('login') >= 0)) {
        log('la2fdoci', 'API검색: 세션만료 → 재로그인', 'warning');
        STATE.sessions.la2fdoci = false;
        if (!(await la2fLogin())) return [];
        resp = await la2fHttpRequest('/partner/order/orderList.do?' + params, 'GET');
        if (resp.status !== 200) return [];
      } else return [];
    }
    
    var html = resp.data;
    var orders = [];
    
    if (cheerio) {
      // ★ cheerio 기반 정확한 파싱
      var $ = cheerio.load(html);
      $('table tr').each(function() {
        var tds = $(this).find('td');
        if (tds.length < 10) return;
        var cells = [];
        tds.each(function() { cells.push($(this).text().trim()); });
        var cb = $(this).find('input[type="checkbox"]');
        var intId = cb.length > 0 ? (parseInt(cb.attr('value')) || 0) : 0;
        if (!intId || intId < 100) return;
        var off = cb.length > 0 ? 1 : 0;
        var rStatus = (cells[off + 13] || '').trim();
        if (['확정','예약확정','입금완료','결제완료','미사용'].indexOf(rStatus) >= 0) rStatus = '사용가능';
        if (['완료','이용완료','사용완료','사용'].indexOf(rStatus) >= 0) rStatus = '사용완료';
        if (['취소','예매취소','환불','노쇼'].indexOf(rStatus) >= 0) rStatus = '취소';
        orders.push({
          internalId: intId,
          orderNo: (cells[off + 1] || '').trim(),
          couponNo: (cells[off + 6] || '').trim(),
          buyer: (cells[off + 9] || '').trim(),
          phone: (cells[off + 10] || '').trim(),
          product: (cells[off + 2] || '').trim(),
          validDate: (cells[off + 7] || '').trim(),
          sentDate: (cells[off + 11] || '').trim(),
          qtyStr: (cells[off + 12] || '').trim(),
          status: rStatus,
        });
      });
    } else {
      // regex 폴백
      var trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
      var trMatch;
      while ((trMatch = trRegex.exec(html)) !== null) {
        var rowHtml = trMatch[1];
        var cbMatch = rowHtml.match(/<input[^>]*type=['"]?checkbox['"]?[^>]*value=['"]?(\d+)['"]?/i);
        if (!cbMatch) cbMatch = rowHtml.match(/value=['"]?(\d+)['"]?[^>]*type=['"]?checkbox['"]?/i);
        if (!cbMatch) continue;
        var intId2 = parseInt(cbMatch[1]);
        if (!intId2 || intId2 < 100) continue;
        var tdRegex2 = /<td[^>]*>([\s\S]*?)<\/td>/gi;
        var cells2 = []; var tdM;
        while ((tdM = tdRegex2.exec(rowHtml)) !== null) {
          cells2.push(tdM[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim());
        }
        if (cells2.length < 10) continue;
        var off2 = 1;
        var rStatus2 = (cells2[off2 + 13] || '').trim();
        if (['확정','예약확정','입금완료','결제완료','미사용'].indexOf(rStatus2) >= 0) rStatus2 = '사용가능';
        if (['완료','이용완료','사용완료','사용'].indexOf(rStatus2) >= 0) rStatus2 = '사용완료';
        if (['취소','예매취소','환불','노쇼'].indexOf(rStatus2) >= 0) rStatus2 = '취소';
        orders.push({
          internalId: intId2, orderNo: (cells2[off2 + 1] || '').trim(),
          couponNo: (cells2[off2 + 6] || '').trim(), buyer: (cells2[off2 + 9] || '').trim(),
          phone: (cells2[off2 + 10] || '').trim(), product: (cells2[off2 + 2] || '').trim(),
          validDate: (cells2[off2 + 7] || '').trim(), sentDate: (cells2[off2 + 11] || '').trim(),
          qtyStr: (cells2[off2 + 12] || '').trim(), status: rStatus2,
        });
      }
    }
    
    log('la2fdoci', 'API검색: ' + orders.length + '건 발견' + (phone ? ' (☎' + phone + ')' : '') + (orderNo ? ' (#' + orderNo + ')' : ''));
    return orders;
  } catch(e) {
    log('la2fdoci', 'API검색 오류: ' + e.message, 'error');
    return [];
  }
}

// ═══ 사용완료 처리 (API 기반) ═══
async function la2fMarkUsed(tk, useQty) {
  try {
    if (!STATE.sessions.la2fdoci) { if (!(await la2fLogin())) return false; }
    
    var totalQty = tk.qty || 1;
    useQty = useQty || totalQty;
    log('la2fdoci', '① 사용완료: ' + tk.buyer + ' ☎' + (tk.phone||'') + ' (' + useQty + '/' + totalQty + '매)');
    
    // ★ internalIds 확보
    var ids = (tk.internalIds || []).filter(function(id) { return id > 0; });
    
    // internalIds 없으면 API 검색으로 찾기
    if (ids.length === 0) {
      log('la2fdoci', '② internalIds 없음 → API 검색');
      var searchOrders = await la2fApiSearchOrders(tk.phone, tk.orderNo);
      
      // 매칭: 주문번호 또는 쿠폰번호 또는 전화번호+구매자
      var tkBookDate = (tk.bookDate || tk.sentDate || '').substring(0, 10);
      if (!tkBookDate && tk.orderNo) {
        var dm = (tk.orderNo || '').match(/^L?(\d{2})(\d{2})(\d{2})/);
        if (dm) tkBookDate = '20' + dm[1] + '-' + dm[2] + '-' + dm[3];
      }
      
      var matched = searchOrders.filter(function(o) {
        // 주문번호 매칭
        if (tk.orderNo && o.orderNo === tk.orderNo) return true;
        // 쿠폰번호 매칭
        if (tk.couponNos && tk.couponNos.indexOf(o.couponNo) >= 0) return true;
        if (tk.couponNo && o.couponNo === tk.couponNo) return true;
        // 구매자+전화번호+날짜 매칭
        var cleanTkPhone = (tk.phone || '').replace(/[-\s]/g, '');
        var cleanOPhone = (o.phone || '').replace(/[-\s]/g, '');
        if (cleanTkPhone && cleanOPhone && cleanTkPhone === cleanOPhone) {
          if (!tkBookDate) return true;
          var oDate = (o.sentDate || '').substring(0, 10);
          if (!oDate || oDate === tkBookDate) return true;
        }
        return false;
      });
      
      // 사용가능한 쿠폰만 필터
      var available = matched.filter(function(o) { return o.status === '사용가능'; });
      ids = available.map(function(o) { return o.internalId; });
      
      log('la2fdoci', '  API검색: 전체 ' + matched.length + '건 중 사용가능 ' + available.length + '건');
      
      // 티켓에 internalIds 저장 (다음부터 재사용)
      if (matched.length > 0) {
        tk.internalIds = matched.map(function(o) { return o.internalId; });
      }
    } else {
      log('la2fdoci', '② internalIds 보유: [' + ids.join(',') + ']');
    }
    
    if (ids.length === 0) {
      log('la2fdoci', '❌ 사용가능 쿠폰 없음 (이미 처리됨 또는 검색 실패)', 'warning');
      return false;
    }
    
    // ★ 분할 처리: useQty만큼만 처리
    var targetIds = ids.slice(0, useQty);
    log('la2fdoci', '③ API 사용완료 처리: ' + targetIds.length + '건 [' + targetIds.join(',') + ']');
    
    var ok = await la2fApiChangeStatus(targetIds, 1); // 1 = 사용완료
    
    if (ok) {
      log('la2fdoci', '✅ ' + tk.buyer + ' 사용완료 ' + targetIds.length + '건 API 처리 성공', 'success');
    } else {
      log('la2fdoci', '❌ API 처리 실패', 'error');
    }
    return ok;
  } catch(e) {
    log('la2fdoci', '사용완료 오류: ' + e.message, 'error');
    return false;
  }
}

// ═══ 사용처리 확인 (API 기반) ═══
async function la2fVerifyUsed(tk) {
  try {
    if (!STATE.sessions.la2fdoci) { if (!(await la2fLogin())) return { ok: false, msg: '로그인 실패' }; }
    
    var searchOrders = await la2fApiSearchOrders(tk.phone, tk.orderNo);
    if (searchOrders.length === 0) return { ok: false, msg: '주문을 찾지 못함', statuses: [] };
    
    // 매칭
    var tkBookDate = (tk.bookDate || tk.sentDate || '').substring(0, 10);
    if (!tkBookDate && tk.orderNo) {
      var dm = (tk.orderNo || '').match(/^L?(\d{2})(\d{2})(\d{2})/);
      if (dm) tkBookDate = '20' + dm[1] + '-' + dm[2] + '-' + dm[3];
    }
    
    var matched = searchOrders.filter(function(o) {
      if (tk.orderNo && o.orderNo === tk.orderNo) return true;
      if (tk.couponNos && tk.couponNos.indexOf(o.couponNo) >= 0) return true;
      if (tk.couponNo && o.couponNo === tk.couponNo) return true;
      var cleanTk = (tk.phone || '').replace(/[-\s]/g, '');
      var cleanO = (o.phone || '').replace(/[-\s]/g, '');
      if (cleanTk && cleanO && cleanTk === cleanO) {
        if (!tkBookDate) return true;
        var oDate = (o.sentDate || '').substring(0, 10);
        if (!oDate || oDate === tkBookDate) return true;
      }
      return false;
    });
    
    if (matched.length === 0) return { ok: false, msg: '매칭 주문 없음', statuses: [] };
    
    var statuses = matched.map(function(o) { return { status: o.status, coupon: o.couponNo, date: (o.sentDate||'').substring(0,10), internalId: o.internalId }; });
    var allDone = statuses.every(function(s) { return s.status === '사용완료'; });
    var doneCount = statuses.filter(function(s) { return s.status === '사용완료'; }).length;
    
    // internalIds 갱신
    if (matched.length > 0 && (!tk.internalIds || tk.internalIds.length === 0)) {
      tk.internalIds = matched.map(function(o) { return o.internalId; });
    }
    
    return {
      ok: true,
      verified: allDone,
      msg: allDone ? '전체 사용완료 확인 (' + doneCount + '/' + matched.length + ')'
                    : '미완료 있음 (' + doneCount + '/' + matched.length + ')',
      statuses: statuses,
      doneCount: doneCount,
      totalCount: matched.length,
    };
  } catch(e) {
    return { ok: false, msg: '확인 오류: ' + e.message, statuses: [] };
  }
}

// ═══ la2fdoci 복구 (사용완료 → 사용가능) API 기반 ═══
async function la2fRestoreAvailable(tk) {
  try {
    if (!STATE.sessions.la2fdoci) { if (!(await la2fLogin())) return false; }
    
    log('la2fdoci', '↩ 복구: ' + tk.buyer + ' ☎' + (tk.phone||'') + ' → 사용가능');
    
    // ★ internalIds 확보
    var ids = (tk.internalIds || []).filter(function(id) { return id > 0; });
    
    // internalIds 없으면 API 검색
    if (ids.length === 0) {
      var searchOrders = await la2fApiSearchOrders(tk.phone, tk.orderNo);
      var tkBookDate = (tk.bookDate || tk.sentDate || '').substring(0, 10);
      if (!tkBookDate && tk.orderNo) {
        var dm = (tk.orderNo || '').match(/^L?(\d{2})(\d{2})(\d{2})/);
        if (dm) tkBookDate = '20' + dm[1] + '-' + dm[2] + '-' + dm[3];
      }
      
      var matched = searchOrders.filter(function(o) {
        if (tk.orderNo && o.orderNo === tk.orderNo) return true;
        if (tk.couponNos && tk.couponNos.indexOf(o.couponNo) >= 0) return true;
        if (tk.couponNo && o.couponNo === tk.couponNo) return true;
        var cleanTk = (tk.phone || '').replace(/[-\s]/g, '');
        var cleanO = (o.phone || '').replace(/[-\s]/g, '');
        if (cleanTk && cleanO && cleanTk === cleanO) {
          if (!tkBookDate) return true;
          var oDate = (o.sentDate || '').substring(0, 10);
          if (!oDate || oDate === tkBookDate) return true;
        }
        return false;
      });
      
      // 사용완료 쿠폰만 복구 대상
      var usedOnes = matched.filter(function(o) { return o.status === '사용완료'; });
      ids = usedOnes.map(function(o) { return o.internalId; });
      
      log('la2fdoci', '  API검색: 전체 ' + matched.length + '건 중 사용완료 ' + usedOnes.length + '건');
      
      if (matched.length > 0) tk.internalIds = matched.map(function(o) { return o.internalId; });
    }
    
    if (ids.length === 0) {
      log('la2fdoci', '❌ 복구할 쿠폰 없음 (사용완료 상태가 아니거나 검색 실패)', 'warning');
      return false;
    }
    
    log('la2fdoci', '↩ API 복구 처리: ' + ids.length + '건 [' + ids.join(',') + ']');
    var ok = await la2fApiChangeStatus(ids, 0); // 0 = 사용가능
    
    if (ok) {
      log('la2fdoci', '✅ ' + tk.buyer + ' 복구 ' + ids.length + '건 API 처리 성공', 'success');
    } else {
      log('la2fdoci', '❌ API 복구 실패', 'error');
    }
    return ok;
  } catch(e) {
    log('la2fdoci', '복구 오류: ' + e.message, 'error');
    return false;
  }
}

async function naverVerifyUsed(tk) {
  try {
    if (!STATE.sessions.naver) { if (!(await naverLogin())) return { ok: false, msg: '네이버 로그인 실패' }; }
    var page = STATE.pages.naver;
    
    // ★ 프레임 분리(detached) 방지
    try { await page.title(); page.url(); } catch(hErr) {
      log('naver', '확인: 프레임 분리 감지 → 페이지 재획득');
      try {
        var pages = await STATE.browsers.naver.pages();
        if (pages && pages.length > 0) { page = pages[pages.length - 1]; STATE.pages.naver = page; }
        else { STATE.sessions.naver = false; if (!(await naverLogin())) return { ok: false, msg: '재로그인 실패' }; page = STATE.pages.naver; }
      } catch(bErr) {
        STATE.sessions.naver = false;
        if (!(await naverLogin())) return { ok: false, msg: '브라우저 오류' };
        page = STATE.pages.naver;
      }
    }
    
    // 예약관리 페이지로 이동 (이용일 기준, 전체 상태)
    var cfg = STATE.config.naver;
    // ★ 크롤링에서 저장된 bookingBase 우선 사용
    var bookingBase = STATE.naverBookingBase || naverPartnerUrl('booking-list-view');
    if (!bookingBase) {
      var curUrl = page.url();
      var bizMatch = curUrl.match(/\/bizes\/(\d+)/);
      if (bizMatch && curUrl.indexOf('partner.booking') >= 0) {
        bookingBase = 'https://partner.booking.naver.com/bizes/' + bizMatch[1] + '/booking-list-view';
      } else {
        bookingBase = 'https://partner.booking.naver.com/bizes/784618/booking-list-view';
      }
    }
    
    // 전체 상태(필터 없이)로 조회하여 이용완료 여부 확인
    var useDate = tk.useDate || tk.bookDate || new Date().toISOString().split('T')[0];
    var bizIdParam = cfg.bizId ? '&bookingBusinessId=' + cfg.bizId : '';
    var verifyUrl = bookingBase + '?dateFilter=USEDATE&dateDropdownType=PERIOD'
      + '&startDateTime=' + useDate + 'T00:00:00'
      + '&endDateTime=' + useDate + 'T23:59:59'
      + bizIdParam;
    
    log('naver', '🔍 확인: ' + tk.buyer + ' → ' + verifyUrl.substring(0, 100));
    await page.goto(verifyUrl, { waitUntil: 'domcontentloaded', timeout: 12000 }).catch(function(){});
    await new Promise(function(r) { setTimeout(r, 2500); });
    // await dismissNaverPopups(page); // 비활성화
    
    // 테이블에서 해당 예약 찾기
    // ★ 행 로딩 대기
    for (var vwi = 0; vwi < 8; vwi++) {
      var vrc = await page.evaluate(function() {
        var allTr = document.querySelectorAll('table tr');
        var cnt = 0;
        for (var i = 0; i < allTr.length; i++) { if (allTr[i].querySelectorAll('td').length >= 3) cnt++; }
        return cnt;
      });
      if (vrc > 0) break;
      await new Promise(function(r) { setTimeout(r, 1000); });
    }
    
    var result = await page.evaluate(function(orderNo, buyer, phone) {
      // ★ 다양한 셀렉터
      var rows = document.querySelectorAll('table tbody tr');
      if (rows.length === 0) {
        var allTr = document.querySelectorAll('table tr');
        var dataRows = [];
        for (var t = 0; t < allTr.length; t++) {
          if (allTr[t].querySelectorAll('td').length >= 3) dataRows.push(allTr[t]);
        }
        rows = dataRows;
      }
      
      var found = [];
      for (var i = 0; i < rows.length; i++) {
        var row = rows[i] instanceof HTMLElement ? rows[i] : rows[i];
        var text = row.textContent || '';
        var match = false;
        if (orderNo && text.indexOf(orderNo) >= 0) match = true;
        if (!match && buyer && text.indexOf(buyer) >= 0) {
          var cp = phone ? phone.replace(/[-\s]/g, '') : '';
          if (cp && text.replace(/[-\s]/g, '').indexOf(cp) >= 0) match = true;
        }
        if (!match) continue;
        
        var tds = row.querySelectorAll('td');
        var status = '';
        for (var j = 0; j < tds.length; j++) {
          var ct = tds[j].textContent.trim();
          if (['이용완료','완료','확정','취소','노쇼','확정대기'].indexOf(ct) >= 0) { status = ct; if(ct==='완료')status='이용완료'; break; }
          var badges = tds[j].querySelectorAll('span, em, strong, div');
          for (var b = 0; b < badges.length; b++) {
            var bt = badges[b].textContent.trim();
            if (['이용완료','완료','확정','취소','노쇼','확정대기'].indexOf(bt) >= 0) { status = bt; if(bt==='완료')status='이용완료'; break; }
          }
          if (status) break;
        }
        found.push({ status: status || '(알수없음)', row: i });
      }
      
      // ★ 폴백: innerText 검색
      if (found.length === 0 && rows.length === 0) {
        var body = document.body ? document.body.innerText : '';
        if (orderNo && body.indexOf(orderNo) >= 0) {
          var lines = body.split('\n');
          for (var li = 0; li < lines.length; li++) {
            if (lines[li].indexOf(orderNo) >= 0) {
              var st = lines[li].indexOf('이용완료') >= 0 ? '이용완료' : lines[li].indexOf('완료') >= 0 ? '이용완료' : lines[li].indexOf('확정') >= 0 ? '확정' : '(텍스트)';
              found.push({ status: st, row: -1 });
              break;
            }
          }
        }
      }
      
      return { total: rows.length, matches: found };
    }, tk.orderNo, tk.buyer, tk.phone);
    
    if (result.matches.length === 0) {
      return { ok: false, msg: '예약 미발견 (테이블 ' + result.total + '행, 주문번호: ' + (tk.orderNo||'') + ')' };
    }
    
    var allDone = result.matches.every(function(m) { return m.status === '이용완료'; });
    var doneCount = result.matches.filter(function(m) { return m.status === '이용완료'; }).length;
    var statuses = result.matches.map(function(m) { return { coupon: '행' + m.row, status: m.status }; });
    
    return {
      ok: true,
      verified: allDone,
      msg: allDone ? '이용완료 확인 (' + doneCount + '/' + result.matches.length + ')'
                    : '미완료 (' + doneCount + '/' + result.matches.length + ') → ' + result.matches.map(function(m){return m.status}).join(','),
      statuses: statuses,
      doneCount: doneCount,
      totalCount: result.matches.length
    };
  } catch(e) {
    return { ok: false, msg: '확인 오류: ' + e.message };
  }
}

// ═══ 네이버 크롤러 ═══
// 네이버 팝업/모달/광고 자동 닫기
async function dismissNaverPopups(page) {
  try {
    // 최대 3회 반복 시도
    for (var attempt = 0; attempt < 3; attempt++) {
      var closed = await page.evaluate(function() {
        var results = [];
        
        // ★ 전략1: 알림 권한 팝업 차단 (partner.booking.naver.com에서 다음 권한을 요청합니다)
        document.querySelectorAll('button').forEach(function(btn) {
          var t = (btn.textContent || '').trim();
          if (t === '차단' || t === '거부' || t === 'Block' || t === 'Deny') {
            btn.click();
            results.push('🔕 알림차단');
          }
        });
        
        // ★ 전략2: 체크박스 먼저 ("일주일 동안 보지 않기" 등)
        document.querySelectorAll('*').forEach(function(el) {
          var t = (el.textContent || '').trim();
          if (t.length < 30 && (t.indexOf('보지 않기') >= 0 || t.indexOf('보지않기') >= 0 || t.indexOf('다시 보지') >= 0)) {
            // 체크박스 자체이거나, 가까이에 있는 체크박스 찾기
            var cb = el.matches('input[type="checkbox"]') ? el : 
                     el.querySelector('input[type="checkbox"]') ||
                     (el.previousElementSibling && el.previousElementSibling.matches && el.previousElementSibling.matches('input[type="checkbox"]') ? el.previousElementSibling : null);
            if (cb && !cb.checked) { cb.click(); results.push('☑ 보지않기'); }
            // 부모 컨테이너에서 라벨/체크 클릭
            if (!cb) { el.click(); results.push('☑ 라벨클릭'); }
          }
        });
        
        // ★ 전략2: 모든 보이는 팝업/오버레이의 닫기 버튼 클릭
        // 2a) body 위에 떠있는 고정 위치 요소들 찾기
        var allEls = document.querySelectorAll('*');
        var floatingContainers = [];
        allEls.forEach(function(el) {
          var cs = window.getComputedStyle(el);
          if ((cs.position === 'fixed' || cs.position === 'absolute') && cs.zIndex > 10 && el.offsetWidth > 200 && el.offsetHeight > 200) {
            floatingContainers.push(el);
          }
        });
        
        // 2b) 떠있는 컨테이너 안의 닫기 버튼 찾기
        floatingContainers.forEach(function(container) {
          // ★ fn-booking 등 예약 UI 요소는 닫지 않음 (팝업/모달만 닫기)
          var containerCls = (container.className || '').toString().toLowerCase();
          var isPopup = containerCls.indexOf('modal') >= 0 || containerCls.indexOf('popup') >= 0 || 
                        containerCls.indexOf('dim') >= 0 || containerCls.indexOf('overlay') >= 0 || 
                        containerCls.indexOf('toast') >= 0 || containerCls.indexOf('alert') >= 0;
          var isBookingUI = containerCls.indexOf('booking') >= 0 || containerCls.indexOf('table') >= 0 ||
                           containerCls.indexOf('filter') >= 0 || containerCls.indexOf('fn-') >= 0;
          if (isBookingUI && !isPopup) return;
          
          var btns = container.querySelectorAll('button, [role="button"], a, svg, [class*="close"], [class*="Close"]');
          btns.forEach(function(btn) {
            if (btn.offsetParent === null && !btn.closest('svg')) return;
            var t = (btn.textContent || '').trim();
            var cls = (btn.className || '') + '';
            var aria = btn.getAttribute('aria-label') || '';
            var isSvg = btn.tagName === 'svg' || btn.querySelector('svg');
            
            // ★ fn-booking / booking 관련 버튼은 절대 닫지 않음
            if (cls.indexOf('fn-booking') >= 0 || cls.indexOf('booking') >= 0 || cls.indexOf('fn-') >= 0) return;
            // 부모에 booking 클래스가 있으면 건너뜀
            var parentEl = btn.parentElement;
            for (var pp = 0; pp < 3 && parentEl; pp++) {
              var pcls = (parentEl.className || '').toString();
              if (pcls.indexOf('fn-booking') >= 0 || pcls.indexOf('booking') >= 0) return;
              parentEl = parentEl.parentElement;
            }
            
            // X/닫기 버튼 판별 (더 엄격한 조건)
            var isClose = t === '×' || t === 'X' || t === '✕' || t === '닫기' ||
                aria.indexOf('닫기') >= 0 || aria.indexOf('close') >= 0;
            // cls에 close가 있더라도 booking 관련이면 스킵 (위에서 이미 처리)
            if (!isClose && (cls.indexOf('close') >= 0 || cls.indexOf('Close') >= 0)) isClose = true;
            if (isClose) {
              var clickTarget = btn.closest('button') || btn;
              clickTarget.click();
              results.push('✕ float: ' + (t || cls || btn.tagName).substring(0, 20));
            }
          });
        });
        
        // ★ 전략3: 일반 닫기 버튼 (class/aria 기반)
        document.querySelectorAll(
          'button[class*="close"], button[class*="Close"], button[class*="dismiss"], ' +
          'button[aria-label="닫기"], button[aria-label="close"], button[aria-label="Close"], ' +
          '[role="dialog"] button, [class*="modal"] button'
        ).forEach(function(btn) {
          var t = (btn.textContent || '').trim();
          var btnCls = (btn.className || '').toString();
          // ★ fn-booking 관련 버튼 제외
          if (btnCls.indexOf('fn-booking') >= 0 || btnCls.indexOf('fn-') >= 0) return;
          if (btn.offsetParent !== null && (t.length < 5 || t === '닫기' || btnCls.indexOf('close') >= 0)) {
            btn.click();
            results.push('✕ cls: ' + (t || btn.className).substring(0, 20));
          }
        });
        
        // ★ 전략4: 큰 배경 딤/오버레이 우측 상단 영역의 X 버튼
        document.querySelectorAll('[class*="dim"], [class*="Dim"], [class*="backdrop"], [class*="overlay"], [class*="mask"]').forEach(function(d) {
          if (d.offsetParent !== null) {
            // 빈 배경이면 클릭
            if (d.children.length === 0) { d.click(); results.push('dim'); }
            // 안에 닫기 버튼이 있으면 클릭
            var cb = d.querySelector('button');
            if (cb) { cb.click(); results.push('dim-btn'); }
          }
        });
        
        // ★ 전략5: 우측 상단의 작은 × 아이콘 (위치 기반)
        document.querySelectorAll('button, [role="button"]').forEach(function(btn) {
          if (btn.offsetParent === null) return;
          var rect = btn.getBoundingClientRect();
          // 화면 우측 상단에 위치한 작은 버튼 (팝업의 X)
          if (rect.width < 60 && rect.height < 60 && rect.right > window.innerWidth * 0.5) {
            var t = (btn.textContent || '').trim();
            var svg = btn.querySelector('svg, path, img');
            if (t === '×' || t === 'X' || t === '✕' || t === '' || svg) {
              // 부모가 고정/절대 위치인지 확인
              var parent = btn.closest('[style*="position: fixed"], [style*="position:fixed"]') || 
                          btn.parentElement;
              var pcs = parent ? window.getComputedStyle(parent) : null;
              if (pcs && (pcs.position === 'fixed' || pcs.position === 'absolute' || pcs.zIndex > 5)) {
                btn.click();
                results.push('✕ pos: ' + rect.right.toFixed(0) + ',' + rect.top.toFixed(0));
              }
            }
          }
        });
        
        // ★ 전략6: ESC 키
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
        document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape', keyCode: 27, bubbles: true }));
        
        return results;
      });
      
      if (closed.length > 0) {
        log('naver', '팝업 닫기 #' + (attempt+1) + ': ' + closed.join(', '));
        await new Promise(function(r) { setTimeout(r, 500); });
      } else {
        break; // 더 이상 닫을 게 없으면 중단
      }
    }
  } catch(e) { /* 팝업 닫기 실패해도 진행 */ }
}

// ═══ 네이버 쿠키 영속화 (재시작 시 자동 로그인) ═══
var NAVER_COOKIE_FILE = path.join(__dirname, 'naver_cookies.json');

async function naverSaveCookies(page) {
  try {
    var cookies = await page.cookies();
    if (cookies && cookies.length > 0) {
      fs.writeFileSync(NAVER_COOKIE_FILE, JSON.stringify(cookies, null, 2), 'utf8');
      log('naver', '🍪 쿠키 ' + cookies.length + '개 저장 → 다음 시작 시 자동 로그인');
    }
  } catch(e) { log('naver', '쿠키 저장 실패: ' + e.message, 'warning'); }
}

async function naverLoadCookies(page) {
  try {
    if (!fs.existsSync(NAVER_COOKIE_FILE)) return false;
    var stat = fs.statSync(NAVER_COOKIE_FILE);
    var ageDays = (Date.now() - stat.mtimeMs) / 86400000;
    if (ageDays > 7) { log('naver', '쿠키 7일 경과 → 만료'); return false; }
    var cookies = JSON.parse(fs.readFileSync(NAVER_COOKIE_FILE, 'utf8'));
    if (!cookies || cookies.length === 0) return false;
    await page.setCookie.apply(page, cookies);
    log('naver', '🍪 저장된 쿠키 ' + cookies.length + '개 로드');
    return true;
  } catch(e) { log('naver', '쿠키 로드 실패: ' + e.message, 'warning'); return false; }
}

function naverPartnerUrl(subPath) {
  var pbid = STATE.config.naver.partnerBizId || '784618';
  return 'https://partner.booking.naver.com/bizes/' + pbid + '/' + (subPath || 'booking-list-view');
}

async function naverLogin() {
  var c = STATE.config.naver;
  if (!c.id || !c.pw) { log('naver', 'ID/PW 미설정', 'warning'); return false; }
  
  // ★ 2FA 실패 쿨다운: 최근 3분 내 2FA 실패했으면 재시도 방지
  if (STATE._naver2FAFailedAt && Date.now() - STATE._naver2FAFailedAt < 180000) {
    // 단, 이미 브라우저에서 수동 로그인 완료했을 수 있으니 확인
    try {
      var page2 = await getPage('naver');
      var curUrl2 = page2.url();
      if (curUrl2.indexOf('partner.booking.naver.com') >= 0 && curUrl2.indexOf('nidlogin') < 0) {
        STATE.sessions.naver = true;
        STATE._naver2FAFailedAt = null;
        log('naver', '✅ 브라우저에서 수동 로그인 확인됨!', 'success');
        await naverSaveCookies(page2);
        return true;
      }
    } catch(e2) {}
    
    var remaining = Math.ceil((180000 - (Date.now() - STATE._naver2FAFailedAt)) / 1000);
    log('naver', '⏳ 2차인증 쿨다운 중 (' + remaining + '초 후 재시도) → 브라우저에서 직접 로그인 완료하세요', 'warning');
    return false;
  }
  
  try {
    log('naver', '네이버 로그인 시작 (ID: ' + c.id + ')');
    var page = await getPage('naver');

    // ★ STEP 0: 저장된 쿠키로 빠른 로그인 시도
    var cookieLoaded = await naverLoadCookies(page);
    if (cookieLoaded) {
      log('naver', '🍪 쿠키 로그인 시도...');
      var testUrl = naverPartnerUrl('booking-calendar-view');
      await page.goto(testUrl, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(function(){});
      await new Promise(function(r) { setTimeout(r, 2000); });
      var cookieUrl = page.url();
      if (cookieUrl.indexOf('partner.booking.naver.com') >= 0 && cookieUrl.indexOf('nidlogin') < 0) {
        STATE.sessions.naver = true;
        STATE._naver2FAFailedAt = null;
        log('naver', '✅ 쿠키 로그인 성공! (브라우저 인증 없이 자동 로그인)', 'success');
        await crawlLive('naver', '① 쿠키 로그인 성공');
        return true;
      }
      log('naver', '⚠️ 쿠키 만료 → ID/PW 로그인으로 전환', 'warning');
    }

    // ★ STEP 1: partner.booking.naver.com으로 직접 이동 (로그인 리다이렉트)
    var startUrl = naverPartnerUrl('booking-calendar-view');
    var loginUrl = 'https://nid.naver.com/nidlogin.login?mode=form&url=' + encodeURIComponent(startUrl);
    log('naver', '로그인 페이지: ' + loginUrl.substring(0, 80));
    await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 12000 }).catch(function(){});
    await new Promise(function(r) { setTimeout(r, 50); });
    var url = page.url();
    log('naver', '현재 URL: ' + url.substring(0, 100));

    // 이미 로그인 상태면 바로 성공
    if (url.indexOf('partner.booking.naver.com') >= 0 && url.indexOf('nidlogin') < 0) {
      STATE.sessions.naver = true;
      log('naver', '✅ 이미 로그인 상태!', 'success');
      await naverSaveCookies(page);
      return true;
    }

    await screenshot('naver');

    // ★ STEP 2: QR→ID/PW 탭 전환
    var tabResult = await page.evaluate(function() {
      var idInput = document.querySelector('#id');
      if (idInput && idInput.offsetParent !== null) return 'id-input-visible';
      var switches = document.querySelectorAll('.panel_switch a, .tab_switch a, .login_tab a, [class*="tab"] a');
      for (var i = 0; i < switches.length; i++) {
        var t = (switches[i].textContent || '').trim();
        if (t.indexOf('ID') >= 0 || t.indexOf('아이디') >= 0 || t.indexOf('전화번호') >= 0) {
          switches[i].click(); return 'panel_switch: ' + t;
        }
      }
      var all = document.querySelectorAll('a, button, span, div, label, li');
      for (var j = 0; j < all.length; j++) {
        var txt = (all[j].textContent || '').trim();
        if (txt === 'ID/전화번호' || txt === 'ID / 전화번호') { all[j].click(); return 'exact-match'; }
      }
      for (var k = 0; k < all.length; k++) {
        var txt2 = (all[k].textContent || '').trim();
        if (txt2.length < 20 && (txt2.indexOf('ID') >= 0 || txt2.indexOf('아이디') >= 0) && txt2.indexOf('QR') < 0) {
          all[k].click(); return 'partial-match: ' + txt2;
        }
      }
      var idTab = document.querySelector('#label_id_pw, [data-tabname="id"], .tab_id');
      if (idTab) { idTab.click(); return 'selector-click'; }
      return 'not-found';
    });
    log('naver', 'ID/PW 탭 전환: ' + tabResult);
    await new Promise(function(r) { setTimeout(r, 80); });
    
    if (tabResult === 'not-found') {
      await page.goto('https://nid.naver.com/nidlogin.login?mode=form&url=' + encodeURIComponent(startUrl), { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(function(){});
      await new Promise(function(r) { setTimeout(r, 1500); });
    }
    
    var hasIdField = await page.evaluate(function() {
      var id = document.querySelector('#id');
      return id ? (id.offsetParent !== null ? 'visible' : 'hidden') : 'missing';
    });
    log('naver', 'ID 입력란: ' + hasIdField);
    
    if (hasIdField !== 'visible') {
      await page.evaluate(function() {
        var panels = document.querySelectorAll('[class*="panel"], [class*="content"]');
        panels.forEach(function(p) { if ((p.id || p.className || '').toLowerCase().indexOf('qr') >= 0) p.style.display = 'none'; });
        var idPanel = document.querySelector('#frmNIDLogin, [id*="id_pw"], .id_pw_wrap');
        if (idPanel) idPanel.style.display = 'block';
      });
      await new Promise(function(r) { setTimeout(r, 150); });
    }

    // ★ STEP 3: ID/PW 입력 (CDP insertText)
    var client;
    try { client = await page.target().createCDPSession(); } catch(ce) {
      log('naver', 'CDP 세션 실패: ' + ce.message, 'error'); return false;
    }

    try {
      await page.click('#id');
      await new Promise(function(r) { setTimeout(r, 50); });
      await page.keyboard.down('Control'); await page.keyboard.press('KeyA'); await page.keyboard.up('Control');
      await new Promise(function(r) { setTimeout(r, 50); });
      await client.send('Input.insertText', { text: c.id });
      await new Promise(function(r) { setTimeout(r, 80); });
    } catch(ie) {
      log('naver', 'ID 입력 실패: ' + ie.message + ' → evaluate 방식', 'warning');
      await page.evaluate(function(id) { var el = document.querySelector('#id, input[name="id"]'); if (el) { el.focus(); el.value = id; el.dispatchEvent(new Event('input', {bubbles:true})); } }, c.id);
    }

    try {
      await page.click('#pw');
      await new Promise(function(r) { setTimeout(r, 50); });
      await page.keyboard.down('Control'); await page.keyboard.press('KeyA'); await page.keyboard.up('Control');
      await new Promise(function(r) { setTimeout(r, 50); });
      await client.send('Input.insertText', { text: c.pw });
      await new Promise(function(r) { setTimeout(r, 50); });
    } catch(pe) {
      log('naver', 'PW 입력 실패: ' + pe.message + ' → evaluate 방식', 'warning');
      await page.evaluate(function(pw) { var el = document.querySelector('#pw, input[name="pw"], input[type="password"]'); if (el) { el.focus(); el.value = pw; el.dispatchEvent(new Event('input', {bubbles:true})); } }, c.pw);
    }
    log('naver', 'ID/PW 입력 완료');

    // ★ STEP 4: 로그인 버튼 클릭
    await page.evaluate(function() {
      var btn = document.querySelector('.btn_login, .btn_global, #log\\.login, button[type="submit"]');
      if (btn) btn.click();
      else { var f = document.querySelector('form'); if (f) f.submit(); }
    });
    await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 12000 }).catch(function(){});
    await new Promise(function(r) { setTimeout(r, 1000); });
    url = page.url();
    log('naver', '로그인 후 URL: ' + url.substring(0, 100));

    // ★ STEP 5: 캡차/2차인증 대기
    if (url.indexOf('nid.naver.com') >= 0) {
      // 먼저 에러 메시지 확인
      var errMsg = await page.evaluate(function() {
        var selectors = ['#err_common', '.error_message', '.err_msg', '#err_pw', '#err_empty', '.input_alert'];
        for (var s = 0; s < selectors.length; s++) {
          var err = document.querySelector(selectors[s]);
          if (err && err.offsetHeight > 0 && err.textContent.trim()) return err.textContent.trim();
        }
        // 페이지 전체에서 에러 키워드 검색
        var body = document.body ? document.body.innerText : '';
        if (body.indexOf('비밀번호가 일치하지') >= 0) return '비밀번호가 일치하지 않습니다';
        if (body.indexOf('아이디가 존재하지') >= 0) return '아이디가 존재하지 않습니다';
        if (body.indexOf('로봇이 아닙') >= 0) return '캡차 인증 필요';
        return '';
      }).catch(function() { return ''; });
      
      if (errMsg) {
        log('naver', '⚠️ 로그인 에러: ' + errMsg, 'error');
        // 비밀번호 오류면 쿨다운 설정 (반복 시도 방지)
        if (errMsg.indexOf('비밀번호') >= 0 || errMsg.indexOf('아이디') >= 0) {
          STATE._naver2FAFailedAt = Date.now();
          log('naver', '❌ ID/PW 오류 → 설정에서 확인 후 재시도하세요', 'error');
        }
      } else {
        // 2차인증/추가인증 대기
        log('naver', '⚠️ 추가인증 필요 → 브라우저에서 직접 완료해주세요! (180초 대기)', 'warning');
        await screenshot('naver'); // 2FA 화면 스크린샷
        
        // 브라우저 창 앞으로 가져오기
        try {
          await page.bringToFront();
        } catch(bf) {}
        
        var waitSeconds = 180; // 120→180초로 확대
        var waitLoops = Math.floor(waitSeconds / 2);
        for (var i = 0; i < waitLoops; i++) {
          await new Promise(function(r) { setTimeout(r, 2000); });
          url = page.url();
          if (url.indexOf('nid.naver.com') < 0) {
            log('naver', '✅ 인증 완료 감지! URL 변경됨', 'success');
            break;
          }
          // "나중에 등록" 등 팝업 자동 처리
          await page.evaluate(function() {
            var btns = document.querySelectorAll('button, a');
            for (var b = 0; b < btns.length; b++) {
              var t = (btns[b].textContent || '').trim();
              if (t === '나중에 등록' || t === '건너뛰기' || t === '나중에' || t === '다음에 변경' || t === '확인') { btns[b].click(); return; }
            }
          }).catch(function(){});
          // 5회마다 로그 (10초 간격)
          if (i % 5 === 4) {
            var remain = waitSeconds - (i + 1) * 2;
            log('naver', '⏳ 인증 대기 중... (남은 ' + remain + '초) → 브라우저에서 2차인증 완료해주세요', 'info');
          }
        }
        
        // 대기 후에도 실패면 쿨다운 설정
        if (url.indexOf('nid.naver.com') >= 0) {
          STATE._naver2FAFailedAt = Date.now();
          log('naver', '⏳ 인증 시간 초과 → 3분 쿨다운 (이 시간 동안 브라우저에서 직접 로그인 가능)', 'warning');
        }
      }
    }

    STATE.sessions.naver = url.indexOf('nid.naver.com') < 0;
    if (STATE.sessions.naver) {
      STATE._naver2FAFailedAt = null; // 쿨다운 해제
      log('naver', '✅ 로그인 성공!', 'success');
      await naverSaveCookies(page); // 🍪 쿠키 저장 → 다음 시작 시 자동 로그인
      await crawlLive('naver', '① 로그인 성공');
      await dismissNaverPopups(page);
    } else {
      log('naver', '❌ 로그인 실패', 'error');
    }
    await screenshot('naver');
    return STATE.sessions.naver;
  } catch(e) {
    log('naver', '❌ 로그인 오류: ' + e.message, 'error');
    await screenshot('naver').catch(function(){});
    STATE.sessions.naver = false;
    return false;
  }
}

// ═══ 옵션명 유효성 검사 (메타데이터 필드 차단) ═══
var INVALID_OPTION_NAMES = [
  '유입경로','결제정보','결제상태','결제금액','직원메모','메모',
  '취소일시','이용완료일시','확정일시','신청일시','예약일시','변경일시',
  '예약금','예약상태','예매상태','환불정보','환불금액','환불일시',
  '예매정보','예매번호','주문번호','결제수단','결제일시',
  '이용일','방문일','방문일시','연락처','전화번호','이름','예약자',
  '상품','수량','가격','금액','합계','총액',
  '쿠폰','포인트','할인','부분환불','전액환불',
  '네이버','플레이스','스마트플레이스',
  '네이버 플레이스','네이버플레이스','예매 상세정보',
];
function isValidOptionName(name) {
  if (!name || name.length < 2) return false;
  // 정확 일치
  for (var i = 0; i < INVALID_OPTION_NAMES.length; i++) {
    if (name === INVALID_OPTION_NAMES[i]) return false;
    if (name.indexOf(INVALID_OPTION_NAMES[i]) === 0) return false;
  }
  // 패턴 거부: ~일시, ~금액, ~경로, ~정보, ~상태, ~번호
  if (/^.*(일시|금액|경로|정보|상태|번호|수단)$/.test(name)) return false;
  // 날짜, 금액 패턴
  if (/^\d{4}[-\/]\d{2}/.test(name)) return false;
  if (/^[\d,]+\s*원/.test(name)) return false;
  if (/^-$/.test(name)) return false;
  // 전화번호 패턴
  if (/^01[016789][-\s]?\d{3,4}[-\s]?\d{4}$/.test(name)) return false;
  return true;
}

// ★ 네이버 상태 필터 "전체" 선택 헬퍼
async function naverSelectAllStatus(page) {
  try {
    log('naver', '상태 필터 → "전체" 선택 시작...');
    
    // ★ 1단계: 드롭다운 버튼 찾기
    var filterClicked = await page.evaluate(function() {
      var allEls = document.querySelectorAll('button, div, span, label, a, [role="button"]');
      var best = null;
      var bestScore = -1;
      // 상태 키워드 목록
      var statusWords = ['신청','확정','취소','완료','노쇼'];
      
      for (var i = 0; i < allEls.length; i++) {
        var el = allEls[i];
        if (!el.offsetParent) continue;
        var t = (el.textContent || '').trim();
        var r = el.getBoundingClientRect();
        if (r.top < 50 || r.top > 500 || r.width < 20 || r.height < 10) continue;
        if (t.length > 40) continue;
        if (r.top > 400 && t.length < 5) continue;
        
        var score = 0;
        
        // ★ 패턴1: "신청, 확정, 취소, 완료, 노쇼" (쉼표 구분 상태 나열)
        var matchCnt = 0;
        for (var sw = 0; sw < statusWords.length; sw++) {
          if (t.indexOf(statusWords[sw]) >= 0) matchCnt++;
        }
        if (matchCnt >= 3) score = 20; // 3개 이상 상태어 포함 → 최고 점수
        else if (matchCnt >= 2) score = 15;
        
        // ★ 패턴2: "예매상태" 단독
        if (score === 0 && t.indexOf('예매상태') >= 0 && t.length < 20) score = 15;
        
        // ★ 패턴3: "확정" 단독 (짧은 텍스트)
        if (score === 0 && t.indexOf('확정') >= 0 && t.length < 10 && t.indexOf('확정대기') < 0) score = 10;
        
        if (score === 0) continue;
        if (t.indexOf('확정대기') >= 0 && matchCnt < 2) continue;
        
        if (el.querySelector('svg')) score += 5;
        if (t.indexOf('▾') >= 0 || t.indexOf('▼') >= 0) score += 5;
        if (el.tagName === 'BUTTON') score += 3;
        if (el.getAttribute('role') === 'button') score += 3;
        var cursor = ''; try { cursor = getComputedStyle(el).cursor; } catch(e2){}
        if (cursor === 'pointer') score += 2;
        if (r.width > 60 && r.width < 400 && r.height > 15 && r.height < 60) score += 2;
        
        if (score > bestScore) { bestScore = score; best = { el: el, text: t, x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), score: score }; }
      }
      
      if (best) {
        best.el.click();
        return { ok: true, text: best.text, x: best.x, y: best.y, w: best.w, h: best.h, score: best.score };
      }
      return { ok: false };
    });
    
    if (!filterClicked.ok) {
      log('naver', '상태 필터 드롭다운 못찾음', 'warning');
      return false;
    }
    log('naver', '필터 드롭다운 클릭: "' + filterClicked.text + '" @(' + filterClicked.x + ',' + filterClicked.y + ') score=' + filterClicked.score);
    await new Promise(function(r) { setTimeout(r, 800); });
    
    // ★ 2단계: 드롭다운 메뉴 확인
    var menuCheck = await page.evaluate(function() {
      var items = document.querySelectorAll('label, li, div, span, a, button');
      var vis = [];
      var cbs = [];
      for (var i = 0; i < items.length; i++) {
        var el = items[i];
        var t = (el.textContent || '').trim();
        var r = el.getBoundingClientRect();
        if (!el.offsetParent || r.width < 8 || r.height < 8 || r.top < 100 || r.top > 700) continue;
        if (['전체','신청','확정','취소','완료','노쇼'].indexOf(t) >= 0) {
          vis.push(t);
          var cb = el.querySelector('input[type="checkbox"]');
          if (!cb) { var p = el.closest('label, li, div'); if (p) cb = p.querySelector('input[type="checkbox"]'); }
          if (!cb) { var prev = el.previousElementSibling; if (prev && prev.type === 'checkbox') cb = prev; }
          if (cb) cbs.push({ text: t, checked: cb.checked });
        }
      }
      return { vis: vis, cbs: cbs };
    });
    log('naver', '드롭다운 메뉴: [' + menuCheck.vis.join(', ') + ']' + (menuCheck.cbs.length ? ' 체크: ' + menuCheck.cbs.map(function(c){return c.text+'('+(c.checked?'✓':'☐')+')'}).join(',') : ''));
    
    if (menuCheck.vis.length === 0) {
      log('naver', '드롭다운 안열림 → 재클릭', 'warning');
      await page.evaluate(function() {
        var statusW = ['신청','확정','취소','완료','노쇼'];
        var els = document.querySelectorAll('button, div, span, [role="button"]');
        for (var i = 0; i < els.length; i++) {
          var t = (els[i].textContent || '').trim();
          if (!els[i].offsetParent || t.length > 40) continue;
          // 패턴1: "예매상태"
          if (t.indexOf('예매상태') >= 0) { els[i].click(); return; }
          // 패턴2: 쉼표 구분 상태어 (3개 이상)
          var mc = 0;
          for (var s = 0; s < statusW.length; s++) { if (t.indexOf(statusW[s]) >= 0) mc++; }
          if (mc >= 3) { els[i].click(); return; }
        }
      });
      await new Promise(function(r) { setTimeout(r, 1000); });
    }
    
    // ★ 3단계: "전체" 체크박스 클릭
    var result = await page.evaluate(function() {
      var items = document.querySelectorAll('label, li, div, span, a, button');
      var targets = [];
      for (var i = 0; i < items.length; i++) {
        var el = items[i];
        var t = (el.textContent || '').trim();
        var r = el.getBoundingClientRect();
        if (!el.offsetParent || r.width < 8 || r.height < 8 || r.top < 100 || r.top > 700) continue;
        if (t === '전체' || t === '전체 선택') targets.push({ el: el, text: t, y: r.top, x: r.left });
      }
      if (targets.length === 0) return { ok: false, reason: 'no-전체' };
      targets.sort(function(a, b) { return a.y - b.y; });
      var target = targets[0];
      
      // 체크박스 찾기 (5가지 전략)
      var cb = null;
      cb = target.el.querySelector('input[type="checkbox"]');
      if (!cb) { var p = target.el.closest('label, li'); if (p) cb = p.querySelector('input[type="checkbox"]'); }
      if (!cb) { var p2 = target.el.parentElement; if (p2) cb = p2.querySelector('input[type="checkbox"]'); if (!cb && p2 && p2.parentElement) cb = p2.parentElement.querySelector('input[type="checkbox"]'); }
      if (!cb) { var prev = target.el.previousElementSibling; var next = target.el.nextElementSibling; if (prev && prev.type === 'checkbox') cb = prev; else if (next && next.type === 'checkbox') cb = next; }
      if (!cb) {
        var allCbs = document.querySelectorAll('input[type="checkbox"]');
        var minD = 9999, tr = target.el.getBoundingClientRect();
        for (var ci = 0; ci < allCbs.length; ci++) { var cr = allCbs[ci].getBoundingClientRect(); var d = Math.abs(cr.top - tr.top) + Math.abs(cr.left - tr.left); if (d < minD && d < 100) { minD = d; cb = allCbs[ci]; } }
      }
      
      if (cb) {
        var was = cb.checked;
        if (!was) { cb.click(); cb.dispatchEvent(new Event('change', { bubbles: true })); }
        return { ok: true, method: 'checkbox', wasChecked: was, x: Math.round(target.x), y: Math.round(target.y) };
      }
      target.el.click();
      return { ok: true, method: 'direct-click', x: Math.round(target.x), y: Math.round(target.y) };
    });
    
    if (result.ok) {
      log('naver', '✅ 상태 필터 "전체" 선택: ' + result.method + (result.wasChecked ? ' (이미 체크됨)' : ' (새로 체크)'), 'success');
      await new Promise(function(r) { setTimeout(r, 1500); });
      await page.keyboard.press('Escape').catch(function(){});
      await new Promise(function(r) { setTimeout(r, 300); });
      await page.evaluate(function() { document.body.click(); }).catch(function(){});
      await new Promise(function(r) { setTimeout(r, 800); });
      // 필터 후 테이블 리로딩 대기
      for (var wi = 0; wi < 5; wi++) {
        var rc = await page.evaluate(function() { var rows = document.querySelectorAll('table tr'); var c = 0; for (var i = 0; i < rows.length; i++) { if (rows[i].querySelectorAll('td').length >= 3) c++; } return c; }).catch(function() { return 0; });
        if (rc > 0) { log('naver', '  필터 후 테이블 행: ' + rc); break; }
        await new Promise(function(r) { setTimeout(r, 1000); });
      }
      return true;
    } else {
      log('naver', '"전체" 옵션 못찾음 (' + (result.reason || '') + ')', 'warning');
      return false;
    }
  } catch(e) {
    log('naver', '필터 설정 오류: ' + e.message, 'warning');
    return false;
  }
}

async function naverCrawl() {
  var cfg = STATE.config.naver;
  if (!cfg.id) { log('naver', 'ID 미설정', 'warning'); return []; }
  
  // ★ 잘못된 옵션 티켓 자동 정리 (메타데이터 필드명으로 생성된 것들)
  var badOptions = STATE.tickets.filter(function(t) {
    return t.isOption && !isValidOptionName(t.product);
  });
  if (badOptions.length > 0) {
    log('naver', '🧹 잘못된 옵션 티켓 ' + badOptions.length + '건 정리: ' + badOptions.map(function(t) { return t.product; }).join(', '), 'warning');
    STATE.tickets = STATE.tickets.filter(function(t) {
      return !(t.isOption && !isValidOptionName(t.product));
    });
    sendState();
  }
  
  STATE.crawlStatus.naver = 'crawling';
  broadcast({ type: 'crawlStatus', data: STATE.crawlStatus });

  try {
    // 페이지 유효성 체크
    if (STATE.pages.naver) {
      try { await STATE.pages.naver.title(); } catch(e) {
        log('naver', '페이지 무효 → 재로그인', 'warning');
        STATE.sessions.naver = false;
        STATE.pages.naver = null;
      }
    }
    if (!STATE.sessions.naver) { if (!(await naverLogin())) { STATE.crawlStatus.naver = 'error'; return []; } }
    var page = STATE.pages.naver;
    if (!page) { log('naver', '페이지 없음', 'error'); STATE.crawlStatus.naver = 'error'; return []; }
    var curUrl = page.url();
    log('naver', '현재 URL: ' + curUrl.substring(0, 100));

    // ═══ Step 1~3 통합: 예약관리 페이지 직접 이동 ═══
    var placeId = cfg.placeId || '4789821';
    var bizBookingId = cfg.bizId || '507900';
    
    // 이미 booking/list 페이지면 스킵
    var isOnBooking = curUrl.indexOf('partner.booking.naver.com') >= 0 && curUrl.indexOf('/booking') >= 0;
    if (isOnBooking) {
      log('naver', '이미 예매자관리 페이지');
    } else {
      log('naver', '예매자관리 페이지 이동 (partner.booking.naver.com 직접 접근)');
      
      // ★ 전략 1: partner.booking.naver.com 직접 이동 (API 방식)
      var directUrl = naverPartnerUrl('booking-list-view');
      await page.goto(directUrl, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(function(){});
      await new Promise(function(r) { setTimeout(r, 2000); });
      checkAbort();
      curUrl = page.url();
      
      // 로그인 리다이렉트 감지
      if (curUrl.indexOf('nid.naver.com') >= 0) {
        log('naver', '세션 만료 → 재로그인', 'warning');
        STATE.sessions.naver = false;
        if (!(await naverLogin())) { STATE.crawlStatus.naver = 'error'; return []; }
        page = STATE.pages.naver;
        // 로그인 후 다시 이동
        await page.goto(directUrl, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(function(){});
        await new Promise(function(r) { setTimeout(r, 2000); });
        curUrl = page.url();
      }
      
      var bookingReached = curUrl.indexOf('partner.booking.naver.com') >= 0 && curUrl.indexOf('/booking') >= 0;
      if (!bookingReached) {
        bookingReached = await page.evaluate(function() {
          var b = document.body ? document.body.innerText : '';
          return b.indexOf('예매자관리') >= 0 || b.indexOf('예매번호') >= 0 || b.indexOf('이용일') >= 0;
        });
      }
      log('naver', '전략1 (직접 URL): ' + (bookingReached ? '✅' : '❌') + ' URL: ' + curUrl.substring(0, 100));
      
      // ★ 전략 2: 실패 시 smartplace.naver.com 경유 (기존 폴백)
      if (!bookingReached) {
        log('naver', '전략2: 사이드바 클릭');
        var dashUrl = cfg.bookingUrl || ('https://new.smartplace.naver.com/bizes/place/' + placeId + '?bookingBusinessId=' + bizBookingId);
        await page.goto(dashUrl, { waitUntil: 'domcontentloaded', timeout: 12000 }).catch(function(){});
        await new Promise(function(r) { setTimeout(r, 2000); });
        checkAbort();
        
        // 사이드바 "예약" 클릭
        var oldUrl2 = page.url();
        await page.evaluate(function() {
          var links = document.querySelectorAll('a');
          for (var i = 0; i < links.length; i++) {
            var t = (links[i].textContent || '').trim();
            if ((t === '예약' || t === '예약관리') && links[i].offsetParent !== null) {
              var rect = links[i].getBoundingClientRect();
              if (rect.left < 250) { links[i].click(); return; }
            }
          }
        });
        for (var wi = 0; wi < 12; wi++) {
          await new Promise(function(r) { setTimeout(r, 500); });
          curUrl = page.url();
          if (curUrl !== oldUrl2) break;
        }
        checkAbort();
        bookingReached = curUrl.indexOf('/booking') >= 0 || (await page.evaluate(function() {
          var b = document.body ? document.body.innerText : '';
          return b.indexOf('예매자관리') >= 0 || b.indexOf('예매번호') >= 0;
        }));
        log('naver', '전략2: ' + (bookingReached ? '✅' : '❌') + ' URL: ' + curUrl.substring(0, 100));
      }
      
      if (!bookingReached) {
        log('naver', '⚠️ 예매자관리 진입 실패!', 'warning');
        await screenshot('naver');
      }
    }
    curUrl = page.url();
    log('naver', '최종 URL: ' + curUrl.substring(0, 120));
    // await dismissNaverPopups(page); // 비활성화: 테이블 UI 파괴 방지

    // ═══ Step 4: 날짜/필터 URL 이동 → 업체 드롭다운 변경 (이 순서가 핵심!) ═══
    // ※ 업체를 먼저 바꿔도 날짜 URL goto()로 페이지 리로드되면 업체 선택이 초기화됨
    // ※ 따라서 날짜 URL 이동을 먼저 하고, 그 후에 업체 드롭다운을 변경해야 함
    
    // ──── 4-1: 날짜 필터 URL 이동 (먼저) ────
    var naverDateFrom = cfg.dateFrom || STATE.config.crawlDateFrom || new Date().toISOString().split('T')[0];
    var naverDateTo = cfg.dateTo || STATE.config.crawlDateTo || new Date().toISOString().split('T')[0];
    log('naver', '크롤링 기간: ' + naverDateFrom + ' ~ ' + naverDateTo);
    
    // ★ 직접 partner.booking.naver.com URL 사용 (API 방식)
    var bookingBase = naverPartnerUrl('booking-list-view');
    
    var isToday = naverDateFrom === new Date().toISOString().split('T')[0] && naverDateTo === naverDateFrom;
    var qp = [];
    qp.push('dateFilter=USEDATE');
    if (isToday) {
      qp.push('dateDropdownType=TODAY');
    } else {
      qp.push('dateDropdownType=PERIOD');
      qp.push('startDateTime=' + naverDateFrom + 'T00:00:00');
      qp.push('endDateTime=' + naverDateTo + 'T23:59:59');
    }
    // ★ 상태 필터: 전체 (확정+이용완료+신청+취소+노쇼 모두 포함)
    // RC01=확정, RC02=신청, RC03=확정대기, RC04=입금대기, RC05=결제완료, RC08=이용완료, RC09=취소, RC10=노쇼
    var allStatusCodes = ['RC01','RC02','RC03','RC04','RC05','RC08','RC09','RC10'];
    allStatusCodes.forEach(function(code) { qp.push('bookingStatusCodes=' + code); });
    
    var targetUrl = bookingBase + '?' + qp.join('&');
    log('naver', '조회 URL: ' + targetUrl.substring(0, 150));
    
    await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 20000 }).catch(function(e) {
      log('naver', '조회 URL 이동 실패: ' + e.message, 'warning');
    });
    await new Promise(function(r) { setTimeout(r, 4000); });
    checkAbort();
    // ★ 팝업 닫기 사용 안 함 (테이블 UI를 파괴하는 문제)
    
    var afterGoto = await page.evaluate(function() {
      var body = document.body ? document.body.innerText : '';
      return {
        url: location.href,
        hasTable: document.querySelectorAll('table tbody tr').length,
        noResults: body.indexOf('조회된 예매내역이 없습니다') >= 0,
        pageText: body.substring(0, 300)
      };
    });
    log('naver', '이동 후 URL: ' + afterGoto.url.substring(0, 150));
    log('naver', '이동 후 상태: 테이블 ' + afterGoto.hasTable + '행' + (afterGoto.noResults ? ', 결과없음' : ''));
    
    // ──── 4-2: 업체 드롭다운 → "박물관" 포함 업체 선택 ────
    log('naver', '업체 드롭다운 → 박물관 업체 선택 시도');
    await crawlLive('naver', '③ 업체 선택 중');
    
    // ★ 스크린샷으로 현재 페이지 확인
    await screenshot('naver');
    
    // 드롭다운 트리거 찾기 (React 커스텀 컴포넌트)
    // partner.booking.naver.com의 업체 드롭다운 구조:
    //   <div> or <button> 안에 "한국잠사플레이팝 잠..." 텍스트 + SVG 화살표
    //   클릭 시 하위에 li/a 목록이 나타남
    var triggerInfo = await page.evaluate(function() {
      var info = { found: false, log: [] };
      
      // ★ 전략1: aria 속성이 있는 드롭다운 트리거
      var ariaEls = document.querySelectorAll('[aria-expanded], [aria-haspopup], [role="combobox"], [role="button"][aria-controls]');
      for (var a = 0; a < ariaEls.length; a++) {
        var el = ariaEls[a];
        var t = (el.textContent || '').trim();
        if ((t.indexOf('잠사') >= 0 || t.indexOf('플레이') >= 0) && t.length < 80 && el.offsetParent) {
          var r = el.getBoundingClientRect();
          info.found = true;
          info.x = Math.round(r.left + r.width / 2);
          info.y = Math.round(r.top + r.height / 2);
          info.text = t.substring(0, 40);
          info.method = 'aria';
          info.log.push('aria 트리거: "' + t.substring(0, 30) + '" @(' + info.x + ',' + info.y + ') ' + Math.round(r.width) + 'x' + Math.round(r.height));
          return info;
        }
      }
      
      // ★ 전략2: SVG 아이콘(화살표)을 가진 잠사 텍스트 요소
      var allEls = document.querySelectorAll('button, div, span, a');
      for (var i = 0; i < allEls.length; i++) {
        var el2 = allEls[i];
        if (!el2.offsetParent) continue;
        var t2 = (el2.textContent || '').trim();
        if (t2.indexOf('잠사') < 0 && t2.indexOf('플레이') < 0) continue;
        if (t2.length > 60 || t2.length < 5) continue;
        
        var r2 = el2.getBoundingClientRect();
        // 드롭다운 크기: 폭 120-400, 높이 25-55
        if (r2.width < 80 || r2.height < 15 || r2.height > 70) continue;
        
        // SVG 화살표가 있거나 클릭 가능한 요소
        var hasSvg = el2.querySelector('svg') !== null;
        var isClickable = el2.tagName === 'BUTTON' || el2.style.cursor === 'pointer' || el2.onclick !== null;
        var hasClass = (el2.className || '').toString().match(/dropdown|select|trigger|combo|toggle/i);
        
        info.log.push(el2.tagName + ': "' + t2.substring(0, 30) + '" ' + Math.round(r2.width) + 'x' + Math.round(r2.height) + ' svg=' + hasSvg + ' click=' + isClickable + ' cls=' + !!hasClass);
        
        if (hasSvg || isClickable || hasClass) {
          info.found = true;
          info.x = Math.round(r2.left + r2.width / 2);
          info.y = Math.round(r2.top + r2.height / 2);
          info.text = t2.substring(0, 40);
          info.method = 'svg-clickable';
          return info;
        }
      }
      
      // ★ 전략3: 텍스트만으로 찾기 (최후의 수단) - "잠사플레이" 텍스트가 있고 부모가 큰 컨테이너가 아닌 리프 요소
      for (var j = 0; j < allEls.length; j++) {
        var el3 = allEls[j];
        if (!el3.offsetParent) continue;
        var t3 = (el3.textContent || '').trim();
        if (t3.indexOf('잠사플레이') < 0) continue;
        if (t3.length > 40) continue;
        var r3 = el3.getBoundingClientRect();
        if (r3.width > 80 && r3.height > 15 && r3.height < 70) {
          // 자식이 많지 않은 말단 요소 (드롭다운 트리거)
          if (el3.querySelectorAll('*').length < 10) {
            info.found = true;
            info.x = Math.round(r3.left + r3.width / 2);
            info.y = Math.round(r3.top + r3.height / 2);
            info.text = t3.substring(0, 40);
            info.method = 'text-leaf';
            info.log.push('text-leaf: "' + t3.substring(0, 30) + '" @(' + info.x + ',' + info.y + ')');
            return info;
          }
        }
      }
      
      // ★ 전략4: 모든 요소에서 "잠사" 포함하고 크기가 드롭다운인 것 (가장 넓은 범위)
      for (var k = 0; k < allEls.length; k++) {
        var el4 = allEls[k];
        if (!el4.offsetParent) continue;
        // 바로 이 요소의 직접 텍스트만 체크 (자식 제외)
        var directText = '';
        for (var cn = 0; cn < el4.childNodes.length; cn++) {
          if (el4.childNodes[cn].nodeType === 3) directText += el4.childNodes[cn].textContent;
        }
        directText = directText.trim();
        if (directText.indexOf('잠사') < 0 && directText.indexOf('플레이') < 0) {
          // 첫번째 자식 텍스트도 확인
          var fc = el4.firstElementChild;
          if (fc) directText = (fc.textContent || '').trim();
        }
        if (directText.indexOf('잠사') < 0 && directText.indexOf('플레이') < 0) continue;
        if (directText.length > 50) continue;
        
        var r4 = el4.getBoundingClientRect();
        if (r4.width > 80 && r4.height > 15 && r4.height < 70) {
          info.found = true;
          info.x = Math.round(r4.left + r4.width / 2);
          info.y = Math.round(r4.top + r4.height / 2);
          info.text = directText.substring(0, 40);
          info.method = 'direct-text';
          info.log.push('direct-text: "' + directText.substring(0, 30) + '" @(' + info.x + ',' + info.y + ')');
          return info;
        }
      }
      
      info.log.push('모든 전략 실패');
      return info;
    });
    
    log('naver', '드롭다운 감지: ' + (triggerInfo.found ? '✅ [' + triggerInfo.method + '] "' + triggerInfo.text + '" @(' + triggerInfo.x + ',' + triggerInfo.y + ')' : '❌ 못 찾음'));
    triggerInfo.log.forEach(function(l) { log('naver', '  ' + l); });
    
    if (triggerInfo.found) {
      // ★ 드롭다운 트리거 클릭 (열기)
      await page.mouse.click(triggerInfo.x, triggerInfo.y);
      await new Promise(function(r) { setTimeout(r, 1500); });
      checkAbort();
      
      // ★ 열린 드롭다운에서 첫번째 옵션 클릭
      // 핵심: 트리거 x좌표 근처의 요소만 수집 (사이드바 x≈120 vs 드롭다운 x≈1200 구분)
      var firstOptResult = await page.evaluate(function(triggerX, triggerY) {
        var result = { clicked: false, log: [] };
        
        // 드롭다운 메뉴 항목 수집
        var candidates = document.querySelectorAll('li, a, [role="option"], [role="menuitem"]');
        var options = [];
        
        for (var i = 0; i < candidates.length; i++) {
          var el = candidates[i];
          if (!el.offsetParent) continue;
          var rect = el.getBoundingClientRect();
          if (rect.height < 10 || rect.width < 50 || rect.height > 70) continue;
          var t = (el.textContent || '').trim();
          if (t.indexOf('잠사') < 0 && t.indexOf('플레이') < 0) continue;
          if (t.length < 4 || t.length > 50) continue;
          
          var elCenterX = Math.round(rect.left + rect.width / 2);
          var elCenterY = Math.round(rect.top + rect.height / 2);
          
          // ★ 핵심 필터: 트리거 x좌표와 300px 이내의 요소만 (사이드바 제외)
          if (Math.abs(elCenterX - triggerX) > 300) {
            result.log.push('  [제외-x거리] "' + t.substring(0, 25) + '" @(' + elCenterX + ',' + elCenterY + ') Δx=' + Math.abs(elCenterX - triggerX));
            continue;
          }
          
          // ★ 트리거보다 위에 있으면 제외 (드롭다운은 아래로 열림)
          if (elCenterY < triggerY - 20) {
            result.log.push('  [제외-위쪽] "' + t.substring(0, 25) + '" @(' + elCenterX + ',' + elCenterY + ')');
            continue;
          }
          
          // 중복 제거
          var dup = false;
          for (var d = 0; d < options.length; d++) {
            if (Math.abs(options[d].y - rect.top) < 3) { dup = true; break; }
          }
          if (dup) continue;
          
          options.push({
            text: t,
            x: elCenterX,
            y: elCenterY,
            w: Math.round(rect.width),
            h: Math.round(rect.height),
            tag: el.tagName
          });
        }
        
        // y좌표 오름차순 (최상단 = 첫번째)
        options.sort(function(a, b) { return a.y - b.y; });
        
        result.log.push('드롭다운 옵션 ' + options.length + '개 (트리거 x=' + triggerX + ' 기준 필터):');
        options.forEach(function(o, idx) {
          result.log.push('  #' + (idx+1) + ' <' + o.tag + '> "' + o.text + '" @(' + o.x + ',' + o.y + ') ' + o.w + 'x' + o.h);
        });
        
        // ★ 첫번째 옵션 선택 (한국잠사플레이팝 = 예매가 있는 업체)
        if (options.length >= 1) {
          result.pickText = options[0].text;
          result.pickX = options[0].x;
          result.pickY = options[0].y;
          result.clicked = true;
        }
        
        return result;
      }, triggerInfo.x, triggerInfo.y);
      
      firstOptResult.log.forEach(function(l) { log('naver', '  ' + l); });
      
      if (firstOptResult.clicked) {
        log('naver', '→ 업체 선택: "' + firstOptResult.pickText + '" @(' + firstOptResult.pickX + ',' + firstOptResult.pickY + ')');
        await page.mouse.click(firstOptResult.pickX, firstOptResult.pickY);
        await new Promise(function(r) { setTimeout(r, 3000); });
        checkAbort();
        // await dismissNaverPopups(page); // 비활성화: 테이블 UI 파괴 방지
        
        // ★ 업체 변경 후 예매자관리(booking-list-view)로 직접 이동
        // 사이드바 "예약"이 2개(상위메뉴/하위서브메뉴)라 클릭이 모호 → URL 직접 이동
        log('naver', '예매자관리 페이지로 직접 이동...');
        var bizUrl = page.url();
        // URL에서 bizes ID 추출: partner.booking.naver.com/bizes/784618/...
        var bizMatch = bizUrl.match(/\/bizes\/(\d+)/);
        if (bizMatch) {
          var bizesId = bizMatch[1];
          // bookingBusinessId도 추출 시도
          var bbMatch2 = bizUrl.match(/bookingBusinessId=([^&]*)/);
          var bbId = bbMatch2 ? bbMatch2[1] : bizesId;
          var listUrl = 'https://partner.booking.naver.com/bizes/' + bizesId + '/booking-list-view?bookingBusinessId=' + bbId;
          log('naver', '이동 URL: ' + listUrl);
          await page.goto(listUrl, { waitUntil: 'domcontentloaded', timeout: 12000 }).catch(function(){});
          await new Promise(function(r) { setTimeout(r, 3000); });
          checkAbort();
          // await dismissNaverPopups(page); // 비활성화: 테이블 UI 파괴 방지
        } else {
          // URL에서 ID 못 찾으면 사이드바 폴백 (하위 "예약" 서브메뉴 정확 타겟)
          log('naver', 'bizes ID 미발견 → 사이드바 서브메뉴 "예약" 클릭 시도');
          var sidebarClicked = await page.evaluate(function() {
            // 사이드바에서 "예약" 서브메뉴 찾기 (하위 항목 = 부모가 이미 열린 메뉴)
            var links = document.querySelectorAll('a');
            var candidates = [];
            for (var i = 0; i < links.length; i++) {
              var el = links[i];
              if (!el.offsetParent) continue;
              var t = (el.textContent || '').trim();
              var rect = el.getBoundingClientRect();
              var href = el.getAttribute('href') || '';
              if (rect.left < 250 && t === '예약' && rect.height > 10 && rect.height < 60) {
                candidates.push({ el: el, href: href, y: rect.top, hasBooking: href.indexOf('booking') >= 0 });
              }
            }
            // booking URL을 가진 "예약" 우선, 없으면 y좌표가 더 큰(하위) 것
            candidates.sort(function(a, b) {
              if (a.hasBooking !== b.hasBooking) return a.hasBooking ? -1 : 1;
              return b.y - a.y; // y가 큰 게 서브메뉴
            });
            if (candidates.length > 0) {
              candidates[0].el.click();
              return { ok: true, href: candidates[0].href, y: Math.round(candidates[0].y) };
            }
            return { ok: false };
          });
          
          if (sidebarClicked.ok) {
            log('naver', '✅ 서브메뉴 "예약" 클릭 (href=' + sidebarClicked.href + ', y=' + sidebarClicked.y + ')');
            await new Promise(function(r) { setTimeout(r, 3000); });
            checkAbort();
            // await dismissNaverPopups(page); // 비활성화: 테이블 UI 파괴 방지
          } else {
            log('naver', '⚠️ 사이드바 "예약" 못 찾음');
          }
        }
        
        // 업체 변경 후 테이블 확인
        var afterBiz = await page.evaluate(function() {
          return {
            rows: document.querySelectorAll('table tbody tr').length,
            noData: (document.body.innerText || '').indexOf('조회된 예매내역이 없습니다') >= 0,
            url: location.href.substring(0, 150)
          };
        });
        log('naver', '업체 변경 후: 테이블 ' + afterBiz.rows + '행' + (afterBiz.noData ? ', 결과없음' : '') + ' URL: ' + afterBiz.url);
      } else {
        log('naver', '⚠️ 드롭다운 옵션 없음 → Escape');
        await page.keyboard.press('Escape');
        await new Promise(function(r) { setTimeout(r, 500); });
      }
    } else {
      // 드롭다운 못 찾음 → 디버그 정보 덤프
      var debug = await page.evaluate(function() {
        var info = [];
        // 페이지 내 '잠사' 포함 요소 전수 조사
        var all = document.querySelectorAll('*');
        for (var i = 0; i < all.length; i++) {
          var el = all[i];
          if (!el.offsetParent) continue;
          var t = (el.textContent || '').trim();
          if (t.indexOf('잠사') < 0) continue;
          if (t.length > 50) continue;
          if (el.children.length > 5) continue;  // 큰 컨테이너 제외
          var r = el.getBoundingClientRect();
          info.push(el.tagName + '.' + (el.className || '').toString().substring(0, 20) + ': "' + t.substring(0, 30) + '" ' + Math.round(r.width) + 'x' + Math.round(r.height) + ' @(' + Math.round(r.left) + ',' + Math.round(r.top) + ')');
        }
        return info.slice(0, 15);
      });
      log('naver', '⚠️ 업체 드롭다운 미발견. 잠사 요소들:');
      debug.forEach(function(l) { log('naver', '  [debug] ' + l); });
    }
    
    // ★ 업체 변경 + 예약 이동 후: 날짜 필터 재적용 (업체 변경으로 URL이 바뀌었을 수 있음)
    curUrl = page.url();
    
    // ★ bookingBase를 현재 URL 기준으로 업데이트 (업체 변경 후 새 URL)
    bookingBase = curUrl.split('?')[0];
    if (bookingBase.indexOf('booking-list-view') < 0) {
      // booking-list-view가 아니면 보정
      var bizMatch2 = curUrl.match(/\/bizes\/(\d+)/);
      if (bizMatch2) {
        bookingBase = 'https://partner.booking.naver.com/bizes/' + bizMatch2[1] + '/booking-list-view';
      }
    }
    log('naver', '업데이트된 bookingBase: ' + bookingBase.substring(0, 100));
    // ★ 다른 함수에서 재사용하기 위해 저장
    STATE.naverBookingBase = bookingBase;
    
    if (curUrl.indexOf('booking-list-view') < 0 || curUrl.indexOf('dateFilter=') < 0) {
      log('naver', '날짜 필터 재적용...');
      var base2 = curUrl.split('?')[0];
      if (base2.indexOf('booking-list-view') < 0) {
        base2 = base2.replace(/\/booking\/list\/?$/, '/booking-list-view');
        base2 = base2.replace(/\/booking\/?$/, '/booking-list-view');
        if (base2.indexOf('booking-list-view') < 0 && base2.indexOf('booking') >= 0) {
          base2 = base2 + '-list-view';
        } else if (base2.indexOf('booking') < 0) {
          base2 = base2 + '/booking-list-view';
        }
      }
      var qp2 = [];
      qp2.push('dateFilter=USEDATE');
      if (isToday) { qp2.push('dateDropdownType=TODAY'); }
      else { qp2.push('dateDropdownType=PERIOD'); qp2.push('startDateTime=' + naverDateFrom + 'T00:00:00'); qp2.push('endDateTime=' + naverDateTo + 'T23:59:59'); }
      // ★ 상태 필터: 전체
      allStatusCodes.forEach(function(code) { qp2.push('bookingStatusCodes=' + code); });
      // 현재 URL에 bookingBusinessId가 있으면 유지
      var bbMatch = curUrl.match(/bookingBusinessId=([^&]*)/);
      if (bbMatch) qp2.push('bookingBusinessId=' + bbMatch[1]);
      var reUrl = base2 + '?' + qp2.join('&');
      log('naver', '날짜 재적용 URL: ' + reUrl.substring(0, 150));
      await page.goto(reUrl, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(function(){});
      await new Promise(function(r) { setTimeout(r, 2500); });
      checkAbort();
      // await dismissNaverPopups(page); // 비활성화: 테이블 UI 파괴 방지
    }
    
    // ──── 4-3: 상태 필터 → "전체" 선택 (확정만이 아닌 모든 상태 크롤링) ────
    await naverSelectAllStatus(page);
    
    // ──── 4-4: 필터 확인 + 테이블 로딩 대기 ────
    log('naver', '테이블 로딩 대기...');
    await crawlLive('naver', '③ 테이블 로딩 대기');
    
    // ★ 테이블 행이 나타날 때까지 최대 15초 대기
    var detectedRows = 0;
    var isDivTable = false; // div 기반 테이블 여부
    for (var waitI = 0; waitI < 15; waitI++) {
      var rowInfo = await page.evaluate(function() {
        var tbody = document.querySelectorAll('table tbody tr');
        var allTr = document.querySelectorAll('table tr');
        var dataTr = 0;
        for (var i = 0; i < allTr.length; i++) {
          if (allTr[i].querySelectorAll('td').length >= 3) dataTr++;
        }
        // "예매 N건" 텍스트에서 건수 추출
        var body = document.body ? document.body.innerText : '';
        var countMatch = body.match(/예매\s*(\d+)\s*건/);
        var count = countMatch ? parseInt(countMatch[1]) : 0;
        
        // ★ div 기반 테이블 행 감지 (table이 없는 경우)
        var divRows = 0;
        if (dataTr === 0 && tbody.length === 0) {
          // 방법1: 전화번호 패턴이 포함된 div 행 수
          var allDivs = document.querySelectorAll('div, li, article, [role="row"]');
          for (var d = 0; d < allDivs.length; d++) {
            var dt = (allDivs[d].textContent || '');
            if (dt.match(/010[-.\s]?\d{4}[-.\s]?\d{4}/) && dt.length < 500) divRows++;
          }
          // 방법2: 예매번호 패턴
          if (divRows === 0) {
            for (var d2 = 0; d2 < allDivs.length; d2++) {
              var dt2 = (allDivs[d2].textContent || '');
              if (dt2.match(/\d{10,}/) && dt2.indexOf('예매') >= 0 && dt2.length < 500) divRows++;
            }
          }
        }
        
        return { tbody: tbody.length, dataTr: dataTr, allTr: allTr.length, count: count, divRows: divRows, hasTable: document.querySelectorAll('table').length };
      });
      
      detectedRows = rowInfo.dataTr || rowInfo.tbody;
      if (detectedRows > 0) {
        log('naver', '테이블 행 ' + detectedRows + '개 감지 (' + (waitI+1) + '초) [tbody=' + rowInfo.tbody + ', dataTr=' + rowInfo.dataTr + ', 예매=' + rowInfo.count + '건]');
        break;
      }
      
      // ★ div 기반 테이블 감지
      if (rowInfo.divRows > 0) {
        isDivTable = true;
        detectedRows = rowInfo.divRows;
        log('naver', '✅ div 기반 테이블 감지! ' + rowInfo.divRows + '행 (' + (waitI+1) + '초) [table=' + rowInfo.hasTable + ', 예매=' + rowInfo.count + '건]');
        break;
      }
      
      // "예매 N건"이 보이면 div 기반일 수 있으니 빨리 진행
      if (waitI >= 3 && rowInfo.count > 0 && rowInfo.hasTable === 0) {
        isDivTable = true;
        detectedRows = rowInfo.count;
        log('naver', '✅ 예매 ' + rowInfo.count + '건 표시 (table=0 → div 기반 추정) → 텍스트 파싱으로 진행');
        break;
      }
      
      if (waitI === 5 && rowInfo.count > 0) {
        log('naver', '예매 ' + rowInfo.count + '건 표시 but 행 없음 → 추가 대기');
      }
      
      await new Promise(function(r) { setTimeout(r, 1000); });
    }
    
    if (detectedRows === 0) {
      log('naver', '⚠ 15초 대기 후에도 행 없음 → iframe 검색');
      
      // ★ iframe 안에 테이블이 있는지 확인
      var frames = page.frames();
      log('naver', '프레임 수: ' + frames.length);
      for (var fi = 0; fi < frames.length; fi++) {
        try {
          var frameName = frames[fi].name() || frames[fi].url().substring(0, 80);
          var frameRows = await frames[fi].evaluate(function() {
            var rows = document.querySelectorAll('table tr');
            var cnt = 0;
            for (var i = 0; i < rows.length; i++) { if (rows[i].querySelectorAll('td').length >= 3) cnt++; }
            return { dataTr: cnt, tbody: document.querySelectorAll('table tbody tr').length, allTr: rows.length };
          }).catch(function() { return { dataTr: 0, tbody: 0, allTr: 0 }; });
          
          log('naver', '  프레임[' + fi + '] ' + frameName.substring(0, 50) + ': dataTr=' + frameRows.dataTr + ' tbody=' + frameRows.tbody);
          
          if (frameRows.dataTr > 0 || frameRows.tbody > 0) {
            log('naver', '✅ iframe에서 테이블 발견! 프레임[' + fi + ']');
            // 이 프레임을 파싱에 사용
            page._naverFrame = frames[fi];
            detectedRows = frameRows.dataTr || frameRows.tbody;
            break;
          }
        } catch(fe) {
          log('naver', '  프레임[' + fi + '] 접근 실패: ' + fe.message);
        }
      }
      
      // ★ iframe도 없으면 page.content()에서 직접 테이블 검색
      if (detectedRows === 0) {
        var pageHtml = await page.evaluate(function() {
          return {
            hasTable: document.querySelectorAll('table').length,
            hasTbody: document.querySelectorAll('tbody').length,
            hasTr: document.querySelectorAll('tr').length,
            hasTd: document.querySelectorAll('td').length,
            iframes: document.querySelectorAll('iframe').length,
            bodyLen: (document.body ? document.body.innerHTML.length : 0),
            sample: (document.body ? document.body.innerHTML.substring(0, 2000) : ''),
          };
        });
        log('naver', 'DOM분석: table=' + pageHtml.hasTable + ' tbody=' + pageHtml.hasTbody + ' tr=' + pageHtml.hasTr + ' td=' + pageHtml.hasTd + ' iframe=' + pageHtml.iframes + ' bodyLen=' + pageHtml.bodyLen);
        // HTML 샘플에서 테이블 구조 확인
        if (pageHtml.sample.indexOf('<table') >= 0) {
          log('naver', 'HTML에 <table> 태그 있음');
        }
        if (pageHtml.sample.indexOf('phone') >= 0 || pageHtml.sample.indexOf('전화') >= 0) {
          log('naver', 'HTML에 전화 관련 텍스트 있음');
        }
      }
    }
    
    // ★ "이용완료" 탭은 건드리지 않음 (이미 결과가 표시되고 있음)
    // 이전에 이 탭을 해제하면 결과가 사라지는 문제가 있었음
    
    // ★ 파싱에 사용할 컨텍스트 (메인 페이지 또는 iframe)
    var evalCtx = page._naverFrame || page;
    if (page._naverFrame) {
      log('naver', '★ iframe 컨텍스트 사용');
    }
    
    // ──── 4-4: 최종 확인 ────
    var finalCheck = await evalCtx.evaluate(function() {
      var body = document.body ? document.body.innerText : '';
      var count = '0건';
      var m = body.match(/예매\s*(\d+)\s*건/);
      if (m) count = m[1] + '건';
      
      var tbodyRows = document.querySelectorAll('table tbody tr').length;
      var dataTr = 0;
      var allTr = document.querySelectorAll('table tr');
      for (var i = 0; i < allTr.length; i++) {
        if (allTr[i].querySelectorAll('td').length >= 3) dataTr++;
      }
      
      // div 기반 행 수
      var phones = body.match(/01[016789][-.\s]?\d{3,4}[-.\s]?\d{4}/g);
      var divRows = phones ? phones.length : 0;
      
      return { 
        count: count, countNum: m ? parseInt(m[1]) : 0,
        url: location.href.substring(0, 150),
        noResults: body.indexOf('조회된 예매내역이 없습니다') >= 0,
        hasTable: tbodyRows,
        dataTr: dataTr,
        allTr: allTr.length,
        divRows: divRows,
        tableCount: document.querySelectorAll('table').length,
      };
    });
    
    var effectiveRows = finalCheck.dataTr || finalCheck.hasTable || (isDivTable ? finalCheck.divRows : 0);
    log('naver', '📊 최종: ' + finalCheck.count + (isDivTable ? ' (div기반: ' + finalCheck.divRows + '행)' : '') + ', tbody행: ' + finalCheck.hasTable + ', dataTr: ' + finalCheck.dataTr + ', allTr: ' + finalCheck.allTr + ', table수: ' + finalCheck.tableCount + (finalCheck.noResults ? ' (결과없음)' : ''));
    
    // ★ detectedRows 또는 effectiveRows > 0이면 재시도 불필요
    if (detectedRows > 0 || effectiveRows > 0) {
      log('naver', '✅ 행 감지됨 → 재시도 건너뜀 (detected=' + detectedRows + ', effective=' + effectiveRows + ')');
    } else if (finalCheck.noResults || (effectiveRows === 0 && finalCheck.countNum === 0)) {
      log('naver', '0건 → 재시도 시작');
      
      // 현재 URL에서 bookingBusinessId 추출
      var curUrlForRetry = page.url();
      var bbRetry = curUrlForRetry.match(/bookingBusinessId=([^&]*)/);
      var bbParam = bbRetry ? '&bookingBusinessId=' + bbRetry[1] : '';
      
      var retryConfigs = [
        { label: '이용일+전체', params: 'dateFilter=USEDATE' + bbParam },
        { label: '신청일+전체', params: 'dateFilter=REGDATE' + bbParam },
        { label: '필터없음', params: bbParam ? bbParam.substring(1) : '' },
      ];
      // ★ 각 재시도에 전체 상태 코드 추가
      var statusQp = allStatusCodes.map(function(c) { return 'bookingStatusCodes=' + c; }).join('&');
      for (var ri = 0; ri < retryConfigs.length; ri++) {
        var retryQp = retryConfigs[ri].params;
        retryQp += (retryQp ? '&' : '') + statusQp;
        if (!isToday) {
          retryQp += (retryQp ? '&' : '') + 'dateDropdownType=PERIOD&startDateTime=' + naverDateFrom + 'T00:00:00&endDateTime=' + naverDateTo + 'T23:59:59';
        } else {
          retryQp += (retryQp ? '&' : '') + 'dateDropdownType=TODAY';
        }
        var retryUrl = bookingBase + '?' + retryQp;
        log('naver', '  재시도 ' + (ri+1) + ': ' + retryConfigs[ri].label);
        await page.goto(retryUrl, { waitUntil: 'domcontentloaded', timeout: 12000 }).catch(function(){});
        await new Promise(function(r) { setTimeout(r, 3000); });
        checkAbort();
        // 재시도에서도 상태 필터 "전체" 적용
        await naverSelectAllStatus(page);
        
        // 행 로딩 대기
        for (var rw = 0; rw < 8; rw++) {
          var rc = await evalCtx.evaluate(function() { 
            var rows = document.querySelectorAll('table tr');
            var cnt = 0;
            for (var i = 0; i < rows.length; i++) { if (rows[i].querySelectorAll('td').length >= 3) cnt++; }
            return cnt;
          });
          if (rc > 0) break;
          await new Promise(function(r) { setTimeout(r, 1000); });
        }
        
        var retryCheck = await evalCtx.evaluate(function() {
          var body = document.body ? document.body.innerText : '';
          var rows = document.querySelectorAll('table tr');
          var cnt = 0;
          for (var i = 0; i < rows.length; i++) { if (rows[i].querySelectorAll('td').length >= 3) cnt++; }
          return {
            rows: cnt,
            noResults: body.indexOf('조회된 예매내역이 없습니다') >= 0
          };
        });
        log('naver', '    결과: ' + retryCheck.rows + '행' + (retryCheck.noResults ? ' (없음)' : ''));
        
        if (retryCheck.rows > 0 && !retryCheck.noResults) {
          log('naver', '✅ 재시도 성공!');
          break;
        }
      }
    }
    
    // ★★★ 스크롤하여 모든 행 로드 (무한스크롤/지연로딩 대응) ★★★
    log('naver', '스크롤 로딩 시작...' + (isDivTable ? ' (div 기반)' : ''));
    await crawlLive('naver', '④ 스크롤 로딩 중');
    
    var scrollResult = await evalCtx.evaluate(function() {
      // 스크롤 가능한 컨테이너 찾기
      var scrollTarget = null;
      // 1) table 기반
      var tables = document.querySelectorAll('table');
      for (var t = 0; t < tables.length; t++) {
        var p = tables[t].parentElement;
        while (p && p !== document.body) {
          if (p.scrollHeight > p.clientHeight + 10) { scrollTarget = p; break; }
          p = p.parentElement;
        }
        if (scrollTarget) break;
      }
      // 2) div 기반: 스크롤 가능한 리스트 컨테이너 찾기
      if (!scrollTarget) {
        var containers = document.querySelectorAll('[class*="list"], [class*="scroll"], [class*="table"], [class*="booking"], main, [role="main"]');
        for (var ci = 0; ci < containers.length; ci++) {
          var c = containers[ci];
          if (c.scrollHeight > c.clientHeight + 50 && c.clientHeight > 200) { scrollTarget = c; break; }
        }
      }
      // 폴백: body
      if (!scrollTarget) scrollTarget = document.documentElement.scrollHeight > document.documentElement.clientHeight ? document.documentElement : document.body;
      
      // 현재 행 수: table 또는 phone 패턴 기반
      var initRows = document.querySelectorAll('table tbody tr').length;
      if (initRows === 0) {
        var body = document.body ? document.body.innerText : '';
        var phones = body.match(/01[016789][-.\s]?\d{3,4}[-.\s]?\d{4}/g);
        initRows = phones ? phones.length : 0;
      }
      
      return {
        target: scrollTarget === document.documentElement ? 'html' : scrollTarget === document.body ? 'body' : (scrollTarget.tagName + '.' + (scrollTarget.className||'').substring(0,30)),
        scrollH: scrollTarget.scrollHeight,
        clientH: scrollTarget.clientHeight,
        initRows: initRows
      };
    });
    log('naver', '스크롤 대상: ' + scrollResult.target + ' (scrollH=' + scrollResult.scrollH + ', clientH=' + scrollResult.clientH + ', 현재 ' + scrollResult.initRows + '행)');
    
    // 페이지 하단으로 반복 스크롤하여 lazy-loaded 행 로드
    var prevRowCount = scrollResult.initRows;
    var maxScrollAttempts = isDivTable ? 50 : 30; // div 기반은 더 많이 스크롤
    for (var si = 0; si < maxScrollAttempts; si++) {
      // 스크롤 실행
      await evalCtx.evaluate(function() {
        var scrolled = false;
        // table 컨테이너
        var tables = document.querySelectorAll('table');
        for (var t = 0; t < tables.length; t++) {
          var p = tables[t].parentElement;
          while (p && p !== document.body) {
            if (p.scrollHeight > p.clientHeight + 10) { p.scrollTop = p.scrollHeight; scrolled = true; break; }
            p = p.parentElement;
          }
          if (scrolled) break;
        }
        // div 컨테이너
        if (!scrolled) {
          var containers = document.querySelectorAll('[class*="list"], [class*="scroll"], [class*="table"], [class*="booking"], main');
          for (var ci = 0; ci < containers.length; ci++) {
            var c = containers[ci];
            if (c.scrollHeight > c.clientHeight + 50) { c.scrollTop = c.scrollHeight; scrolled = true; break; }
          }
        }
        // 폴백: 페이지 자체
        if (!scrolled) {
          window.scrollTo(0, document.body.scrollHeight);
          document.documentElement.scrollTop = document.documentElement.scrollHeight;
        }
      });
      
      await new Promise(function(r) { setTimeout(r, 800); });
      
      var currentRows = await evalCtx.evaluate(function() {
        // table 기반 행 수
        var rows = document.querySelectorAll('table tr');
        var cnt = 0;
        for (var i = 0; i < rows.length; i++) { if (rows[i].querySelectorAll('td').length >= 3) cnt++; }
        if (cnt > 0) return cnt;
        cnt = document.querySelectorAll('table tbody tr').length;
        if (cnt > 0) return cnt;
        // div 기반: 전화번호 패턴 수
        var body = document.body ? document.body.innerText : '';
        var phones = body.match(/01[016789][-.\s]?\d{3,4}[-.\s]?\d{4}/g);
        return phones ? phones.length : 0;
      });
      
      if (si % 5 === 0 || currentRows !== prevRowCount) {
        log('naver', '  스크롤 #' + (si+1) + ': ' + currentRows + '행' + (currentRows > prevRowCount ? ' (+' + (currentRows - prevRowCount) + ')' : ''));
      }
      
      // 더 이상 새로운 행이 로드되지 않으면 중단
      if (currentRows === prevRowCount && si >= 3) {
        log('naver', '  스크롤 완료: ' + currentRows + '행 (변화 없음)');
        break;
      }
      prevRowCount = currentRows;
    }
    
    // 스크롤을 맨 위로 돌려놓기
    await evalCtx.evaluate(function() {
      var tables = document.querySelectorAll('table');
      for (var t = 0; t < tables.length; t++) {
        var p = tables[t].parentElement;
        while (p && p !== document.body) {
          if (p.scrollHeight > p.clientHeight + 10) { p.scrollTop = 0; return; }
          p = p.parentElement;
        }
      }
      // div 컨테이너도 맨 위로
      var containers = document.querySelectorAll('[class*="list"], [class*="scroll"], [class*="table"], [class*="booking"], main');
      for (var ci = 0; ci < containers.length; ci++) {
        if (containers[ci].scrollHeight > containers[ci].clientHeight + 50) { containers[ci].scrollTop = 0; return; }
      }
      window.scrollTo(0, 0);
    });
    
    await screenshot('naver');

    // ═══ Step 5: 테이블 파싱 (다양한 DOM 구조 + 스크롤 로딩) ═══
    log('naver', '테이블 파싱 시작...');
    await crawlLive('naver', '⑤ 테이블 파싱 중');
    
    var bookings = await evalCtx.evaluate(function() {
      // ★ 다양한 방법으로 테이블 행 찾기
      var rows = document.querySelectorAll('table tbody tr');
      if (rows.length === 0) {
        // tbody 없이 직접 tr을 사용하는 경우
        var allTr = document.querySelectorAll('table tr');
        var dataRows = [];
        for (var t = 0; t < allTr.length; t++) {
          if (allTr[t].querySelectorAll('td').length >= 3) dataRows.push(allTr[t]);
        }
        rows = dataRows;
      }
      
      // ★ 컬럼 인덱스 파악 (헤더 기반)
      var colIdx = { status: -1, buyer: -1, phone: -1, orderNo: -1, useDate: -1, product: -1, priceType: -1 };
      var headerRow = document.querySelector('table thead tr');
      if (!headerRow) {
        var firstTr = document.querySelector('table tr');
        if (firstTr && firstTr.querySelectorAll('th').length > 0) headerRow = firstTr;
      }
      if (headerRow) {
        var ths = headerRow.querySelectorAll('th, td');
        for (var h = 0; h < ths.length; h++) {
          var ht = (ths[h].textContent || '').trim();
          if (ht === '상태' || ht.indexOf('예매상태') >= 0) colIdx.status = h;
          else if (ht.indexOf('예매자') >= 0) colIdx.buyer = h;
          else if (ht.indexOf('전화') >= 0) colIdx.phone = h;
          else if (ht.indexOf('예매번호') >= 0) colIdx.orderNo = h;
          else if (ht.indexOf('이용일') >= 0) colIdx.useDate = h;
          else if (ht === '상품') colIdx.product = h;
          else if (ht.indexOf('가격') >= 0) colIdx.priceType = h;
        }
      }

      var result = [];
      for (var i = 0; i < rows.length; i++) {
        var row = rows[i] instanceof HTMLElement ? rows[i] : rows[i];
        var tds = row.querySelectorAll('td');
        if (tds.length < 3) continue;

        var cells = [];
        for (var ci = 0; ci < tds.length; ci++) cells.push(tds[ci].textContent.trim());

        var status = '', buyer = '', phone = '', orderNo = '', useDate = '', product = '', priceType = '';
        
        // 1) 컬럼 인덱스 기반
        if (colIdx.status >= 0 && tds[colIdx.status]) {
          var badges = tds[colIdx.status].querySelectorAll('span, em, strong, div, p, b, label, button');
          for (var sb = 0; sb < badges.length; sb++) {
            var bt = badges[sb].textContent.trim().replace(/\s+/g,'');
            if (['확정','이용완료','예매취소','노쇼','확정대기','완료','이용중','사용완료'].indexOf(bt) >= 0) { status = bt; if(bt==='완료'||bt==='사용완료'||bt==='이용중')status='이용완료'; break; }
          }
          if (!status) {
            var stFull = tds[colIdx.status].textContent.trim().replace(/\s+/g,'');
            if (stFull.indexOf('완료') >= 0) status = '이용완료';
            else if (stFull.indexOf('취소') >= 0) status = '예매취소';
            else if (stFull.indexOf('노쇼') >= 0) status = '노쇼';
            else if (stFull.indexOf('확정') >= 0 && stFull.indexOf('대기') >= 0) status = '확정대기';
            else if (stFull.indexOf('확정') >= 0) status = '확정';
          }
        }
        if (colIdx.buyer >= 0 && tds[colIdx.buyer]) {
          var bt2 = tds[colIdx.buyer].textContent.trim().split('\n')[0].trim();
          var nm = bt2.match(/([가-힣]{2,5})/); buyer = nm ? nm[1] : bt2;
        }
        if (colIdx.phone >= 0 && tds[colIdx.phone]) {
          var pm = tds[colIdx.phone].textContent.match(/01[016789][-.\s]?\d{3,4}[-.\s]?\d{4}/);
          phone = pm ? pm[0] : '';
        }
        if (colIdx.orderNo >= 0 && tds[colIdx.orderNo]) {
          var om = tds[colIdx.orderNo].textContent.match(/(\d{8,})/);
          orderNo = om ? om[1] : '';
        }
        if (colIdx.useDate >= 0 && tds[colIdx.useDate]) useDate = tds[colIdx.useDate].textContent.trim();
        if (colIdx.product >= 0 && tds[colIdx.product]) product = tds[colIdx.product].textContent.trim();
        if (colIdx.priceType >= 0 && tds[colIdx.priceType]) priceType = tds[colIdx.priceType].textContent.trim();
        
        // 2) 폴백
        if (!status) { for (var si2 = 0; si2 < tds.length; si2++) { var badges3 = tds[si2].querySelectorAll('span, em, strong, div, p, b, label, button'); for (var b3 = 0; b3 < badges3.length; b3++) { var bt3 = badges3[b3].textContent.trim().replace(/\s+/g,''); if (['확정','이용완료','예매취소','노쇼','확정대기','완료','사용완료'].indexOf(bt3) >= 0) { status = bt3; if(bt3==='완료'||bt3==='사용완료')status='이용완료'; break; } } if (status) break; } }
        if (!orderNo) { for (var oi = 0; oi < cells.length; oi++) { var m = cells[oi].match(/(\d{9,})/); if (m) { orderNo = m[1]; break; } } }
        if (!buyer) { for (var bi = 0; bi < cells.length; bi++) { var ct = cells[bi].trim().split('\n')[0].trim(); var nm2 = ct.match(/^([가-힣]{2,5})$/); if (nm2 && ['확정','이용완료','노쇼','예매취소','확정대기','완료'].indexOf(nm2[1]) < 0) { buyer = nm2[1]; break; } } }
        if (!phone) { for (var pi = 0; pi < cells.length; pi++) { var pm2 = cells[pi].match(/01[016789][-.\s]?\d{3,4}[-.\s]?\d{4}/); if (pm2) { phone = pm2[0]; break; } } }
        if (!useDate) { for (var di = 0; di < cells.length; di++) { if (/\d{2,4}\.\s*\d{1,2}\.\s*\d{1,2}/.test(cells[di])) { useDate = cells[di].trim(); break; } } }
        if (!product) { for (var pri = 0; pri < cells.length; pri++) { var ct2 = cells[pri].trim(); if (ct2.length > 3 && /[가-힣]/.test(ct2) && !/^[가-힣]{2,5}$/.test(ct2) && ct2.indexOf('010') < 0 && !/^\d{8,}$/.test(ct2) && !/^\d{2,4}\./.test(ct2) && ['확정','이용완료','예매취소','노쇼','확정대기','완료'].indexOf(ct2) < 0 && ct2.length > product.length) product = ct2.substring(0, 80); } }
        
        if (!orderNo && !phone) continue;

        // 날짜 변환
        var parsedDate = '';
        if (useDate) { var dm = useDate.match(/(\d{2,4})\.\s*(\d{1,2})\.\s*(\d{1,2})/); if (dm) { var yr = dm[1].length <= 2 ? '20' + dm[1] : dm[1]; var mo = dm[2].length < 2 ? '0' + dm[2] : dm[2]; var dy = dm[3].length < 2 ? '0' + dm[3] : dm[3]; parsedDate = yr + '-' + mo + '-' + dy; } }
        var qty = 1;
        // ★ 수량 추출 (주의: "예매 1시간" 에서 1을 잡지 않도록)
        var qmText = product + ' ' + priceType;
        // 1순위: "입장권 N" 또는 "입장권N"
        var qm1 = qmText.match(/입장권\s*(\d+)/);
        if (qm1 && parseInt(qm1[1]) < 100) qty = parseInt(qm1[1]);
        // 2순위: "N매", "N건", "N명", "N인", "N장"
        if (!qm1) { var qm2 = qmText.match(/(\d+)\s*(매|건|명|인|장)/); if (qm2 && parseInt(qm2[1]) < 100) qty = parseInt(qm2[1]); }
        // 3순위: "예매 N" 단, 뒤에 "시간/분/일"이 오지 않는 경우만
        if (!qm1 && qty === 1) { var qm3 = qmText.match(/예매\s*(\d+)(?!\s*(시간|분|일|초))/); if (qm3 && parseInt(qm3[1]) < 100) qty = parseInt(qm3[1]); }
        if (status === '완료' || status === '사용완료' || status === '이용중') status = '이용완료';

        result.push({
          orderNo: orderNo, buyer: buyer, phone: phone.replace(/\./g, '-'),
          product: product || '종일권', priceType: priceType || '',
          useDate: parsedDate || useDate, useDateRaw: useDate,
          status: status || '확정', qty: qty,
          raw: cells.join(' | ').substring(0, 150),
        });
      }
      return { bookings: result, totalRows: rows.length, colIdx: colIdx };
    });
    
    log('naver', '파싱 결과: ' + bookings.bookings.length + '건 (DOM 행: ' + bookings.totalRows + ', 컬럼: ' + JSON.stringify(bookings.colIdx) + ')');
    bookings = bookings.bookings;
    
    // ★ 상태별 통계 로그
    if (bookings.length > 0) {
      var statusCounts = {};
      bookings.forEach(function(b) { statusCounts[b.status] = (statusCounts[b.status] || 0) + 1; });
      log('naver', '상태별: ' + Object.keys(statusCounts).map(function(k) { return k + ':' + statusCounts[k] + '건'; }).join(', '));
      // 이용완료 건 상세
      var doneBookings = bookings.filter(function(b) { return b.status === '이용완료'; });
      if (doneBookings.length > 0) {
        log('naver', '이용완료 ' + doneBookings.length + '건: ' + doneBookings.slice(0, 5).map(function(b) { return b.buyer + '(' + b.orderNo + ')'; }).join(', ') + (doneBookings.length > 5 ? ' ...' : ''));
      }
    }
    
    // ★★★ 폴백: 테이블 파싱 0건이면 페이지 텍스트에서 직접 추출 ★★★
    if (bookings.length === 0) {
      log('naver', '테이블 파싱 0건 → 텍스트 기반 추출 시도');
      
      var textBookings = await evalCtx.evaluate(function() {
        var result = [];
        var body = document.body ? document.body.innerText : '';
        
        // 전화번호 패턴으로 행 분리
        var phonePattern = /01[016789][-.\s]?\d{3,4}[-.\s]?\d{4}/g;
        var orderPattern = /\d{9,}/g;
        var datePattern = /\d{2,4}\.\s*\d{1,2}\.\s*\d{1,2}\.?\s*\([^\)]*\)/g;
        var namePattern = /[가-힣]{2,5}/g;
        
        // 방법1: 전화번호 주변 텍스트에서 추출
        var phones = body.match(phonePattern) || [];
        var orders = body.match(orderPattern) || [];
        var dates = body.match(datePattern) || [];
        
        // 방법2: 줄 단위로 분석
        var lines = body.split('\n').map(function(l) { return l.trim(); }).filter(function(l) { return l.length > 0; });
        
        // 전화번호가 포함된 줄 찾기 (각 줄이 하나의 행)
        for (var li = 0; li < lines.length; li++) {
          var line = lines[li];
          var pm = line.match(/01[016789][-.\s]?\d{3,4}[-.\s]?\d{4}/);
          if (!pm) continue;
          
          var phone = pm[0];
          var om = line.match(/(\d{9,})/);
          var orderNo = om ? om[1] : '';
          
          // ★ 같은 줄에서 먼저 추출, 안되면 주변 줄에서
          var sameLine = line;
          var contextLines = lines.slice(Math.max(0, li - 2), li + 3).join(' ');
          
          // ★ 이름: 같은 줄에서 전화번호 앞에 있는 한글 이름 우선
          var buyer = '';
          var skipWords = ['확정','이용완료','예매취소','노쇼','확정대기','종일권','예매자','전화번호','예매번호','이용일','상품','가격분류','예매관리','예매현황','예매상품','프로그램상품','올바른','개인정보','취급안내','오늘이용','오늘취소','취소일시','내려받기','결제상태','예매상태','상세','인쇄','쿠폰','방문자','대리예약','일간','주간','월간','잠사박물관','플레이팝','한국잠사','예매현황','프로그램','검색하세','입력후','광고주센터'];
          
          // 1순위: 같은 줄의 한글 이름
          var sameLineNames = sameLine.match(/[가-힣]{2,5}/g) || [];
          for (var ni = 0; ni < sameLineNames.length; ni++) {
            var c = sameLineNames[ni];
            if (skipWords.indexOf(c) < 0 && c.indexOf('취소') < 0 && c.indexOf('일시') < 0 && c.indexOf('관리') < 0 && c.indexOf('잠사') < 0 && c.indexOf('플레이') < 0 && c.indexOf('박물관') < 0 && c.indexOf('프로그램') < 0) {
              buyer = c;
              break;
            }
          }
          // 2순위: 전화번호 바로 앞 줄
          if (!buyer && li > 0) {
            var prevLine = lines[li - 1] || '';
            var prevNames = prevLine.match(/[가-힣]{2,5}/g) || [];
            for (var pn = 0; pn < prevNames.length; pn++) {
              var c2 = prevNames[pn];
              if (skipWords.indexOf(c2) < 0 && c2.indexOf('취소') < 0 && c2.indexOf('일시') < 0 && c2.indexOf('관리') < 0) {
                buyer = c2;
                break;
              }
            }
          }
          
          var dm = contextLines.match(/(\d{2,4})\.\s*(\d{1,2})\.\s*(\d{1,2})/);
          var useDate = '';
          if (dm) {
            var yr = dm[1].length <= 2 ? '20' + dm[1] : dm[1];
            var mo = dm[2].length < 2 ? '0' + dm[2] : dm[2];
            var dy = dm[3].length < 2 ? '0' + dm[3] : dm[3];
            useDate = yr + '-' + mo + '-' + dy;
          }
          
          // 상태: 같은 줄에서만 판별
          var status = '확정';
          if (sameLine.indexOf('이용완료') >= 0 || sameLine.indexOf('완료') >= 0) status = '이용완료';
          else if (sameLine.indexOf('예매취소') >= 0) status = '예매취소';
          else if (sameLine.indexOf('노쇼') >= 0) status = '노쇼';
          else if (sameLine.indexOf('확정대기') >= 0) status = '확정대기';
          
          // 상품
          var product = '종일권';
          var prodM = contextLines.match(/종일권[^가-힣]*/);
          if (prodM) product = prodM[0].trim().substring(0, 50);
          
          // 수량
          var qty = 1;
          // ★ "입장권 N" 우선, "예매 N시간" 제외
          var qm1 = contextLines.match(/입장권\s*(\d+)/);
          if (qm1 && parseInt(qm1[1]) < 100) qty = parseInt(qm1[1]);
          if (!qm1) { var qm2 = contextLines.match(/(\d+)\s*(매|건|명|인|장)/); if (qm2 && parseInt(qm2[1]) < 100) qty = parseInt(qm2[1]); }
          if (!qm1 && qty === 1) { var qm3 = contextLines.match(/예매\s*(\d+)(?!\s*(시간|분|일|초))/); if (qm3 && parseInt(qm3[1]) < 100) qty = parseInt(qm3[1]); }
          
          // 중복 체크 (같은 전화번호+주문번호)
          var dup = false;
          for (var ri = 0; ri < result.length; ri++) {
            if (result[ri].phone === phone && result[ri].orderNo === orderNo) { dup = true; break; }
          }
          if (dup) continue;
          
          if (orderNo || buyer) {
            result.push({
              orderNo: orderNo, buyer: buyer, phone: phone.replace(/\./g, '-'),
              product: product, priceType: '',
              useDate: useDate, useDateRaw: '',
              status: status, qty: qty,
              raw: contextLines.substring(0, 150),
            });
          }
        }
        return result;
      }).catch(function(e) { return []; });
      
      if (textBookings.length > 0) {
        log('naver', '✅ 텍스트 기반 추출: ' + textBookings.length + '건');
        bookings = textBookings;
      } else {
        // evalCtx가 iframe이면 main page에서도 시도
        if (page._naverFrame) {
          log('naver', 'iframe 컨텍스트에서 0건 → 메인 페이지에서 재시도');
          textBookings = await page.evaluate(function() {
            // 위와 동일한 텍스트 파싱 로직 (간략 버전)
            var result = [];
            var body = document.body ? document.body.innerText : '';
            var lines = body.split('\n').map(function(l) { return l.trim(); }).filter(function(l) { return l.length > 0; });
            for (var li = 0; li < lines.length; li++) {
              var line = lines[li];
              var pm = line.match(/01[016789][-.\s]?\d{3,4}[-.\s]?\d{4}/);
              if (!pm) continue;
              var phone = pm[0];
              var om = line.match(/(\d{9,})/);
              var orderNo = om ? om[1] : '';
              var contextLines = lines.slice(Math.max(0, li - 3), li + 4).join(' ');
              var buyer = '';
              var names = contextLines.match(/[가-힣]{2,5}/g) || [];
              var skip = ['확정','이용완료','예매취소','노쇼','확정대기','종일권','예매자','전화번호','예매번호','이용일','상품','가격분류','예매관리','예매현황','예매상품','프로그램상품','올바른','개인정보','취급안내','예매취소','내려받기','상세','인쇄','결제상태','쿠폰','오늘이용','오늘취소','취소일시','방문자','대리예약','일간','주간','월간','잠사박물관','플레이팝','한국잠사','검색하세','입력후','광고주센터'];
              // 같은 줄에서 이름 추출 (전화번호가 있는 줄)
              var sameNames = line.match(/[가-힣]{2,5}/g) || [];
              for (var ni = 0; ni < sameNames.length; ni++) { var c = sameNames[ni]; if (skip.indexOf(c) < 0 && c.indexOf('취소') < 0 && c.indexOf('일시') < 0 && c.indexOf('관리') < 0 && c.indexOf('잠사') < 0 && c.indexOf('플레이') < 0 && c.indexOf('프로그램') < 0) { buyer = c; break; } }
              // 폴백: 바로 앞줄
              if (!buyer && li > 0) { var pn = (lines[li-1]||'').match(/[가-힣]{2,5}/g)||[]; for (var pi=0;pi<pn.length;pi++) { var c2=pn[pi]; if (skip.indexOf(c2)<0 && c2.indexOf('취소')<0 && c2.indexOf('일시')<0) { buyer=c2; break; } } }
              var dm = contextLines.match(/(\d{2,4})\.\s*(\d{1,2})\.\s*(\d{1,2})/);
              var useDate = '';
              if (dm) { var yr = dm[1].length <= 2 ? '20' + dm[1] : dm[1]; useDate = yr + '-' + (dm[2].length < 2 ? '0' + dm[2] : dm[2]) + '-' + (dm[3].length < 2 ? '0' + dm[3] : dm[3]); }
              var status = line.indexOf('이용완료') >= 0 ? '이용완료' : line.indexOf('완료') >= 0 ? '이용완료' : line.indexOf('예매취소') >= 0 ? '예매취소' : line.indexOf('노쇼') >= 0 ? '노쇼' : '확정';
              var qty = 1; var qm1 = contextLines.match(/입장권\s*(\d+)/); if (qm1 && parseInt(qm1[1])<100) qty=parseInt(qm1[1]); if(!qm1){var qm2=contextLines.match(/(\d+)\s*(매|건|명|인|장)/);if(qm2&&parseInt(qm2[1])<100) qty=parseInt(qm2[1]);} if(!qm1&&qty===1){var qm3=contextLines.match(/예매\s*(\d+)(?!\s*(시간|분|일))/);if(qm3&&parseInt(qm3[1])<100) qty=parseInt(qm3[1]);}
              var dup = false; for (var ri = 0; ri < result.length; ri++) { if (result[ri].phone === phone && result[ri].orderNo === orderNo) { dup = true; break; } }
              if (!dup && (orderNo || buyer)) result.push({ orderNo: orderNo, buyer: buyer, phone: phone.replace(/\./g, '-'), product: '종일권', priceType: '', useDate: useDate, useDateRaw: '', status: status, qty: qty, raw: contextLines.substring(0, 150) });
            }
            return result;
          }).catch(function() { return []; });
          if (textBookings.length > 0) {
            log('naver', '✅ 메인페이지 텍스트 추출: ' + textBookings.length + '건');
            bookings = textBookings;
          }
        }
        if (bookings.length === 0) log('naver', '❌ 텍스트 기반 추출도 0건');
      }
    }

    log('naver', bookings.length + '건 파싱됨');
    await crawlLive('naver', '⑤ ' + bookings.length + '건 파싱 완료');
    
    // ★ 데이터 없으면 즉시 완료 처리 → 다음 단계로 넘어감
    if (bookings.length === 0) {
      log('naver', '📭 해당 기간 예약 데이터 없음 → 완료', 'info');
      STATE.crawlStatus.naver = 'idle';
      sendState();
      return [];
    }
    
    bookings.forEach(function(b) {
      log('naver', '  [' + b.status + '] ' + b.buyer + ' | ' + b.phone + ' | #' + b.orderNo + ' | ' + b.useDate + ' | ' + b.product + (b.priceType ? ' | ' + b.priceType : '') + ' | qty=' + b.qty);
    });

    // ═══ Step 5.5: 상세 페이지에서 정확한 수량 조회 ═══
    // ★ 최근 3일 이용일 예매만 상세 조회 (전체 400건 중 최근분만)
    var todayStr = new Date().toISOString().split('T')[0];
    var d1 = new Date(); d1.setDate(d1.getDate() - 1); var yestStr = d1.toISOString().split('T')[0];
    var d2 = new Date(); d2.setDate(d2.getDate() - 2); var d2Str = d2.toISOString().split('T')[0];
    var recentDates = [todayStr, yestStr, d2Str];
    var recentBookings = bookings.filter(function(bk) { return recentDates.indexOf(bk.useDate) >= 0; });
    var detailTargets = recentBookings.length > 0 ? recentBookings : bookings.slice(0, 30);
    
    if (detailTargets.length > 0 && detailTargets.length <= 200) {
      log('naver', '상세 수량 조회: ' + detailTargets.length + '건' + (recentBookings.length > 0 ? ' (최근 3일)' : ' (최근)') + ' / 전체 ' + bookings.length + '건');
      await crawlLive('naver', '⑤-2 상세 수량 조회');
      
      for (var di = 0; di < detailTargets.length; di++) {
        var bk = detailTargets[di];
        if (!bk.orderNo) continue;
        
        try {
          // 상세 페이지 URL: bookingBase/bookings/{orderNo}
          var detailBase = bookingBase.replace(/\/booking-list-view\/?$/, '');
          var detailUrl = detailBase + '/booking-list-view/bookings/' + bk.orderNo;
          
          await page.goto(detailUrl, { waitUntil: 'networkidle2', timeout: 8000 }).catch(function(){});
          await new Promise(function(r) { setTimeout(r, 1500); });
          checkAbort();
          
          var detail = await page.evaluate(function() {
            var body = document.body ? document.body.innerText : '';
            var result = { qty: 0, product: '', status: '', options: [], price: 0 };
            
            var lines = body.split('\n').map(function(l) { return l.trim(); });
            for (var i = 0; i < lines.length; i++) {
              // "수량" 라벨 → 다음 줄에서 수량
              if (lines[i] === '수량' || lines[i].indexOf('수량') === 0) {
                // 현재줄 + 다음 2줄에서 수량 찾기
                var qtyLines = lines[i];
                if (i + 1 < lines.length) qtyLines += ' ' + lines[i + 1];
                if (i + 2 < lines.length) qtyLines += ' ' + lines[i + 2];
                // 1순위: "입장권 N"
                var m1 = qtyLines.match(/입장권\s*(\d+)/);
                if (m1) { result.qty = parseInt(m1[1]); continue; }
                // 2순위: "N매", "N건", "N명", "N장"
                var m3 = qtyLines.match(/(\d+)\s*(매|건|명|인|장)/);
                if (m3) { result.qty = parseInt(m3[1]); continue; }
                // 3순위: 줄 끝 숫자 (다음줄에서)
                if (i + 1 < lines.length) {
                  var nextLine = lines[i + 1];
                  var m2 = nextLine.match(/(\d+)\s*$/);
                  if (m2 && parseInt(m2[1]) < 100 && parseInt(m2[1]) > 0) { result.qty = parseInt(m2[1]); continue; }
                }
              }
              
              // ★ "옵션" 라벨 → 다음 줄에서 옵션명+수량 추출
              if (lines[i] === '옵션') {
                // 메타데이터 필드명 (절대로 옵션이 아닌 것들)
                var STOP_WORDS = [
                  '유입경로','결제정보','결제상태','결제금액','직원메모','메모',
                  '취소일시','이용완료일시','확정일시','신청일시','예약일시','변경일시',
                  '예약금','예약상태','예매상태','환불정보','환불금액','환불일시',
                  '예매정보','예매번호','주문번호','결제수단','결제일시',
                  '이용일','방문일','방문일시','연락처','전화번호','이름','예약자',
                  '상품','수량','가격','금액','합계','총액',
                  '쿠폰','포인트','할인','부분환불','전액환불',
                  '네이버','플레이스','스마트플레이스',
                ];
                // 옵션은 여러 줄일 수 있음
                for (var oi = i + 1; oi < Math.min(i + 10, lines.length); oi++) {
                  var optLine = lines[oi];
                  // 빈 줄이면 중단
                  if (!optLine) break;
                  // stop word 체크 (정확 일치 또는 포함)
                  var isStop = false;
                  for (var sw = 0; sw < STOP_WORDS.length; sw++) {
                    if (optLine === STOP_WORDS[sw] || optLine.indexOf(STOP_WORDS[sw]) === 0) { isStop = true; break; }
                  }
                  if (isStop) break;
                  // 메타데이터 패턴 거부: "~일시", "~금액", "~경로", "~정보", "~상태", 날짜/시간, 금액
                  if (/^.*(일시|금액|경로|정보|상태|번호|수단)$/.test(optLine)) break;
                  if (/^\d{4}[-\/]\d{2}/.test(optLine)) break;  // 날짜 패턴
                  if (/^[\d,]+\s*원/.test(optLine)) break;      // 금액 패턴
                  if (/^-$/.test(optLine)) continue;             // 빈 값("-") 스킵
                  
                  // "먹이주기 3종 세트 1" → 옵션명 + 수량
                  var optMatch = optLine.match(/^(.+?)\s+(\d+)\s*$/);
                  if (optMatch) {
                    result.options.push({
                      name: optMatch[1].trim(),
                      qty: parseInt(optMatch[2]),
                    });
                  } else if (optLine.length > 2 && /[가-힣]/.test(optLine) && !/[일시금액경로정보상태]/.test(optLine.slice(-2))) {
                    // 수량 없으면 1개로 간주 (메타데이터 라벨 패턴 제외)
                    result.options.push({ name: optLine.trim(), qty: 1 });
                  }
                }
              }
              
              // 상태 확인
              if (['이용완료','완료','확정','노쇼','예매취소'].indexOf(lines[i]) >= 0) {
                if (!result.status) result.status = (lines[i]==='완료'?'이용완료':lines[i]);
              }
              
              // 결제금액
              if (lines[i] === '결제금액' && i + 1 < lines.length) {
                var pm = lines[i + 1].match(/([\d,]+)\s*원/);
                if (pm) result.price = parseInt(pm[1].replace(/,/g, ''));
              }
            }
            
            // 상품명 업데이트
            var prodMatch = body.match(/상품\s*\n?\s*(종일권[^\n]*|[가-힣]+권[^\n]*)/);
            if (prodMatch) result.product = prodMatch[1].trim().substring(0, 80);
            
            return result;
          });
          
          if (detail.qty > 0 && detail.qty !== bk.qty) {
            log('naver', '  #' + bk.orderNo + ' ' + bk.buyer + ': 수량 ' + bk.qty + ' → ' + detail.qty);
            bk.qty = detail.qty;
          }
          if (detail.product && detail.product.length > (bk.product||'').length) {
            bk.product = detail.product;
          }
          if (detail.status && detail.status !== bk.status) {
            bk.status = detail.status;
          }
          if (detail.price > 0) {
            bk.price = detail.price;
          }
          // ★ 옵션 저장
          if (detail.options && detail.options.length > 0) {
            bk.options = detail.options;
            log('naver', '  #' + bk.orderNo + ' ' + bk.buyer + ': 옵션 ' + detail.options.map(function(o) { return o.name + ' x' + o.qty; }).join(', '));
          }
          
        } catch(de) {
          log('naver', '  #' + bk.orderNo + ' 상세 조회 실패: ' + de.message);
        }
        
        // 진행률 표시 (10건마다)
        if ((di + 1) % 10 === 0 || di === detailTargets.length - 1) {
          await crawlLive('naver', '⑤-2 상세 수량 ' + (di + 1) + '/' + detailTargets.length);
        }
      }
      
      // 원래 목록 페이지로 복귀
      log('naver', '상세 수량 조회 완료');
    }

    // ═══ Step 6: 티켓 등록 ═══
    // ★ 날짜 범위 필터: 크롤링 기간 외 티켓 제외
    var nFilterFrom = STATE.config.crawlDateFrom || '';
    var nFilterTo = STATE.config.crawlDateTo || '';
    if (nFilterFrom || nFilterTo) {
      var nBeforeCount = bookings.length;
      bookings = bookings.filter(function(b) {
        var bDate = (b.useDate || b.useDateRaw || '').substring(0, 10);
        if (!bDate) return true;
        if (nFilterFrom && bDate < nFilterFrom) return false;
        if (nFilterTo && bDate > nFilterTo) return false;
        return true;
      });
      if (nBeforeCount !== bookings.length) {
        log('naver', '📅 날짜 필터: ' + nBeforeCount + '건 → ' + bookings.length + '건 (' + nFilterFrom + '~' + nFilterTo + ')');
      }
    }
    
    var newTickets = [];
    bookings.forEach(function(b) {
      // ★ 중복 체크 강화: 소스+주문번호 또는 같은 구매자+날짜
      var existing = STATE.tickets.find(function(t) {
        // 1) 같은 소스 + 주문번호
        if (t.source === 'naver' && t.orderNo === b.orderNo) return true;
        // 2) 다른 소스라도 같은 구매자+전화번호+날짜면 크로스체크
        var cleanPhone1 = (t.phone || '').replace(/[-\s]/g, '');
        var cleanPhone2 = (b.phone || '').replace(/[-\s]/g, '');
        if (t.buyer === b.buyer && cleanPhone1 && cleanPhone2 && cleanPhone1 === cleanPhone2 && 
            t.bookDate && b.useDate && t.bookDate.substring(0,10) === b.useDate.substring(0,10)) return true;
        return false;
      });
      if (existing) {
        var changed = false;
        // ★ 네이버 원본 상태 저장
        if (b.status) { existing.naverStatus = b.status; changed = true; }
        // ★ 이용완료/완료 → 사용완료 (어떤 기존 상태든 무조건 업데이트)
        if (['이용완료','완료','사용완료','사용'].indexOf(b.status) >= 0 && existing.status !== '사용완료') { 
          log('naver', '🔄 ' + existing.buyer + ' 상태 변경: ' + existing.status + ' → 사용완료 (네이버: ' + b.status + ')');
          existing.status = '사용완료'; existing.usedAt = existing.usedAt || new Date().toISOString(); changed = true; 
        }
        // ★ 예매취소 처리
        if ((b.status === '예매취소' || b.status === '취소') && existing.status !== '예매취소') { 
          log('naver', '🔄 ' + existing.buyer + ' 상태 변경: ' + existing.status + ' → 예매취소');
          existing.status = '예매취소'; changed = true; 
        }
        // ★ 노쇼 처리
        if (b.status === '노쇼' && existing.status !== '노쇼') { 
          existing.status = '노쇼'; changed = true; 
        }
        if (b.product && b.product !== existing.product) { existing.product = b.product; changed = true; }
        if (b.phone && !existing.phone) { existing.phone = b.phone; changed = true; }
        if (b.qty && b.qty > (existing.qty||1)) { existing.qty = b.qty; existing.personCount = b.qty; changed = true; }
        if (b.price && !existing.price) { existing.price = b.price; changed = true; }
        // 크로스매치 표시
        if (existing.source !== 'naver' && !existing.crossMatch) { existing.crossMatch = 'naver'; changed = true; }
        if (changed) { broadcast({ type: 'ticketUpdate', data: existing }); sbSync.saveTicket(existing).catch(function(){}); }
        
        // ★ 기존 본권에 옵션 별도 티켓 등록
        if (b.options && b.options.length > 0 && existing.source === 'naver') {
          existing.hasOptions = true;
          existing.optionInfo = b.options.map(function(o) { return o.name + ' x' + o.qty; }).join(', ');
          b.options.forEach(function(opt, oi) {
            if (!isValidOptionName(opt.name)) { log('naver', '  ⛔ 잘못된 옵션명 차단: ' + opt.name); return; }
            var optId = 'NVO' + b.orderNo + '-' + (oi + 1);
            var existOpt = STATE.tickets.find(function(t) { return t.id === optId || (t.parentOrderNo === b.orderNo && t.product === opt.name); });
            if (existOpt) {
              // 부모가 이용완료면 옵션도 사용완료로
              if (existing.status === '사용완료' && existOpt.status !== '사용완료') { existOpt.status = '사용완료'; broadcast({ type: 'ticketUpdate', data: existOpt }); }
              return;
            }
            var optTk = {
              id: optId, orderNo: b.orderNo, couponNo: optId, couponNos: [optId],
              source: 'naver', product: opt.name, buyer: b.buyer, phone: (b.phone || '').replace(/\./g, '-'),
              price: 0, qty: opt.qty || 1, status: existing.status === '사용완료' ? '사용완료' : '사용가능',
              qrIssued: true, detectedAt: new Date().toISOString(),
              items: [{ n: opt.name, p: 0 }], personCount: opt.qty || 1,
              useDate: b.useDate, bookDate: b.useDate || '', validDate: b.useDate || '',
              validRange: b.useDate ? b.useDate + ' ~ ' + b.useDate : '',
              sentDate: b.useDate || '', priceType: '옵션',
              isOption: true, parentOrderNo: b.orderNo, parentTicketId: existing.id,
              smsSent: false, smsTime: '', adminOk: null, adminVerified: null,
            };
            STATE.tickets.unshift(optTk);
            newTickets.push(optTk);
            log('naver', '  🎫 옵션 티켓: ' + opt.name + ' x' + opt.qty + ' (' + optId + ')', 'success');
            broadcast({ type: 'newTicket', data: optTk });
          });
        }
        return;
      }
      // ★ 모든 상태의 티켓 등록 (서버 재시작 시 이력 보존)
      // 이용완료 → 사용완료, 예매취소 → 예매취소, 확정 → 사용가능
      var tkStatus = '사용가능';
      if (b.status === '이용완료' || b.status === '사용완료' || b.status === '완료' || b.status === '사용') tkStatus = '사용완료';
      else if (b.status === '예매취소' || b.status === '취소') tkStatus = '예매취소';
      else if (b.status === '노쇼') tkStatus = '노쇼';

      var tk = {
        id: 'NV' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        orderNo: b.orderNo, couponNo: 'NV' + b.orderNo, 
        couponNos: ['NV' + b.orderNo],
        source: 'naver',
        product: b.product, buyer: b.buyer, phone: (b.phone || '').replace(/\./g, '-'),
        price: b.price || 0, qty: b.qty || 1, status: tkStatus,
        qrIssued: true, detectedAt: new Date().toISOString(),
        items: [{ n: b.product, p: b.price || 0 }], personCount: b.qty || 1,
        useDate: b.useDate,
        bookDate: b.useDate || '',
        validDate: b.useDate || '',
        validRange: b.useDate ? b.useDate + ' ~ ' + b.useDate : '',
        sentDate: b.useDate || '',
        priceType: b.priceType || '',
        useDateRaw: b.useDateRaw || b.useDate || '',
        naverStatus: b.status || '확정',
        smsSent: false, smsTime: '',
        adminOk: null, adminVerified: null,
        hasOptions: !!(b.options && b.options.length > 0),
      };
      // ★ 크로스체크: la2fdoci에 같은 구매자+전화번호 있는지
      var laMatch = STATE.tickets.find(function(t) {
        return t.source === 'la2fdoci' && t.buyer === b.buyer && t.phone === b.phone && b.phone;
      });
      if (laMatch) {
        tk.crossMatch = 'la2fdoci';
        if (!laMatch.crossMatch) { laMatch.crossMatch = 'naver'; broadcast({ type: 'ticketUpdate', data: laMatch }); }
        log('naver', '🔗 크로스매치: ' + b.buyer + ' ← LA #' + laMatch.orderNo);
      }
      STATE.tickets.unshift(tk);
      newTickets.push(tk);
      sbSync.saveTicket(tk).catch(function(){});
      log('naver', '🆕 ' + tk.buyer + ' | ☎' + tk.phone + ' | #' + tk.orderNo + ' | ' + tk.qty + '매 | ' + b.useDate + ' | ' + tk.product + ' | 상태:' + tkStatus + (tkStatus === '사용완료' ? ' ✅' : '') + (b.priceType ? ' | ' + b.priceType : ''), 'success');
      broadcast({ type: 'newTicket', data: tk });
      
      // ★ 옵션 품목 별도 티켓 등록 (QR 발급)
      if (b.options && b.options.length > 0) {
        tk.hasOptions = true;
        tk.optionInfo = b.options.map(function(o) { return o.name + ' x' + o.qty; }).join(', ');
        b.options.forEach(function(opt, oi) {
          if (!isValidOptionName(opt.name)) { log('naver', '  ⛔ 잘못된 옵션명 차단: ' + opt.name); return; }
          var optId = 'NVO' + b.orderNo + '-' + (oi + 1);
          var optTk = {
            id: optId, orderNo: b.orderNo, couponNo: optId, couponNos: [optId],
            source: 'naver', product: opt.name, buyer: b.buyer, phone: (b.phone || '').replace(/\./g, '-'),
            price: 0, qty: opt.qty || 1, status: tkStatus === '사용완료' ? '사용완료' : '사용가능',
            qrIssued: true, detectedAt: new Date().toISOString(),
            items: [{ n: opt.name, p: 0 }], personCount: opt.qty || 1,
            useDate: b.useDate, bookDate: b.useDate || '', validDate: b.useDate || '',
            validRange: b.useDate ? b.useDate + ' ~ ' + b.useDate : '',
            sentDate: b.useDate || '', priceType: '옵션',
            isOption: true, parentOrderNo: b.orderNo, parentTicketId: tk.id,
            smsSent: false, smsTime: '', adminOk: null, adminVerified: null,
          };
          STATE.tickets.unshift(optTk);
          newTickets.push(optTk);
          log('naver', '  🎫 옵션 티켓: ' + opt.name + ' x' + opt.qty + ' (' + optId + ')', 'success');
          broadcast({ type: 'newTicket', data: optTk });
        });
      }
    });
    if (newTickets.length === 0) log('naver', '신규 없음 (기존 ' + bookings.length + '건)');
    STATE.crawlStatus.naver = 'connected';
    // 크롤 성공 시 쿠키 갱신 (세션 유지)
    if (page) naverSaveCookies(page).catch(function(){});
    return newTickets;
  } catch(e) {
    log('naver', '크롤링 오류: ' + e.message, 'error');
    STATE.crawlStatus.naver = 'error';
    STATE.sessions.naver = false;
    try { await aiDiagnose('naver', e.message); } catch(ae) {}
    return [];
  }
}

// ═══ 네이버 복구 (이용완료 → 확정) ═══
async function naverRestoreAvailable(tk) {
  try {
    if (!STATE.sessions.naver) { if (!(await naverLogin())) return false; }
    var page = STATE.pages.naver;
    
    try { await page.title(); page.url(); } catch(hErr) {
      try {
        var pages = await STATE.browsers.naver.pages();
        if (pages && pages.length > 0) { page = pages[pages.length - 1]; STATE.pages.naver = page; }
        else { STATE.sessions.naver = false; if (!(await naverLogin())) return false; page = STATE.pages.naver; }
      } catch(bErr) { STATE.sessions.naver = false; if (!(await naverLogin())) return false; page = STATE.pages.naver; }
    }
    
    log('naver', '↩ 복구: ' + tk.buyer + ' #' + (tk.orderNo||'') + ' → 확정');
    
    // 1) 예약목록 이동
    var cfg = STATE.config.naver;
    // ★ 크롤링에서 저장된 bookingBase 우선 사용
    var bookingBase = STATE.naverBookingBase || naverPartnerUrl('booking-list-view');
    if (!bookingBase) {
      var curUrl = page.url();
      var bizMatch = curUrl.match(/\/bizes\/(\d+)/);
      if (bizMatch && curUrl.indexOf('partner.booking') >= 0) {
        bookingBase = 'https://partner.booking.naver.com/bizes/' + bizMatch[1] + '/booking-list-view';
      } else {
        bookingBase = 'https://partner.booking.naver.com/bizes/784618/booking-list-view';
      }
    }
    
    var useDate = tk.usedAt ? tk.usedAt.split('T')[0] : (tk.useDate || tk.bookDate || new Date().toISOString().split('T')[0]);
    var bizIdParam = cfg.bizId ? '&bookingBusinessId=' + cfg.bizId : '';
    // RC08 = 이용완료 상태 필터
    var targetUrl = bookingBase + '?bookingStatusCodes=RC08&dateFilter=USEDATE&dateDropdownType=PERIOD'
      + '&startDateTime=' + useDate + 'T00:00:00'
      + '&endDateTime=' + useDate + 'T23:59:59'
      + bizIdParam;
    
    log('naver', '② 이용완료 목록 이동: ' + targetUrl.substring(0, 120));
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 12000 }).catch(function(){});
    await new Promise(function(r) { setTimeout(r, 2500); });
    // await dismissNaverPopups(page); // 비활성화
    
    // 2) 해당 예약 행 찾기 + 클릭
    var found = await page.evaluate(function(orderNo, buyer, phone) {
      var rows = document.querySelectorAll('table tbody tr');
      for (var i = 0; i < rows.length; i++) {
        var text = rows[i].textContent || '';
        var match = false;
        if (orderNo && text.indexOf(orderNo) >= 0) match = true;
        if (!match && buyer && phone) {
          var cp = phone.replace(/[-\s]/g, '');
          if (text.indexOf(buyer) >= 0 && text.replace(/[-\s]/g, '').indexOf(cp) >= 0) match = true;
        }
        if (!match && buyer && buyer.length >= 2 && text.indexOf(buyer) >= 0) match = true;
        if (!match) continue;
        
        // 이름 셀 클릭 (상세 패널 열기)
        var tds = rows[i].querySelectorAll('td');
        for (var k = 0; k < tds.length; k++) {
          var ct = tds[k].textContent.trim();
          if (/^[가-힣]{2,5}$/.test(ct) && ['확정','이용완료','노쇼','취소'].indexOf(ct) < 0) {
            tds[k].click(); return { found: true, row: i, clicked: 'name' };
          }
        }
        rows[i].click();
        return { found: true, row: i, clicked: 'row' };
      }
      return { found: false, total: rows.length };
    }, tk.orderNo, tk.buyer, tk.phone);
    
    if (!found.found) {
      log('naver', '❌ 이용완료 목록에서 미발견 (총 ' + (found.total||0) + '행)', 'warning');
      return false;
    }
    
    log('naver', '③ 상세 패널 열기 (행' + found.row + ')');
    await new Promise(function(r) { setTimeout(r, 2000); });
    
    // 3) 상세 패널에서 "확정" 버튼 또는 상태변경 버튼 찾기
    var restored = await page.evaluate(function() {
      var btns = document.querySelectorAll('button, a, [role="button"]');
      // 1차: "확정" 또는 "확정으로 변경" 버튼
      for (var i = 0; i < btns.length; i++) {
        var t = (btns[i].textContent || '').trim();
        if ((t === '확정' || t === '확정으로 변경' || t === '예약확정') && btns[i].offsetParent !== null) {
          btns[i].click();
          return { clicked: true, text: t, method: 'direct-btn' };
        }
      }
      // 2차: 상태변경 select/dropdown
      var selects = document.querySelectorAll('select');
      for (var s = 0; s < selects.length; s++) {
        var opts = selects[s].querySelectorAll('option');
        for (var o = 0; o < opts.length; o++) {
          var ot = opts[o].textContent.trim();
          if (ot === '확정' || ot === 'RC01') {
            selects[s].value = opts[o].value;
            selects[s].dispatchEvent(new Event('change', {bubbles: true}));
            return { clicked: true, text: ot, method: 'select' };
          }
        }
      }
      // 3차: "상태변경" 메뉴에서 "확정" 찾기
      for (var j = 0; j < btns.length; j++) {
        var t2 = (btns[j].textContent || '').trim();
        if (t2.indexOf('상태변경') >= 0 && btns[j].offsetParent !== null) {
          btns[j].click();
          return { clicked: true, text: t2, method: 'status-menu', needSecondClick: true };
        }
      }
      return { clicked: false };
    });
    
    if (!restored.clicked) {
      log('naver', '⚠️ 확정 버튼 미발견', 'warning');
      await screenshot('naver');
      return false;
    }
    
    log('naver', '④ 복구 1차 클릭: ' + restored.text + ' (' + restored.method + ')');
    await new Promise(function(r) { setTimeout(r, 1500); });
    
    // 4) 상태변경 메뉴를 열었다면 "확정" 하위 항목 클릭
    if (restored.needSecondClick) {
      await page.evaluate(function() {
        var btns = document.querySelectorAll('button, a, [role="button"], [role="menuitem"], li');
        for (var i = 0; i < btns.length; i++) {
          var t = (btns[i].textContent || '').trim();
          if (t === '확정' && btns[i].offsetParent !== null) {
            btns[i].click(); return;
          }
        }
      });
      await new Promise(function(r) { setTimeout(r, 1500); });
    }
    
    // 5) 확인 모달 처리
    var confirm1 = await page.evaluate(function() {
      var btns = document.querySelectorAll('button, [role="button"]');
      for (var i = btns.length - 1; i >= 0; i--) {
        var t = (btns[i].textContent || '').trim();
        if ((t === '확인' || t === '확정' || t === '네' || t === '예' || t === '완료') && btns[i].offsetParent !== null) {
          btns[i].click();
          return { clicked: true, text: t };
        }
      }
      return { clicked: false };
    });
    
    if (confirm1.clicked) {
      log('naver', '⑤ 확인 클릭: ' + confirm1.text);
      await new Promise(function(r) { setTimeout(r, 1500); });
    }
    
    // 패널 닫기
    await page.evaluate(function() {
      var close = document.querySelector('[class*="close"], button[aria-label="닫기"]');
      if (close) close.click();
    }).catch(function(){});
    
    log('naver', '✅ 복구 완료 (→ 확정)', 'success');
    return true;
  } catch(e) {
    log('naver', '복구 오류: ' + e.message, 'error');
    return false;
  }
}

async function naverMarkUsed(tk) {
  try {
    // ★ 세션 확인 강화: 실패 시 자동 재로그인
    if (!STATE.sessions.naver) {
      log('naver', '세션 없음 → 재로그인 후 이용완료 처리');
      if (!(await naverLogin())) { log('naver', '❌ 재로그인 실패', 'error'); return false; }
    }
    var page = STATE.pages.naver;
    
    // ★ 프레임 분리(detached) 방지
    try { await page.title(); page.url(); } catch(hErr) {
      log('naver', '프레임 분리 감지 → 페이지 재획득');
      try {
        var pages = await STATE.browsers.naver.pages();
        if (pages && pages.length > 0) { page = pages[pages.length - 1]; STATE.pages.naver = page; }
        else { STATE.sessions.naver = false; if (!(await naverLogin())) return false; page = STATE.pages.naver; }
      } catch(bErr) { STATE.sessions.naver = false; if (!(await naverLogin())) return false; page = STATE.pages.naver; }
    }
    
    log('naver', '① 이용완료: ' + tk.buyer + ' #' + (tk.orderNo||''));
    
    if (!tk.orderNo) {
      log('naver', '❌ 주문번호 없음 → 사용처리 불가', 'warning');
      return false;
    }
    
    // ═══ bookingBase 결정 ═══
    var cfg = STATE.config.naver;
    var bookingBase = STATE.naverBookingBase || naverPartnerUrl('booking-list-view');
    if (!bookingBase) {
      var curUrl = page.url();
      var bizMatch = curUrl.match(/\/bizes\/(\d+)/);
      if (bizMatch && curUrl.indexOf('partner.booking') >= 0) {
        bookingBase = 'https://partner.booking.naver.com/bizes/' + bizMatch[1] + '/booking-list-view';
      } else {
        bookingBase = 'https://partner.booking.naver.com/bizes/784618/booking-list-view';
      }
    }
    
    // ═══ Step 1: 상세 페이지 직접 이동 (이름 클릭과 동일) ═══
    var detailUrl = bookingBase + '/bookings/' + tk.orderNo;
    log('naver', '② 상세페이지: ' + detailUrl.substring(0, 120));
    await page.goto(detailUrl, { waitUntil: 'networkidle2', timeout: 15000 }).catch(function(){});
    await new Promise(function(r) { setTimeout(r, 3000); });
    
    // 상세 패널이 열렸는지 확인
    var detailCheck = await page.evaluate(function(orderNo) {
      var body = document.body ? document.body.innerText : '';
      return {
        hasDetail: body.indexOf('예매 상세정보') >= 0 || body.indexOf('예매자') >= 0,
        hasOrderNo: body.indexOf(orderNo) >= 0,
        hasCompleteBtn: false,
        alreadyDone: body.indexOf('이용완료') >= 0 && body.indexOf('예매취소') >= 0, // 상태가 이용완료
        url: location.href,
      };
    }, tk.orderNo);
    
    log('naver', '  상세패널: ' + (detailCheck.hasDetail ? '✓' : '✗') + ' 주문번호: ' + (detailCheck.hasOrderNo ? '✓' : '✗'));
    
    if (!detailCheck.hasDetail && !detailCheck.hasOrderNo) {
      log('naver', '❌ 상세 페이지 로드 실패', 'warning');
      
      // 폴백: 목록에서 이름 클릭 시도
      var useDate = tk.useDate || tk.bookDate || new Date().toISOString().split('T')[0];
      var bizIdParam = cfg.bizId ? '&bookingBusinessId=' + cfg.bizId : '';
      var listUrl = bookingBase + '?dateFilter=USEDATE&dateDropdownType=PERIOD'
        + '&startDateTime=' + useDate + 'T00:00:00'
        + '&endDateTime=' + useDate + 'T23:59:59'
        + bizIdParam;
      
      log('naver', '  폴백: 목록 이동 → ' + listUrl.substring(0, 100));
      await page.goto(listUrl, { waitUntil: 'networkidle2', timeout: 15000 }).catch(function(){});
      await new Promise(function(r) { setTimeout(r, 4000); });
      
      // 행 대기
      for (var mwi = 0; mwi < 10; mwi++) {
        var mrc = await page.evaluate(function() {
          var allTr = document.querySelectorAll('table tr');
          var cnt = 0;
          for (var i = 0; i < allTr.length; i++) { if (allTr[i].querySelectorAll('td').length >= 3) cnt++; }
          return cnt;
        });
        if (mrc > 0) { log('naver', '  행 ' + mrc + '개 감지'); break; }
        await new Promise(function(r) { setTimeout(r, 1000); });
      }
      
      // 이름 클릭
      var clicked = await page.evaluate(function(orderNo, buyer) {
        var clickable = document.querySelectorAll('a, span, div, td');
        for (var i = 0; i < clickable.length; i++) {
          var el = clickable[i];
          if (!el.offsetParent) continue;
          var et = (el.textContent || '').trim();
          if (et === buyer && el.tagName !== 'TH') { el.click(); return { ok: true, method: 'buyer' }; }
        }
        // 주문번호로
        for (var j = 0; j < clickable.length; j++) {
          var el2 = clickable[j];
          if (!el2.offsetParent) continue;
          var et2 = (el2.textContent || '').trim();
          if (et2.indexOf(orderNo) >= 0 && et2.length < 200) { el2.click(); return { ok: true, method: 'orderNo' }; }
        }
        return { ok: false };
      }, tk.orderNo, tk.buyer);
      
      if (!clicked.ok) {
        log('naver', '❌ 목록에서도 미발견', 'warning');
        return false;
      }
      log('naver', '  이름 클릭 성공 (' + clicked.method + ')');
      await new Promise(function(r) { setTimeout(r, 2000); });
    }
    
    // ═══ Step 2: "이용완료" 버튼 클릭 (상세 패널 하단) ═══
    log('naver', '③ 이용완료 버튼 클릭');
    
    var btn1 = await page.evaluate(function() {
      var btns = document.querySelectorAll('button, a, [role="button"]');
      var candidates = [];
      for (var i = 0; i < btns.length; i++) {
        var t = (btns[i].textContent || '').trim();
        var rect = btns[i].getBoundingClientRect();
        if (!btns[i].offsetParent || rect.width === 0) continue;
        
        if (t === '이용완료') {
          candidates.push({
            el: btns[i], text: t,
            x: rect.x, y: rect.y, w: rect.width, h: rect.height,
            // 패널 하단의 "이용완료" = x > 800 (우측 패널)
            isPanel: rect.x > 700,
          });
        }
      }
      
      // 우측 패널의 "이용완료" 버튼 우선
      var panelBtns = candidates.filter(function(c) { return c.isPanel; });
      var target = panelBtns.length > 0 ? panelBtns[panelBtns.length - 1] : (candidates.length > 0 ? candidates[candidates.length - 1] : null);
      
      if (target) {
        target.el.click();
        return { clicked: true, text: target.text, x: Math.round(target.x), y: Math.round(target.y), w: Math.round(target.w) };
      }
      return { clicked: false, total: candidates.length };
    });
    
    if (!btn1.clicked) {
      // 이미 이용완료 상태인지 확인
      var alreadyDone = await page.evaluate(function() {
        var body = document.body ? document.body.innerText : '';
        // 상태 배지가 "이용완료"인지 확인
        var badges = document.querySelectorAll('span, em, strong, div');
        for (var i = 0; i < badges.length; i++) {
          var t = badges[i].textContent.trim();
          var rect = badges[i].getBoundingClientRect();
          if (t === '이용완료' && rect.x > 700 && rect.y < 200) return true; // 상세패널 상단 상태
        }
        return false;
      });
      
      if (alreadyDone) {
        log('naver', '✅ 이미 이용완료 상태', 'success');
        return true;
      }
      
      log('naver', '⚠️ 이용완료 버튼 미발견', 'warning');
      return false;
    }
    
    log('naver', '  1차 클릭 완료 (x=' + btn1.x + ', y=' + btn1.y + ', w=' + btn1.w + ')');
    await new Promise(function(r) { setTimeout(r, 2500); });
    
    // ═══ Step 3: 확인 페이지에서 녹색 "이용완료" 버튼 클릭 ═══
    // URL이 /complete 로 바뀌는지 확인
    var curUrl2 = page.url();
    log('naver', '④ 확인페이지: ' + curUrl2.substring(0, 120));
    
    var btn2 = await page.evaluate(function() {
      var body = document.body ? document.body.innerText : '';
      var isCompletePage = body.indexOf('이용완료 시 사용자에게') >= 0 || 
                           body.indexOf('이용완료 알림이') >= 0 ||
                           location.href.indexOf('/complete') >= 0;
      
      if (!isCompletePage) {
        // 모달형 확인 대화상자일 수 있음
        var btns = document.querySelectorAll('button, [role="button"]');
        for (var i = btns.length - 1; i >= 0; i--) {
          var t = (btns[i].textContent || '').trim();
          if ((t === '확인' || t === '이용완료' || t === '네' || t === '완료') && btns[i].offsetParent !== null) {
            var rect = btns[i].getBoundingClientRect();
            if (rect.width > 50) {
              btns[i].click();
              return { clicked: true, text: t, type: 'modal' };
            }
          }
        }
      }
      
      // 확인 페이지의 녹색 "이용완료" 버튼 (하단의 큰 버튼)
      var btns2 = document.querySelectorAll('button, a, [role="button"]');
      var candidates = [];
      for (var j = 0; j < btns2.length; j++) {
        var t2 = (btns2[j].textContent || '').trim();
        if (!btns2[j].offsetParent) continue;
        var rect2 = btns2[j].getBoundingClientRect();
        
        if (t2 === '이용완료' && rect2.width > 100) {
          candidates.push({
            el: btns2[j], text: t2,
            x: Math.round(rect2.x), y: Math.round(rect2.y),
            w: Math.round(rect2.width), h: Math.round(rect2.height),
          });
        }
      }
      
      // 가장 아래쪽(y가 큰), 넓은 버튼 = 녹색 확인 버튼
      if (candidates.length > 0) {
        candidates.sort(function(a, b) { return b.y - a.y || b.w - a.w; });
        candidates[0].el.click();
        return { clicked: true, text: candidates[0].text, type: 'complete-page', x: candidates[0].x, y: candidates[0].y, w: candidates[0].w };
      }
      
      return { clicked: false, isCompletePage: isCompletePage };
    });
    
    if (btn2.clicked) {
      log('naver', '  확인 클릭: ' + btn2.text + ' (' + btn2.type + ')');
      await new Promise(function(r) { setTimeout(r, 2000); });
    } else {
      log('naver', '⚠️ 확인 버튼 미발견 (complete=' + btn2.isCompletePage + ')', 'warning');
      // 한번 더 시도: /complete URL로 직접 이동
      if (!btn2.isCompletePage) {
        var completeUrl = bookingBase + '/bookings/' + tk.orderNo + '/complete';
        log('naver', '  /complete URL 직접 이동: ' + completeUrl.substring(0, 100));
        await page.goto(completeUrl, { waitUntil: 'networkidle2', timeout: 10000 }).catch(function(){});
        await new Promise(function(r) { setTimeout(r, 2000); });
        
        // 녹색 버튼 클릭
        var btn3 = await page.evaluate(function() {
          var btns = document.querySelectorAll('button, a, [role="button"]');
          for (var i = 0; i < btns.length; i++) {
            var t = (btns[i].textContent || '').trim();
            var rect = btns[i].getBoundingClientRect();
            if (t === '이용완료' && rect.width > 100 && btns[i].offsetParent) {
              btns[i].click();
              return { clicked: true };
            }
          }
          return { clicked: false };
        });
        
        if (btn3.clicked) {
          log('naver', '  /complete 직접 이동 → 이용완료 클릭 성공');
          await new Promise(function(r) { setTimeout(r, 2000); });
        } else {
          log('naver', '❌ /complete 페이지에서도 버튼 미발견', 'warning');
          return false;
        }
      }
    }
    
    // ═══ Step 4: 완료 확인 ═══
    var finalUrl = page.url();
    var finalCheck = await page.evaluate(function() {
      var body = document.body ? document.body.innerText : '';
      return {
        done: body.indexOf('이용완료') >= 0,
        url: location.href,
      };
    });
    
    // 패널 닫기 (X 버튼)
    await page.evaluate(function() {
      var btns = document.querySelectorAll('button, [role="button"]');
      for (var i = 0; i < btns.length; i++) {
        var t = (btns[i].textContent || '').trim();
        if ((t === '×' || t === '✕' || t === 'X') && btns[i].offsetParent) {
          btns[i].click(); return;
        }
        if (btns[i].getAttribute('aria-label') === '닫기' && btns[i].offsetParent) {
          btns[i].click(); return;
        }
      }
    }).catch(function(){});
    
    log('naver', '✅ ' + tk.buyer + ' 이용완료 처리 완료!', 'success');
    return true;
  } catch(e) {
    log('naver', '이용완료 오류: ' + e.message, 'error');
    STATE.sessions.naver = false;
    return false;
  }
}


// ═══ OKPOS 크롤러 ═══
// ═══ 네이버 예매 취소 ═══
async function naverCancelBooking(tk, reason) {
  try {
    if (!STATE.sessions.naver) { if (!(await naverLogin())) return false; }
    var page = STATE.pages.naver;
    
    // 프레임 분리 방지
    try { await page.title(); } catch(hErr) {
      try {
        var pages = await STATE.browsers.naver.pages();
        if (pages && pages.length > 0) { page = pages[pages.length - 1]; STATE.pages.naver = page; }
        else { STATE.sessions.naver = false; if (!(await naverLogin())) return false; page = STATE.pages.naver; }
      } catch(bErr) { STATE.sessions.naver = false; if (!(await naverLogin())) return false; page = STATE.pages.naver; }
    }
    
    if (!tk.orderNo) {
      log('naver', '❌ 주문번호 없음 → 취소 불가', 'warning');
      return { ok: false, msg: '주문번호 없음' };
    }
    
    var cancelReason = reason || '관리자 취소';
    log('naver', '🚫 예매취소 시작: ' + tk.buyer + ' #' + tk.orderNo + ' (사유: ' + cancelReason + ')');
    
    // ═══ bookingBase 결정 ═══
    var bookingBase = STATE.naverBookingBase || naverPartnerUrl('booking-list-view');
    if (!bookingBase) {
      bookingBase = 'https://partner.booking.naver.com/bizes/784618/booking-list-view';
    }
    
    // ═══ Step 1: 취소 페이지 직접 이동 ═══
    // URL: .../bookings/{주문번호}/cancel
    var cancelUrl = bookingBase + '/bookings/' + tk.orderNo + '/cancel';
    log('naver', '① 취소페이지: ' + cancelUrl.substring(0, 120));
    await page.goto(cancelUrl, { waitUntil: 'networkidle2', timeout: 15000 }).catch(function(){});
    await new Promise(function(r) { setTimeout(r, 3000); });
    
    // 취소 페이지 확인
    var cancelCheck = await page.evaluate(function() {
      var body = document.body ? document.body.innerText : '';
      return {
        isCancelPage: body.indexOf('예매 취소') >= 0 || body.indexOf('환불기준') >= 0,
        hasFullRefund: body.indexOf('전액환불') >= 0,
        hasAgreedRefund: body.indexOf('동의된 환불기준') >= 0,
        hasCancelBtn: false,
        hasReasonField: body.indexOf('관리자취소 사유') >= 0 || body.indexOf('취소 사유') >= 0,
      };
    });
    
    if (!cancelCheck.isCancelPage) {
      log('naver', '❌ 취소 페이지 로드 실패', 'warning');
      return { ok: false, msg: '취소 페이지 로드 실패' };
    }
    
    log('naver', '  취소페이지 확인 ✓ (전액환불: ' + cancelCheck.hasFullRefund + ', 사유란: ' + cancelCheck.hasReasonField + ')');
    
    // ═══ Step 2: "전액환불" 라디오 버튼 선택 ═══
    log('naver', '② 전액환불 선택');
    var radioResult = await page.evaluate(function() {
      // 라디오 버튼 찾기
      var radios = document.querySelectorAll('input[type="radio"]');
      var labels = document.querySelectorAll('label');
      
      // 방법1: "전액환불" 텍스트가 있는 라벨의 라디오 클릭
      for (var i = 0; i < labels.length; i++) {
        var lt = (labels[i].textContent || '').trim();
        if (lt.indexOf('전액환불') >= 0) {
          var forId = labels[i].getAttribute('for');
          if (forId) {
            var radio = document.getElementById(forId);
            if (radio) { radio.click(); return { clicked: true, method: 'label-for', text: lt }; }
          }
          // 라벨 내부 input
          var innerRadio = labels[i].querySelector('input[type="radio"]');
          if (innerRadio) { innerRadio.click(); return { clicked: true, method: 'label-inner', text: lt }; }
          // 라벨 자체 클릭
          labels[i].click();
          return { clicked: true, method: 'label-click', text: lt };
        }
      }
      
      // 방법2: 라디오 버튼 중 첫 번째 (전액환불이 보통 첫 번째)
      if (radios.length > 0) {
        radios[0].click();
        return { clicked: true, method: 'first-radio' };
      }
      
      // 방법3: "전액환불" 텍스트 근처의 클릭 가능 요소
      var allEls = document.querySelectorAll('span, div, p, li');
      for (var j = 0; j < allEls.length; j++) {
        var et = (allEls[j].textContent || '').trim();
        if (et === '전액환불') {
          allEls[j].click();
          return { clicked: true, method: 'text-click' };
        }
      }
      
      return { clicked: false };
    });
    
    if (radioResult.clicked) {
      log('naver', '  전액환불 선택 (' + radioResult.method + ')');
    } else {
      log('naver', '  ⚠️ 전액환불 라디오 미발견 → 기본값으로 진행');
    }
    
    await new Promise(function(r) { setTimeout(r, 1000); });
    
    // ═══ Step 3: 관리자취소 사유 입력 ═══
    log('naver', '③ 취소 사유 입력: ' + cancelReason);
    
    // React 앱: puppeteer의 type으로 직접 타이핑 (가장 안정적)
    var hasTextarea = await page.evaluate(function() {
      var ta = document.querySelectorAll('textarea');
      for (var i = 0; i < ta.length; i++) {
        if (ta[i].offsetParent !== null) return true;
      }
      return false;
    });
    
    if (hasTextarea) {
      // textarea 클릭 후 타이핑
      await page.click('textarea').catch(function(){});
      await new Promise(function(r) { setTimeout(r, 300); });
      // 기존 내용 지우기
      await page.evaluate(function() {
        var ta = document.querySelector('textarea');
        if (ta) {
          ta.focus();
          ta.select();
          // React input setter 우회
          var nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
          nativeInputValueSetter.call(ta, '');
          ta.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });
      await page.type('textarea', cancelReason, { delay: 30 });
      log('naver', '  사유 입력 완료 (puppeteer type)');
    } else {
      log('naver', '  ⚠️ textarea 미발견');
    }
    
    await new Promise(function(r) { setTimeout(r, 1000); });
    
    // ═══ Step 4: "예매 취소" 버튼 클릭 ═══
    log('naver', '④ 예매 취소 버튼 클릭');
    var cancelBtnResult = await page.evaluate(function() {
      var btns = document.querySelectorAll('button, a, [role="button"]');
      var candidates = [];
      
      for (var i = 0; i < btns.length; i++) {
        var t = (btns[i].textContent || '').trim();
        if (!btns[i].offsetParent) continue;
        var rect = btns[i].getBoundingClientRect();
        
        // "예매 취소" 또는 "예매취소" 녹색 버튼 (하단의 넓은 버튼)
        if ((t === '예매 취소' || t === '예매취소') && rect.width > 100) {
          candidates.push({
            el: btns[i], text: t,
            x: Math.round(rect.x), y: Math.round(rect.y),
            w: Math.round(rect.width), h: Math.round(rect.height),
          });
        }
      }
      
      // 가장 아래쪽, 넓은 버튼 = 녹색 확인 버튼
      if (candidates.length > 0) {
        candidates.sort(function(a, b) { return b.y - a.y || b.w - a.w; });
        candidates[0].el.click();
        return { clicked: true, text: candidates[0].text, y: candidates[0].y, w: candidates[0].w };
      }
      
      return { clicked: false, total: candidates.length };
    });
    
    if (!cancelBtnResult.clicked) {
      log('naver', '❌ 예매 취소 버튼 미발견', 'warning');
      return { ok: false, msg: '취소 버튼 미발견' };
    }
    
    log('naver', '  취소 버튼 클릭 (y=' + cancelBtnResult.y + ', w=' + cancelBtnResult.w + ')');
    await new Promise(function(r) { setTimeout(r, 2000); });
    
    // ═══ Step 5: 확인 대화상자 처리 (있을 경우) ═══
    var confirmResult = await page.evaluate(function() {
      var btns = document.querySelectorAll('button, [role="button"]');
      for (var i = btns.length - 1; i >= 0; i--) {
        var t = (btns[i].textContent || '').trim();
        if ((t === '확인' || t === '예' || t === '네' || t === '취소하기' || t === '예매 취소') && btns[i].offsetParent !== null) {
          var rect = btns[i].getBoundingClientRect();
          if (rect.width > 50) {
            btns[i].click();
            return { clicked: true, text: t };
          }
        }
      }
      return { clicked: false };
    });
    
    if (confirmResult.clicked) {
      log('naver', '  확인 대화상자: ' + confirmResult.text);
      await new Promise(function(r) { setTimeout(r, 2000); });
    }
    
    // ═══ Step 6: 결과 확인 ═══
    var finalCheck = await page.evaluate(function() {
      var body = document.body ? document.body.innerText : '';
      return {
        cancelled: body.indexOf('예매취소') >= 0 || body.indexOf('취소 완료') >= 0 || body.indexOf('취소되었') >= 0,
        url: location.href,
      };
    });
    
    // 패널 닫기
    await page.evaluate(function() {
      var btns = document.querySelectorAll('button, [role="button"]');
      for (var i = 0; i < btns.length; i++) {
        var t = (btns[i].textContent || '').trim();
        if ((t === '×' || t === '✕' || t === 'X') && btns[i].offsetParent) { btns[i].click(); return; }
        if (btns[i].getAttribute('aria-label') === '닫기' && btns[i].offsetParent) { btns[i].click(); return; }
      }
    }).catch(function(){});
    
    log('naver', '✅ ' + tk.buyer + ' 예매취소 완료! (사유: ' + cancelReason + ')', 'success');
    return { ok: true, msg: '예매취소 완료' };
  } catch(e) {
    log('naver', '예매취소 오류: ' + e.message, 'error');
    STATE.sessions.naver = false;
    return { ok: false, msg: e.message };
  }
}

async function okposLogin() {
  var c = STATE.config.okpos;
  if (!c.id || !c.pw) { log('okpos', 'ID/PW 미설정', 'warning'); return false; }
  try {
    log('okpos', 'OKPOS 로그인 시작 (ID: ' + c.id + ')');
    var page = await getPage('okpos');
    log('okpos', '브라우저 준비 완료');
    
    // ★ 기존 세션 쿠키 제거 (계정 전환 시 필수)
    try {
      var client = await page.target().createCDPSession();
      await client.send('Network.clearBrowserCookies');
      await client.detach();
      log('okpos', '쿠키 초기화 완료');
    } catch(cookieErr) {
      // 쿠키 삭제 실패 시 페이지 리로드로 대체
      try { await page.evaluate(function() { document.cookie.split(';').forEach(function(c) { document.cookie = c.trim().split('=')[0] + '=;expires=Thu,01 Jan 1970 00:00:00 GMT;path=/'; }); }); } catch(e2) {}
    }
    
    var loginUrl = (c.aspUrl || 'https://nice.okpos.co.kr') + '/login/login_form.jsp';
    log('okpos', '로그인 페이지: ' + loginUrl);
    await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(function(e) { log('okpos', '페이지 로딩 실패: ' + e.message, 'warning'); });
    await new Promise(function(r) { setTimeout(r, 1500); });
    
    // 페이지가 리다이렉트됐으면 재획득
    try { await page.title(); } catch(tf) {
      log('okpos', '프레임 분리 감지 → 페이지 재획득');
      try {
        var pages = await STATE.browsers.okpos.pages();
        if (pages && pages.length > 0) {
          page = pages[pages.length - 1];
          STATE.pages.okpos = page;
        } else {
          page = await STATE.browsers.okpos.newPage();
          STATE.pages.okpos = page;
        }
      } catch(pErr) {
        log('okpos', '페이지 재획득 실패: ' + pErr.message, 'error');
        return false;
      }
      await new Promise(function(r) { setTimeout(r, 300); });
    }
    
    log('okpos', '현재 URL: ' + (page ? page.url() : '(없음)').substring(0, 80));
    
    // ★ 디버그: 로그인 폼 HTML 구조 파악
    var formDebug = await page.evaluate(function() {
      var info = [];
      // input 필드들
      var inputs = document.querySelectorAll('input');
      inputs.forEach(function(inp, i) {
        info.push('input[' + i + '] name=' + (inp.name||'') + ' type=' + (inp.type||'') + ' id=' + (inp.id||'') + ' value=' + (inp.value||'').substring(0,10));
      });
      // 버튼/링크
      var btns = document.querySelectorAll('a, button, input[type="button"], input[type="submit"]');
      btns.forEach(function(b, i) {
        var t = (b.textContent||b.value||'').trim().substring(0,20);
        var onclick = (b.getAttribute('onclick')||'').substring(0,40);
        var href = (b.getAttribute('href')||'').substring(0,40);
        if (t || onclick || href) info.push('btn[' + i + '] tag=' + b.tagName + ' text=' + t + ' onclick=' + onclick + ' href=' + href);
      });
      // form
      var forms = document.querySelectorAll('form');
      forms.forEach(function(f, i) {
        info.push('form[' + i + '] action=' + (f.action||'') + ' method=' + (f.method||'') + ' name=' + (f.name||''));
      });
      return info.join('\n');
    }).catch(function() { return '(evaluate 실패)'; });
    log('okpos', '폼 구조:\n' + formDebug);

    // OKPOS 로그인 폼 - 실제 키보드 입력 (evaluate 대신 type 사용)
    try {
      // ID 입력 - 단일 셀렉터로 순차 시도
      var idSelectors = ['#user_id', 'input[name="user_id"]', 'input[name="txtID"]', 'input[type="text"]'];
      var idDone = false;
      for (var isi = 0; isi < idSelectors.length && !idDone; isi++) {
        try {
          var idEl = await page.$(idSelectors[isi]);
          if (idEl) {
            await idEl.click();
            await idEl.press('Home');
            await page.keyboard.down('Shift');
            await page.keyboard.press('End');
            await page.keyboard.up('Shift');
            await page.keyboard.press('Backspace');
            await idEl.type(c.id, { delay: 30 });
            idDone = true;
            log('okpos', 'ID 입력 완료: ' + c.id + ' (' + idSelectors[isi] + ')');
          }
        } catch(e) {}
      }
      
      // PW 입력
      var pwSelectors = ['#user_pwd', 'input[name="user_pwd"]', 'input[name="txtPW"]', 'input[type="password"]'];
      var pwDone = false;
      for (var psi = 0; psi < pwSelectors.length && !pwDone; psi++) {
        try {
          var pwEl = await page.$(pwSelectors[psi]);
          if (pwEl) {
            await pwEl.click();
            await pwEl.press('Home');
            await page.keyboard.down('Shift');
            await page.keyboard.press('End');
            await page.keyboard.up('Shift');
            await page.keyboard.press('Backspace');
            await pwEl.type(c.pw, { delay: 30 });
            pwDone = true;
            log('okpos', 'PW 입력 완료 (' + pwSelectors[psi] + ')');
          }
        } catch(e) {}
      }
      
      if (!idDone || !pwDone) throw new Error('필드 못 찾음 id=' + idDone + ' pw=' + pwDone);
      
    } catch(typeErr) {
      log('okpos', 'type 방식 실패, evaluate 폴백: ' + typeErr.message, 'warning');
      await page.evaluate(function(id, pw) {
        var idEl = document.getElementById('user_id') || document.querySelector('input[name="user_id"]') || document.querySelector('input[type="text"]');
        var pwEl = document.getElementById('user_pwd') || document.querySelector('input[name="user_pwd"]') || document.querySelector('input[type="password"]');
        if (idEl) { idEl.value = id; idEl.dispatchEvent(new Event('input', {bubbles:true})); idEl.dispatchEvent(new Event('change', {bubbles:true})); }
        if (pwEl) { pwEl.value = pw; pwEl.dispatchEvent(new Event('input', {bubbles:true})); pwEl.dispatchEvent(new Event('change', {bubbles:true})); }
      }, c.id, c.pw);
    }
    await new Promise(function(r) { setTimeout(r, 300); });

    // ★★★ OKPOS 로그인 핵심 수정 ★★★
    // 문제: form이 target="LoginActionFrame" (hidden iframe)으로 제출됨
    // → waitForNavigation 안 먹힘 (메인 페이지 URL 안 바뀜)
    // 해결: form.submit() → iframe 응답 대기 → 메인 페이지로 직접 이동
    
    log('okpos', '로그인 폼 제출 (iframe 방식)...');
    
    // 방법 1: form.submit() 직접 호출
    var submitOk = await page.evaluate(function(id, pw) {
      try {
        // 폼 필드 직접 설정 (가장 확실한 방법)
        var form = document.loginForm || document.getElementById('loginForm') || document.forms[0];
        if (!form) return { ok: false, error: 'form not found' };
        
        // 모든 input 필드를 순회해서 ID/PW 입력
        var inputs = form.querySelectorAll('input');
        for (var i = 0; i < inputs.length; i++) {
          var inp = inputs[i];
          if (inp.type === 'text' || inp.name === 'user_id' || inp.name === 'txtID' || inp.name === 'userId') {
            inp.value = id;
          }
          if (inp.type === 'password' || inp.name === 'user_pwd' || inp.name === 'txtPW' || inp.name === 'userPw') {
            inp.value = pw;
          }
        }
        
        // iframe target 확인
        var target = form.target || '';
        
        // form submit (iframe으로 감)
        form.submit();
        
        return { ok: true, target: target, action: form.action || '' };
      } catch(e) {
        return { ok: false, error: e.message };
      }
    }, c.id, c.pw).catch(function(e) { return { ok: false, error: e.message }; });
    
    log('okpos', 'form.submit 결과: ' + JSON.stringify(submitOk));
    
    // iframe 응답 대기 (2~4초)
    log('okpos', 'iframe 응답 대기 중...');
    await new Promise(function(r) { setTimeout(r, 3000); });
    
    // iframe 내용 확인 (성공 여부)
    var iframeResult = await page.evaluate(function() {
      try {
        var iframe = document.getElementById('LoginActionFrame') || document.querySelector('iframe[name="LoginActionFrame"]');
        if (iframe && iframe.contentDocument) {
          var body = iframe.contentDocument.body;
          return body ? body.innerHTML.substring(0, 500) : '(body없음)';
        }
        if (iframe && iframe.contentWindow) {
          try { return iframe.contentWindow.document.body.innerHTML.substring(0, 500); } catch(e) { return '(cross-origin)'; }
        }
        return '(iframe없음)';
      } catch(e) { return '(iframe접근실패:' + e.message + ')'; }
    }).catch(function() { return '(evaluate실패)'; });
    log('okpos', 'iframe 응답: ' + (iframeResult || '').substring(0, 200));
    
    // ★ 로그인 성공 시 iframe이 parent를 리다이렉트하거나 쿠키를 설정
    // → main.do 대신 실제 필요한 매출 페이지로 직접 이동
    var baseUrl = c.aspUrl || 'https://nice.okpos.co.kr';
    
    // 먼저 쿠키 확인 (세션 쿠키가 설정되었는지)
    var cookies = await page.cookies();
    var hasSession = cookies.some(function(ck) { return ck.name === 'JSESSIONID' || ck.name === 'NICESID' || ck.name.indexOf('SESSION') >= 0; });
    log('okpos', '세션 쿠키: ' + (hasSession ? '✅ 있음 (' + cookies.length + '개)' : '⚠️ 없음'));
    
    // 여러 URL을 순서대로 시도
    var tryUrls = [
      baseUrl + '/sale/sale/prod011',     // 상품별 매출 (가장 필요한 페이지)
      baseUrl + '/main/main.do',          // 메인
      baseUrl + '/main/index.do',         // 메인 대안
      baseUrl + '/',                      // 루트
    ];
    
    var loginSuccess = false;
    for (var ui = 0; ui < tryUrls.length; ui++) {
      try {
        log('okpos', '페이지 이동 시도 (' + (ui+1) + '/' + tryUrls.length + '): ' + tryUrls[ui].substring(baseUrl.length));
        await page.goto(tryUrls[ui], { waitUntil: 'domcontentloaded', timeout: 12000 });
        await new Promise(function(r) { setTimeout(r, 1000); });
        
        var curUrl = page.url();
        // 로그인 페이지로 돌아갔으면 실패
        if (curUrl.indexOf('login') >= 0) {
          log('okpos', '  → 로그인 페이지로 리다이렉트 (실패)');
          continue;
        }
        // 404/에러 페이지 확인
        var pageText = await page.evaluate(function() { return document.body ? document.body.innerText.substring(0, 200) : ''; }).catch(function() { return ''; });
        if (pageText.indexOf('404') >= 0 || pageText.indexOf('Not Found') >= 0) {
          log('okpos', '  → 404 (다음 URL 시도)');
          continue;
        }
        
        loginSuccess = true;
        log('okpos', '  → ✅ 성공! URL: ' + curUrl.substring(0, 80));
        break;
      } catch(navErr) {
        log('okpos', '  → 이동 실패: ' + navErr.message.substring(0, 50));
      }
    }
    
    await new Promise(function(r) { setTimeout(r, 1500); });
    
    // 리다이렉트 후 프레임 분리 재확인
    try { await page.title(); } catch(tf2) {
      log('okpos', '로그인 후 프레임 분리 → 페이지 재획득');
      try {
        var pages2 = await STATE.browsers.okpos.pages();
        if (pages2 && pages2.length > 0) {
          page = pages2[pages2.length - 1];
          STATE.pages.okpos = page;
          await new Promise(function(r) { setTimeout(r, 300); });
        } else {
          log('okpos', '페이지 없음 → 새 탭 생성');
          page = await STATE.browsers.okpos.newPage();
          STATE.pages.okpos = page;
        }
      } catch(pErr) {
        log('okpos', '페이지 재획득 실패: ' + pErr.message, 'error');
        STATE.sessions.okpos = false;
        return false;
      }
    }

    var url = page ? page.url() : '';
    log('okpos', '로그인 후 URL: ' + url.substring(0, 100));
    
    // 에러 메시지 확인
    var errMsg = await page.evaluate(function() {
      var alerts = document.querySelectorAll('.error, .err, [class*="error"], [class*="alert"]');
      var msg = '';
      alerts.forEach(function(a) { if (a.textContent.trim()) msg += a.textContent.trim().substring(0, 50) + ' '; });
      return msg;
    });
    if (errMsg) log('okpos', '페이지 메시지: ' + errMsg);
    
    STATE.sessions.okpos = loginSuccess || (url.indexOf('login_form') < 0 && url.indexOf('login.jsp') < 0);
    if (STATE.sessions.okpos) {
      var code = await page.evaluate(function() { var m = document.body.innerText.match(/[A-Z]\d{5}/); return m ? m[0] : ''; });
      if (code && !c.storeCode) { STATE.config.okpos.storeCode = code; log('okpos', '매장코드 감지: ' + code); }
      log('okpos', '✅ 로그인 성공!', 'success');
    } else {
      log('okpos', '❌ 로그인 실패 → debug_okpos.png 확인', 'error');
    }
    await screenshot('okpos');
    return STATE.sessions.okpos;
  } catch(e) { log('okpos', '❌ 오류: ' + e.message, 'error'); await screenshot('okpos').catch(function(){}); STATE.sessions.okpos = false; return false; }
}

async function okposRegister(tk) {
  try {
    if (!STATE.sessions.okpos) { if (!(await okposLogin())) return false; }
    var page = STATE.pages.okpos;
    var c = STATE.config.okpos;
    
    // ★ 프레임 분리(detached) 방지
    try { await page.title(); page.url(); } catch(hErr) {
      log('okpos', '프레임 분리 감지 → 페이지 재획득');
      try {
        var pages = await STATE.browsers.okpos.pages();
        if (pages && pages.length > 0) { page = pages[pages.length - 1]; STATE.pages.okpos = page; }
        else { STATE.sessions.okpos = false; if (!(await okposLogin())) return false; page = STATE.pages.okpos; }
      } catch(bErr) { STATE.sessions.okpos = false; if (!(await okposLogin())) return false; page = STATE.pages.okpos; }
    }
    
    log('okpos', '매출등록: ' + tk.buyer + ' ' + (tk.price || 0).toLocaleString() + '원');
    await page.goto(c.aspUrl, { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(function(e){ log('okpos','페이지 로딩실패: '+e.message,'warning'); });
    await new Promise(function(r) { setTimeout(r, 80); });
    // 매출관리 메뉴 클릭
    await page.evaluate(function() {
      var links = document.querySelectorAll('a, .menu-item, li');
      for (var i = 0; i < links.length; i++) {
        if (links[i].textContent.match(/매출관리|매출등록|임의등록/)) { links[i].click(); return true; }
      }
      return false;
    });
    await new Promise(function(r) { setTimeout(r, 300); });
    // 폼 채우기
    var ok = await page.evaluate(function(tk) {
      function fill(sels, val) {
        for (var i = 0; i < sels.length; i++) {
          var el = document.querySelector(sels[i]);
          if (el) { el.value = val; el.dispatchEvent(new Event('change', { bubbles: true })); return true; }
        }
        return false;
      }
      fill(['input[name*="product"]', 'input[name*="goods"]', 'input[name*="item"]'], tk.product || '온라인');
      fill(['input[name*="price"]', 'input[name*="amount"]', 'input[name*="amt"]'], String(tk.price || 0));
      fill(['input[name*="qty"]', 'input[name*="count"]'], String(tk.personCount || 1));
      fill(['input[name*="memo"]', 'textarea[name*="memo"]'], 'QR|' + tk.buyer + '|' + (tk.couponNo || '') + '|' + tk.source);
      var btns = document.querySelectorAll('button, input[type="button"], input[type="submit"]');
      for (var i = 0; i < btns.length; i++) {
        var txt = btns[i].textContent || btns[i].value || '';
        if (txt.match(/등록|저장/)) { btns[i].click(); return true; }
      }
      return false;
    }, tk);
    if (ok) { await new Promise(function(r) { setTimeout(r, 300); }); log('okpos', '매출등록 완료!', 'success'); }
    else log('okpos', '매출등록 폼 미발견 → 수동확인', 'warning');
    return ok;
  } catch(e) { log('okpos', '매출등록 오류: ' + e.message, 'error'); return false; }
}

// ═══ OKPOS POS 단말기 직접 품목 등록 ═══
function okposPosRegister(tk) {
  return new Promise(function(resolve) {
    try {
      var helperPath = path.join(__dirname, 'okpos_pos_helper.py');
      if (!fs.existsSync(helperPath)) {
        log('okpos', 'okpos_pos_helper.py 없음', 'warning');
        resolve(false);
        return;
      }
      
      var product = tk.product || '입장권';
      var qty = tk.qty || tk.personCount || 1;
      var source = tk.source || '';
      var price = tk.price || 0;
      
      // 상품명 정규화 (네이버/라이프 긴 이름 → POS 버튼명으로 변환)
      var origProduct = product;
      
      // 괄호 이후 제거: "종일권(예매 1시간 이후 사용가능)" → "종일권"
      product = product.replace(/\(.+\)/g, '').trim();
      // "한국 잠사 플레이팜 입장권 2" → "입장권"
      product = product.replace(/한국\s*잠사\s*플레이팜?\s*/gi, '').replace(/\s*\d+$/,'').trim();
      
      if (source === 'naver') {
        // 네이버 상품 → POS 네이버 탭 매핑
        if (product.indexOf('네이버') < 0) {
          if (/종일|입장/.test(product)) product = '네이버 입장권';
          else if (/오후/.test(product)) product = '네이버 오후권';
          else if (/먹이/.test(product)) product = '네이버 먹이 3종세트';
          else if (/오디/.test(product)) product = '네이버 오디 3종체험';
          else if (/누에/.test(product)) product = '네이버 누에 3종 체험';
          else if (/비단/.test(product)) product = '네이버 비단체험';
          else if (/달고나/.test(product)) product = '네이버 달고나체험';
          else if (/바베큐|BBQ/.test(product)) product = '네이버 바베큐 패키지';
          else if (/불멍/.test(product)) product = '네이버 불멍패키지';
          else if (/빼빼로/.test(product)) product = '네이버 빼빼로만들기';
          else if (/오두막/.test(product)) product = price >= 50000 ? '네이버 오두막(6만원)' : '네이버 오두막(3만원)';
          else product = '네이버 입장권';  // 기본값
        }
      } else if (source === 'la2fdoci') {
        if (product.indexOf('라이프') < 0) {
          if (/종일/.test(product)) product = '라이프 종일권';
          else if (/오후/.test(product)) product = '라이프 오후권';
          else if (/누에/.test(product)) product = '라이프도시 누에 3종체험';
          else if (/오디/.test(product)) product = '라이프도시 오디 3종체험';
          else if (/불멍/.test(product)) product = '라이프도시 불멍체험';
          else if (/바베큐|BBQ/.test(product)) product = '라이프도시 바베큐 패키지';
          else if (/캔들/.test(product)) product = '라이프도시 캔들체험';
          else product = '라이프 입장권';
        }
      } else {
        // 현장 판매
        if (/청주시민/.test(product)) product = '입장권_청주시민';
        else if (/장애|경로|우대/.test(product)) product = '장애인/경로우대';
        else if (/입장/.test(product)) product = '입장권';
      }
      
      log('okpos', '🖥 POS: ' + origProduct + ' → ' + product + ' x' + qty + ' (' + source + ')');
      var jsonData = JSON.stringify({ product: product, qty: qty, source: source, price: price });
      var tmpFile = path.join(__dirname, '.okpos_pos_' + Date.now() + '.json');
      fs.writeFileSync(tmpFile, jsonData, 'utf8');
      
      log('okpos', '🖥 POS 등록: ' + product + ' x' + qty + ' (' + source + ') [Alt+Tab 전환]');
      
      // 비동기 exec로 서버 블로킹 방지
      var cp2 = require('child_process');
      var pyCmd = process.platform === 'win32' ? 'python' : 'python3';
      var cmd = pyCmd + ' "' + helperPath + '" --jsonfile "' + tmpFile + '"';
      
      cp2.exec(cmd, { timeout: 20000, encoding: 'utf8' }, function(err, stdout, stderr) {
        // 임시파일 정리
        try { if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile); } catch(uf) {}
        
        if (err) {
          // python3 → py 폴백
          var fallback = process.platform === 'win32' ? 'py' : 'python';
          var cmd2 = fallback + ' "' + helperPath + '" --jsonfile "' + tmpFile + '"';
          // tmpFile 이미 삭제됨 → 재생성
          try { fs.writeFileSync(tmpFile, jsonData, 'utf8'); } catch(wf) {}
          cp2.exec(cmd2, { timeout: 20000, encoding: 'utf8' }, function(err2, stdout2, stderr2) {
            try { if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile); } catch(uf2) {}
            if (err2) {
              log('okpos', 'POS Python 실행 실패: ' + (stderr2 || err2.message || '').substring(0, 200), 'error');
              resolve(false);
              return;
            }
            var ok2 = (stdout2 || '').trim().indexOf('OK') >= 0;
            log('okpos', ok2 ? '✅ POS 등록 완료 (' + fallback + ')' : '❌ POS: ' + (stdout2 || '').trim(), ok2 ? 'success' : 'warning');
            resolve(ok2);
          });
          return;
        }
        var output = (stdout || '').trim();
        var ok = output.indexOf('OK') >= 0;
        log('okpos', ok ? '✅ POS 단말기 등록 완료: ' + product + ' x' + qty : '❌ POS: ' + output, ok ? 'success' : 'warning');
        resolve(ok);
      });
    } catch(e) {
      log('okpos', 'POS 등록 오류: ' + e.message, 'error');
      resolve(false);
    }
  });
}

// ═══ POS 연동 테스트 API ═══
app.post('/api/okpos/pos-test', async function(req, res) {
  try {
    var body = req.body || {};
    var product = body.product || '입장권';
    var qty = body.qty || 1;
    var source = body.source || '';
    
    log('okpos', '🖥 POS 연동 테스트: ' + product + ' x' + qty);
    var result = await okposPosRegister({ product: product, qty: qty, source: source, price: body.price || 0 });
    res.json({ ok: !!result, manual: result === 'manual', product: product, qty: qty });
  } catch(e) {
    res.json({ ok: false, error: e.message });
  }
});

// ═══ 통합 크롤링 ═══
// ═══ 텔레그램 알림 ═══
async function sendTelegram(message, chatId) {
  var token = STATE.config.telegram.botToken;
  var cid = chatId || STATE.config.telegram.chatId;
  if (!token || !cid) { log('telegram', '텔레그램 미설정 (봇 토큰/채팅 ID)', 'warning'); return false; }
  try {
    var https = require('https');
    var url = 'https://api.telegram.org/bot' + token + '/sendMessage';
    var body = JSON.stringify({ chat_id: cid, text: message, parse_mode: 'HTML' });
    return new Promise(function(resolve) {
      var req = https.request(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, function(res) {
        var data = '';
        res.on('data', function(c) { data += c; });
        res.on('end', function() {
          try {
            var r = JSON.parse(data);
            if (r.ok) { log('telegram', '✅ 텔레그램 전송 완료', 'success'); resolve(true); }
            else { log('telegram', '❌ 텔레그램 실패: ' + (r.description || ''), 'error'); resolve(false); }
          } catch(e) { log('telegram', '응답 파싱 실패', 'error'); resolve(false); }
        });
      });
      req.on('error', function(e) { log('telegram', '전송 오류: ' + e.message, 'error'); resolve(false); });
      req.write(body);
      req.end();
    });
  } catch(e) { log('telegram', '오류: ' + e.message, 'error'); return false; }
}

// 텔레그램 이미지 전송
async function sendTelegramPhoto(imagePath, caption, chatId) {
  var token = STATE.config.telegram.botToken;
  var cid = chatId || STATE.config.telegram.chatId;
  if (!token || !cid || !imagePath) return false;
  try {
    var FormData = require('form-data') || null;
    if (!FormData) {
      // form-data 없으면 텍스트만 전송
      return sendTelegram(caption || '이미지', cid);
    }
    var form = new FormData();
    form.append('chat_id', cid);
    form.append('photo', fs.createReadStream(imagePath));
    if (caption) form.append('caption', caption);
    // ... (간단 구현은 텍스트 전송으로 대체)
    return sendTelegram(caption || '📸 이미지 전송', cid);
  } catch(e) { return sendTelegram(caption || '이미지', cid); }
}

// ═══ 통합 알림 (카카오+텔레그램 동시) ═══
async function notifyAll(message, room) {
  var results = { kakao: false, telegram: false };
  // 카카오톡 PC
  if (STATE.config.kakao.enabled) {
    results.kakao = await sendKakaoPC(message, room);
  }
  // 텔레그램
  if (STATE.config.telegram.enabled && STATE.config.telegram.botToken) {
    results.telegram = await sendTelegram(message);
  }
  return results;
}

// ═══ 카카오톡 PC 매크로 전송 ═══
function sendKakaoPC(message, room) {
  return new Promise(function(resolve) {
    if (!STATE.config.kakao.enabled) { log('kakao', '카톡 비활성화', 'warning'); resolve(false); return; }
    var targetRoom = room || STATE.config.kakao.room || '';
    if (!targetRoom) { log('kakao', '발송방 미설정', 'warning'); resolve(false); return; }
    if (!message) { log('kakao', '메시지 없음', 'warning'); resolve(false); return; }
    
    var cp = require('child_process');
    var helperPath = path.join(__dirname, 'kakao_helper.py');
    
    if (!fs.existsSync(helperPath)) {
      log('kakao', 'kakao_helper.py 없음: ' + helperPath, 'error');
      resolve(false);
      return;
    }
    
    // 메시지를 임시 파일로 저장
    var tmpFile = path.join(__dirname, '.kakao_msg_' + Date.now() + '.txt');
    try {
      fs.writeFileSync(tmpFile, message, 'utf8');
      
      var cmd = 'python "' + helperPath + '" "' + targetRoom.replace(/"/g, '\\"') + '" --file "' + tmpFile + '"';
      log('kakao', '명령어: ' + cmd.substring(0, 120) + '...');
      
      var pyEnv = Object.assign({}, process.env, { PYTHONIOENCODING: 'utf-8', PYTHONLEGACYWINDOWSSTDIO: '0' });
      var pyOpts = { timeout: 30000, encoding: 'utf8', windowsHide: true, env: pyEnv };
      
      // Windows: python → python3 → py 폴백
      try {
        var result = cp.execSync(cmd, pyOpts);
        var ok = (result || '').trim().indexOf('OK') >= 0;
        log('kakao', ok ? '✅ 카톡 전송 완료 → ' + targetRoom : '❌ 카톡 전송 실패: ' + (result || '').trim(), ok ? 'success' : 'warning');
        resolve(ok);
      } catch(e1) {
        var errMsg1 = (e1.stderr || e1.stdout || e1.message || '').substring(0, 200);
        log('kakao', 'python 실패: ' + errMsg1, 'warning');
        
        // python3 시도
        try {
          var result2 = cp.execSync(cmd.replace(/^python /, 'python3 '), pyOpts);
          var ok2 = (result2 || '').trim().indexOf('OK') >= 0;
          log('kakao', ok2 ? '✅ 카톡 전송 완료 (python3) → ' + targetRoom : '❌ 실패: ' + (result2 || '').trim(), ok2 ? 'success' : 'warning');
          resolve(ok2);
        } catch(e2) {
          // py 런처 시도 (Windows)
          try {
            var result3 = cp.execSync(cmd.replace(/^python /, 'py '), pyOpts);
            var ok3 = (result3 || '').trim().indexOf('OK') >= 0;
            log('kakao', ok3 ? '✅ 카톡 전송 완료 (py) → ' + targetRoom : '❌ 실패: ' + (result3 || '').trim(), ok3 ? 'success' : 'warning');
            resolve(ok3);
          } catch(e3) {
            var errMsg = (e3.stderr || e3.stdout || e3.message || '').substring(0, 300);
            log('kakao', '❌ Python 실행 실패: ' + errMsg, 'error');
            log('kakao', '💡 확인사항:', 'warning');
            log('kakao', '  1) CMD에서 python --version 실행되는지 확인', 'warning');
            log('kakao', '  2) pip install pyautogui pyperclip Pillow', 'warning');
            log('kakao', '  3) 카카오톡 PC 실행 중인지 확인', 'warning');
            log('kakao', '  4) 채팅방 "' + targetRoom + '" 이름이 정확한지 확인', 'warning');
            resolve(false);
          }
        }
      }
    } catch(e) {
      log('kakao', '카톡 전송 오류: ' + e.message, 'error');
      resolve(false);
    } finally {
      try { fs.unlinkSync(tmpFile); } catch(ue) {}
    }
  });
}

// ═══ 카카오톡 이미지+텍스트 전송 ═══
function sendKakaoPCWithImage(message, imagePath, room) {
  return new Promise(function(resolve) {
    if (!STATE.config.kakao.enabled) { resolve(false); return; }
    var targetRoom = room || STATE.config.kakao.room || '';
    if (!targetRoom) { resolve(false); return; }
    
    var cp = require('child_process');
    var helperPath = path.join(__dirname, 'kakao_helper.py');
    
    if (!fs.existsSync(helperPath)) {
      log('kakao', 'kakao_helper.py 없음', 'warning');
      resolve(false);
      return;
    }
    
    var tmpFile = null;
    var argParts = ['"' + helperPath + '"', '"' + targetRoom.replace(/"/g, '\\"') + '"'];
    
    if (message) {
      tmpFile = path.join(__dirname, '.kakao_msg_' + Date.now() + '.txt');
      fs.writeFileSync(tmpFile, message, 'utf8');
      argParts.push('--file', '"' + tmpFile + '"');
    }
    if (imagePath && fs.existsSync(imagePath)) {
      argParts.push('--image', '"' + imagePath + '"');
    }
    
    var cmd = 'python ' + argParts.join(' ');
    var pyEnv = Object.assign({}, process.env, { PYTHONIOENCODING: 'utf-8', PYTHONLEGACYWINDOWSSTDIO: '0' });
    var pyOpts = { timeout: 30000, encoding: 'utf8', windowsHide: true, env: pyEnv };
    
    try {
      try {
        var result = cp.execSync(cmd, pyOpts);
        var ok = (result || '').trim().indexOf('OK') >= 0;
        resolve(ok);
      } catch(e1) {
        try {
          var result2 = cp.execSync(cmd.replace(/^python /, 'python3 '), pyOpts);
          resolve((result2 || '').trim().indexOf('OK') >= 0);
        } catch(e2) {
          var result3 = cp.execSync(cmd.replace(/^python /, 'py '), pyOpts);
          resolve((result3 || '').trim().indexOf('OK') >= 0);
        }
      }
    } catch(e) {
      log('kakao', '카톡 이미지 전송 오류: ' + (e.stderr || e.message || '').substring(0, 200), 'error');
      resolve(false);
    } finally {
      if (tmpFile) try { fs.unlinkSync(tmpFile); } catch(ue) {}
    }
  });
}

// ═══ OKPOS 매출 크롤링 (Puppeteer UI 기반) ═══

// OKPOS ShowItemFrm 메뉴에서 페이지 이동 → 날짜 설정 → 조회 → 데이터 추출
async function okposNavigateAndQuery(page, menuName, dateFrom, dateTo) {
  var allFrames = page.frames();
  var mainFrame = null;
  log('okpos', '  프레임: ' + allFrames.map(function(f) { return f.name() || '?'; }).filter(function(n) { return n !== '?' && n.indexOf('Popup') < 0; }).join(', '));
  
  // 1) 먼저 "매출현황" 서브메뉴 펼치기 (필요시)
  // ShowItemFrm, MenuVFrm, MyMenuFrm 등에서 "매출현황" 클릭
  for (var efi = 0; efi < allFrames.length; efi++) {
    var efn = allFrames[efi].name() || '';
    if (efn.indexOf('Popup') >= 0 || efn.indexOf('Blank') >= 0 || efn.indexOf('cal_') >= 0) continue;
    
    await allFrames[efi].evaluate(function() {
      var els = document.querySelectorAll('a, td, div, span, li, button, dt, dd');
      for (var i = 0; i < els.length; i++) {
        var t = (els[i].textContent || '').trim();
        if (t === '매출현황' || t === '매출현황 >') {
          els[i].click();
          els[i].dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
          return true;
        }
      }
      return false;
    }).catch(function() { return false; });
  }
  await new Promise(function(r) { setTimeout(r, 1500); });
  
  // 2) 메뉴 항목 클릭 (모든 프레임에서 검색)
  allFrames = page.frames(); // 펼친 후 재탐색
  var menuClicked = false;
  
  for (var fi = 0; fi < allFrames.length; fi++) {
    var fn = allFrames[fi].name() || '';
    if (fn.indexOf('Popup') >= 0 || fn.indexOf('Blank') >= 0 || fn.indexOf('cal_') >= 0) continue;
    
    menuClicked = await allFrames[fi].evaluate(function(menuName) {
      var els = document.querySelectorAll('a, td, div, span, li, button, dt, dd, label');
      
      // 1순위: 정확히 일치
      for (var i = 0; i < els.length; i++) {
        var text = (els[i].textContent || '').trim();
        if (text === menuName) {
          els[i].click();
          return 'exact:' + text;
        }
      }
      
      // 2순위: 텍스트가 메뉴명을 포함 (번호 아이콘 등 제거)
      for (var j = 0; j < els.length; j++) {
        var text2 = (els[j].textContent || '').trim();
        // "⑩ 상품별" 또는 "10 상품별" 등 → "상품별" 포함
        if (text2.indexOf(menuName) >= 0 && text2.length < menuName.length + 10) {
          // 자식 요소가 없거나 적은 것 우선 (말단 노드)
          if (els[j].children.length <= 2) {
            els[j].click();
            return 'contains:' + text2;
          }
        }
      }
      
      // 3순위: href/onclick에 키워드 포함
      var jspMap = { '상품별': 'prod011', '시간대별': 'time011', '당일매출상세현황': 'daily012', '당일매출종합현황': 'daily011' };
      var jspKey = jspMap[menuName] || '';
      if (jspKey) {
        for (var k = 0; k < els.length; k++) {
          var href = (els[k].getAttribute('href') || '') + ' ' + (els[k].getAttribute('onclick') || '');
          if (href.indexOf(jspKey) >= 0) {
            els[k].click();
            return 'jsp:' + jspKey;
          }
        }
      }
      
      // 4순위: 포함 매칭 (느슨하게)
      for (var m = 0; m < els.length; m++) {
        var text3 = (els[m].textContent || '').trim();
        if (text3.indexOf(menuName) >= 0 && text3.length < 30) {
          els[m].click();
          return 'loose:' + text3;
        }
      }
      
      return '';
    }, menuName).catch(function() { return ''; });
    
    if (menuClicked) {
      log('okpos', '  ✅ "' + menuName + '" 클릭: ' + menuClicked + ' (프레임: ' + fn + ')');
      break;
    }
  }
  
  if (!menuClicked) {
    // 최종: 상위 메뉴 "매출관리" 탭 클릭 후 재시도
    log('okpos', '  메뉴 미발견 → "매출관리" 탭 클릭 후 재시도');
    for (var tfi = 0; tfi < allFrames.length; tfi++) {
      await allFrames[tfi].evaluate(function() {
        var els = document.querySelectorAll('a, td, div, span, li');
        for (var i = 0; i < els.length; i++) {
          var t = (els[i].textContent || '').trim();
          if (t === '매출관리') { els[i].click(); return true; }
        }
        return false;
      }).catch(function() { return false; });
    }
    await new Promise(function(r) { setTimeout(r, 2000); });
    
    // "매출현황" 클릭
    allFrames = page.frames();
    for (var efi2 = 0; efi2 < allFrames.length; efi2++) {
      await allFrames[efi2].evaluate(function() {
        var els = document.querySelectorAll('a, td, div, span, li');
        for (var i = 0; i < els.length; i++) {
          if ((els[i].textContent || '').trim().indexOf('매출현황') >= 0) { els[i].click(); return; }
        }
      }).catch(function() {});
    }
    await new Promise(function(r) { setTimeout(r, 1500); });
    
    // 다시 메뉴 항목 검색
    allFrames = page.frames();
    for (var rfi = 0; rfi < allFrames.length; rfi++) {
      menuClicked = await allFrames[rfi].evaluate(function(menuName) {
        var els = document.querySelectorAll('a, td, div, span, li, button');
        for (var i = 0; i < els.length; i++) {
          var t = (els[i].textContent || '').trim();
          if (t.indexOf(menuName) >= 0 && t.length < 30) { els[i].click(); return 'retry:' + t; }
        }
        return '';
      }, menuName).catch(function() { return ''; });
      if (menuClicked) { log('okpos', '  ✅ 재시도 성공: ' + menuClicked); break; }
    }
  }
  
  if (!menuClicked) {
    log('okpos', '  ❌ "' + menuName + '" 최종 실패', 'warning');
    return null;
  }
  
  // 3) MainFrm 로딩 대기
  await new Promise(function(r) { setTimeout(r, 4000); });
  
  // MainFrm 재탐색
  allFrames = page.frames();
  mainFrame = null;
  for (var mfi = 0; mfi < allFrames.length; mfi++) {
    if (allFrames[mfi].name() === 'MainFrm') { mainFrame = allFrames[mfi]; break; }
  }
  
  if (!mainFrame) {
    log('okpos', '  MainFrm 미발견', 'warning');
    return null;
  }
  
  log('okpos', '  MainFrm: ' + mainFrame.url().split('/').pop().split('?')[0]);
  
  // 3) XHR 인터셉트 설정 (조회 전에)
  await mainFrame.evaluate(function() {
    window._okposXhrData = [];
    var origOpen = XMLHttpRequest.prototype.open;
    var origSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function(method, url) {
      this._okposUrl = url;
      return origOpen.apply(this, arguments);
    };
    XMLHttpRequest.prototype.send = function(body) {
      var xhr = this;
      this.addEventListener('load', function() {
        try {
          if (xhr.responseText && xhr.responseText.length > 50) {
            window._okposXhrData.push({
              url: xhr._okposUrl || '',
              data: xhr.responseText,
              size: xhr.responseText.length
            });
          }
        } catch(e) {}
      });
      return origSend.apply(this, arguments);
    };
  }).catch(function() {});
  
  // 4) "분류별상품" 탭 클릭 + 콘텐츠 로딩 대기
  var tabClicked = await mainFrame.evaluate(function() {
    var tabs = document.querySelectorAll('a, span, div, li, button, label, input[type="button"], td');
    for (var i = 0; i < tabs.length; i++) {
      var t = (tabs[i].textContent || tabs[i].value || '').trim();
      if (t === '분류별상품' || t === '분류별 상품' || t.indexOf('분류별상품') >= 0) {
        tabs[i].click();
        return 'tab:' + t;
      }
    }
    return '';
  }).catch(function() { return ''; });
  
  if (tabClicked) log('okpos', '  탭 클릭: ' + tabClicked);
  
  // 탭 클릭 후 콘텐츠 로딩 대기 (input 개수로 감지)
  for (var waitI = 0; waitI < 10; waitI++) {
    await new Promise(function(r) { setTimeout(r, 1000); });
    
    // MainFrm 또는 하위 프레임에서 input 개수 확인
    var inputCount = await mainFrame.evaluate(function() {
      return document.querySelectorAll('input').length;
    }).catch(function() { return 0; });
    
    // 하위 iframe도 확인
    var childFrames = mainFrame.childFrames ? mainFrame.childFrames() : [];
    for (var cfi = 0; cfi < childFrames.length; cfi++) {
      var cCount = await childFrames[cfi].evaluate(function() {
        return document.querySelectorAll('input').length;
      }).catch(function() { return 0; });
      inputCount += cCount;
    }
    
    if (inputCount >= 3) {
      log('okpos', '  콘텐츠 로딩 완료: input ' + inputCount + '개 (' + (waitI + 1) + '초)');
      break;
    }
  }
  
  // MainFrm 하위 프레임 탐색 (탭이 iframe으로 콘텐츠를 로드할 수 있음)
  var targetFrame = mainFrame;
  var mainChildFrames = mainFrame.childFrames ? mainFrame.childFrames() : [];
  if (mainChildFrames.length > 0) {
    for (var mcfi = 0; mcfi < mainChildFrames.length; mcfi++) {
      var mcInputs = await mainChildFrames[mcfi].evaluate(function() {
        return document.querySelectorAll('input').length;
      }).catch(function() { return 0; });
      if (mcInputs > 2) {
        targetFrame = mainChildFrames[mcfi];
        log('okpos', '  하위 프레임 발견: input ' + mcInputs + '개 (URL: ' + targetFrame.url().split('/').pop().split('?')[0] + ')');
        break;
      }
    }
  }
  
  // 5) 날짜 설정 + 조회 클릭
  log('okpos', '  날짜 설정: ' + dateFrom + ' ~ ' + dateTo);
  
  // XHR 인터셉트를 targetFrame에도 설정
  await targetFrame.evaluate(function() {
    window._okposXhrData = [];
    var origOpen = XMLHttpRequest.prototype.open;
    var origSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function(method, url) {
      this._okposUrl = url;
      return origOpen.apply(this, arguments);
    };
    XMLHttpRequest.prototype.send = function(body) {
      var xhr = this;
      this.addEventListener('load', function() {
        try {
          if (xhr.responseText && xhr.responseText.length > 50) {
            window._okposXhrData.push({ url: xhr._okposUrl || '', data: xhr.responseText, size: xhr.responseText.length });
          }
        } catch(e) {}
      });
      return origSend.apply(this, arguments);
    };
  }).catch(function() {});
  
  
  // 디버그: DOM 요소 목록
  var debugInfo = await targetFrame.evaluate(function() {
    var info = { inputs: [], buttons: [] };
    var allInputs = document.querySelectorAll('input');
    for (var i = 0; i < allInputs.length; i++) {
      var inp = allInputs[i];
      info.inputs.push({
        type: inp.type, name: inp.name, id: inp.id, value: (inp.value || '').substring(0, 30),
        cls: (inp.className || '').substring(0, 30)
      });
    }
    // 버튼류 요소
    var btns = document.querySelectorAll('button, input[type="button"], input[type="submit"], input[type="image"], a[class*="btn"], img[onclick]');
    for (var j = 0; j < btns.length; j++) {
      info.buttons.push({
        tag: btns[j].tagName, type: btns[j].type || '',
        text: (btns[j].textContent || '').trim().substring(0, 20),
        value: (btns[j].value || '').substring(0, 20),
        onclick: (btns[j].getAttribute('onclick') || '').substring(0, 40)
      });
    }
    return info;
  }).catch(function() { return { inputs: [], buttons: [] }; });
  
  log('okpos', '  DOM: input ' + debugInfo.inputs.length + '개, button ' + debugInfo.buttons.length + '개');
  // 날짜 input 후보 로깅
  debugInfo.inputs.forEach(function(inp) {
    if (inp.value.match(/\d{4}/) || inp.name.match(/date|dt|day/i) || inp.type === 'text') {
      log('okpos', '    input: name=' + inp.name + ' id=' + inp.id + ' type=' + inp.type + ' val="' + inp.value + '" cls=' + inp.cls);
    }
  });
  debugInfo.buttons.forEach(function(btn) {
    log('okpos', '    btn: <' + btn.tag + '> text="' + btn.text + '" value="' + btn.value + '" onclick="' + btn.onclick + '"');
  });
  
  var queryResult = await targetFrame.evaluate(function(dateFrom, dateTo) {
    var result = { dateSet: false, btnClicked: false, error: '', dateMethod: '', btnMethod: '' };
    try {
      // ─── 날짜 설정 (5가지 전략) ───
      var allInputs = document.querySelectorAll('input');
      var dateInputs = [];
      
      // 전략1: 값에 날짜 패턴이 있는 input
      for (var i = 0; i < allInputs.length; i++) {
        var v = allInputs[i].value || '';
        if (v.match(/^\d{4}[-\/\.]\d{2}[-\/\.]\d{2}$/)) {
          dateInputs.push(allInputs[i]);
        }
      }
      
      // 전략2: name/id에 date 관련 키워드
      if (dateInputs.length < 2) {
        for (var i2 = 0; i2 < allInputs.length; i2++) {
          var n = (allInputs[i2].name || '').toLowerCase();
          var id = (allInputs[i2].id || '').toLowerCase();
          if (n.match(/date|dt_|sdate|edate|from_d|to_d|s_day|e_day/) || id.match(/date|dt_|sdate|edate/)) {
            if (dateInputs.indexOf(allInputs[i2]) < 0) dateInputs.push(allInputs[i2]);
          }
        }
      }
      
      // 전략3: class에 calendar/datepicker 관련
      if (dateInputs.length < 2) {
        for (var i3 = 0; i3 < allInputs.length; i3++) {
          var cls = (allInputs[i3].className || '').toLowerCase();
          if (cls.match(/date|calendar|picker|hasdate/)) {
            if (dateInputs.indexOf(allInputs[i3]) < 0) dateInputs.push(allInputs[i3]);
          }
        }
      }
      
      // 전략4: type=text인 input 중 앞쪽 2개 (보통 날짜가 맨 앞)
      if (dateInputs.length < 2) {
        var textInputs = [];
        for (var i4 = 0; i4 < allInputs.length; i4++) {
          if ((allInputs[i4].type === 'text' || !allInputs[i4].type) && allInputs[i4].offsetWidth > 0) {
            textInputs.push(allInputs[i4]);
          }
        }
        // 날짜 형태의 값이 있는 것 우선
        for (var i5 = 0; i5 < textInputs.length; i5++) {
          var v5 = textInputs[i5].value || '';
          if (v5.match(/\d{4}/) && v5.length <= 12) {
            if (dateInputs.indexOf(textInputs[i5]) < 0) dateInputs.push(textInputs[i5]);
          }
        }
      }
      
      result.dateMethod = 'found:' + dateInputs.length;
      
      if (dateInputs.length >= 2) {
        // nativeInputValueSetter로 React 호환
        var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(dateInputs[0], dateFrom);
        dateInputs[0].dispatchEvent(new Event('input', {bubbles:true}));
        dateInputs[0].dispatchEvent(new Event('change', {bubbles:true}));
        setter.call(dateInputs[1], dateTo);
        dateInputs[1].dispatchEvent(new Event('input', {bubbles:true}));
        dateInputs[1].dispatchEvent(new Event('change', {bubbles:true}));
        result.dateSet = true;
      } else if (dateInputs.length === 1) {
        var setter2 = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter2.call(dateInputs[0], dateFrom);
        dateInputs[0].dispatchEvent(new Event('input', {bubbles:true}));
        dateInputs[0].dispatchEvent(new Event('change', {bubbles:true}));
        result.dateSet = true;
      }
      
      // ─── 조회 버튼 클릭 (5가지 전략) ───
      
      // 전략1: input[value="조회"]
      var inputs = document.querySelectorAll('input');
      for (var b1 = 0; b1 < inputs.length; b1++) {
        if ((inputs[b1].value || '').trim() === '조회') {
          inputs[b1].click();
          result.btnClicked = true;
          result.btnMethod = 'input-value';
          break;
        }
      }
      
      // 전략2: button/a 텍스트 "조회"
      if (!result.btnClicked) {
        var els = document.querySelectorAll('button, a, span, div, td');
        for (var b2 = 0; b2 < els.length; b2++) {
          var t = (els[b2].textContent || '').trim();
          if (t === '조회' && els[b2].offsetWidth > 0) {
            els[b2].click();
            result.btnClicked = true;
            result.btnMethod = 'text';
            break;
          }
        }
      }
      
      // 전략3: onclick에 doAction('search') 포함
      if (!result.btnClicked) {
        var allEls = document.querySelectorAll('[onclick]');
        for (var b3 = 0; b3 < allEls.length; b3++) {
          var oc = allEls[b3].getAttribute('onclick') || '';
          if (oc.indexOf('doAction') >= 0 && oc.indexOf('search') >= 0) {
            allEls[b3].click();
            result.btnClicked = true;
            result.btnMethod = 'onclick-doAction';
            break;
          }
        }
      }
      
      // 전략4: img alt/title "조회"
      if (!result.btnClicked) {
        var imgs = document.querySelectorAll('img');
        for (var b4 = 0; b4 < imgs.length; b4++) {
          var alt = (imgs[b4].alt || imgs[b4].title || '').trim();
          if (alt === '조회' || alt === 'search') {
            imgs[b4].click();
            result.btnClicked = true;
            result.btnMethod = 'img-alt';
            break;
          }
        }
      }
      
      // 전략5: doAction('search') 직접 호출
      if (!result.btnClicked) {
        try {
          if (typeof doAction === 'function') {
            doAction('search');
            result.btnClicked = true;
            result.btnMethod = 'doAction()';
          }
        } catch(e) { result.error += 'doAction:' + e.message + '; '; }
      }
      
      // 전략6: ibSearch, fn_search 등
      if (!result.btnClicked) {
        var fnNames = ['ibSearch', 'fn_search', 'fnSearch', 'search', 'doSearch'];
        for (var fi = 0; fi < fnNames.length; fi++) {
          try {
            if (typeof window[fnNames[fi]] === 'function') {
              window[fnNames[fi]]();
              result.btnClicked = true;
              result.btnMethod = fnNames[fi] + '()';
              break;
            }
          } catch(e) {}
        }
      }
      
    } catch(e) { result.error = e.message; }
    return result;
  }, dateFrom, dateTo).catch(function(e) { return { error: e.message }; });
  
  log('okpos', '  조회: 날짜=' + (queryResult.dateSet ? '✅' : '❌') + '(' + (queryResult.dateMethod || '') + ')' +
    ' 버튼=' + (queryResult.btnClicked ? '✅' + (queryResult.btnMethod || '') : '❌') +
    (queryResult.error ? ' err=' + queryResult.error : ''));
  
  // 5) 데이터 로딩 대기 (IBSheet XHR)
  await new Promise(function(r) { setTimeout(r, 6000); });
  
  // 6) 데이터 추출 (3가지 방법 시도)
  
  // 방법A: XHR 인터셉트
  var xhrData = await targetFrame.evaluate(function() {
    return window._okposXhrData || [];
  }).catch(function() { return []; });
  
  if (xhrData.length > 0) {
    var validXhr = xhrData.filter(function(x) { return x.size > 100 && x.data.indexOf('오류발생') < 0; });
    if (validXhr.length > 0) {
      var best = validXhr.sort(function(a, b) { return b.size - a.size; })[0];
      log('okpos', '  ✅ XHR 인터셉트: ' + best.size + 'bytes');
      log('okpos', '  XHR 샘플: ' + (best.data || '').substring(0, 200));
      return { ok: true, data: best.data, method: 'xhr', isJSON: false };
    }
  }
  log('okpos', '  XHR: ' + xhrData.length + '건 (유효 없음)');
  
  // 방법B: IBSheet 객체 추출
  var ibData = await targetFrame.evaluate(function() {
    var sheetObj = null;
    // IBSheet 객체 검색
    var searchKeys = ['mySheet', 'sheet', 'Sheet', 'ibsheet'];
    for (var si = 0; si < searchKeys.length; si++) {
      try { if (window[searchKeys[si]] && typeof window[searchKeys[si]].GetTotalRows === 'function') { sheetObj = window[searchKeys[si]]; break; } } catch(e) {}
    }
    if (!sheetObj) {
      for (var key in window) {
        try { if (window[key] && typeof window[key].GetTotalRows === 'function') { sheetObj = window[key]; break; } } catch(e) {}
      }
    }
    if (!sheetObj) return { ok: false, error: 'IBSheet not found' };
    
    var totalRows = sheetObj.GetTotalRows();
    if (totalRows === 0) return { ok: true, rows: [], count: 0 };
    
    var headers = [];
    var colCount = 30;
    try { colCount = sheetObj.ColCount ? sheetObj.ColCount() : 30; } catch(e) {}
    for (var c = 0; c < colCount; c++) {
      try {
        var h = sheetObj.GetCellValue(0, c);
        if (!h) try { h = sheetObj.GetHeaderText(c); } catch(e2) {}
        headers.push(h || ('col' + c));
      } catch(e) { break; }
    }
    
    var rows = [];
    for (var r = 1; r <= totalRows; r++) {
      var row = {};
      for (var c2 = 0; c2 < headers.length; c2++) {
        try {
          var val = sheetObj.GetCellValue(r, c2);
          if (val !== undefined && val !== null && val !== '') row[headers[c2]] = String(val);
        } catch(e) {}
      }
      if (Object.keys(row).length > 0) rows.push(row);
    }
    return { ok: true, rows: rows, count: totalRows };
  }).catch(function(e) { return { ok: false, error: e.message }; });
  
  if (ibData.ok && ibData.rows && ibData.rows.length > 0) {
    log('okpos', '  ✅ IBSheet 추출: ' + ibData.rows.length + '행');
    return { ok: true, data: JSON.stringify(ibData.rows), method: 'ibsheet', isJSON: true };
  }
  log('okpos', '  IBSheet: ' + (ibData.error || ibData.count + '행'));
  
  // 방법C: HTML 테이블 추출
  var tableData = await targetFrame.evaluate(function() {
    // 가장 큰 테이블 찾기
    var tables = document.querySelectorAll('table');
    var best = null, bestRows = 0;
    for (var i = 0; i < tables.length; i++) {
      var trs = tables[i].querySelectorAll('tr');
      if (trs.length > bestRows) { best = tables[i]; bestRows = trs.length; }
    }
    if (!best || bestRows < 2) {
      // div 기반 그리드
      var gridEl = document.querySelector('[class*="ibsheet"], [class*="Sheet"], [id*="sheet"], [id*="Sheet"]');
      if (gridEl) {
        var text = gridEl.innerText || '';
        var lines = text.split('\n').filter(function(l) { return l.trim(); });
        return { ok: lines.length > 1, rows: lines, method: 'div-text' };
      }
      return { ok: false };
    }
    var trs = best.querySelectorAll('tr');
    var hdrs = [];
    trs[0].querySelectorAll('th, td').forEach(function(th) { hdrs.push(th.textContent.trim()); });
    var rows = [];
    for (var r = 1; r < trs.length; r++) {
      var cells = trs[r].querySelectorAll('td');
      var row = {};
      for (var c = 0; c < cells.length && c < hdrs.length; c++) {
        var v = cells[c].textContent.trim();
        if (v) row[hdrs[c] || ('col' + c)] = v;
      }
      if (Object.keys(row).length > 0) rows.push(row);
    }
    return { ok: rows.length > 0, rows: rows };
  }).catch(function() { return { ok: false }; });
  
  if (tableData.ok && tableData.rows) {
    log('okpos', '  ✅ HTML 테이블: ' + tableData.rows.length + '행');
    return { ok: true, data: JSON.stringify(tableData.rows), method: 'table', isJSON: true };
  }
  
  log('okpos', '  모든 추출 실패', 'warning');
  return { ok: false, error: 'extraction failed' };
}

// ═══ 같은 페이지 내 탭 전환 + 조회 + 데이터 추출 ═══
async function okposSwitchTabAndQuery(page, tabName, dateFrom, dateTo) {
  log('okpos', '  🔄 탭 전환: ' + tabName);
  
  // MainFrm 찾기
  var allFrames = page.frames();
  var mainFrame = null;
  for (var fi = 0; fi < allFrames.length; fi++) {
    if (allFrames[fi].name() === 'MainFrm') { mainFrame = allFrames[fi]; break; }
  }
  if (!mainFrame) { log('okpos', '  MainFrm 미발견', 'warning'); return null; }
  
  // targetFrame (MainFrm 또는 하위 iframe)
  var targetFrame = mainFrame;
  var childFrames = mainFrame.childFrames ? mainFrame.childFrames() : [];
  for (var cfi = 0; cfi < childFrames.length; cfi++) {
    var cInputs = await childFrames[cfi].evaluate(function() {
      return document.querySelectorAll('input').length;
    }).catch(function() { return 0; });
    if (cInputs > 2) { targetFrame = childFrames[cfi]; break; }
  }
  
  // 탭 클릭
  var tabClicked = await targetFrame.evaluate(function(tabName) {
    var els = document.querySelectorAll('a, span, div, li, button, label, input[type="button"], td');
    for (var i = 0; i < els.length; i++) {
      var t = (els[i].textContent || els[i].value || '').trim();
      if (t === tabName || t.indexOf(tabName) >= 0 && t.length < tabName.length + 10) {
        els[i].click();
        return t;
      }
    }
    return '';
  }, tabName).catch(function() { return ''; });
  
  if (!tabClicked) {
    // mainFrame에서도 시도
    tabClicked = await mainFrame.evaluate(function(tabName) {
      var els = document.querySelectorAll('a, span, div, li, button, label, td');
      for (var i = 0; i < els.length; i++) {
        var t = (els[i].textContent || els[i].value || '').trim();
        if (t === tabName || (t.indexOf(tabName) >= 0 && t.length < tabName.length + 10)) {
          els[i].click();
          return t;
        }
      }
      return '';
    }, tabName).catch(function() { return ''; });
  }
  
  if (!tabClicked) {
    log('okpos', '  "' + tabName + '" 탭 미발견', 'warning');
    return null;
  }
  log('okpos', '  탭 클릭: ' + tabClicked);
  
  // 콘텐츠 로딩 대기
  for (var wi = 0; wi < 8; wi++) {
    await new Promise(function(r) { setTimeout(r, 1000); });
    var inputCount = await targetFrame.evaluate(function() {
      return document.querySelectorAll('input').length;
    }).catch(function() { return 0; });
    if (inputCount >= 3) break;
  }
  
  // 하위 프레임 재탐색
  childFrames = mainFrame.childFrames ? mainFrame.childFrames() : [];
  for (var cfi2 = 0; cfi2 < childFrames.length; cfi2++) {
    var ci2 = await childFrames[cfi2].evaluate(function() {
      return document.querySelectorAll('input').length;
    }).catch(function() { return 0; });
    if (ci2 > 2) { targetFrame = childFrames[cfi2]; break; }
  }
  
  // XHR 인터셉트 설정
  await targetFrame.evaluate(function() {
    window._okposXhrData = [];
    var origOpen = XMLHttpRequest.prototype.open;
    var origSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function(method, url) {
      this._okposUrl = url;
      return origOpen.apply(this, arguments);
    };
    XMLHttpRequest.prototype.send = function(body) {
      var xhr = this;
      this.addEventListener('load', function() {
        try {
          if (xhr.responseText && xhr.responseText.length > 50) {
            window._okposXhrData.push({ url: xhr._okposUrl || '', data: xhr.responseText, size: xhr.responseText.length });
          }
        } catch(e) {}
      });
      return origSend.apply(this, arguments);
    };
  }).catch(function() {});
  
  // 날짜 설정 + 조회
  await targetFrame.evaluate(function(dateFrom, dateTo) {
    // 날짜 설정
    var allInputs = document.querySelectorAll('input');
    var dateInputs = [];
    for (var i = 0; i < allInputs.length; i++) {
      var v = allInputs[i].value || '';
      if (v.match(/^\d{4}[-\/\.]\d{2}[-\/\.]\d{2}$/)) dateInputs.push(allInputs[i]);
    }
    if (dateInputs.length < 2) {
      for (var i2 = 0; i2 < allInputs.length; i2++) {
        var n = (allInputs[i2].name || '').toLowerCase();
        if (n.match(/date|dt_|sdate|edate/) && dateInputs.indexOf(allInputs[i2]) < 0) dateInputs.push(allInputs[i2]);
      }
    }
    if (dateInputs.length < 2) {
      for (var i3 = 0; i3 < allInputs.length; i3++) {
        if ((allInputs[i3].type === 'text' || !allInputs[i3].type) && (allInputs[i3].value || '').match(/\d{4}/) && allInputs[i3].offsetWidth > 0) {
          if (dateInputs.indexOf(allInputs[i3]) < 0) dateInputs.push(allInputs[i3]);
        }
      }
    }
    var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    if (dateInputs.length >= 2) {
      setter.call(dateInputs[0], dateFrom); dateInputs[0].dispatchEvent(new Event('change', {bubbles:true}));
      setter.call(dateInputs[1], dateTo); dateInputs[1].dispatchEvent(new Event('change', {bubbles:true}));
    } else if (dateInputs.length === 1) {
      setter.call(dateInputs[0], dateFrom); dateInputs[0].dispatchEvent(new Event('change', {bubbles:true}));
    }
    
    // 조회 버튼 클릭
    var inputs = document.querySelectorAll('input');
    for (var b = 0; b < inputs.length; b++) {
      if ((inputs[b].value || '').trim() === '조회') { inputs[b].click(); return 'input-조회'; }
    }
    var els = document.querySelectorAll('button, a, span, div');
    for (var b2 = 0; b2 < els.length; b2++) {
      if ((els[b2].textContent || '').trim() === '조회') { els[b2].click(); return 'text-조회'; }
    }
    var allEls = document.querySelectorAll('[onclick]');
    for (var b3 = 0; b3 < allEls.length; b3++) {
      var oc = allEls[b3].getAttribute('onclick') || '';
      if (oc.indexOf('doAction') >= 0) { allEls[b3].click(); return 'onclick'; }
    }
    try { if (typeof doAction === 'function') { doAction('search'); return 'doAction'; } } catch(e) {}
    return 'none';
  }, dateFrom, dateTo).catch(function() { return 'error'; });
  
  // 데이터 로딩 대기
  await new Promise(function(r) { setTimeout(r, 6000); });
  
  // XHR 인터셉트 데이터 확인
  var xhrData = await targetFrame.evaluate(function() {
    return window._okposXhrData || [];
  }).catch(function() { return []; });
  
  if (xhrData.length > 0) {
    var valid = xhrData.filter(function(x) { return x.size > 100 && x.data.indexOf('오류발생') < 0; });
    if (valid.length > 0) {
      var best = valid.sort(function(a, b) { return b.size - a.size; })[0];
      log('okpos', '  ✅ ' + tabName + ' XHR: ' + best.size + 'bytes');
      log('okpos', '  XHR 샘플: ' + (best.data || '').substring(0, 200));
      return { ok: true, data: best.data, method: 'xhr', isJSON: false };
    }
  }
  
  // IBSheet 추출
  var ibData = await targetFrame.evaluate(function() {
    var sheetObj = null;
    for (var key in window) {
      try { if (window[key] && typeof window[key].GetTotalRows === 'function') { sheetObj = window[key]; break; } } catch(e) {}
    }
    if (!sheetObj) return { ok: false };
    var totalRows = sheetObj.GetTotalRows();
    if (totalRows === 0) return { ok: true, rows: [], count: 0 };
    var headers = [];
    var colCount = 50; // 시간대별은 컬럼이 많음
    try { colCount = sheetObj.ColCount ? sheetObj.ColCount() : 50; } catch(e) {}
    for (var c = 0; c < colCount; c++) {
      try { var h = sheetObj.GetCellValue(0, c); if (!h) try { h = sheetObj.GetHeaderText(c); } catch(e2) {} headers.push(h || ('col' + c)); } catch(e) { break; }
    }
    var rows = [];
    for (var r = 1; r <= totalRows; r++) {
      var row = {};
      for (var c2 = 0; c2 < headers.length; c2++) {
        try { var val = sheetObj.GetCellValue(r, c2); if (val !== undefined && val !== null && val !== '') row[headers[c2]] = String(val); } catch(e) {}
      }
      if (Object.keys(row).length > 0) rows.push(row);
    }
    return { ok: true, rows: rows, count: totalRows };
  }).catch(function(e) { return { ok: false, error: e.message }; });
  
  if (ibData.ok && ibData.rows && ibData.rows.length > 0) {
    log('okpos', '  ✅ ' + tabName + ' IBSheet: ' + ibData.rows.length + '행');
    return { ok: true, data: JSON.stringify(ibData.rows), method: 'ibsheet', isJSON: true };
  }
  
  // HTML 테이블 추출
  var tableData = await targetFrame.evaluate(function() {
    var tables = document.querySelectorAll('table');
    var best = null, bestRows = 0;
    for (var i = 0; i < tables.length; i++) {
      var trs = tables[i].querySelectorAll('tr');
      if (trs.length > bestRows) { best = tables[i]; bestRows = trs.length; }
    }
    if (!best || bestRows < 2) return { ok: false };
    var trs = best.querySelectorAll('tr');
    var hdrs = [];
    trs[0].querySelectorAll('th, td').forEach(function(th) { hdrs.push(th.textContent.trim()); });
    var rows = [];
    for (var r = 1; r < trs.length; r++) {
      var cells = trs[r].querySelectorAll('td');
      var row = {};
      for (var c = 0; c < cells.length && c < hdrs.length; c++) {
        var v = cells[c].textContent.trim();
        if (v) row[hdrs[c] || ('col' + c)] = v;
      }
      if (Object.keys(row).length > 0) rows.push(row);
    }
    return { ok: rows.length > 0, rows: rows };
  }).catch(function() { return { ok: false }; });
  
  if (tableData.ok && tableData.rows) {
    log('okpos', '  ✅ ' + tabName + ' 테이블: ' + tableData.rows.length + '행');
    return { ok: true, data: JSON.stringify(tableData.rows), method: 'table', isJSON: true };
  }
  
  log('okpos', '  ' + tabName + ' 추출 실패', 'warning');
  return null;
}

// ═══ OKPOS 상품별 매출 크롤링 ═══
async function okposSalesCrawl(dateFrom, dateTo, _retry) {
  var today = new Date().toISOString().split('T')[0];
  dateFrom = dateFrom || today;
  dateTo = dateTo || dateFrom;
  
  log('okpos', '📊 상품별 매출 크롤링: ' + dateFrom + ' ~ ' + dateTo);
  
  var c = STATE.config.okpos;
  if (!c.id || !c.pw) { log('okpos', 'OKPOS ID/PW 미설정', 'warning'); return null; }
  
  try {
    // 로그인
    if (!STATE.sessions.okpos) {
      var loginOk = await okposLogin();
      if (!loginOk) { log('okpos', '로그인 실패', 'error'); return null; }
    }
    var page = STATE.pages.okpos;
    if (!page) { log('okpos', '페이지 없음', 'error'); STATE.sessions.okpos = false; return null; }
    
    try { await page.title(); } catch(tf) {
      STATE.sessions.okpos = false;
      if (_retry) return null;
      return await okposSalesCrawl(dateFrom, dateTo, true);
    }
    
    // "상품별" 메뉴 클릭 → 날짜 설정 → 조회
    var result = await okposNavigateAndQuery(page, '상품별', dateFrom, dateTo);
    
    if (!result || !result.ok) {
      log('okpos', '  데이터 추출 실패', 'warning');
      if (!_retry) {
        STATE.sessions.okpos = false;
        return await okposSalesCrawl(dateFrom, dateTo, true);
      }
      return null;
    }
    
    // 데이터 파싱
    var rows = [];
    if (result.isJSON) {
      try { rows = JSON.parse(result.data); } catch(e) { rows = []; }
    } else {
      rows = parseSheetResponse(result.data);
    }
    log('okpos', '  파싱: ' + rows.length + '행 (방법: ' + result.method + ')');
    
    // 상품별 데이터 정리
    var items = [];
    var curCategory = ''; // 대분류 추적
    rows.forEach(function(r) {
      var name = '', code = '', qty = 0, sales = 0, dc = 0, net = 0, category = '';
      var keys = Object.keys(r);
      keys.forEach(function(k) {
        var v = (r[k] || '').toString().trim();
        var kl = k.toLowerCase();
        if (kl.match(/prod_nm|상품명/) || (kl === 'col5' && v.length > 1 && !v.match(/^\d/))) name = v;
        else if (kl.match(/prod_cd|상품코드/) || kl === 'col1') code = v;
        else if (kl.match(/sale_qty|수량/) || kl === 'col7') qty = parseInt(v.replace(/,/g, '')) || 0;
        else if (kl.match(/tot_sale_amt|총매출/) || kl === 'col8') sales = parseInt(v.replace(/,/g, '')) || 0;
        else if (kl.match(/tot_dc_amt|총할인/) || kl === 'col9') dc = parseInt(v.replace(/,/g, '')) || 0;
        else if (kl.match(/dcm_sale_amt|실매출/) || kl === 'col10') net = parseInt(v.replace(/,/g, '')) || 0;
        // 대분류 캡처 (col2)
        else if (kl.match(/grp_nm|대분류/) || kl === 'col2') {
          if (v && v.length > 1 && !v.match(/^\d+$/) && v !== '소계') category = v;
        }
      });
      // 소계 행에서 대분류 추적
      if (category) curCategory = category;
      if (name && qty > 0) {
        // ★ 0원 상품에 단가 매핑 적용
        var pm = STATE.config.okpos.priceMap || {};
        if (sales === 0 && qty > 0) {
          var mappedPrice = pm[name] || pm[code] || 0;
          if (mappedPrice > 0) {
            sales = mappedPrice * qty;
            net = sales;
          }
        }
        items.push({ product: name, code: code, qty: qty, total_sales: sales, discount: dc, net_sales: net || (sales - dc), unitPrice: (qty > 0 ? Math.round(sales / qty) : 0), isZeroPrice: (sales === 0 && qty > 0), category: curCategory });
      }
    });
    
    var data = {
      dateFrom: dateFrom, dateTo: dateTo, items: items,
      grandTotal: {
        qty: items.reduce(function(a, i) { return a + i.qty; }, 0),
        total_sales: items.reduce(function(a, i) { return a + i.total_sales; }, 0),
        discount: items.reduce(function(a, i) { return a + i.discount; }, 0),
        net_sales: items.reduce(function(a, i) { return a + i.net_sales; }, 0),
      },
    };
    
    log('okpos', '  ✅ 상품별: ' + items.length + '종, ₩' + data.grandTotal.total_sales.toLocaleString() + ' / ' + data.grandTotal.qty + '건', 'success');
    
    STATE.salesData = data;
    STATE.lastSalesCrawl = new Date().toISOString();
    STATE.crawlStatus.okpos = 'connected';
    STATE.sessions.okpos = true;
    if (!STATE._suppressSalesBroadcast) {
      broadcast({ type: 'salesData', data: data });
    }
    
    // ─── 같은 페이지에서 "시간대별" 탭 데이터도 추출 ───
    log('okpos', '📊 시간대별 탭 추출...');
    var timeResult = await okposSwitchTabAndQuery(page, '시간대별', dateFrom, dateTo);
    
    if (timeResult && timeResult.ok) {
      var timeRows = [];
      if (timeResult.isJSON) { try { timeRows = JSON.parse(timeResult.data); } catch(e) {} }
      else { timeRows = parseSheetResponse(timeResult.data); }
      
      log('okpos', '  시간대별 파싱: ' + timeRows.length + '행');
      
      // 디버그: 첫 행의 키 출력
      if (timeRows.length > 0) {
        var firstKeys = Object.keys(timeRows[0]);
        log('okpos', '  시간대별 컬럼: ' + firstKeys.length + '개 → ' + firstKeys.slice(0, 15).join(', ') + (firstKeys.length > 15 ? '...' : ''));
        // 첫 행 값 일부 출력
        var sample = {};
        firstKeys.slice(0, 8).forEach(function(k) { sample[k] = timeRows[0][k]; });
        log('okpos', '  시간대별 샘플: ' + JSON.stringify(sample));
      }
      
      // 시간대별 데이터 구조 분석
      // OKPOS IBSheet 시간대별 컬럼 패턴:
      // 방법1: PROD_CD, PROD_NM, QTY_00~QTY_23, AMT_00~AMT_23
      // 방법2: col0(코드), col1(이름), col2(10시수량), col3(10시매출), col4(11시수량)...
      // 방법3: 상품코드, 상품명, 10시 수량, 10시 매출액, 11시 수량...
      // 방법4: XML attrs like PROD_CD, PROD_NM, S_QTY_10, S_AMT_10...
      
      var hourlyByProduct = [];
      var hourlyTotals = {};
      
      // 컬럼 패턴 자동 감지
      var colKeys = timeRows.length > 0 ? Object.keys(timeRows[0]) : [];
      var hourColMap = {}; // { '10': { qtyKey: 'xxx', salesKey: 'yyy' }, ... }
      var codeKey = '', nameKey = '';
      
      colKeys.forEach(function(k) {
        var kl = k.toLowerCase();
        // 코드/이름 키 감지
        if (kl.match(/prod_cd|상품코드/) || kl === 'col0') codeKey = codeKey || k;
        if (kl.match(/prod_nm|상품명/) || kl === 'col1') nameKey = nameKey || k;
        
        // 시간 패턴 감지
        // 패턴A: QTY_10, AMT_10, S_QTY_10, SALE_QTY_10 등
        var pA = kl.match(/(?:s_)?(?:sale_)?qty[_]?(\d{1,2})/);
        if (pA) {
          var hr = pA[1].padStart(2, '0');
          if (!hourColMap[hr]) hourColMap[hr] = {};
          hourColMap[hr].qtyKey = k;
        }
        var pB = kl.match(/(?:s_)?(?:sale_)?amt[_]?(\d{1,2})/);
        if (pB) {
          var hr2 = pB[1].padStart(2, '0');
          if (!hourColMap[hr2]) hourColMap[hr2] = {};
          hourColMap[hr2].salesKey = k;
        }
        
        // 패턴B: "10시 수량", "10시 매출액"
        var pC = k.match(/(\d{1,2})시?\s*(수량|매출)/);
        if (pC) {
          var hr3 = pC[1].padStart(2, '0');
          if (!hourColMap[hr3]) hourColMap[hr3] = {};
          if (pC[2] === '수량') hourColMap[hr3].qtyKey = k;
          else hourColMap[hr3].salesKey = k;
        }
        
        // 패턴C: 10_qty, 10_amt 등
        var pD = kl.match(/^(\d{1,2})[_\s]?(qty|amt|수량|매출)/);
        if (pD) {
          var hr4 = pD[1].padStart(2, '0');
          if (!hourColMap[hr4]) hourColMap[hr4] = {};
          if (pD[2].match(/qty|수량/)) hourColMap[hr4].qtyKey = k;
          else hourColMap[hr4].salesKey = k;
        }
      });
      
      log('okpos', '  시간대별 컬럼매핑: code=' + codeKey + ' name=' + nameKey + ' 시간=' + Object.keys(hourColMap).length + '개');
      if (Object.keys(hourColMap).length > 0) {
        var first3 = Object.keys(hourColMap).sort().slice(0, 3);
        first3.forEach(function(hr) { log('okpos', '    ' + hr + '시: qty=' + (hourColMap[hr].qtyKey || '?') + ' sales=' + (hourColMap[hr].salesKey || '?')); });
      }
      
      // 패턴D: 위치 기반 (헤더가 없거나 col 인덱스인 경우)
      // 시간대별 탭: col0=코드, col1=이름, 그 후 매 2컬럼씩 (수량, 매출액) 반복
      if (Object.keys(hourColMap).length === 0 && colKeys.length > 4) {
        log('okpos', '  시간대별: 위치 기반 파싱 시도');
        
        // OKPOS 시간대별 그리드 구조:
        // 상품코드 | 상품명 | 00시수량 | 00시매출 | 01시수량 | 01시매출 | ... | 23시수량 | 23시매출
        // 시작 시간 판단: 헤더에서 숫자 확인
        var startHour = 0;
        var startCol = 2;
        
        // 헤더에 시간 정보가 있는지 확인 (ex: "10시" 가 포함된 키)
        for (var si = 0; si < colKeys.length; si++) {
          var hm = colKeys[si].match(/(\d{1,2})시/);
          if (hm) {
            startHour = parseInt(hm[1]);
            startCol = si;
            break;
          }
        }
        
        // 위치 기반: startCol부터 2개씩 묶어서 시간대 매핑
        var hourIdx = startHour;
        for (var ci = startCol; ci < colKeys.length - 1; ci += 2) {
          var hr5 = String(hourIdx).padStart(2, '0');
          hourColMap[hr5] = { qtyKey: colKeys[ci], salesKey: colKeys[ci + 1] };
          hourIdx++;
          if (hourIdx >= 24) break;
        }
        
        log('okpos', '  위치기반 매핑: ' + Object.keys(hourColMap).length + '개 시간대 (시작: ' + startHour + '시, col' + startCol + ')');
      }
      
      // 데이터 추출
      timeRows.forEach(function(r) {
        var code = (r[codeKey] || '').toString().trim();
        var name = (r[nameKey] || '').toString().trim();
        
        // 코드/이름이 못잡히면 첫 2개 값 사용
        if (!name) {
          var vals = Object.values(r);
          if (vals.length >= 2) {
            code = code || (vals[0] || '').toString().trim();
            name = (vals[1] || '').toString().trim();
          }
        }
        
        // "소계", "합계" 행 스킵
        if (!name || name.match(/^소계|^합계|^소 계|^합 계/) || code.match(/^소계|^합계/)) return;
        
        var hours = {};
        Object.keys(hourColMap).forEach(function(hr) {
          var map = hourColMap[hr];
          var qty = map.qtyKey ? (parseInt((r[map.qtyKey] || '0').toString().replace(/,/g, '')) || 0) : 0;
          var sales = map.salesKey ? (parseInt((r[map.salesKey] || '0').toString().replace(/,/g, '')) || 0) : 0;
          if (qty > 0 || sales > 0) {
            hours[hr] = { qty: qty, sales: sales };
          }
        });
        
        if (name && Object.keys(hours).length > 0) {
          hourlyByProduct.push({ code: code, product: name, hours: hours });
          
          Object.keys(hours).forEach(function(hr) {
            if (!hourlyTotals[hr]) hourlyTotals[hr] = { qty: 0, sales: 0 };
            hourlyTotals[hr].qty += hours[hr].qty;
            hourlyTotals[hr].sales += hours[hr].sales;
          });
        }
      });
      
      // hourly 배열로 변환
      var hourlyArray = Object.keys(hourlyTotals).sort().map(function(hr) {
        return { hour: hr, qty: hourlyTotals[hr].qty, sales: hourlyTotals[hr].sales, net_sales: hourlyTotals[hr].sales };
      });
      
      var timeGrandTotal = {
        qty: hourlyArray.reduce(function(a, h) { return a + h.qty; }, 0),
        total_sales: hourlyArray.reduce(function(a, h) { return a + h.sales; }, 0),
        net_sales: hourlyArray.reduce(function(a, h) { return a + h.sales; }, 0),
      };
      
      var timeSalesData = {
        hourly: hourlyArray,
        hourly_by_product: hourlyByProduct,
        daily_detail: [],
        grand_total: timeGrandTotal,
        crawled_at: new Date().toISOString(),
      };
      
      log('okpos', '  ✅ 시간대별: ' + hourlyArray.length + '개 시간대, ₩' + timeGrandTotal.total_sales.toLocaleString() + ' / ' + timeGrandTotal.qty + '건', 'success');
      
      STATE.timeSalesData = timeSalesData;
      if (!STATE._suppressSalesBroadcast) {
        broadcast({ type: 'timeSalesData', data: timeSalesData });
      }
    } else {
      log('okpos', '  시간대별 탭 추출 실패 (상품별은 정상)', 'warning');
    }
    
    return data;
  } catch(e) {
    log('okpos', '매출 크롤링 오류: ' + e.message, 'error');
    STATE.sessions.okpos = false;
    return null;
  }
}

// ═══ OKPOS 시간대별 매출 크롤링 ═══
async function okposTimeSalesCrawl(dateFrom, dateTo, _retry) {
  dateFrom = dateFrom || new Date().toISOString().split('T')[0];
  dateTo = dateTo || dateFrom;
  
  // okposSalesCrawl이 이제 시간대별도 함께 크롤링함
  log('okpos', '📊 시간대별 크롤링 요청: ' + dateFrom + ' ~ ' + dateTo);
  
  // 이미 오늘 크롤링된 데이터가 있으면 재사용
  if (STATE.timeSalesData && STATE.timeSalesData.crawled_at) {
    var crawledDate = STATE.timeSalesData.crawled_at.split('T')[0];
    var now = new Date().toISOString().split('T')[0];
    if (crawledDate === now) {
      log('okpos', '  이미 크롤링됨: ' + (STATE.timeSalesData.hourly || []).length + '개 시간대', 'success');
      return STATE.timeSalesData;
    }
  }
  
  // 상품별 크롤링 실행 (시간대별도 함께 추출됨)
  await okposSalesCrawl(dateFrom, dateTo, _retry);
  
  return STATE.timeSalesData || null;
}

// ═══ 일일 마감 엑셀 생성 (POS 데이터 → 템플릿 매핑) ═══
async function generateDailyExcel(dateStr, clientItems, tableData) {
  var fs = require('fs');
  var path = require('path');
  var cp = require('child_process');
  
  dateStr = dateStr || new Date().toISOString().split('T')[0];
  tableData = tableData || [];
  
  // 데이터 소스 결정
  var salesItems = null;
  if (tableData && tableData.length > 0) {
    salesItems = tableData;
    log('okpos', '엑셀: 화면 테이블 데이터 사용 (' + salesItems.length + '건, 섹션별 매핑)');
  } else if (clientItems && clientItems.length > 0) {
    salesItems = clientItems;
    log('okpos', '엑셀: 클라이언트 POS 데이터 사용 (' + salesItems.length + '건)');
  } else if (STATE.salesData && STATE.salesData.items && STATE.salesData.items.length > 0 && STATE.salesData.dateFrom === dateStr) {
    salesItems = STATE.salesData.items;
    log('okpos', '엑셀: 캐시 데이터 사용 (' + salesItems.length + '건)');
  } else {
    log('okpos', '엑셀: 데이터 없음 → 크롤링 시도');
    await okposSalesCrawl(dateStr, dateStr);
    if (STATE.salesData && STATE.salesData.items) salesItems = STATE.salesData.items;
  }
  
  if (!salesItems || salesItems.length === 0) {
    return { ok: false, error: '매출 데이터가 없습니다.' };
  }
  
  // Python 스크립트로 엑셀 생성
  var templatePath = path.join(__dirname, 'public', 'template_daily.xlsx');
  var outputPath = path.join(__dirname, 'public', 'daily_' + dateStr + '.xlsx');
  
  if (!fs.existsSync(templatePath)) {
    return { ok: false, error: '템플릿 파일(template_daily.xlsx)이 없습니다' };
  }
  
  var salesJson = JSON.stringify(salesItems);
  var pyScript = `# -*- coding: utf-8 -*-
import openpyxl, json, sys, re
from openpyxl.styles import PatternFill, Font, Alignment, Border, Side
from datetime import datetime

template_path = sys.argv[1]
output_path = sys.argv[2]
date_str = sys.argv[3]
json_path = sys.argv[4]

with open(json_path, 'r', encoding='utf-8') as f:
    items = json.load(f)

wb = openpyxl.load_workbook(template_path)
ws = wb['기본양식']

# 날짜 입력
try:
    ws.cell(4, 3).value = datetime.strptime(date_str, '%Y-%m-%d')
except:
    ws.cell(4, 3).value = date_str

# ═══ 1단계: 템플릿 구조 파악 ═══
KNOWN_SECTIONS = {'매표', '매 점', '매점', '누에쉼터', '단체식당', '양떼정원', '체 험', '체험', '소 계', '총 계', '특이사항', '실입장객', '단체'}

section_product_map = {}
product_map = {}
cur_section = ''
section_rows = {}  # 섹션별 행 범위

for r in range(6, ws.max_row + 1):
    b = ws.cell(r, 2).value
    d = ws.cell(r, 4).value
    if b and str(b).strip():
        raw = str(b).strip().replace(chr(10), ' ')
        base = raw.split('(')[0].strip() if '(' in raw else raw
        if base in KNOWN_SECTIONS or len(raw) <= 10:
            cur_section = raw
            if cur_section not in section_rows:
                section_rows[cur_section] = {'start': r, 'end': r}
    if cur_section and cur_section in section_rows:
        section_rows[cur_section]['end'] = r
    if d and str(d).strip():
        name = str(d).strip()
        key = cur_section + '|' + name
        section_product_map[key] = r
        if name not in product_map:
            product_map[name] = []
        product_map[name].append(r)

# ═══ 2단계: 기존 데이터 초기화 ═══
for r in range(6, ws.max_row + 1):
    d = ws.cell(r, 4).value
    if d and str(d).strip():
        ws.cell(r, 5).value = None  # 실입장객
        ws.cell(r, 6).value = None  # 카드 결제
        ws.cell(r, 7).value = None  # (비고)
        h = ws.cell(r, 8)
        if not (h.value and str(h.value).startswith('=')):
            h.value = None  # 매출합계

# ═══ 3단계: 섹션명 정규화 ═══
SEC_NORMALIZE = {}
for sec_key in section_product_map.keys():
    sec_name = sec_key.split('|')[0]
    norm = re.sub(r'\\s+', '', sec_name)
    SEC_NORMALIZE[norm] = sec_name

def normalize_section(s):
    if not s: return ''
    norm = re.sub(r'\\s+', '', s)
    if norm in SEC_NORMALIZE: return SEC_NORMALIZE[norm]
    for k, v in SEC_NORMALIZE.items():
        if k in norm or norm in k: return v
    return s

def clean(s):
    return re.sub(r'[()\\[\\]_\\-\\s]', '', s).lower()

def find_row(product_name, section=''):
    pn = product_name.strip()
    sec_norm = normalize_section(section)
    
    # 1) 섹션+상품명 정확 매칭
    if sec_norm:
        key = sec_norm + '|' + pn
        if key in section_product_map: return section_product_map[key]
    
    # 2) 상품명만 정확 매칭
    if pn in product_map:
        rows = product_map[pn]
        if len(rows) == 1: return rows[0]
        if sec_norm:
            for row in rows:
                for key, r in section_product_map.items():
                    if r == row and key.startswith(sec_norm): return row
        return rows[0]
    
    # 3) 공백/특수문자 제거 후 비교
    pn_clean = clean(pn)
    for name, rows in product_map.items():
        if clean(name) == pn_clean:
            return rows[0]
    
    # 4) 부분 매칭 (3글자+)
    if len(pn) >= 3:
        for name, rows in product_map.items():
            if len(name) >= 3 and (name in pn or pn in name):
                return rows[0]
    return None

# ═══ 4단계: 데이터 매핑 ═══
matched = 0
unmatched = []
unmatched_items = []
debug_log = []

for item in items:
    section = item.get('section', item.get('category', ''))
    product = item.get('product', '')
    qty = item.get('qty', 0)
    sales = item.get('sales', item.get('total_sales', 0))
    if not product: continue
    if qty == 0 and sales == 0: continue
    
    row = find_row(product, section)
    if row:
        # 수량 누적
        cur_qty = ws.cell(row, 6).value
        ws.cell(row, 6).value = (cur_qty if isinstance(cur_qty, (int, float)) else 0) + qty
        # 매출 누적 (수식이면 건너뜀)
        h_cell = ws.cell(row, 8)
        if h_cell.value and str(h_cell.value).startswith('='):
            pass
        else:
            cur_amt = h_cell.value
            h_cell.value = (cur_amt if isinstance(cur_amt, (int, float)) else 0) + sales
        matched += 1
        debug_log.append('OK ' + section + '|' + product + ' -> row' + str(row))
    else:
        unmatched.append(product)
        unmatched_items.append(item)
        debug_log.append('MISS ' + section + '|' + product)

# ═══ 5단계: 미매칭 상품 → 섹션 빈 행에 배치 ═══
SEC_NAME_TO_ID = {
    '매표(입장)': 'ticket', '매표 (입장)': 'ticket',
    '매 점': 'shop', '매점': 'shop',
    '누에쉼터': 'rest', '단체식당': 'food',
    '양떼정원': 'sheep', '체 험': 'exp', '체험': 'exp',
    '기타': 'rest', '단체': 'ticket2',
}

# 섹션별 행 범위 (템플릿 구조에서 감지)
SEC_ROW_RANGES = {}
for sec_name, info in section_rows.items():
    norm = re.sub(r'\\s+', '', sec_name)
    for k, v in SEC_NAME_TO_ID.items():
        if re.sub(r'\\s+', '', k) == norm:
            SEC_ROW_RANGES[v] = (info['start'], info['end'])
            break

# 수동 범위 폴백
if 'ticket' not in SEC_ROW_RANGES: SEC_ROW_RANGES['ticket'] = (6, 25)
if 'shop' not in SEC_ROW_RANGES: SEC_ROW_RANGES['shop'] = (27, 45)
if 'rest' not in SEC_ROW_RANGES: SEC_ROW_RANGES['rest'] = (47, 83)
if 'food' not in SEC_ROW_RANGES: SEC_ROW_RANGES['food'] = (85, 109)
if 'exp' not in SEC_ROW_RANGES: SEC_ROW_RANGES['exp'] = (112, 169)

still_unmatched = []

for item in unmatched_items:
    sec = item.get('section', item.get('category', ''))
    product = item.get('product', '')
    qty = item.get('qty', 0)
    sales = item.get('sales', item.get('total_sales', 0))
    
    # 섹션 ID 결정
    norm_sec = re.sub(r'\\s+', '', sec)
    sec_id = None
    for k, v in SEC_NAME_TO_ID.items():
        if re.sub(r'\\s+', '', k) == norm_sec:
            sec_id = v
            break
    if not sec_id:
        for k, v in SEC_NAME_TO_ID.items():
            if norm_sec and (norm_sec in re.sub(r'\\s+', '', k) or re.sub(r'\\s+', '', k) in norm_sec):
                sec_id = v
                break
    
    rng = SEC_ROW_RANGES.get(sec_id)
    placed = False
    
    if rng:
        for r2 in range(rng[0], rng[1] + 1):
            if not ws.cell(r2, 4).value:
                ws.cell(r2, 4).value = product
                ws.cell(r2, 6).value = qty
                h2 = ws.cell(r2, 8)
                if not (h2.value and str(h2.value).startswith('=')):
                    h2.value = sales
                matched += 1
                if product in unmatched: unmatched.remove(product)
                debug_log.append('ADD ' + sec + '|' + product + ' -> row' + str(r2))
                placed = True
                break
    
    if not placed:
        still_unmatched.append(item)

# ═══ 6단계: 최종 미매칭 → 시트 하단에 강제 추가 (절대 누락 없음) ═══
if still_unmatched:
    # 총계 행 찾기
    total_row = ws.max_row
    for r4 in range(6, ws.max_row + 1):
        b4 = ws.cell(r4, 2).value
        if b4 and '총 계' in str(b4):
            total_row = r4
            break
    
    # 총계 아래에 미매칭 상품 추가
    add_row = total_row + 2
    
    # 헤더
    ws.cell(add_row, 2).value = '추가항목'
    ws.cell(add_row, 2).font = Font(bold=True, color='FF6600')
    add_row += 1
    
    yellow_fill = PatternFill(start_color='FFFFF0', end_color='FFFFF0', fill_type='solid')
    thin_border = Border(
        left=Side(style='thin'), right=Side(style='thin'),
        top=Side(style='thin'), bottom=Side(style='thin')
    )
    
    add_total_qty = 0
    add_total_sales = 0
    
    for item in still_unmatched:
        product = item.get('product', '')
        qty = item.get('qty', 0)
        sales = item.get('sales', item.get('total_sales', 0))
        sec = item.get('section', '')
        
        ws.cell(add_row, 3).value = sec
        ws.cell(add_row, 4).value = product
        ws.cell(add_row, 6).value = qty
        ws.cell(add_row, 8).value = sales
        
        # 노란색 배경 + 테두리
        for col in range(2, 9):
            ws.cell(add_row, col).fill = yellow_fill
            ws.cell(add_row, col).border = thin_border
        ws.cell(add_row, 4).font = Font(bold=True, color='FF6600')
        
        add_total_qty += qty
        add_total_sales += sales
        matched += 1
        if product in unmatched: unmatched.remove(product)
        debug_log.append('BOTTOM ' + sec + '|' + product + ' -> row' + str(add_row))
        add_row += 1
    
    # 추가항목 소계
    if add_total_sales > 0:
        ws.cell(add_row, 4).value = '추가항목 소계'
        ws.cell(add_row, 4).font = Font(bold=True)
        ws.cell(add_row, 6).value = add_total_qty
        ws.cell(add_row, 8).value = add_total_sales
        ws.cell(add_row, 8).font = Font(bold=True, color='FF6600')
        for col in range(2, 9):
            ws.cell(add_row, col).border = thin_border

# ═══ 7단계: 검증 ═══
verify_total = 0
for item in items:
    verify_total += item.get('sales', item.get('total_sales', 0))

wb.save(output_path)
result = {
    'matched': matched, 'unmatched': unmatched[:20], 'total': len(items),
    'still_unmatched': len(still_unmatched),
    'debug': debug_log[:50], 'verify_total': verify_total
}
print(json.dumps(result, ensure_ascii=False))
`;
  
  var pyPath = path.join(__dirname, '_gen_excel.py');
  var jsonPath = path.join(__dirname, '_sales_data.json');
  fs.writeFileSync(pyPath, pyScript, 'utf8');
  fs.writeFileSync(jsonPath, salesJson, 'utf8');
  
  return new Promise(function(resolve) {
    function handlePyOutput(err, stdout, stderr) {
      if (err) {
        log('okpos', '엑셀 생성 오류: ' + (stderr || err.message), 'error');
        resolve({ ok: false, error: err.message });
        return;
      }
      try {
        var result = JSON.parse(stdout.trim());
        log('okpos', '✅ 엑셀 생성: ' + result.matched + '/' + result.total + '건 매칭, 미매칭: ' + result.unmatched.length + '건', 'success');
        if (result.debug) {
          result.debug.forEach(function(d) { log('okpos', '  ' + d); });
        }
        if (result.unmatched.length > 0) log('okpos', '  미매칭: ' + result.unmatched.join(', '), 'warning');
        if (result.unmatched.length > 0) {
          log('okpos', '  미매칭 상품: ' + result.unmatched.join(', '), 'warning');
        }
        resolve({ ok: true, path: outputPath, filename: 'daily_' + dateStr + '.xlsx', matched: result.matched, total: result.total, unmatched: result.unmatched, debug: result.debug || [] });
      } catch(pe) {
        log('okpos', '엑셀 결과 파싱 오류: ' + stdout, 'warning');
        resolve({ ok: fs.existsSync(outputPath), path: outputPath, filename: 'daily_' + dateStr + '.xlsx' });
      }
    }
    
    var args = ' "' + pyPath + '" "' + templatePath + '" "' + outputPath + '" "' + dateStr + '" "' + jsonPath + '"';
    var opts = { maxBuffer: 10 * 1024 * 1024, env: Object.assign({}, process.env, { PYTHONIOENCODING: 'utf-8' }) };
    
    // Windows: python 먼저 시도, Mac/Linux: python3
    var pyCmd = process.platform === 'win32' ? 'python' : 'python3';
    log('okpos', '📊 엑셀 생성 (' + pyCmd + ')...');
    
    cp.exec(pyCmd + args, opts, function(err, stdout, stderr) {
      if (err) {
        // 첫번째 시도 실패시 다른 명령어로 재시도
        var fallback = process.platform === 'win32' ? 'python3' : 'python';
        log('okpos', '  ' + pyCmd + ' 실패, ' + fallback + ' 재시도...');
        cp.exec(fallback + args, opts, function(err2, stdout2, stderr2) {
          if (err2) {
            log('okpos', '❌ Python 실행 실패: ' + (stderr2 || err2.message || '알 수 없는 오류'), 'error');
            resolve({ ok: false, error: 'Python 실행 실패: ' + (stderr2 || err2.message || 'Python 미설치 또는 openpyxl 미설치. pip install openpyxl 실행 필요') });
            return;
          }
          handlePyOutput(null, stdout2, stderr2);
        });
        return;
      }
      handlePyOutput(null, stdout, stderr);
    });
  });
}

// ── IBSheet 응답 파싱 헬퍼 (XML/Pipe/JSON) ──
function parseSheetResponse(rawData) {
  var rows = [];
  var data = rawData.replace(/^\uFEFF/, ''); // BOM 제거
  
  // 1) XML 파싱
  var xmlRowRegex = /<Row\s+([^>]+)\/?\s*>/gi;
  var xmlMatch;
  while ((xmlMatch = xmlRowRegex.exec(data)) !== null) {
    var attrs = {};
    var attrRegex = /(\w+)=["']([^"']*)["']/g;
    var am;
    while ((am = attrRegex.exec(xmlMatch[1])) !== null) { attrs[am[1]] = am[2]; }
    if (Object.keys(attrs).length > 0) rows.push(attrs);
  }
  if (rows.length > 0) return rows;
  
  // 2) Pipe 파싱
  var lines = data.split('\n').filter(function(l) { return l.indexOf('|') >= 0; });
  if (lines.length >= 2) {
    var headers = lines[0].split('|');
    for (var li = 1; li < lines.length; li++) {
      var vals = lines[li].split('|');
      if (vals.length >= headers.length * 0.5) {
        var row = {};
        for (var hi = 0; hi < headers.length && hi < vals.length; hi++) {
          row[headers[hi].trim()] = vals[hi].trim();
        }
        rows.push(row);
      }
    }
    if (rows.length > 0) return rows;
  }
  
  // 3) JSON 파싱
  try {
    var json = JSON.parse(data);
    var arr = json.Data || json.data || json.rows || (Array.isArray(json) ? json : []);
    if (Array.isArray(arr) && arr.length > 0) return arr;
  } catch(je) {}
  
  return rows;
}

// ── OKPOS HTTP 헬퍼 ──
function okposHttpGet(urlPath, _depth) {
  _depth = _depth || 0;
  return new Promise(function(resolve, reject) {
    var req = https.request({
      hostname: 'nice.okpos.co.kr', port: 443,
      path: urlPath, method: 'GET',
      headers: {
        'Cookie': STATE._okposCookies || '',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://nice.okpos.co.kr/login/top_frame.jsp',
      },
      timeout: 15000,
    }, function(res) {
      var sc = res.headers['set-cookie'];
      if (sc) {
        var existing = {};
        (STATE._okposCookies || '').split('; ').forEach(function(c) { var p = c.split('='); if (p[0]) existing[p[0]] = p.slice(1).join('='); });
        sc.forEach(function(c) { var p = c.split(';')[0].split('='); if (p[0]) existing[p[0].trim()] = p.slice(1).join('='); });
        STATE._okposCookies = Object.keys(existing).map(function(k) { return k + '=' + existing[k]; }).join('; ');
      }
      // ★ 302/301 redirect 자동 follow
      if ((res.statusCode === 302 || res.statusCode === 301) && res.headers.location && _depth < 5) {
        var rPath = (res.headers.location || '').replace('https://nice.okpos.co.kr', '').replace('http://nice.okpos.co.kr', '');
        if (rPath.indexOf('/') !== 0) rPath = '/' + rPath;
        res.resume();
        return okposHttpGet(rPath, _depth + 1).then(resolve).catch(reject);
      }
      var chunks = [];
      res.on('data', function(ch) { chunks.push(ch); });
      res.on('end', function() { resolve(Buffer.concat(chunks).toString('utf8')); });
    });
    req.on('error', function() { resolve(''); });
    req.on('timeout', function() { req.destroy(); resolve(''); });
    req.end();
  });
}

// ═══ POS ↔ 티켓 시간대별 대조 + 카톡 알림 ═══
async function posTicketCompare(forceAlert) {
  try {
    var today = new Date().toISOString().split('T')[0];
    var now = new Date();
    var curHour = now.getHours();
    
    // 운영시간 외 스킵 (09~18시)
    if (curHour < 9 || curHour > 18) return;
    
    log('system', '📊 POS↔티켓 대조 시작...');
    
    // ═══ 1) OKPOS 매출 데이터 (내부 STATE 사용, 없으면 크롤링) ═══
    var posData = STATE.salesData;
    if (!posData || !posData.grand_total || posData.grand_total.qty === 0) {
      log('system', '  매출 데이터 없음 → 크롤링 시도...');
      posData = await okposSalesCrawl();
    }
    // 폴백: OKPOS 서버(localhost:5000)에서 가져오기
    if (!posData || !posData.grand_total || posData.grand_total.qty === 0) {
      try {
        posData = await new Promise(function(resolve) {
          var req = require('http').get('http://localhost:5000/api/sales', function(res) {
            var body = '';
            res.on('data', function(chunk) { body += chunk; });
            res.on('end', function() {
              try { resolve(JSON.parse(body)); } catch(e) { resolve(null); }
            });
          });
          req.on('error', function() { resolve(null); });
          req.setTimeout(3000, function() { req.destroy(); resolve(null); });
        });
      } catch(e) { posData = null; }
    }
    
    if (!posData || posData.error) {
      log('system', '  POS 데이터 없음 (OKPOS 서버 미실행 또는 미크롤링)');
      return;
    }
    
    // ═══ 2) POS 품목별 수량 추출 ═══
    var posItems = {};  // { "상품명": qty }
    var posTotalQty = 0;
    var posTotalSales = 0;
    
    (posData.categories || []).forEach(function(cat) {
      (cat.items || []).forEach(function(item) {
        var name = item.product || item.name || '';
        var qty = item.qty || 0;
        var sales = item.total_sales || 0;
        if (qty > 0) {
          posItems[name] = (posItems[name] || 0) + qty;
          posTotalQty += qty;
          posTotalSales += sales;
        }
      });
    });
    
    // ═══ 3) 크롤링 티켓 데이터 집계 ═══
    var ticketUsed = 0;      // 사용완료 티켓 수
    var ticketUsedQty = 0;   // 사용완료 매수
    var ticketAvail = 0;     // 사용가능 티켓 수
    var ticketAvailQty = 0;  // 사용가능 매수
    var ticketTotal = 0;     // 전체 티켓 수
    var ticketTotalQty = 0;  // 전체 매수
    var optionUsedQty = 0;   // 옵션 사용완료 매수
    
    // 시간대별 집계
    var hourlyUsed = {};     // { "10": 5, "11": 3 }
    var hourlyPOS = {};      // POS 매출 이력에서 시간대별
    
    STATE.tickets.forEach(function(t) {
      if (t.isOption) {
        if (t.status === '사용완료') optionUsedQty += (t.qty || 1);
        return; // 옵션은 별도 집계
      }
      var tkDate = (t.useDate || t.bookDate || '').substring(0, 10);
      if (tkDate !== today) return;
      
      ticketTotal++;
      ticketTotalQty += (t.qty || 1);
      
      if (t.status === '사용완료' || t.status === '부분사용') {
        ticketUsed++;
        ticketUsedQty += (t.qty || 1);
        
        // 사용 시간대 집계
        if (t.usedAt) {
          var h = new Date(t.usedAt).getHours();
          var hk = String(h).padStart(2, '0');
          hourlyUsed[hk] = (hourlyUsed[hk] || 0) + (t.qty || 1);
        }
      } else if (t.status === '사용가능' || t.status === '확정') {
        ticketAvail++;
        ticketAvailQty += (t.qty || 1);
      }
    });
    
    // POS 매출 이력 시간대별
    STATE.posLog.forEach(function(p) {
      var pDate = (p.time || '').substring(0, 10);
      if (pDate !== today) return;
      var h = new Date(p.time).getHours();
      var hk = String(h).padStart(2, '0');
      hourlyPOS[hk] = (hourlyPOS[hk] || 0) + (p.qty || 1);
    });
    
    // ═══ 4) 대조 ═══
    var mismatches = [];
    
    // 전체 수량 비교: POS 총판매 vs 프로그램 사용완료
    var posSaleQty = posTotalQty;
    var progUsedQty = ticketUsedQty + optionUsedQty;
    
    if (posSaleQty !== progUsedQty) {
      mismatches.push({
        type: '전체',
        pos: posSaleQty,
        prog: progUsedQty,
        diff: posSaleQty - progUsedQty,
      });
    }
    
    // 입장권 관련 품목 비교
    var posEntrance = 0;  // POS에서 입장권류
    Object.keys(posItems).forEach(function(name) {
      if (name.indexOf('입장') >= 0 || name.indexOf('종일') >= 0 || name.indexOf('어른') >= 0 || name.indexOf('어린이') >= 0 || name.indexOf('플레이') >= 0) {
        posEntrance += posItems[name];
      }
    });
    
    if (posEntrance > 0 && Math.abs(posEntrance - ticketUsedQty) > 0) {
      mismatches.push({
        type: '입장권',
        pos: posEntrance,
        prog: ticketUsedQty,
        diff: posEntrance - ticketUsedQty,
      });
    }
    
    // 시간대별 비교
    var hourlyMismatch = [];
    var allHours = {};
    Object.keys(hourlyUsed).forEach(function(h) { allHours[h] = true; });
    Object.keys(hourlyPOS).forEach(function(h) { allHours[h] = true; });
    
    Object.keys(allHours).sort().forEach(function(h) {
      var usedH = hourlyUsed[h] || 0;
      var posH = hourlyPOS[h] || 0;
      if (usedH !== posH) {
        hourlyMismatch.push({ hour: h, used: usedH, pos: posH, diff: posH - usedH });
      }
    });
    
    // ═══ 5) 결과 저장 ═══
    STATE.lastPosCompare = {
      time: now.toISOString(),
      posTotalQty: posTotalQty,
      posTotalSales: posTotalSales,
      posItems: posItems,
      ticketUsedQty: ticketUsedQty,
      ticketAvailQty: ticketAvailQty,
      ticketTotalQty: ticketTotalQty,
      optionUsedQty: optionUsedQty,
      mismatches: mismatches,
      hourlyMismatch: hourlyMismatch,
      hourlyUsed: hourlyUsed,
      hourlyPOS: hourlyPOS,
      match: mismatches.length === 0,
    };
    
    broadcast({ type: 'posCompare', data: STATE.lastPosCompare });
    
    var matchStr = mismatches.length === 0 ? '✅ 일치' : '⚠️ 불일치 ' + mismatches.length + '건';
    log('system', '📊 POS↔티켓 대조: POS=' + posTotalQty + '건 / 프로그램=' + progUsedQty + '건(사용) + ' + ticketAvailQty + '건(대기) → ' + matchStr, mismatches.length > 0 ? 'warning' : 'success');
    
    // ═══ 6) 카카오톡 알림 (불일치 시 또는 수동 요청 시) ═══
    var shouldAlert = forceAlert || mismatches.length > 0 || hourlyMismatch.length > 0;
    
    if (shouldAlert) {
      var msg = '';
      if (mismatches.length > 0 || hourlyMismatch.length > 0) {
        msg = '⚠️ [잠사박물관 POS↔티켓 불일치]\n';
      } else {
        msg = '✅ [잠사박물관 POS↔티켓 대조]\n';
      }
      msg += '📅 ' + today + ' ' + String(curHour).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0') + ' 기준\n';
      msg += '━━━━━━━━━━━━━━━\n';
      
      if (mismatches.length > 0) {
        msg += '⚠️ 수량 불일치!\n';
        mismatches.forEach(function(m) {
          var arrow = m.diff > 0 ? '↑' + m.diff : '↓' + Math.abs(m.diff);
          msg += '• ' + m.type + ': POS ' + m.pos + '건 / 프로그램 ' + m.prog + '건 (' + arrow + ')\n';
        });
        msg += '\n';
      }
      
      // 시간대별 현황 (항상 포함)
      msg += '📊 시간대별 현황\n';
      var allH = {};
      Object.keys(hourlyUsed).forEach(function(h) { allH[h] = true; });
      Object.keys(hourlyPOS).forEach(function(h) { allH[h] = true; });
      Object.keys(allH).sort().forEach(function(h) {
        var uH = hourlyUsed[h] || 0;
        var pH = hourlyPOS[h] || 0;
        var mark = uH !== pH ? '⚠' : '✓';
        msg += '  ' + h + '시: 프로그램 ' + uH + '건 / POS ' + pH + '건 ' + mark + '\n';
      });
      
      msg += '\n📋 요약\n';
      msg += '• POS 총판매: ' + posTotalQty + '건 (' + posTotalSales.toLocaleString() + '원)\n';
      msg += '• 프로그램 사용완료: ' + ticketUsedQty + '건\n';
      msg += '• 프로그램 대기중: ' + ticketAvailQty + '건\n';
      if (optionUsedQty > 0) msg += '• 옵션 사용: ' + optionUsedQty + '건\n';
      
      // POS 품목별 상세
      var posKeys = Object.keys(posItems);
      if (posKeys.length > 0) {
        msg += '\n🛒 POS 품목별\n';
        posKeys.forEach(function(k) {
          msg += '  • ' + k + ': ' + posItems[k] + '건\n';
        });
      }
      
      msg += '\n🏢 한국잠사박물관 통합 시스템';
      
      // 카카오톡 전송
      log('system', '📱 카카오톡 알림 전송 시도...');
      try {
        var kakaoOk = await sendKakaoPC(msg);
        if (kakaoOk) {
          log('system', '✅ 카카오톡 알림 전송 완료', 'success');
        } else {
          log('system', '⚠️ 카카오톡 전송 실패', 'warning');
        }
      } catch(ke) {
        log('system', '카카오톡 전송 오류: ' + ke.message, 'error');
      }
    } else {
      log('system', '📊 POS↔티켓 일치 → 카톡 생략');
    }
    
  } catch(e) {
    log('system', 'POS 대조 오류: ' + e.message, 'warning');
  }
}

// ═══ 크롤 후 사용처리 동기화 검증 ═══
async function verifyTicketSync() {
  var today = new Date().toISOString().split('T')[0];
  
  // 오늘 날짜 티켓 중 확인 대상 추출
  var toVerify = STATE.tickets.filter(function(t) {
    if (t.isOption) return false;  // 옵션 티켓 제외
    if (t.source !== 'naver') return false;  // 네이버만
    if (!t.orderNo) return false;
    var tkDate = (t.useDate || t.bookDate || '').substring(0, 10);
    if (tkDate !== today) return false;  // 오늘 날짜만
    // 사용완료인데 미확인 또는 사용가능 상태 모두 확인
    return t.status === '사용완료' || t.status === '사용가능' || t.status === '부분사용';
  });
  
  if (toVerify.length === 0) return;
  
  log('system', '🔄 동기화 검증 시작 (' + toVerify.length + '건, 오늘 네이버 티켓)');
  broadcast({ type: 'syncVerify', status: 'start', total: toVerify.length });
  
  if (!STATE.sessions.naver) {
    log('system', '  네이버 미로그인 → 검증 스킵');
    return;
  }
  
  var page = STATE.pages.naver;
  try { await page.title(); } catch(e) {
    log('system', '  네이버 페이지 연결 끊김 → 검증 스킵');
    return;
  }
  
  var bookingBase = STATE.naverBookingBase || naverPartnerUrl('booking-list-view');
  
  var mismatch = [];    // 불일치: 프로그램≠네이버
  var confirmed = 0;    // 일치 확인
  var failed = 0;       // 조회 실패
  var autoFixed = 0;    // 자동 수정
  
  for (var vi = 0; vi < toVerify.length; vi++) {
    var tk = toVerify[vi];
    
    try {
      // 상세 페이지에서 상태 확인 (테이블 파싱보다 빠르고 안정적)
      var detailUrl = bookingBase + '/bookings/' + tk.orderNo;
      await page.goto(detailUrl, { waitUntil: 'networkidle2', timeout: 10000 }).catch(function(){});
      await new Promise(function(r) { setTimeout(r, 1500); });
      
      var siteStatus = await page.evaluate(function() {
        var body = document.body ? document.body.innerText : '';
        // 상태 배지 확인
        if (body.indexOf('이용완료') >= 0) {
          // "이용완료" 텍스트가 있으면 배지인지 버튼인지 구분
          var badges = document.querySelectorAll('span, em, strong, div');
          for (var i = 0; i < badges.length; i++) {
            var t = badges[i].textContent.trim();
            var rect = badges[i].getBoundingClientRect();
            // 상단 상태 배지 (x>700=우측패널, y<200=상단)
            if (t === '이용완료' && rect.width < 100 && rect.y < 300) {
              return '이용완료';
            }
          }
          // 텍스트에 이용완료 버튼이 있으면 아직 확정 상태
        }
        if (body.indexOf('예매취소') >= 0) {
          var badges2 = document.querySelectorAll('span, em, strong, div');
          for (var j = 0; j < badges2.length; j++) {
            if (badges2[j].textContent.trim() === '예매취소' && badges2[j].getBoundingClientRect().y < 300) {
              return '예매취소';
            }
          }
        }
        // "이용완료" 버튼이 보이면 → 아직 확정 상태
        var btns = document.querySelectorAll('button');
        for (var k = 0; k < btns.length; k++) {
          if (btns[k].textContent.trim() === '이용완료' && btns[k].offsetParent) {
            return '확정';
          }
        }
        // 페이지에 예매 상세정보 없으면 조회 실패
        if (body.indexOf('예매 상세정보') < 0 && body.indexOf('예매자') < 0) return 'NOT_FOUND';
        return '확정';  // 기본
      });
      
      if (siteStatus === 'NOT_FOUND') {
        failed++;
        continue;
      }
      
      // ═══ 상태 비교 ═══
      var localStatus = tk.status;
      var isMatch = false;
      
      // ★ 네이버 원본 상태 저장
      if (siteStatus) tk.naverStatus = siteStatus;
      
      if (localStatus === '사용완료' && siteStatus === '이용완료') isMatch = true;
      if (localStatus === '사용가능' && siteStatus === '확정') isMatch = true;
      if (localStatus === '예매취소' && siteStatus === '예매취소') isMatch = true;
      
      if (isMatch) {
        confirmed++;
        // 확인 플래그 업데이트
        if (localStatus === '사용완료' && !tk.adminVerified) {
          tk.adminVerified = true;
          tk.verifiedAt = new Date().toISOString();
        }
      } else {
        // ═══ 불일치 처리 ═══
        var info = {
          id: tk.id, buyer: tk.buyer, orderNo: tk.orderNo,
          local: localStatus, site: siteStatus,
        };
        mismatch.push(info);
        
        log('system', '  ⚠️ 불일치: ' + tk.buyer + ' #' + tk.orderNo 
          + ' | 프로그램=' + localStatus + ' ↔ 네이버=' + siteStatus, 'warning');
        
        // ★ 자동 수정 로직
        if (localStatus === '사용완료' && siteStatus === '확정') {
          // 프로그램=사용완료인데 네이버=확정 → 네이버에서 이용완료 재처리
          log('system', '    → 네이버 이용완료 자동 재처리 시도...');
          try {
            var retryOk = await naverMarkUsed(tk);
            if (retryOk) {
              tk.adminOk = true;
              tk.adminVerified = true;
              tk.verifiedAt = new Date().toISOString();
              autoFixed++;
              log('system', '    ✅ 자동 재처리 성공', 'success');
            } else {
              tk.adminVerified = false;
              log('system', '    ❌ 자동 재처리 실패', 'error');
            }
          } catch(re) {
            tk.adminVerified = false;
            log('system', '    ❌ 재처리 오류: ' + re.message, 'error');
          }
        } else if (localStatus === '사용가능' && siteStatus === '이용완료') {
          // 네이버=이용완료인데 프로그램=사용가능 → 프로그램 상태 업데이트
          log('system', '    → 프로그램 상태 자동 업데이트: 사용가능 → 사용완료');
          tk.status = '사용완료';
          tk.usedAt = new Date().toISOString();
          tk.adminOk = true;
          tk.adminVerified = true;
          tk.verifiedAt = new Date().toISOString();
          tk.syncNote = '네이버에서 직접 이용완료 처리됨';
          autoFixed++;
          broadcast({ type: 'ticketUpdate', data: tk });
        } else if (localStatus === '사용가능' && siteStatus === '예매취소') {
          // 네이버=취소인데 프로그램=사용가능 → 프로그램도 취소
          log('system', '    → 프로그램 상태 자동 업데이트: 사용가능 → 예매취소');
          tk.status = '예매취소';
          tk.syncNote = '네이버에서 직접 예매취소됨';
          autoFixed++;
          broadcast({ type: 'ticketUpdate', data: tk });
        }
      }
    } catch(ve) {
      failed++;
    }
  }
  
  // ═══ 결과 리포트 ═══
  var summary = '🔍 동기화 검증 완료: '
    + confirmed + '건 일치, '
    + mismatch.length + '건 불일치'
    + (autoFixed > 0 ? ' (' + autoFixed + '건 자동수정)' : '')
    + (failed > 0 ? ', ' + failed + '건 조회실패' : '');
  
  log('system', summary, mismatch.length > 0 ? 'warning' : 'success');
  
  // 불일치 상세 브로드캐스트
  broadcast({
    type: 'syncVerify',
    status: 'done',
    confirmed: confirmed,
    mismatch: mismatch,
    autoFixed: autoFixed,
    failed: failed,
    total: toVerify.length,
  });
  
  // 상태 저장
  STATE.lastSyncVerify = {
    time: new Date().toISOString(),
    total: toVerify.length,
    confirmed: confirmed,
    mismatch: mismatch.length,
    autoFixed: autoFixed,
    failed: failed,
    details: mismatch,
  };
  
  sendState();
}

async function crawlCycle(channels) {
  channels = channels || 'all';
  var doLa = channels === 'all' || channels === 'la2fdoci';
  var doNv = channels === 'all' || channels === 'naver';
  var doOk = channels === 'all' || channels === 'okpos';
  
  STATE.totalCrawls++;
  log('system', '━━ 크롤링 #' + STATE.totalCrawls + ' (' + (channels === 'all' ? '전체(개별실행)' : channels) + ') ━━');

  // ─── la2fdoci (HTTP, 독립) ───
  if (doLa) {
    STATE.crawlStatus.la2fdoci = 'crawling'; sendState();
    try {
      checkAbort();
      var la2fR = await Promise.race([la2fCrawl(), new Promise(function(_,rej){setTimeout(function(){rej(new Error('la2f 타임아웃'))},180000)})]);
      STATE.crawlStatus.la2fdoci = 'idle';
      log('la2fdoci', '✅ 완료 (' + (Array.isArray(la2fR)?la2fR.length:0) + '건)', 'success');
    } catch(e) {
      STATE.crawlStatus.la2fdoci = e.name==='CrawlAbortError'?'idle':'error';
      log('la2fdoci', e.name==='CrawlAbortError'?'⏹ 중단':'❌ '+e.message+' → 다음 진행', e.name==='CrawlAbortError'?'warning':'error');
    }
    sendState();
  }

  // ─── 네이버 (Puppeteer, 독립) ───
  if (doNv) {
    if (!puppeteer) { log('naver', '⚠️ Puppeteer 없음 (Vercel 모드)', 'warning'); }
    else {
      STATE.crawlStatus.naver = 'crawling'; sendState();
      try {
        checkAbort();
        if (STATE.pages.naver) { try { await STATE.pages.naver.title(); } catch(e) { STATE.sessions.naver=false; STATE.pages.naver=null; if(STATE.browsers.naver){try{await STATE.browsers.naver.close()}catch(e2){}} STATE.browsers.naver=null; } }
        var nvR = await Promise.race([naverCrawl(), new Promise(function(_,rej){setTimeout(function(){rej(new Error('naver 타임아웃'))},90000)})]);
        STATE.crawlStatus.naver = 'idle';
        log('naver', '✅ 완료 (' + (Array.isArray(nvR)?nvR.length:0) + '건)', 'success');
      } catch(e) {
        STATE.crawlStatus.naver = e.name==='CrawlAbortError'?'idle':'error';
        if(e.name!=='CrawlAbortError') STATE.sessions.naver=false;
        log('naver', e.name==='CrawlAbortError'?'⏹ 중단':'❌ '+e.message+' → OKPOS 계속 진행', e.name==='CrawlAbortError'?'warning':'error');
      }
      sendState();
    }
  }

  // ─── OKPOS (Puppeteer, 독립) ───
  if (doOk && puppeteer && STATE.config.okpos.id && STATE.config.okpos.pw && STATE.config.okpos.auto) {
    STATE.crawlStatus.okpos = 'crawling'; sendState();
    try {
      checkAbort();
      if (STATE.pages.okpos) { try { await STATE.pages.okpos.title(); } catch(e) { STATE.sessions.okpos=false; STATE.pages.okpos=null; if(STATE.browsers.okpos){try{await STATE.browsers.okpos.close()}catch(e2){}} STATE.browsers.okpos=null; } }
      if (!STATE.sessions.okpos) await okposLogin();
      if (STATE.sessions.okpos) {
        await okposSalesCrawl();
        await okposTimeSalesCrawl();
        STATE.crawlStatus.okpos = 'connected';
        log('okpos', '✅ OKPOS 완료', 'success');
      } else {
        STATE.crawlStatus.okpos = 'error';
        log('okpos', '❌ 로그인 실패', 'error');
      }
    } catch(e) {
      STATE.crawlStatus.okpos = e.name==='CrawlAbortError'?'idle':'error';
      log('okpos', e.name==='CrawlAbortError'?'⏹ 중단':'❌ '+e.message, e.name==='CrawlAbortError'?'warning':'error');
    }
    sendState();
  } else if (doOk && !STATE.config.okpos.auto) {
    log('okpos', 'OKPOS 자동연동 꺼짐', 'info');
    STATE.crawlStatus.okpos = 'idle';
  }

  // ═══ 후처리 ═══
  if (!STATE.crawlAborted) {
    try { await verifyTicketSync(); } catch(e) {}
    try { await posTicketCompare(); } catch(e) {}
  }
  saveTicketsLocal();
  broadcast({ type: 'crawlStatus', data: STATE.crawlStatus });
  sendState();
}

// ═══ 사용처리 (즉시 응답 + 백그라운드) ═══
async function processUse(ticketId, useQty) {
  var tk = STATE.tickets.find(function(t) { return String(t.id) === String(ticketId); });
  if (!tk) return { ok: false, error: '티켓 없음' };
  if (!['사용가능', '확정', '부분사용'].includes(tk.status)) return { ok: false, error: '이미 사용됨 (' + tk.status + ')' };

  var totalQty = tk.qty || 1;
  useQty = useQty ? parseInt(useQty) : totalQty;
  if (useQty < 1) useQty = 1;
  if (useQty > totalQty) useQty = totalQty;
  var isSplit = useQty < totalQty;

  var steps = [];
  function step(label, status) {
    steps.push({ l: label, s: status, t: Date.now() });
    try { broadcast({ type: 'processStep', ticketId: ticketId, step: steps.length, label: label, status: status }); } catch(be) {}
  }

  log('system', '🔄 ' + tk.buyer + ' 사용처리 시작 (' + tk.source + ' #' + (tk.orderNo||'') + ')' + (isSplit ? ' [분할 ' + useQty + '/' + totalQty + ']' : ''));
  step('① QR 유효성 확인' + (isSplit ? ' (분할: ' + useQty + '/' + totalQty + '매)' : ''), 'ok');

  // ═══════════════════════════════════════════
  // ★ 즉시처리: 로컬 상태 변경 + POS 기록 (0.1초)
  // ═══════════════════════════════════════════
  var now = new Date().toISOString();
  var txn = 'OKP-' + Date.now();
  var posEntry, remainTk;
  
  if (isSplit) {
    var usedPrice = Math.round((tk.price || 0) * useQty / totalQty);
    var remainQty = totalQty - useQty;
    var remainPrice = (tk.price || 0) - usedPrice;
    
    tk.status = '부분사용';
    tk.usedAt = now;
    tk.posOk = true;
    tk.txnId = txn;
    tk.okposRegistered = false;
    tk.adminOk = null;  // 백그라운드에서 업데이트
    tk.adminVerified = null;
    tk.usedQty = useQty;
    tk.remainQty = remainQty;
    tk.originalQty = totalQty;
    tk.qty = useQty;
    tk.personCount = useQty;
    tk.price = usedPrice;
    tk.splitHistory = (tk.splitHistory || []).concat([{ qty: useQty, time: now, txn: txn }]);
    
    remainTk = JSON.parse(JSON.stringify(tk));
    remainTk.id = tk.id + '-R' + Date.now().toString(36);
    remainTk.status = '사용가능';
    remainTk.qty = remainQty;
    remainTk.personCount = remainQty;
    remainTk.price = remainPrice;
    remainTk.items = [{ n: tk.product, p: remainPrice }];
    remainTk.usedAt = null;
    remainTk.posOk = false;
    remainTk.txnId = null;
    remainTk.okposRegistered = false;
    remainTk.adminOk = null;
    remainTk.adminVerified = null;
    remainTk.usedQty = null;
    remainTk.remainQty = null;
    remainTk.parentId = String(tk.id);
    remainTk.splitNote = '분할 잔여 ' + remainQty + '매 (원본: ' + totalQty + '매)';
    STATE.tickets.push(remainTk);
    log('system', '🔀 분할: ' + tk.buyer + ' ' + useQty + '매 사용, 잔여 ' + remainQty + '매');
    
    posEntry = {
      id: 'POS-' + Date.now(), txnId: txn, ticketId: String(tk.id),
      source: tk.source, buyer: tk.buyer, phone: tk.phone,
      product: tk.product, amount: usedPrice, qty: useQty,
      time: now, items: tk.items || [], okposSync: false,
      split: true, splitNote: useQty + '/' + totalQty + '매'
    };
  } else {
    tk.status = '사용완료';
    tk.usedAt = now;
    tk.posOk = true;
    tk.txnId = txn;
    tk.okposRegistered = false;
    tk.adminOk = null;
    tk.adminVerified = null;
    
    // ★ 진행이력 (타임라인) 기록
    if (!tk.history) tk.history = [];
    if (tk.bookDate && tk.history.length === 0) {
      tk.history.push({ action: '신청', time: tk.bookDate, by: tk.source || '고객' });
    }
    if (tk.history.length <= 1) {
      tk.history.push({ action: '확정', time: tk.bookDate || now, by: tk.source || '시스템' });
    }
    tk.history.push({ action: '사용완료', time: now, by: '파트너센터 (잠사박물관 POS)' });
    
    posEntry = {
      id: 'POS-' + Date.now(), txnId: txn, ticketId: String(tk.id),
      source: tk.source, buyer: tk.buyer, phone: tk.phone,
      product: tk.product, amount: tk.price || 0, qty: tk.qty || 1,
      time: now, items: tk.items || [], okposSync: false
    };
  }
  STATE.posLog.unshift(posEntry);
  
  // 사용처리 이력
  var useEntry = {
    id: 'USE-' + Date.now(), time: now, ticketId: String(tk.id), orderNo: tk.orderNo,
    buyer: tk.buyer, phone: tk.phone, product: tk.product, qty: isSplit ? useQty : (tk.qty || 1),
    price: posEntry.amount, source: tk.source, method: 'qr',
    adminOk: null, okposOk: false, adminVerified: null,
    split: isSplit, splitNote: isSplit ? (useQty + '/' + totalQty + '매') : null,
    bandCount: bandCount, needBand: needBand,
    steps: ['즉시완료 → 백그라운드 처리중'],
  };
  STATE.useHistory.unshift(useEntry);
  if (STATE.useHistory.length > 500) STATE.useHistory.length = 500;
  
  step('② 사용처리 완료 (즉시)', 'ok');
  
  // ═══ ★ 띠지(팔찌) 자동 출력 ═══
  var bandCount = 0;
  var needBand = isTicketForBand(tk.product);
  if (needBand && (PRINTER.type === 'godex-usb' || PRINTER.type === 'godex-net')) {
    var printQty = isSplit ? useQty : (tk.personCount || tk.qty || 1);
    log('system', '🖨️ 팔찌 출력 시작: ' + tk.buyer + ' ' + printQty + '매 (' + PRINTER.type + ')');
    step('② -1 🖨️ 팔찌 ' + printQty + '매 출력중...', 'processing');
    var rData = { buyer: tk.buyer, phone: tk.phone || '', phone4: (tk.phone || '').replace(/[^0-9]/g, '').slice(-4), product: tk.product, source: tk.source, usedAt: now };
    for (var bi = 0; bi < printQty; bi++) {
      try {
        await printBand(buildEZPL2(rData, bi + 1, printQty));
        bandCount++;
      } catch(bErr) {
        log('system', '🖨️ 팔찌 출력 실패 (' + (bi+1) + '/' + printQty + '): ' + bErr.message, 'error');
      }
      if (bi < printQty - 1) await new Promise(function(r) { setTimeout(r, 150); });
    }
    step('② -1 🖨️ 팔찌 ' + bandCount + '/' + printQty + '매 완료', bandCount > 0 ? 'ok' : 'warning');
    log('system', '🖨️ 팔찌 출력 완료: ' + bandCount + '/' + printQty + '매', bandCount > 0 ? 'success' : 'warning');
  } else if (needBand && PRINTER.type === 'browser') {
    bandCount = -1; // 브라우저 인쇄는 클라이언트에서 처리
    step('② -1 🖨️ 브라우저 인쇄 → 클라이언트 처리', 'ok');
  } else if (!needBand) {
    step('② -1 📋 체험/기념품 → 띠지 불필요', 'ok');
  }
  
  // ☁️ Supabase 동기화 (비동기)
  if (sbSync.isEnabled()) {
    sbSync.syncTickets([tk]).catch(function(){});
    sbSync.syncUseHistory(useEntry).catch(function(){});
  }
  step('③ 관리자/OKPOS → 백그라운드 처리중...', 'processing');
  
  log('system', '⚡ ' + tk.buyer + (isSplit ? ' [분할 ' + useQty + '/' + totalQty + ']' : '') + ' 즉시 완료 | ' + posEntry.amount.toLocaleString() + '원 → 백그라운드 처리 시작', 'success');
  sendState();
  broadcast({ type: 'useLog', data: useEntry });
  
  // ═══════════════════════════════════════════════
  // ★ 백그라운드 처리: 관리자 사용완료 + OKPOS (비동기)
  // ═══════════════════════════════════════════════
  var bgTkId = String(tk.id);
  var bgSource = tk.source;
  var bgIsOption = tk.isOption;
  
  setImmediate(function() {
    (async function() {
      try {
        var ok1 = false, ok2 = false, okpos = false;
        
        // ── 관리자 사이트 이용완료 ──
        if (bgSource === 'la2fdoci') {
          broadcast({ type: 'processStep', ticketId: bgTkId, step: 4, label: '④ la2fdoci 처리중...', status: 'processing' });
          try { ok1 = await la2fMarkUsed(tk, useQty); } catch(e1) { log('la2fdoci', '백그라운드 사용완료 예외: ' + e1.message, 'error'); }
          broadcast({ type: 'processStep', ticketId: bgTkId, step: 4, label: ok1 ? '④ la2fdoci ✓' : '④ la2fdoci △', status: ok1 ? 'ok' : 'warning' });
        } else if (bgIsOption) {
          ok2 = true; // 옵션 티켓은 네이버 처리 불필요
          broadcast({ type: 'processStep', ticketId: bgTkId, step: 4, label: '④ 옵션 (네이버 불필요)', status: 'ok' });
        } else {
          broadcast({ type: 'processStep', ticketId: bgTkId, step: 4, label: '④ 네이버 이용완료 처리중...', status: 'processing' });
          try { ok2 = await naverMarkUsed(tk); } catch(e2) { log('naver', '백그라운드 이용완료 예외: ' + e2.message, 'error'); }
          broadcast({ type: 'processStep', ticketId: bgTkId, step: 4, label: ok2 ? '④ 네이버 ✓' : '④ 네이버 △', status: ok2 ? 'ok' : 'warning' });
        }
        
        tk.adminOk = bgSource === 'la2fdoci' ? !!ok1 : !!ok2;
        
        // ── OKPOS 웹 매출등록 ──
        if (STATE.config.okpos.auto) {
          broadcast({ type: 'processStep', ticketId: bgTkId, step: 5, label: '⑤ OKPOS 웹 등록중...', status: 'processing' });
          try { okpos = await okposRegister(tk); } catch(e3) { log('okpos', '백그라운드 매출등록 예외: ' + e3.message, 'error'); }
          tk.okposRegistered = !!okpos;
          posEntry.okposSync = !!okpos;
          broadcast({ type: 'processStep', ticketId: bgTkId, step: 5, label: okpos ? '⑤ OKPOS 웹 ✓' : '⑤ OKPOS 웹 △', status: okpos ? 'ok' : 'warning' });
        }
        
        // ── OKPOS POS 단말기 직접 등록 ──
        broadcast({ type: 'processStep', ticketId: bgTkId, step: 6, label: '⑥ POS 단말기 등록중...', status: 'processing' });
        var posOk = false;
        try { posOk = await okposPosRegister(tk); } catch(e4) { log('okpos', 'POS 단말기 등록 예외: ' + e4.message, 'warning'); }
        var posLabel = posOk === true ? '⑥ POS 단말기 ✓' : (posOk === 'manual' ? '⑥ POS 수동선택 필요' : '⑥ POS 단말기 △');
        broadcast({ type: 'processStep', ticketId: bgTkId, step: 6, label: posLabel, status: posOk ? 'ok' : 'warning' });
        
        // ── 사이트 반영 확인 (동기화 검증이 주기적으로 하므로 간소화) ──
        tk.adminVerified = tk.adminOk ? true : null;
        tk.verifiedAt = tk.adminOk ? new Date().toISOString() : null;
        
        // 이력 업데이트
        useEntry.adminOk = tk.adminOk;
        useEntry.okposOk = !!okpos;
        useEntry.adminVerified = tk.adminVerified;
        useEntry.steps = [
          '① QR확인(ok)',
          '② 즉시완료(ok)',
          bgSource === 'la2fdoci' ? ('③ la2fdoci(' + (ok1 ? 'ok' : 'fail') + ')') : ('③ 네이버(' + (ok2 ? 'ok' : 'fail') + ')'),
          '④ OKPOS(' + (okpos ? 'ok' : (STATE.config.okpos.auto ? 'fail' : 'skip')) + ')',
        ];
        
        var adminLabel = bgSource === 'la2fdoci' ? (ok1 ? '✓' : '△') : (ok2 ? '✓' : '△');
        log('system', '🏁 ' + tk.buyer + ' 백그라운드 완료 | 관리자:' + adminLabel + ' | OKPOS:' + (okpos ? '✓' : '△'), tk.adminOk ? 'success' : 'warning');
        
        broadcast({ type: 'processStep', ticketId: bgTkId, step: 6, label: '✅ 백그라운드 완료', status: 'ok' });
        broadcast({ type: 'bgComplete', ticketId: bgTkId, adminOk: tk.adminOk, okposOk: !!okpos });
        broadcast({ type: 'ticketUpdate', data: tk });
        sendState();
      } catch(bgErr) {
        log('system', '❌ 백그라운드 처리 오류: ' + bgErr.message, 'error');
        broadcast({ type: 'processStep', ticketId: bgTkId, step: 6, label: '❌ 백그라운드 오류: ' + bgErr.message, status: 'error' });
      }
    })();
  });
  
  // ═══ 즉시 반환 (0.1초 이내) ═══
  return { ok: true, ticket: tk, pos: posEntry, steps: steps, split: isSplit, remainTicket: isSplit ? remainTk : null, bgProcessing: true, bandCount: bandCount, needBand: needBand };
}

// ═══ 수동 주문 추가 ═══
function addManualOrder(data) {
  var tk = {
    id: (data.source === 'naver' ? 'NV-' : 'L') + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
    orderNo: data.orderNo || ('MAN' + Date.now()),
    couponNo: data.couponNo || data.orderNo || ('MAN' + Date.now()),
    source: data.source || 'la2fdoci',
    product: data.product || '수동입력',
    buyer: data.buyer || '미확인',
    phone: data.phone || '',
    price: parseInt(data.price) || 0,
    status: data.source === 'naver' ? '확정' : '사용가능',
    qrIssued: true,
    detectedAt: new Date().toISOString(),
    items: data.items || [{ n: data.product || '수동입력', p: parseInt(data.price) || 0 }],
    personCount: parseInt(data.count) || 1,
  };
  STATE.tickets.unshift(tk);
  log('manual', '📝 수동추가: ' + tk.buyer + ' | ' + tk.product + ' | ' + (tk.price || 0).toLocaleString() + '원', 'success');
  broadcast({ type: 'newTicket', data: tk });
  sendState();
  return tk;
}

// ═══ REST API ═══
app.get('/api/state', function(req, res) {
  res.json({
    tickets: STATE.tickets, posLog: STATE.posLog, logs: STATE.logs.slice(0, 100),
    crawlStatus: STATE.crawlStatus, isRunning: STATE.isRunning, totalCrawls: STATE.totalCrawls,
    sessions: STATE.sessions,
    experiences: STATE.experiences, expBookings: STATE.expBookings,
    rentals: STATE.rentals, rentalBookings: STATE.rentalBookings,
    spotScans: STATE.spotScans, spotScanLogs: (STATE.spotScanLogs || []).slice(0, 200),
    config: {
      la2fdoci: { id: STATE.config.la2fdoci.id, pw: STATE.config.la2fdoci.pw, loginUrl: STATE.config.la2fdoci.loginUrl, orderUrl: STATE.config.la2fdoci.orderUrl },
      naver: { id: STATE.config.naver.id, pw: STATE.config.naver.pw, bookingUrl: STATE.config.naver.bookingUrl },
      okpos: { id: STATE.config.okpos.id, pw: STATE.config.okpos.pw, aspUrl: STATE.config.okpos.aspUrl, storeCode: STATE.config.okpos.storeCode, auto: STATE.config.okpos.auto, dateFrom: STATE.config.okpos.dateFrom||'', dateTo: STATE.config.okpos.dateTo||'', accounts: STATE.config.okpos.accounts||[] },
      kakao: { room: STATE.config.kakao.room, dailyRoom: STATE.config.kakao.dailyRoom||'', dailyAutoTime: STATE.config.kakao.dailyAutoTime||'', dailyAutoEnabled: !!STATE.config.kakao.dailyAutoEnabled, sectionRooms: STATE.config.kakao.sectionRooms||{}, timeRoom: STATE.config.kakao.timeRoom||'', timeAutoTime: STATE.config.kakao.timeAutoTime||'', timeAutoEnabled: !!STATE.config.kakao.timeAutoEnabled, enabled: STATE.config.kakao.enabled },
      anthropicKeyMasked: (process.env.ANTHROPIC_API_KEY ? process.env.ANTHROPIC_API_KEY.substring(0,8)+'...'+process.env.ANTHROPIC_API_KEY.slice(-4) : ''), crawlInterval: STATE.config.crawlInterval,
      crawlDateFrom: STATE.config.crawlDateFrom || '',
      crawlDateTo: STATE.config.crawlDateTo || '',
      msg: { provider: STATE.config.msg.provider, ppurioId: STATE.config.msg.ppurioId||'', ppurioKey: STATE.config.msg.ppurioKey||'', ppurioSender: STATE.config.msg.ppurioSender||'', aligoId: STATE.config.msg.aligoId, aligoSender: STATE.config.msg.aligoSender, coolsmsSender: STATE.config.msg.coolsmsSender, kakaoSenderKey: STATE.config.msg.kakaoSenderKey, kakaoTemplateCode: STATE.config.msg.kakaoTemplateCode, autoSend: STATE.config.msg.autoSend, templates: STATE.config.msg.templates, aligoKey: STATE.config.msg.aligoKey||'', coolsmsKey: STATE.config.msg.coolsmsKey||'', coolsmsSecret: STATE.config.msg.coolsmsSecret||'', kakaoKey: STATE.config.msg.kakaoKey||'', naverNotice: STATE.config.msg.naverNotice||'', naverPlaceUrl: STATE.config.msg.naverPlaceUrl||'', baseUrl: STATE.config.msg.baseUrl||'' },
    },
  });
});

app.post('/api/config', function(req, res) {
  var b = req.body;
  if (b.field === 'crawlDateFrom' || b.field === 'crawlDateTo' || b.field === 'crawlInterval') {
    STATE.config[b.field] = b.value;
    log('config', b.field + ' → ' + b.value);
  } else if (STATE.config[b.section]) {
    STATE.config[b.section][b.field] = b.value;
    // pw 변경은 로그 생략 (무한반복 방지)
    if (b.field !== 'pw') log('config', b.section + '.' + b.field + ' 변경');
  }
  // ★ sendState() 제거 — config 변경으로 전체 re-render 하지 않음
  res.json({ ok: true });
});

// ═══ 크롤링 단계 설정 API ═══
// ═══ 헬스체크 (Railway/Vercel 배포용) ═══
app.get('/api/health', function(req, res) {
  res.json({ ok: true, uptime: process.uptime(), tickets: STATE.tickets.length, memory: Math.round(process.memoryUsage().rss / 1048576) + 'MB', mode: puppeteer ? 'full' : 'vercel' });
});

// ═══ Vercel Cron: la2fdoci 자동 크롤링 (30분마다) ═══
app.get('/api/cron/crawl-la2f', async function(req, res) {
  try {
    // Vercel Cron 인증 확인
    var cronSecret = req.headers['authorization'];
    if (process.env.CRON_SECRET && cronSecret !== 'Bearer ' + process.env.CRON_SECRET) {
      // 로컬에서도 호출 가능하도록 CRON_SECRET 미설정 시 통과
      if (process.env.CRON_SECRET) return res.status(401).json({ ok: false, error: 'unauthorized' });
    }

    log('system', '⏰ Vercel Cron: la2fdoci 크롤링 시작');
    
    // Supabase에서 최신 데이터 로드 (Vercel은 stateless)
    if (STATE.tickets.length === 0 && sbSync.isEnabled()) {
      var restored = await sbSync.loadFromSupabase();
      if (restored && restored.tickets.length > 0) {
        STATE.tickets = restored.tickets.map(function(t) { return sbSync.fromSb ? sbSync.fromSb(t) : t; });
        log('system', '  ☁️ Supabase에서 ' + STATE.tickets.length + '건 로드');
      }
    }

    // la2fdoci HTTP 크롤링 (Puppeteer 불필요)
    STATE.crawlAborted = false;
    var beforeCount = STATE.tickets.length;
    try {
      await la2fCrawl();
    } catch(e) {
      log('la2fdoci', 'Cron 크롤링 오류: ' + e.message, 'error');
    }
    var newCount = STATE.tickets.length - beforeCount;
    
    // Supabase에 결과 저장
    if (sbSync.isEnabled() && newCount > 0) {
      await sbSync.syncTickets(STATE.tickets.slice(-newCount)).catch(function(){});
    }
    saveTicketsLocal();
    
    log('system', '⏰ Cron 완료: 신규 ' + newCount + '건 (전체 ' + STATE.tickets.length + '건)');
    res.json({ ok: true, newTickets: newCount, total: STATE.tickets.length });
  } catch(e) {
    log('system', '⏰ Cron 오류: ' + e.message, 'error');
    res.json({ ok: false, error: e.message });
  }
});

// ═══ Vercel: Supabase에서 티켓 자동 로드 (stateless 대응) ═══
app.use('/api', async function(req, res, next) {
  // 첫 요청 시 Supabase에서 데이터 로드
  if (STATE.tickets.length === 0 && sbSync.isEnabled() && !STATE._sbLoaded) {
    STATE._sbLoaded = true;
    try {
      var restored = await sbSync.loadFromSupabase();
      if (restored && restored.tickets.length > 0) {
        var existingIds = {};
        STATE.tickets.forEach(function(t) { existingIds[t.id] = true; });
        restored.tickets.forEach(function(t) {
          var local = sbSync.fromSb ? sbSync.fromSb(t) : t;
          if (!existingIds[local.id]) { STATE.tickets.push(local); existingIds[local.id] = true; }
        });
      }
    } catch(e) {}
  }
  next();
});

app.get('/api/crawl/steps', function(req, res) {
  res.json({ ok: true, steps: STATE.crawlSteps });
});

app.post('/api/crawl/steps', function(req, res) {
  var b = req.body;
  if (b.service && b.step && b.field !== undefined) {
    // 개별 필드 수정
    if (!STATE.crawlSteps[b.service]) STATE.crawlSteps[b.service] = {};
    if (!STATE.crawlSteps[b.service][b.step]) STATE.crawlSteps[b.service][b.step] = {};
    STATE.crawlSteps[b.service][b.step][b.field] = b.value;
    log('config', '크롤링 설정: ' + b.service + '.' + b.step + '.' + b.field + ' → ' + String(b.value).substring(0, 50));
    res.json({ ok: true });
  } else if (b.service && b.data) {
    // 전체 서비스 설정 교체
    STATE.crawlSteps[b.service] = b.data;
    log('config', '크롤링 설정 전체 저장: ' + b.service);
    res.json({ ok: true });
  } else {
    res.json({ ok: false, error: 'service/step/field 필요' });
  }
});

// 실시간 스크린샷 on-demand
app.get('/api/crawl/live/:service', async function(req, res) {
  var key = req.params.service;
  if (!STATE.pages[key]) return res.json({ ok: false, msg: '브라우저 없음' });
  try {
    var page = STATE.pages[key];
    var url = '';
    try { url = page.url(); } catch(e) {}
    var base64 = await page.screenshot({ encoding: 'base64', type: 'jpeg', quality: 40 });
    res.json({ ok: true, img: base64, url: url, time: Date.now() });
  } catch(e) {
    res.json({ ok: false, msg: e.message });
  }
});

// 수동 클릭/입력 실행 (크롤링 디버그용)
app.post('/api/crawl/exec', async function(req, res) {
  var b = req.body;
  var key = b.service;
  if (!STATE.pages[key]) return res.json({ ok: false, msg: '브라우저 없음' });
  var page = STATE.pages[key];
  try {
    if (b.action === 'click') {
      await page.evaluate(function(sel) {
        var el = document.querySelector(sel);
        if (el) { el.click(); return 'clicked'; }
        return 'not found';
      }, b.selector);
      res.json({ ok: true, msg: '클릭 완료: ' + b.selector });
    } else if (b.action === 'type') {
      await page.evaluate(function(sel, val) {
        var el = document.querySelector(sel);
        if (el) { el.value = val; el.dispatchEvent(new Event('input', {bubbles:true})); return 'typed'; }
        return 'not found';
      }, b.selector, b.value);
      res.json({ ok: true, msg: '입력 완료: ' + b.selector });
    } else if (b.action === 'goto') {
      await page.goto(b.url, { waitUntil: 'domcontentloaded', timeout: 10000 });
      res.json({ ok: true, msg: 'URL 이동: ' + b.url });
    } else if (b.action === 'eval') {
      var result = await page.evaluate(b.code);
      res.json({ ok: true, result: result });
    } else {
      res.json({ ok: false, msg: '알 수 없는 action' });
    }
    await crawlLive(key, '수동 실행: ' + b.action);
  } catch(e) {
    res.json({ ok: false, msg: e.message });
  }
});

app.post('/api/crawl/start', function(req, res) {
  if (STATE.isRunning) return res.json({ ok: true, msg: '이미 실행중' });
  var intv = req.body.interval || STATE.config.crawlInterval;
  var channels = req.body.channels || 'all';
  STATE.config.crawlInterval = intv;
  STATE.config.crawlChannels = channels;
  STATE.isRunning = true;
  STATE.crawlAborted = false;
  // setTimeout 체인 방식: 이전 크롤링 완료 후 다음 스케줄링
  (async function scheduleNext() {
    if (!STATE.isRunning) return;
    try { await crawlCycle(STATE.config.crawlChannels); } catch(e) { log('system', '크롤링 사이클 오류: ' + e.message, 'error'); }
    if (STATE.isRunning) {
      crawlTimer = setTimeout(scheduleNext, STATE.config.crawlInterval * 1000);
    }
  })();
  var chLabel = channels === 'all' ? '전체' : channels === 'la2fdoci' ? 'LA 라이프도시' : 'NV 네이버';
  log('system', '▶ 자동 크롤링 시작 [' + chLabel + '] (' + intv + '초)', 'success');
  sendState();
  res.json({ ok: true });
});

app.post('/api/crawl/stop', function(req, res) {
  STATE.isRunning = false;
  STATE.crawlAborted = true;
  if (crawlTimer) { clearTimeout(crawlTimer); crawlTimer = null; }
  STATE.crawlStatus = { la2fdoci: 'idle', naver: 'idle', okpos: 'idle' };
  log('system', '⏹ 크롤링 중지 (진행중 작업 중단됨)');
  sendState();
  res.json({ ok: true });
});

app.post('/api/crawl/once', async function(req, res) {
  var channels = req.body.channels || 'all';
  STATE.crawlAborted = false;
  var chLabel = channels === 'all' ? '전체' : channels === 'la2fdoci' ? 'LA 라이프도시' : 'NV 네이버';
  log('system', '🔄 수동 크롤링 [' + chLabel + ']');
  await crawlCycle(channels);
  broadcast({ type: 'state', data: { tickets: STATE.tickets, sessions: STATE.sessions, crawlStatus: STATE.crawlStatus } });
  res.json({ ok: true, tickets: STATE.tickets.length });
});

// ═══ 파이프라인 시스템 ═══
var PIPELINE_DEF = {
  la2fdoci: {
    label: 'LA 라이프도시',
    color: '#6366f1',
    functions: [
      { id: 'la2fLogin', name: '로그인', desc: 'la2fdoci HTTP POST 로그인 (세션 쿠키 기반)', icon: '🔑' },
      { id: 'la2fCrawl', name: '크롤링', desc: 'HTTP GET 주문목록 → cheerio HTML 파싱 → 페이지네이션 → 티켓 등록', icon: '🔍' },
      { id: 'la2fMarkUsed', name: '사용처리', desc: 'changeStatus.do JSON API → status:1 (사용완료)', icon: '✅' },
      { id: 'la2fVerifyUsed', name: '반영확인', desc: 'HTTP 주문검색 → 쿠폰 상태 조회 → 사용완료 여부 확인', icon: '🔍' },
    ]
  },
  naver: {
    label: 'NV 네이버',
    color: '#03C75A',
    functions: [
      { id: 'naverLogin', name: '로그인', desc: '네이버 스마트플레이스 로그인 (ID/PW → 캡차 체크)', icon: '🔑' },
      { id: 'naverCrawl', name: '크롤링', desc: '예약관리 페이지 이동 → 업체선택 → 필터설정 → 테이블 파싱 → 티켓 등록', icon: '🔍' },
      { id: 'naverMarkUsed', name: '사용처리', desc: '예약목록에서 해당 예약 찾기 → 이용완료 버튼 클릭', icon: '✅' },
      { id: 'naverVerifyUsed', name: '반영확인', desc: '예약 상태 재조회 → 이용완료 여부 확인', icon: '🔍' },
    ]
  }
};

// 함수 코드 추출
function extractFunctionCode(funcName) {
  var fs = require('fs');
  var code = fs.readFileSync(__filename, 'utf8');
  // "async function funcName" 또는 "function funcName" 찾기
  var patterns = [
    new RegExp('(async\\s+function\\s+' + funcName + '\\s*\\([^)]*\\)\\s*\\{)', 'g'),
    new RegExp('(function\\s+' + funcName + '\\s*\\([^)]*\\)\\s*\\{)', 'g')
  ];
  
  var startIdx = -1;
  for (var pi = 0; pi < patterns.length; pi++) {
    var m = patterns[pi].exec(code);
    if (m) { startIdx = m.index; break; }
  }
  if (startIdx < 0) return null;
  
  // 중괄호 매칭으로 함수 끝 찾기
  var depth = 0;
  var endIdx = startIdx;
  var inStr = false;
  var strCh = '';
  for (var i = startIdx; i < code.length; i++) {
    var ch = code[i];
    if (inStr) {
      if (ch === strCh && code[i-1] !== '\\') inStr = false;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') { inStr = true; strCh = ch; continue; }
    if (ch === '{') depth++;
    if (ch === '}') { depth--; if (depth === 0) { endIdx = i + 1; break; } }
  }
  
  var funcCode = code.substring(startIdx, endIdx);
  var startLine = code.substring(0, startIdx).split('\n').length;
  var lineCount = funcCode.split('\n').length;
  
  return { code: funcCode, startLine: startLine, lineCount: lineCount };
}

// 파이프라인 정보 API
app.get('/api/pipeline/list', function(req, res) {
  var result = {};
  Object.keys(PIPELINE_DEF).forEach(function(ch) {
    var chDef = PIPELINE_DEF[ch];
    result[ch] = {
      label: chDef.label,
      color: chDef.color,
      functions: chDef.functions.map(function(fn) {
        var info = extractFunctionCode(fn.id);
        return {
          id: fn.id,
          name: fn.name,
          desc: fn.desc,
          icon: fn.icon,
          startLine: info ? info.startLine : 0,
          lineCount: info ? info.lineCount : 0,
        };
      })
    };
  });
  res.json({ ok: true, pipelines: result });
});

// 함수 코드 조회 API
app.get('/api/pipeline/code/:funcName', function(req, res) {
  var info = extractFunctionCode(req.params.funcName);
  if (!info) return res.json({ ok: false, error: '함수를 찾을 수 없음: ' + req.params.funcName });
  res.json({ ok: true, funcName: req.params.funcName, code: info.code, startLine: info.startLine, lineCount: info.lineCount });
});

// Claude API를 이용한 자연어 코드 편집
app.post('/api/pipeline/ai-edit', async function(req, res) {
  var funcName = req.body.funcName;
  var instruction = req.body.instruction;
  var images = req.body.images || []; // [{data: base64, mediaType: 'image/png'}, ...]
  var apiKey = process.env.ANTHROPIC_API_KEY;
  
  if (!apiKey) return res.json({ ok: false, error: 'Anthropic API 키가 설정되지 않았습니다. AI진단 탭에서 설정해주세요.' });
  if (!funcName || !instruction) return res.json({ ok: false, error: '함수명과 지시사항이 필요합니다.' });
  
  var info = extractFunctionCode(funcName);
  if (!info) return res.json({ ok: false, error: '함수를 찾을 수 없음: ' + funcName });
  
  log('pipeline', '🤖 AI 편집 요청: ' + funcName + ' → ' + instruction.substring(0, 60) + (images.length ? ' (📷' + images.length + '장)' : ''));
  
  try {
    var https = require('https');
    
    // 메시지 content 구성 (텍스트 + 이미지)
    var userContent = [];
    
    // 이미지 첨부
    for (var ii = 0; ii < images.length; ii++) {
      userContent.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: images[ii].mediaType || 'image/png',
          data: images[ii].data
        }
      });
    }
    
    // 텍스트 지시
    userContent.push({
      type: 'text',
      text: '다음 함수를 수정해주세요.\n\n'
        + '함수명: ' + funcName + '\n'
        + '수정 지시: ' + instruction + '\n'
        + (images.length ? '\n위 스크린샷은 현재 오류 상태/원하는 동작을 보여줍니다. 이를 참고하여 수정해주세요.\n' : '')
        + '\n현재 코드:\n```javascript\n' + info.code + '\n```\n\n'
        + '수정된 전체 함수를 <code> 태그로 반환하고, 변경 내용을 <summary> 태그로 설명해주세요.'
    });
    
    var payload = JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8000,
      system: '당신은 Puppeteer 웹 크롤링 코드 전문 편집자입니다.\n'
        + '규칙:\n'
        + '1. 수정된 전체 함수 코드를 <code> 태그 안에 반환하세요.\n'
        + '2. 기존 코드의 구조와 스타일(var 사용, function 키워드 등)을 유지하세요.\n'
        + '3. ES5 호환 코드를 작성하세요 (const/let/arrow function 금지, var 사용).\n'
        + '4. 한글 로그 메시지를 유지하세요.\n'
        + '5. checkAbort() 호출을 적절한 위치에 유지하세요.\n'
        + '6. 변경 사항을 <summary> 태그 안에 한국어로 간단히 설명하세요.\n'
        + '7. 코드 외의 설명은 최소화하세요.\n'
        + '8. 첨부된 스크린샷이 있다면, 화면의 오류/상태를 분석하여 코드에 반영하세요.',
      messages: [
        {
          role: 'user',
          content: userContent
        }
      ]
    });
    
    var result = await new Promise(function(resolve, reject) {
      var options = {
        hostname: 'api.anthropic.com',
        port: 443,
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Length': Buffer.byteLength(payload)
        }
      };
      var body = '';
      var request = https.request(options, function(resp) {
        resp.on('data', function(d) { body += d; });
        resp.on('end', function() {
          try { resolve(JSON.parse(body)); } catch(e) { reject(new Error('응답 파싱 실패')); }
        });
      });
      request.on('error', function(e) { reject(e); });
      request.write(payload);
      request.end();
    });
    
    if (result.error) return res.json({ ok: false, error: result.error.message || 'API 오류' });
    
    var text = (result.content && result.content[0]) ? result.content[0].text : '';
    
    // <code> 태그에서 코드 추출
    var codeMatch = text.match(/<code>([\s\S]*?)<\/code>/);
    var newCode = codeMatch ? codeMatch[1].trim() : '';
    
    // <summary> 태그에서 설명 추출
    var summaryMatch = text.match(/<summary>([\s\S]*?)<\/summary>/);
    var summary = summaryMatch ? summaryMatch[1].trim() : '변경 사항 설명 없음';
    
    if (!newCode) {
      // code 태그 없으면 ```javascript 블록에서 추출 시도
      var jsMatch = text.match(/```(?:javascript|js)?\s*\n([\s\S]*?)```/);
      newCode = jsMatch ? jsMatch[1].trim() : '';
    }
    
    if (!newCode) return res.json({ ok: false, error: 'AI 응답에서 코드를 추출할 수 없습니다.', raw: text.substring(0, 500) });
    
    log('pipeline', '✅ AI 코드 생성 완료: ' + summary.substring(0, 80));
    
    res.json({
      ok: true,
      funcName: funcName,
      originalCode: info.code,
      newCode: newCode,
      summary: summary,
      startLine: info.startLine,
      lineCount: info.lineCount
    });
    
  } catch(e) {
    log('pipeline', '❌ AI 편집 오류: ' + e.message, 'error');
    res.json({ ok: false, error: e.message });
  }
});

// 코드 적용 API (실제 server.js 수정)
app.post('/api/pipeline/apply', function(req, res) {
  var funcName = req.body.funcName;
  var newCode = req.body.newCode;
  
  if (!funcName || !newCode) return res.json({ ok: false, error: '함수명과 새 코드가 필요합니다.' });
  
  var fs = require('fs');
  var code = fs.readFileSync(__filename, 'utf8');
  var info = extractFunctionCode(funcName);
  if (!info) return res.json({ ok: false, error: '함수를 찾을 수 없음' });
  
  // 백업
  var backupPath = __filename + '.backup.' + Date.now();
  fs.writeFileSync(backupPath, code, 'utf8');
  log('pipeline', '💾 백업 생성: ' + backupPath.split('/').pop());
  
  // 코드 교체
  var newFullCode = code.replace(info.code, newCode);
  fs.writeFileSync(__filename, newFullCode, 'utf8');
  
  log('pipeline', '✅ ' + funcName + ' 코드 적용됨 (재시작 필요)', 'success');
  res.json({ ok: true, backup: backupPath.split('/').pop(), msg: funcName + ' 수정 적용됨. 서버 재시작 후 반영됩니다.' });
});

// 코드 롤백 API
app.post('/api/pipeline/rollback', function(req, res) {
  var fs = require('fs');
  var dir = require('path').dirname(__filename);
  var files = fs.readdirSync(dir).filter(function(f) { return f.indexOf('.backup.') >= 0; }).sort().reverse();
  if (files.length === 0) return res.json({ ok: false, error: '백업 파일이 없습니다.' });
  
  var latestBackup = require('path').join(dir, files[0]);
  var backupCode = fs.readFileSync(latestBackup, 'utf8');
  fs.writeFileSync(__filename, backupCode, 'utf8');
  
  log('pipeline', '⏪ 롤백 완료: ' + files[0], 'success');
  res.json({ ok: true, backup: files[0], msg: '롤백 완료. 서버 재시작 후 반영됩니다.' });
});

// ═══ AI 자가진단 API ═══
app.get('/api/ai/history', function(req, res) {
  res.json({ history: aiDiagHistory });
});

app.post('/api/ai/diagnose', async function(req, res) {
  var service = req.body.service || 'la2fdoci';
  var errorMsg = req.body.error || '수동 진단 요청';
  try {
    var diag = await aiDiagnose(service, errorMsg, { extra: req.body.extra || '' });
    res.json({ ok: true, diag: diag });
  } catch(e) {
    res.json({ ok: false, error: e.message });
  }
});

app.post('/api/ai/config', function(req, res) {
  // 관리자 PIN 확인
  var pin = req.body.pin || '';
  var admin = STATE.staff.find(function(s) { return s.role === 'admin'; });
  if (admin && pin !== admin.pin) {
    return res.json({ ok: false, error: '관리자 PIN이 필요합니다' });
  }
  if (req.body.apiKey !== undefined) {
    process.env.ANTHROPIC_API_KEY = req.body.apiKey;
    // .env에도 저장
    try {
      var envPath = path.join(__dirname, '.env');
      var envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
      if (envContent.indexOf('ANTHROPIC_API_KEY=') >= 0) {
        envContent = envContent.replace(/ANTHROPIC_API_KEY=.*/g, 'ANTHROPIC_API_KEY=' + req.body.apiKey);
      } else {
        envContent += '\nANTHROPIC_API_KEY=' + req.body.apiKey;
      }
      fs.writeFileSync(envPath, envContent);
    } catch(e) {}
    log('ai', 'API 키 ' + (req.body.apiKey ? '설정됨 (마스킹: ...' + req.body.apiKey.slice(-6) + ')' : '삭제됨'));
  }
  // 키 값은 절대 반환하지 않음 (유무만)
  var key = process.env.ANTHROPIC_API_KEY || '';
  res.json({ ok: true, hasKey: !!key, keyHint: key ? '...' + key.slice(-6) : '' });
});

app.post('/api/ticket/use', async function(req, res) {
  try {
    var result = await processUse(req.body.ticketId, req.body.useQty);
    
    // ★ 브라우저 인쇄용 띠지 HTML (프린터 설치 불필요, 브라우저에서 직접 출력)
    if (result.ok && result.needBand) {
      var tk = result.ticket;
      var printQty = result.split ? parseInt(req.body.useQty) || 1 : (tk.personCount || tk.qty || 1);
      var bandsHtml = '';
      for (var bi = 0; bi < printQty; bi++) {
        bandsHtml += buildBandHtml2({
          name: tk.buyer, phone4: (tk.phone || '').replace(/[^0-9]/g, '').slice(-4),
          ticketType: tk.product, platform: tk.source,
          adultCount: printQty, childCount: 0,
          date: new Date().toISOString().substring(0, 10)
        }, bi + 1, printQty);
      }
      result.bandPageHtml = wrapBandPage2(bandsHtml);
      result.printBands = printQty;
    }
    
    res.json(result);
  } catch(e) {
    log('system', '❌ /api/ticket/use 오류: ' + e.message, 'error');
    res.json({ ok: false, error: '서버 오류: ' + e.message });
  }
});

// ═══ 고객용 티켓 조회 API ═══
app.get('/api/ticket/find', function(req, res) {
  var code = (req.query.code || '').trim();
  if (!code) return res.json({ ok: false, error: '코드를 입력해주세요' });
  
  // QR URL 처리: https://jamsabak.kr/qr/XXXX → XXXX
  var qrMatch = code.match(/qr\/([^\/\?]+)/);
  if (qrMatch) code = qrMatch[1];
  
  // 전화번호 뒷4자리 → 다건 반환
  var isPhoneSearch = /^\d{4}$/.test(code);
  
  if (isPhoneSearch) {
    var matches = STATE.tickets.filter(function(t) {
      return t.phone && t.phone.replace(/[^0-9]/g, '').slice(-4) === code;
    }).filter(function(t) {
      return ['사용가능', '확정'].indexOf(t.status) >= 0;
    });
    
    if (matches.length === 0) return res.json({ ok: false, error: '해당 번호의 사용가능한 입장권이 없습니다' });
    
    return res.json({
      ok: true,
      multiple: matches.length > 1,
      tickets: matches.map(function(tk) {
        return {
          id: tk.id, buyer: tk.buyer,
          product: (tk.product || '').substring(0, 40),
          qty: tk.qty || 1, price: tk.price || 0,
          status: tk.status, source: tk.source,
          usedAt: tk.usedAt || null,
          orderNo: tk.orderNo ? '#' + String(tk.orderNo).slice(-6) : '',
          isOption: tk.isOption || false
        };
      })
    });
  }
  
  // 단건 조회
  var tk = STATE.tickets.find(function(t) {
    return t.couponNo === code || t.orderNo === code || String(t.id) === code;
  });
  
  if (!tk) return res.json({ ok: false, error: '유효하지 않은 코드입니다' });
  
  // 고객에게 필요한 정보만 반환
  res.json({
    ok: true,
    ticket: {
      id: tk.id, buyer: tk.buyer,
      product: (tk.product || '').substring(0, 40),
      qty: tk.qty || 1, price: tk.price || 0,
      status: tk.status, source: tk.source,
      usedAt: tk.usedAt || null,
      orderNo: tk.orderNo ? '#' + String(tk.orderNo).slice(-6) : '',
      isOption: tk.isOption || false
    }
  });
});

// ═══ 고객 페이지 라우트 ═══
app.get('/c', function(req, res) { res.sendFile(path.join(__dirname, 'public', 'customer.html')); });
app.get('/customer', function(req, res) { res.sendFile(path.join(__dirname, 'public', 'customer.html')); });
app.get('/v', function(req, res) { res.sendFile(path.join(__dirname, 'public', 'visit.html')); });
app.get('/visit', function(req, res) { res.sendFile(path.join(__dirname, 'public', 'visit.html')); });
app.get('/admin', function(req, res) { res.sendFile(path.join(__dirname, 'public', 'index.html')); });
app.get('/r', function(req, res) { res.sendFile(path.join(__dirname, 'public', 'review.html')); });
app.get('/review', function(req, res) { res.sendFile(path.join(__dirname, 'public', 'review.html')); });
app.get('/reward/:code', function(req, res) { res.sendFile(path.join(__dirname, 'public', 'review.html')); });

// ═══ 리뷰 이벤트 API ═══

// 리뷰 제출 (고객)
app.post('/api/review/submit', async function(req, res) {
  var b = req.body;
  if (!b.phone) return res.json({ ok: false, error: '전화번호를 입력해주세요' });
  if (!b.platform) return res.json({ ok: false, error: '리뷰 플랫폼을 선택해주세요' });
  if (!b.rewardId) return res.json({ ok: false, error: '리워드를 선택해주세요' });
  
  var phone = b.phone.replace(/[^0-9]/g, '');
  if (phone.length < 10) return res.json({ ok: false, error: '올바른 전화번호를 입력해주세요' });
  
  // 같은 번호로 이미 참여했는지 확인
  var existing = STATE.reviews.find(function(r) {
    return r.phone === phone && r.platform === b.platform && !r.expired;
  });
  if (existing) return res.json({ ok: false, error: '이미 해당 플랫폼으로 참여하셨습니다' });
  
  // 리워드 찾기
  var reward = STATE.rewardConfig.rewards.find(function(rw) { return rw.id === b.rewardId; });
  if (!reward) return res.json({ ok: false, error: '유효하지 않은 리워드입니다' });
  
  // 리뷰 등록
  var rewardCode = 'RW' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 5).toUpperCase();
  var review = {
    id: 'rev_' + Date.now(),
    phone: phone,
    name: b.name || '',
    platform: b.platform,       // naver, momcafe, sns
    reviewUrl: b.reviewUrl || '',
    reviewNote: b.reviewNote || '',
    rewardId: b.rewardId,
    rewardName: reward.name,
    rewardCode: rewardCode,
    status: 'issued',           // issued → used → expired
    createdAt: new Date().toISOString(),
    usedAt: null,
    expired: false,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30일
  };
  
  STATE.reviews.push(review);
  log('review', '🎁 리뷰 리워드 발급: ' + (b.name || phone) + ' → ' + reward.name + ' [' + b.platform + '] 코드: ' + rewardCode, 'success');
  broadcast({ type: 'reviewUpdate', data: review });
  
  // SMS 발송 (리워드 QR코드)
  var cfg = STATE.config.msg;
  var baseUrl = cfg.baseUrl || ('http://localhost:' + (process.env.PORT || 3500));
  var rewardUrl = baseUrl + '/reward/' + rewardCode;
  var smsMsg = '[한국잠사박물관 리뷰이벤트]\n'
    + (b.name || '고객') + '님 감사합니다!\n\n'
    + '🎁 리워드: ' + reward.emoji + ' ' + reward.name + '\n'
    + '📱 교환 링크: ' + rewardUrl + '\n\n'
    + '매표소에서 위 링크를 보여주세요.\n'
    + (reward.id === 'ticket' ? '※ 다음날부터 본인만 사용가능\n' : '')
    + '유효기간: 30일';
  
  try {
    var sendResult;
    if (cfg.provider === 'aligo') sendResult = await sendAligo(phone, smsMsg);
    else if (cfg.provider === 'coolsms') sendResult = await sendCoolSms(phone, smsMsg);
    
    if (sendResult && sendResult.ok) {
      review.smsSent = true;
      log('review', '  📱 리워드 SMS 발송 완료 → ' + phone, 'success');
    }
  } catch(e) {
    log('review', '  ⚠️ SMS 발송 실패: ' + e.message, 'warning');
  }
  
  res.json({ ok: true, review: { rewardCode: rewardCode, rewardName: reward.name, rewardEmoji: reward.emoji, rewardUrl: rewardUrl } });
});

// 리워드 조회 (코드로)
app.get('/api/review/reward/:code', function(req, res) {
  var review = STATE.reviews.find(function(r) { return r.rewardCode === req.params.code; });
  if (!review) return res.json({ ok: false, error: '유효하지 않은 코드입니다' });
  
  // 만료 확인
  if (new Date() > new Date(review.expiresAt)) {
    review.expired = true;
    review.status = 'expired';
  }
  
  res.json({
    ok: true,
    reward: {
      code: review.rewardCode,
      name: review.rewardName,
      status: review.status,
      platform: review.platform,
      createdAt: review.createdAt,
      usedAt: review.usedAt,
      expiresAt: review.expiresAt,
      customerName: review.name,
      rewardId: review.rewardId,
    }
  });
});

// 리워드 사용처리 (매표소)
app.post('/api/review/use', function(req, res) {
  var code = req.body.code;
  var review = STATE.reviews.find(function(r) { return r.rewardCode === code; });
  if (!review) return res.json({ ok: false, error: '유효하지 않은 리워드 코드' });
  if (review.status === 'used') return res.json({ ok: false, error: '이미 사용된 리워드입니다' });
  if (review.expired || new Date() > new Date(review.expiresAt)) {
    review.expired = true;
    review.status = 'expired';
    return res.json({ ok: false, error: '만료된 리워드입니다' });
  }
  
  review.status = 'used';
  review.usedAt = new Date().toISOString();
  log('review', '✅ 리워드 사용: ' + review.rewardCode + ' ' + review.rewardName + ' (' + (review.name || review.phone) + ')', 'success');
  broadcast({ type: 'reviewUpdate', data: review });
  
  res.json({ ok: true, reward: review });
});

// 리뷰 전체 목록 (관리자)
app.get('/api/reviews', function(req, res) {
  res.json({ ok: true, reviews: STATE.reviews });
});

app.post('/api/ticket/add', function(req, res) {
  var tk = addManualOrder(req.body);
  res.json({ ok: true, ticket: tk });
});

// 티켓 수정
app.post('/api/ticket/edit', function(req, res) {
  var b = req.body;
  var tk = STATE.tickets.find(function(t) { return String(t.id) === String(b.ticketId); });
  if (!tk) return res.json({ ok: false, error: '티켓 없음' });
  var changed = [];
  if (b.buyer !== undefined && b.buyer !== tk.buyer) { tk.buyer = b.buyer; changed.push('구매자'); }
  if (b.phone !== undefined && b.phone !== tk.phone) { tk.phone = b.phone; changed.push('전화번호'); }
  if (b.product !== undefined && b.product !== tk.product) { tk.product = b.product; changed.push('상품'); }
  if (b.qty !== undefined && parseInt(b.qty) !== tk.qty) { tk.qty = parseInt(b.qty); tk.personCount = tk.qty; changed.push('매수'); }
  if (b.price !== undefined && parseInt(b.price) !== tk.price) { tk.price = parseInt(b.price); tk.items = [{ n: tk.product, p: tk.price }]; changed.push('금액'); }
  if (b.status !== undefined && b.status !== tk.status) { tk.status = b.status; changed.push('상태→' + b.status); }
  if (changed.length > 0) {
    log('ticket', '✏️ ' + tk.buyer + ' 수정: ' + changed.join(', '));
    broadcast({ type: 'ticketUpdate', data: tk });
  }
  res.json({ ok: true, ticket: tk, changed: changed });
});

// 티켓 삭제
app.post('/api/ticket/delete', function(req, res) {
  var idx = STATE.tickets.findIndex(function(t) { return String(t.id) === String(req.body.ticketId); });
  if (idx < 0) return res.json({ ok: false, error: '티켓 없음' });
  var removed = STATE.tickets.splice(idx, 1)[0];
  log('ticket', '🗑️ ' + removed.buyer + ' (' + removed.orderNo + ') 삭제');
  broadcast({ type: 'state', data: { tickets: STATE.tickets } });
  res.json({ ok: true });
});

// 임의 사용처리 (관리자 페이지 연동 없이)
app.post('/api/ticket/force-use', function(req, res) {
  var tk = STATE.tickets.find(function(t) { return String(t.id) === String(req.body.ticketId); });
  if (!tk) return res.json({ ok: false, error: '티켓 없음' });
  tk.status = '사용완료';
  tk.usedAt = new Date().toISOString();
  tk.forcedUse = true;
  log('ticket', '⚡ ' + tk.buyer + ' 임의 사용처리 (관리자페이지 미연동)');
  // 사용처리 이력
  var useEntry = {
    id: 'USE-' + Date.now(), time: tk.usedAt, ticketId: String(tk.id), orderNo: tk.orderNo,
    buyer: tk.buyer, phone: tk.phone, product: tk.product, qty: tk.qty || 1,
    price: tk.price || 0, source: tk.source, method: 'force',
    adminOk: false, okposOk: false, steps: ['임의 사용완료'],
  };
  STATE.useHistory.unshift(useEntry);
  if (STATE.useHistory.length > 500) STATE.useHistory.length = 500;
  broadcast({ type: 'useLog', data: useEntry });
  broadcast({ type: 'ticketUpdate', data: tk });
  res.json({ ok: true, ticket: tk });
});

// ═══ 사용처리 확인 API ═══
// ═══ 티켓 복구 API (사용완료/부분사용 → 사용가능) ═══
app.post('/api/ticket/restore', async function(req, res) {
  try {
    var tk = STATE.tickets.find(function(t) { return String(t.id) === String(req.body.ticketId); });
    if (!tk) return res.json({ ok: false, error: '티켓 없음' });
    if (tk.status !== '사용완료' && tk.status !== '부분사용') return res.json({ ok: false, error: '사용완료/부분사용 상태만 복구 가능' });
    
    log('system', '↩ ' + tk.buyer + ' 티켓 복구 시작: ' + tk.status + ' → 사용가능 (#' + (tk.orderNo || tk.id) + ')');
    
    // ★ 1) 관리자 사이트에서 자동 복구 (API 기반)
    var adminRestore = false;
    if (tk.source === 'la2fdoci') {
      log('la2fdoci', '↩ 관리자 사이트 복구 시도...');
      try { adminRestore = await la2fRestoreAvailable(tk); } catch(e) { log('la2fdoci', '복구 예외: ' + e.message, 'error'); }
      log('la2fdoci', adminRestore ? '✅ 사이트 복구 성공' : '⚠️ 사이트 복구 실패 (수동 확인 필요)', adminRestore ? 'success' : 'warning');
    } else if (tk.source === 'naver') {
      log('naver', '↩ 네이버 복구 시도...');
      try { adminRestore = await naverRestoreAvailable(tk); } catch(e) { log('naver', '복구 예외: ' + e.message, 'error'); }
      log('naver', adminRestore ? '✅ 네이버 복구 성공' : '⚠️ 네이버 복구 실패 (수동 확인 필요)', adminRestore ? 'success' : 'warning');
    }
    
    // ★ 2) 분할 잔여티켓 삭제
    var removedCount = 0;
    if (tk.status === '부분사용') {
      var beforeLen = STATE.tickets.length;
      STATE.tickets = STATE.tickets.filter(function(t) {
        // 이 티켓의 분할 잔여(parentId가 일치하는 것) 삭제
        if (t.parentId && String(t.parentId) === String(tk.id)) {
          log('system', '  🗑 잔여티켓 삭제: ' + t.id + ' (' + (t.qty || 1) + '매)');
          return false;
        }
        return true;
      });
      removedCount = beforeLen - STATE.tickets.length;
    }
    
    // 원래 매수 복원 (분할이었던 경우)
    if (tk.originalQty) {
      tk.qty = tk.originalQty;
      tk.personCount = tk.originalQty;
      // 가격도 원래대로 (원본 가격은 splitHistory나 items에서 추정)
      if (tk.splitHistory && tk.splitHistory.length > 0) {
        // 분할 전 가격 = 현재 가격 / 사용매수 * 원래매수
        var origPrice = Math.round((tk.price || 0) * tk.originalQty / (tk.usedQty || tk.qty || 1));
        tk.price = origPrice;
      }
      tk.originalQty = null;
    }
    
    // 상태 초기화
    tk.status = '사용가능';
    tk.usedAt = null;
    tk.posOk = false;
    tk.txnId = null;
    tk.okposRegistered = false;
    tk.adminOk = null;
    tk.adminVerified = null;
    tk.verifiedAt = null;
    tk.verifyMsg = null;
    tk.verifyDetail = null;
    tk.usedQty = null;
    tk.remainQty = null;
    tk.forcedUse = false;
    
    // posLog에서 해당 건 제거
    var posRemoved = 0;
    STATE.posLog = STATE.posLog.filter(function(p) {
      if (String(p.ticketId) === String(tk.id)) { posRemoved++; return false; }
      return true;
    });
    
    // useHistory에서도 제거
    if (STATE.useHistory) {
      STATE.useHistory = STATE.useHistory.filter(function(u) {
        return String(u.ticketId) !== String(tk.id);
      });
    }
    
    log('system', '✅ 복구 완료: ' + tk.buyer + ' ' + (tk.qty || 1) + '매 (사이트:' + (adminRestore ? '✓' : '△') + ' 잔여삭제:' + removedCount + '건 POS삭제:' + posRemoved + '건)', 'success');
    
    sendState();
    res.json({ ok: true, ticket: tk, tickets: STATE.tickets, adminRestore: adminRestore });
  } catch(e) {
    log('system', '❌ 복구 오류: ' + e.message, 'error');
    res.json({ ok: false, error: '서버 오류: ' + e.message });
  }
});

app.post('/api/ticket/naver-cancel', async function(req, res) {
  try {
    var tk = STATE.tickets.find(function(t) { return String(t.id) === String(req.body.ticketId); });
    if (!tk) return res.json({ ok: false, error: '티켓 없음' });
    if (tk.source !== 'naver') return res.json({ ok: false, error: '네이버 티켓만 취소 가능' });
    if (tk.status === '예매취소') return res.json({ ok: false, error: '이미 취소된 티켓' });
    
    var reason = req.body.reason || '관리자 취소';
    log('system', '🚫 ' + tk.buyer + ' 네이버 예매취소 시작 (#' + (tk.orderNo || tk.id) + ', 사유: ' + reason + ')');
    
    var result = await naverCancelBooking(tk, reason);
    
    if (result.ok) {
      tk.status = '예매취소';
      tk.cancelReason = reason;
      tk.cancelTime = new Date().toISOString();
      log('system', '✅ ' + tk.buyer + ' 예매취소 완료', 'success');
      sendState();
      res.json({ ok: true, ticket: tk });
    } else {
      log('system', '❌ 예매취소 실패: ' + (result.msg || ''), 'error');
      res.json({ ok: false, error: result.msg || '취소 실패' });
    }
  } catch(e) {
    log('system', '❌ 예매취소 오류: ' + e.message, 'error');
    res.json({ ok: false, error: e.message });
  }
});

app.post('/api/ticket/sync-verify', async function(req, res) {
  try {
    log('system', '🔄 수동 동기화 검증 요청');
    res.json({ ok: true, msg: '검증 시작' });
    await verifyTicketSync();
  } catch(e) {
    log('system', '동기화 검증 오류: ' + e.message, 'error');
  }
});

// ★ 잘못된 옵션 티켓 정리 (메타데이터 필드명으로 생성된 것들만)
app.post('/api/ticket/cleanup-options', function(req, res) {
  var badOptions = STATE.tickets.filter(function(t) {
    return t.isOption && !isValidOptionName(t.product);
  });
  if (badOptions.length > 0) {
    log('system', '🧹 잘못된 옵션 티켓 ' + badOptions.length + '건 정리: ' + badOptions.map(function(t) { return t.buyer + ':' + t.product; }).join(', '), 'warning');
    STATE.tickets = STATE.tickets.filter(function(t) {
      return !(t.isOption && !isValidOptionName(t.product));
    });
    sendState();
    res.json({ ok: true, removed: badOptions.length, items: badOptions.map(function(t) { return { id: t.id, buyer: t.buyer, product: t.product }; }) });
  } else {
    res.json({ ok: true, removed: 0, msg: '정리할 항목 없음' });
  }
});

// ★ la2fdoci API 테스트 (검색 + 상태변경 테스트)
app.post('/api/la2f/api-test', async function(req, res) {
  try {
    if (!STATE.sessions.la2fdoci) return res.json({ ok: false, msg: '로그인 필요' });
    var phone = req.body.phone || '';
    log('la2fdoci', '🧪 API 테스트: ' + (phone || '전체'));
    var orders = await la2fApiSearchOrders(phone || null, null);
    res.json({ ok: true, count: orders.length, orders: orders.slice(0, 20) });
  } catch(e) {
    res.json({ ok: false, msg: e.message });
  }
});

// ★ la2fdoci API 수동 상태변경
app.post('/api/la2f/change-status', async function(req, res) {
  try {
    if (!STATE.sessions.la2fdoci) return res.json({ ok: false, msg: '로그인 필요' });
    var ids = req.body.ids || [];
    var status = req.body.status || 1; // 0=사용가능, 1=사용완료, 2=취소
    if (!ids.length) return res.json({ ok: false, msg: 'ids 필요' });
    var ok = await la2fApiChangeStatus(ids, status);
    res.json({ ok: ok });
  } catch(e) {
    res.json({ ok: false, msg: e.message });
  }
});

app.post('/api/ticket/pos-compare', async function(req, res) {
  try {
    var body = req.body || {};
    var sendKakao = body.sendKakao !== false;  // 기본 true
    log('system', '📊 수동 POS↔티켓 대조 요청' + (sendKakao ? ' (카톡 전송)' : ''));
    res.json({ ok: true, msg: '대조 시작' });
    await posTicketCompare(sendKakao);
  } catch(e) {
    log('system', 'POS 대조 오류: ' + e.message, 'error');
  }
});

app.get('/api/ticket/pos-compare', function(req, res) {
  res.json({ ok: true, data: STATE.lastPosCompare || null });
});

// ═══ OKPOS 매출 ═══
app.get('/api/sales', function(req, res) {
  if (STATE.salesData) return res.json(STATE.salesData);
  res.status(404).json({ error: 'no data' });
});

// ═══ 월간 매출 크롤링 API ═══
// ═══ 네이버 리뷰 크롤링 + AI 분석 ═══
// ═══ 네이버 스마트플레이스 통계 크롤링 ═══
app.post('/api/naver/stats', async function(req, res) {
  try {
    var body = req.body || {};
    var period = body.period || 'weekly'; // weekly / monthly
    
    log('naver', '📊 스마트플레이스 통계 크롤링 (' + period + ')...');
    
    var page = await getPage('naver');
    if (!STATE.sessions.naver) {
      if (!(await naverLogin())) return res.json({ ok: false, error: '네이버 로그인 필요. 설정에서 네이버 ID/PW 확인' });
      page = STATE.pages.naver;
    }
    
    // 스마트플레이스 통계 페이지로 이동
    var statsUrl = 'https://new.smartplace.naver.com/bizes/' + (STATE.config.naver.placeId || '4789821') + '/stats/report';
    log('naver', '  통계 페이지: ' + statsUrl);
    
    try {
      await page.goto(statsUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    } catch(e) {
      // 로그인 페이지로 리다이렉트될 수 있음
      STATE.sessions.naver = false;
      if (!(await naverLogin())) return res.json({ ok: false, error: '네이버 재로그인 필요' });
      page = STATE.pages.naver;
      await page.goto(statsUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    }
    
    await new Promise(function(r) { setTimeout(r, 3000); });
    
    // 주간 선택 확인
    if (period === 'weekly') {
      try {
        await page.evaluate(function() {
          var selects = document.querySelectorAll('select, [class*="select"], [class*="dropdown"]');
          selects.forEach(function(s) {
            var options = s.querySelectorAll('option');
            options.forEach(function(o) {
              if (o.textContent.indexOf('주간') >= 0) { s.value = o.value; s.dispatchEvent(new Event('change')); }
            });
          });
          // 주간 버튼 클릭
          var btns = document.querySelectorAll('button, [role="tab"]');
          btns.forEach(function(b) { if (b.textContent.trim() === '주간') b.click(); });
        });
        await new Promise(function(r) { setTimeout(r, 2000); });
      } catch(e) {}
    }
    
    // 페이지 텍스트 추출
    var pageText = await page.evaluate(function() {
      return document.body.innerText;
    });
    
    // 기간 추출
    var periodMatch = pageText.match(/(\d{2,4})[.\s]*(\d{1,2})[.\s]*(\d{1,2})[.\s]*[~\-][.\s]*(\d{1,2})[.\s]*(\d{1,2})/);
    var periodStr = periodMatch ? periodMatch[0] : '';
    
    // 핵심 지표 추출
    var stats = {
      period: periodStr,
      crawledAt: new Date().toISOString(),
      placeVisits: 0, placeVisitsPrev: 0, placeVisitsChange: '',
      reservations: 0, reservationsPrev: 0, reservationsChange: '',
      smartCalls: 0, smartCallsPrev: 0, smartCallsChange: '',
      reviews: 0, reviewsPrev: 0, reviewsChange: '',
      revenue: 0, revenuePrev: 0, revenueChange: '',
      searchKeywords: [],
      details: pageText.substring(0, 3000)
    };
    
    // 패턴 매칭으로 지표 추출
    var visitM = pageText.match(/플레이스\s*유입[^\d]*(\d[\d,]*)\s*회/);
    if (visitM) stats.placeVisits = parseInt(visitM[1].replace(/,/g, ''));
    var visitPM = pageText.match(/플레이스\s*유입[^]*?지난\s*기간\s*(\d[\d,]*)\s*회/);
    if (visitPM) stats.placeVisitsPrev = parseInt(visitPM[1].replace(/,/g, ''));
    var visitCM = pageText.match(/플레이스\s*유입[^\d]*[▼▲↓↑]?\s*([\-\+]?\d+)%/);
    if (visitCM) stats.placeVisitsChange = visitCM[1] + '%';
    
    var resM = pageText.match(/예약[·\s]*주문\s*신청[^\d]*(\d[\d,]*)\s*회/);
    if (resM) stats.reservations = parseInt(resM[1].replace(/,/g, ''));
    var resPM = pageText.match(/예약[·\s]*주문\s*신청[^]*?지난\s*기간\s*(\d[\d,]*)\s*회/);
    if (resPM) stats.reservationsPrev = parseInt(resPM[1].replace(/,/g, ''));
    
    var callM = pageText.match(/스마트콜\s*통화[^\d]*(\d[\d,]*)\s*회/);
    if (callM) stats.smartCalls = parseInt(callM[1].replace(/,/g, ''));
    var callPM = pageText.match(/스마트콜\s*통화[^]*?지난\s*기간\s*(\d[\d,]*)\s*회/);
    if (callPM) stats.smartCallsPrev = parseInt(callPM[1].replace(/,/g, ''));
    
    var revM = pageText.match(/리뷰\s*등록[^\d]*(\d[\d,]*)\s*회/);
    if (revM) stats.reviews = parseInt(revM[1].replace(/,/g, ''));
    var revPM = pageText.match(/리뷰\s*등록[^]*?지난\s*기간\s*(\d[\d,]*)\s*회/);
    if (revPM) stats.reviewsPrev = parseInt(revPM[1].replace(/,/g, ''));
    
    var revnM = pageText.match(/매출액[은\s]*(\d[\d,]*)\s*원/);
    if (revnM) stats.revenue = parseInt(revnM[1].replace(/,/g, ''));
    
    // 검색 키워드 추출
    var kwSection = pageText.match(/유입\s*([\s\S]*?)(?:유입\s*더보기|스마트콜)/);
    if (kwSection) {
      var kwLines = kwSection[1].split('\n').filter(function(l) { return l.trim().match(/^\d+\s+.+\s+[\d,]+회?$/); });
      kwLines.forEach(function(l) {
        var m2 = l.trim().match(/^(\d+)\s+(.+?)\s+([\d,]+)/);
        if (m2) stats.searchKeywords.push({ rank: parseInt(m2[1]), keyword: m2[2].trim(), count: parseInt(m2[3].replace(/,/g, '')) });
      });
    }
    // 간단한 키워드 추출 폴백
    if (stats.searchKeywords.length === 0) {
      var kwMatches = pageText.match(/(네이버검색|네이버지도|네이버블로그|네이버모바일메인|웹사이트)[^\d]*(\d[\d,]*)\s*회/g);
      if (kwMatches) {
        kwMatches.forEach(function(m3, i) {
          var m4 = m3.match(/(.+?)\s*(\d[\d,]*)\s*회/);
          if (m4) stats.searchKeywords.push({ rank: i + 1, keyword: m4[1].trim(), count: parseInt(m4[2].replace(/,/g, '')) });
        });
      }
    }
    
    // 캐시 저장
    if (!STATE.naverStats) STATE.naverStats = [];
    STATE.naverStats.unshift(stats);
    if (STATE.naverStats.length > 20) STATE.naverStats.length = 20;
    
    log('naver', '📊 통계 수집 완료: 유입 ' + stats.placeVisits + '회, 예약 ' + stats.reservations + '회, 매출 ₩' + stats.revenue.toLocaleString(), 'success');
    
    res.json({ ok: true, stats: stats, history: STATE.naverStats.slice(0, 10) });
  } catch(e) {
    log('naver', '통계 크롤링 오류: ' + e.message, 'error');
    res.json({ ok: false, error: e.message });
  }
});

app.post('/api/reviews/crawl', async function(req, res) {
  try {
    var body = req.body || {};
    var dateFrom = body.dateFrom || '';
    var dateTo = body.dateTo || new Date().toISOString().split('T')[0];
    var maxPages = body.maxPages || 5;
    
    log('review', '📝 네이버 리뷰 크롤링 시작' + (dateFrom ? ' (' + dateFrom + '~' + dateTo + ')' : ' (최신)'));
    
    // 네이버 지도 리뷰 페이지 (공개 접근)
    var placeUrl = STATE.config.msg.naverPlaceUrl || '';
    var placeId = '1591058710';
    var m = placeUrl.match(/place\/(\d+)/);
    if (m) placeId = m[1];
    
    var reviewUrl = 'https://pcmap.place.naver.com/place/' + placeId + '/review/visitor';
    log('review', '  URL: ' + reviewUrl);
    
    var browser = null;
    try {
      browser = await require('puppeteer').launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });
      var page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      await page.goto(reviewUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      await new Promise(function(r) { setTimeout(r, 3000); });
      
      var reviews = [];
      
      for (var pg = 0; pg < maxPages; pg++) {
        // 리뷰 추출
        var pageReviews = await page.evaluate(function() {
          var items = [];
          var reviewEls = document.querySelectorAll('[class*="review"], [class*="Review"], .pui__X35jYm, .place_section_content li');
          reviewEls.forEach(function(el) {
            var text = '';
            var author = '';
            var date = '';
            var rating = 0;
            var tags = [];
            
            // 텍스트
            var textEl = el.querySelector('[class*="text"], [class*="content"], .pui__vn15t2, .place_review_text');
            if (textEl) text = textEl.textContent.trim();
            
            // 작성자
            var authorEl = el.querySelector('[class*="author"], [class*="nickname"], [class*="user"], .pui__NiSHf8');
            if (authorEl) author = authorEl.textContent.trim();
            
            // 날짜
            var dateEl = el.querySelector('[class*="date"], [class*="time"], [class*="visit"], .pui__QKE5Pr');
            if (dateEl) date = dateEl.textContent.trim();
            
            // 태그/키워드
            el.querySelectorAll('[class*="tag"], [class*="keyword"], .pui__HGwGol').forEach(function(t) {
              tags.push(t.textContent.trim());
            });
            
            if (text && text.length > 5) {
              items.push({ text: text.substring(0, 500), author: author, date: date, tags: tags, rating: rating });
            }
          });
          return items;
        });
        
        reviews = reviews.concat(pageReviews);
        log('review', '  페이지 ' + (pg+1) + ': ' + pageReviews.length + '건 (누적: ' + reviews.length + '건)');
        
        if (pageReviews.length === 0) break;
        
        // 더보기/다음 페이지 클릭
        try {
          var hasMore = await page.evaluate(function() {
            var moreBtn = document.querySelector('[class*="more"], button[class*="fvwqf"]');
            if (moreBtn) { moreBtn.click(); return true; }
            return false;
          });
          if (!hasMore) break;
          await new Promise(function(r) { setTimeout(r, 2000); });
        } catch(e) { break; }
      }
      
      await browser.close();
      browser = null;
      
      // 날짜 필터
      if (dateFrom && reviews.length > 0) {
        reviews = reviews.filter(function(r) {
          if (!r.date) return true;
          var dMatch = r.date.match(/(\d{4})[.\-\/\s]*(\d{1,2})[.\-\/\s]*(\d{1,2})/);
          if (!dMatch) return true;
          var rDate = dMatch[1] + '-' + dMatch[2].padStart(2, '0') + '-' + dMatch[3].padStart(2, '0');
          return rDate >= dateFrom && rDate <= dateTo;
        });
      }
      
      // 중복 제거
      var seen = {};
      reviews = reviews.filter(function(r) {
        var key = r.text.substring(0, 50);
        if (seen[key]) return false;
        seen[key] = true;
        return true;
      });
      
      // 캐시 저장
      STATE.reviewData = { reviews: reviews, crawledAt: new Date().toISOString(), dateFrom: dateFrom, dateTo: dateTo };
      
      log('review', '📝 리뷰 크롤링 완료: ' + reviews.length + '건', 'success');
      broadcast({ type: 'reviewData', data: STATE.reviewData });
      res.json({ ok: true, count: reviews.length, reviews: reviews.slice(0, 50) });
      
    } catch(e) {
      if (browser) await browser.close().catch(function(){});
      throw e;
    }
  } catch(e) {
    log('review', '리뷰 크롤링 오류: ' + e.message, 'error');
    res.json({ ok: false, error: e.message });
  }
});

// ═══ 리뷰 AI 분석 ═══
app.post('/api/reviews/analyze', async function(req, res) {
  try {
    var body = req.body || {};
    var reviews = body.reviews || (STATE.reviewData ? STATE.reviewData.reviews : []) || [];
    
    if (reviews.length === 0) return res.json({ ok: false, error: '리뷰 데이터 없음' });
    
    // 리뷰 텍스트 요약
    var reviewTexts = reviews.slice(0, 30).map(function(r, i) {
      return (i+1) + '. ' + (r.author || '익명') + ' (' + (r.date || '') + '): ' + (r.text || '').substring(0, 200) + (r.tags && r.tags.length > 0 ? ' [태그: ' + r.tags.join(', ') + ']' : '');
    }).join('\n');
    
    // 태그 통계
    var tagCounts = {};
    reviews.forEach(function(r) {
      (r.tags || []).forEach(function(t) {
        tagCounts[t] = (tagCounts[t] || 0) + 1;
      });
    });
    var topTags = Object.keys(tagCounts).sort(function(a, b) { return tagCounts[b] - tagCounts[a]; }).slice(0, 10);
    
    var apiKey = process.env.ANTHROPIC_API_KEY;
    
    if (apiKey) {
      // Claude AI 분석
      var prompt = '당신은 한국의 체험형 테마파크 "한국잠사플레이팜"(충북 청주, 누에/잠사 테마)의 CS 분석 전문가입니다.\n\n'
        + '아래는 최근 네이버 방문자 리뷰 ' + reviews.length + '건입니다.\n\n'
        + reviewTexts + '\n\n'
        + '자주 언급된 태그: ' + topTags.map(function(t) { return t + '(' + tagCounts[t] + ')'; }).join(', ') + '\n\n'
        + '다음을 분석해주세요:\n\n'
        + '## 1. 리뷰 요약\n전체 분위기, 긍정/부정 비율, 핵심 키워드\n\n'
        + '## 2. 고객 만족 포인트\n고객이 가장 좋아하는 점 3~5개 (구체적 인용)\n\n'
        + '## 3. 불만/개선 요구사항\n반복적으로 언급되는 불만 3~5개 + 구체적 개선 방안\n\n'
        + '## 4. 신규 서비스 아이디어\n리뷰에서 파악된 고객 니즈 기반 새로운 서비스/상품 추천 3개\n\n'
        + '## 5. 답글 추천\n부정 리뷰에 대한 모범 답글 예시 2개\n\n'
        + '## 6. 경쟁력 분석\n리뷰 기반 잠사플레이팜의 차별화 포인트와 개선 우선순위\n\n'
        + '간결하고 실무적으로 답변. 한국어.';
      
      try {
        var apiRes = await new Promise(function(resolve, reject) {
          var postData = JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 3000, messages: [{ role: 'user', content: prompt }] });
          var opts = { hostname: 'api.anthropic.com', port: 443, path: '/v1/messages', method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Length': Buffer.byteLength(postData) } };
          var req2 = https.request(opts, function(resp) { var c = []; resp.on('data', function(d) { c.push(d); }); resp.on('end', function() { try { resolve(JSON.parse(Buffer.concat(c).toString())); } catch(e) { reject(e); } }); });
          req2.on('error', reject); req2.write(postData); req2.end();
        });
        if (apiRes.content) {
          var analysis = apiRes.content.map(function(c) { return c.text || ''; }).join('\n');
          return res.json({ ok: true, analysis: analysis, type: 'ai', tagStats: tagCounts, topTags: topTags, count: reviews.length });
        }
      } catch(e) { log('review', 'AI 분석 실패, 규칙기반 폴백: ' + e.message, 'warning'); }
    }
    
    // 규칙 기반 분석
    var analysis = '📝 네이버 리뷰 분석 (' + reviews.length + '건)\n\n';
    
    // 태그 분석
    if (topTags.length > 0) {
      analysis += '🏷 인기 키워드\n';
      topTags.forEach(function(t) { analysis += '  • ' + t + ' (' + tagCounts[t] + '회)\n'; });
      analysis += '\n';
    }
    
    // 감성 분석 (간단 키워드)
    var posWords = ['좋아','만족','추천','친절','재미','즐거','깨끗','넓','다양','최고','맛있','예쁘','편리','아이들'];
    var negWords = ['아쉬','불편','비싸','줄','좁','더럽','부족','없','대기','오래','냄새'];
    var posCount = 0, negCount = 0;
    var posExamples = [], negExamples = [];
    reviews.forEach(function(r) {
      var t = r.text || '';
      var isPos = posWords.some(function(w) { return t.indexOf(w) >= 0; });
      var isNeg = negWords.some(function(w) { return t.indexOf(w) >= 0; });
      if (isPos) { posCount++; if (posExamples.length < 3) posExamples.push('"' + t.substring(0, 80) + '..."'); }
      if (isNeg) { negCount++; if (negExamples.length < 3) negExamples.push('"' + t.substring(0, 80) + '..."'); }
    });
    
    analysis += '😊 긍정 리뷰: ' + posCount + '건 (' + (reviews.length > 0 ? Math.round(posCount / reviews.length * 100) : 0) + '%)\n';
    posExamples.forEach(function(e) { analysis += '  ' + e + '\n'; });
    analysis += '\n😟 개선 필요: ' + negCount + '건 (' + (reviews.length > 0 ? Math.round(negCount / reviews.length * 100) : 0) + '%)\n';
    negExamples.forEach(function(e) { analysis += '  ' + e + '\n'; });
    analysis += '\n💡 .env에 ANTHROPIC_API_KEY를 설정하면 더 상세한 AI 분석을 받을 수 있습니다.';
    
    res.json({ ok: true, analysis: analysis, type: 'rule', tagStats: tagCounts, topTags: topTags, count: reviews.length });
  } catch(e) {
    res.json({ ok: false, error: e.message });
  }
});

// ═══ 리뷰 카톡 발송 ═══
app.post('/api/reviews/send-kakao', async function(req, res) {
  try {
    var body = req.body || {};
    var room = body.room || STATE.config.kakao.dailyRoom || STATE.config.kakao.room || '';
    var summary = body.summary || '';
    if (!room) return res.json({ ok: false, error: '발송방 미설정' });
    if (!summary) return res.json({ ok: false, error: '요약 내용 없음' });
    
    var ok = await sendKakaoPC(summary, room);
    res.json({ ok: ok });
  } catch(e) {
    res.json({ ok: false, error: e.message });
  }
});

app.post('/api/sales/monthly', async function(req, res) {
  try {
    var body = req.body || {};
    var from = body.from;
    var to = body.to;
    if (!from || !to) return res.json({ ok: false, error: '날짜 범위 필요' });
    
    // ★ 사전 로그인 확인 (실패하면 즉시 응답)
    if (!puppeteer) { return res.json({ ok: false, error: 'Puppeteer 없음 (Vercel 모드에서는 OKPOS 크롤링 불가)' }); }
    if (!STATE.config.okpos.id || !STATE.config.okpos.pw) { return res.json({ ok: false, error: 'OKPOS ID/PW 미설정 (설정 탭에서 입력)' }); }
    if (!STATE.sessions.okpos) {
      log('okpos', '📅 월간 크롤링 전 OKPOS 로그인 시도...');
      var loginOk = await okposLogin();
      if (!loginOk) { return res.json({ ok: false, error: 'OKPOS 로그인 실패 — 로그 탭에서 상세 확인' }); }
    }
    
    // 즉시 응답 (크롤링은 백그라운드)
    res.json({ ok: true, message: '일별 크롤링 시작', from: from, to: to });
    
    // 백그라운드에서 일별 순차 크롤링
    var savedData = STATE.salesData;
    STATE._suppressSalesBroadcast = true;
    
    var d1 = new Date(from);
    var d2 = new Date(to);
    var today = new Date().toISOString().split('T')[0];
    var days = {};
    var total = Math.round((d2 - d1) / 86400000) + 1;
    var done = 0;
    
    log('okpos', '📅 월간 일별 크롤링 시작: ' + from + ' ~ ' + to + ' (' + total + '일)');
    broadcast({ type: 'monthlyProgress', data: { done: 0, total: total, status: 'start' } });
    
    for (var cur = new Date(d1); cur <= d2; cur.setDate(cur.getDate() + 1)) {
      var dateStr = cur.toISOString().split('T')[0];
      
      // 미래 날짜 건너뛰기
      if (dateStr > today) { done++; continue; }
      
      // 이미 캐시에 있으면 건너뛰기 (오늘 제외)
      if (STATE.monthlyCache && STATE.monthlyCache[dateStr] && dateStr !== today) {
        days[dateStr] = STATE.monthlyCache[dateStr];
        done++;
        broadcast({ type: 'monthlyProgress', data: { done: done, total: total, date: dateStr, cached: true, sales: days[dateStr].sales, qty: days[dateStr].qty } });
        continue;
      }
      
      try {
        log('okpos', '  📅 [' + (done+1) + '/' + total + '] ' + dateStr + ' 크롤링...');
        await okposSalesCrawl(dateStr, dateStr);
        var data = STATE.salesData;
        
        if (data && data.grandTotal) {
          days[dateStr] = {
            sales: data.grandTotal.total_sales || 0,
            qty: data.grandTotal.qty || 0,
            items: (data.items || []).map(function(i) { return { product: i.product, qty: i.qty, total_sales: i.total_sales || 0 }; })
          };
        } else {
          days[dateStr] = { sales: 0, qty: 0, items: [] };
        }
        
        done++;
        broadcast({ type: 'monthlyProgress', data: { done: done, total: total, date: dateStr, sales: days[dateStr].sales, qty: days[dateStr].qty } });
        
      } catch(e) {
        log('okpos', '  ❌ ' + dateStr + ' 실패: ' + e.message, 'warning');
        days[dateStr] = { sales: 0, qty: 0, error: e.message };
        done++;
        broadcast({ type: 'monthlyProgress', data: { done: done, total: total, date: dateStr, error: e.message } });
      }
      
      // 크롤링 간 딜레이 (서버 부하 방지)
      await new Promise(function(r) { setTimeout(r, 1000); });
    }
    
    // STATE 복원
    STATE.salesData = savedData;
    STATE._suppressSalesBroadcast = false;
    
    // 캐시 저장
    if (!STATE.monthlyCache) STATE.monthlyCache = {};
    Object.keys(days).forEach(function(k) { STATE.monthlyCache[k] = days[k]; });
    
    log('okpos', '📅 월간 크롤링 완료: ' + Object.keys(days).filter(function(k){return days[k].sales>0;}).length + '/' + total + '일 데이터', 'success');
    broadcast({ type: 'monthlyData', data: { days: days, done: true } });
    
  } catch(e) {
    STATE._suppressSalesBroadcast = false;
    log('okpos', '월간 크롤링 오류: ' + e.message, 'error');
    broadcast({ type: 'monthlyData', data: { error: e.message } });
  }
});

// ═══ OKPOS 복수 계정 관리 API ═══
app.post('/api/okpos/accounts', function(req, res) {
  var b = req.body;
  if (b.action === 'list') {
    return res.json({ ok: true, accounts: STATE.config.okpos.accounts || [] });
  }
  if (b.action === 'add') {
    if (!b.id) return res.json({ ok: false, error: 'ID 필요' });
    var accs = STATE.config.okpos.accounts || [];
    accs.push({ id: b.id, pw: b.pw || '', name: b.name || b.id, storeCode: b.storeCode || '', enabled: true });
    STATE.config.okpos.accounts = accs;
    log('okpos', '✅ 계정 추가: ' + b.id + ' (' + (b.name || b.id) + ')');
    return res.json({ ok: true, accounts: accs });
  }
  if (b.action === 'remove') {
    var accs2 = STATE.config.okpos.accounts || [];
    STATE.config.okpos.accounts = accs2.filter(function(a, i) { return i !== b.index; });
    return res.json({ ok: true, accounts: STATE.config.okpos.accounts });
  }
  if (b.action === 'update') {
    var accs3 = STATE.config.okpos.accounts || [];
    if (b.index >= 0 && b.index < accs3.length) {
      if (b.id !== undefined) accs3[b.index].id = b.id;
      if (b.pw !== undefined) accs3[b.index].pw = b.pw;
      if (b.name !== undefined) accs3[b.index].name = b.name;
      if (b.storeCode !== undefined) accs3[b.index].storeCode = b.storeCode;
      if (b.enabled !== undefined) accs3[b.index].enabled = b.enabled;
      if (b.dateFrom !== undefined) accs3[b.index].dateFrom = b.dateFrom;
      if (b.dateTo !== undefined) accs3[b.index].dateTo = b.dateTo;
    }
    return res.json({ ok: true, accounts: accs3 });
  }
  res.json({ ok: false, error: 'action: list/add/remove/update' });
});

// ═══ OKPOS 복수 계정 합산 크롤링 API ═══
app.post('/api/okpos/multi-crawl', async function(req, res) {
  try {
    var body = req.body || {};
    var df = body.dateFrom || new Date().toISOString().split('T')[0];
    var dt = body.dateTo || df;
    var accounts = body.accounts || STATE.config.okpos.accounts || [];
    
    // 활성화된 계정만
    accounts = accounts.filter(function(a) { return a.enabled !== false && a.id; });
    
    // 기본 계정 포함 (accounts가 비어있으면)
    if (accounts.length === 0 && STATE.config.okpos.id) {
      accounts.push({ id: STATE.config.okpos.id, pw: STATE.config.okpos.pw, name: '기본', storeCode: STATE.config.okpos.storeCode });
    }
    
    if (accounts.length === 0) {
      return res.json({ ok: false, error: 'OKPOS 계정이 설정되지 않았습니다.' });
    }
    
    log('okpos', '📊 복수 계정 합산 크롤링: ' + accounts.length + '개 계정' + (body.perAccountDates ? ' (개별 기간)' : ', ' + df + ' ~ ' + dt));
    res.json({ ok: true, msg: '합산 크롤링 시작 (' + accounts.length + '개 계정)' });
    
    var allItems = [];
    var accountResults = [];
    
    for (var ai = 0; ai < accounts.length; ai++) {
      var acc = accounts[ai];
      
      // ★ 검색기간과 계정 유효기간 겹침 확인 (겹치지 않으면 스킵)
      var accValidFrom = acc.dateFrom || '';  // 계정 유효 시작일
      var accValidTo = acc.dateTo || '';      // 계정 유효 종료일 (빈값 = 현재까지)
      var searchFrom = acc._searchFrom || df; // 실제 크롤링할 시작일
      var searchTo = acc._searchTo || dt;     // 실제 크롤링할 종료일
      
      // 겹침 판단: searchFrom <= accValidTo AND searchTo >= accValidFrom
      if (accValidFrom && searchTo < accValidFrom) {
        log('okpos', '  ⏭ ' + acc.name + ' (' + acc.id + ') 스킵: 검색기간(' + searchFrom + '~' + searchTo + ')이 유효기간(' + accValidFrom + '~) 이전');
        accountResults.push({ name: acc.name || acc.id, id: acc.id, skipped: true, reason: '검색기간이 유효기간 이전' });
        continue;
      }
      if (accValidTo && searchFrom > accValidTo) {
        log('okpos', '  ⏭ ' + acc.name + ' (' + acc.id + ') 스킵: 검색기간(' + searchFrom + '~' + searchTo + ')이 유효기간(~' + accValidTo + ') 이후');
        accountResults.push({ name: acc.name || acc.id, id: acc.id, skipped: true, reason: '검색기간이 유효기간 이후' });
        continue;
      }
      
      // 실제 크롤링 기간 = 검색기간과 유효기간의 교집합
      var accFrom = searchFrom;
      var accTo2 = searchTo;
      if (accValidFrom && accFrom < accValidFrom) accFrom = accValidFrom;
      if (accValidTo && accTo2 > accValidTo) accTo2 = accValidTo;
      
      log('okpos', '  [' + (ai+1) + '/' + accounts.length + '] ' + acc.name + ' (' + acc.id + ') ' + accFrom + '~' + accTo2);
      
      // 해당 계정으로 로그인 전환
      var origId = STATE.config.okpos.id;
      var origPw = STATE.config.okpos.pw;
      var origStore = STATE.config.okpos.storeCode;
      
      STATE.config.okpos.id = acc.id;
      STATE.config.okpos.pw = acc.pw;
      STATE.config.okpos.storeCode = acc.storeCode || '';
      STATE.sessions.okpos = false; // 재로그인 필요
      
      // ★ 브라우저 세션 완전 리셋 (계정 전환 시 쿠키 충돌 방지)
      try {
        if (STATE.browsers.okpos) {
          await STATE.browsers.okpos.close().catch(function(){});
          delete STATE.browsers.okpos;
          delete STATE.pages.okpos;
          log('okpos', '  브라우저 리셋 완료');
        }
      } catch(brErr) {}
      await new Promise(function(r) { setTimeout(r, 500); });
      
      try {
        await okposSalesCrawl(accFrom, accTo2);
        
        var accItems = (STATE.salesData && STATE.salesData.items) ? STATE.salesData.items.slice() : [];
        accItems.forEach(function(item) { item._account = acc.name || acc.id; });
        allItems = allItems.concat(accItems);
        
        var accTotal = 0;
        accItems.forEach(function(it) { accTotal += it.total_sales || it.net_sales || 0; });
        accountResults.push({ name: acc.name || acc.id, id: acc.id, items: accItems.length, total: accTotal, dateFrom: accFrom, dateTo: accTo2 });
        
        log('okpos', '  ✅ ' + acc.name + ' (' + accFrom + '~' + accTo2 + '): ' + accItems.length + '건, ₩' + accTotal.toLocaleString());
      } catch(e) {
        log('okpos', '  ❌ ' + acc.name + ': ' + e.message, 'error');
        accountResults.push({ name: acc.name || acc.id, id: acc.id, error: e.message });
      } finally {
        // ★ 항상 원래 계정 복원 + 브라우저 정리
        STATE.config.okpos.id = origId;
        STATE.config.okpos.pw = origPw;
        STATE.config.okpos.storeCode = origStore;
        STATE.sessions.okpos = false;
        try { if (STATE.browsers.okpos) { await STATE.browsers.okpos.close().catch(function(){}); delete STATE.browsers.okpos; delete STATE.pages.okpos; } } catch(brErr2) {}
      }
    }
    
    // ★ 합산 데이터 생성
    var mergedItems = mergeOkposItems(allItems);
    var grandTotal = 0, grandQty = 0;
    mergedItems.forEach(function(it) { grandTotal += it.total_sales || 0; grandQty += it.qty || 0; });
    
    // STATE에 합산 결과 저장
    STATE.salesData = {
      dateFrom: df, dateTo: dt,
      items: mergedItems,
      grand_total: { total_sales: grandTotal, qty: grandQty },
      multi: true, accountResults: accountResults
    };
    
    // ★ 계정별 개별 데이터도 저장
    STATE.salesByAccount = {};
    allItems.forEach(function(it) {
      var acc = it._account || '기본';
      if (!STATE.salesByAccount[acc]) STATE.salesByAccount[acc] = { items: [], total: 0, qty: 0 };
      STATE.salesByAccount[acc].items.push(it);
      STATE.salesByAccount[acc].total += (it.total_sales || 0);
      STATE.salesByAccount[acc].qty += (it.qty || 0);
    });
    
    broadcast({ type: 'salesData', data: STATE.salesData });
    broadcast({ type: 'salesByAccount', data: { accounts: STATE.salesByAccount, results: accountResults } });
    log('okpos', '✅ 합산 완료: ' + accounts.length + '개 계정 → ' + mergedItems.length + '건, ₩' + grandTotal.toLocaleString(), 'success');
    
  } catch(e) {
    log('okpos', '❌ 합산 크롤링 오류: ' + e.message, 'error');
  }
});

// 복수 계정 아이템 합산 (같은 상품명+카테고리 → 수량/매출 합산)
function mergeOkposItems(allItems) {
  var map = {};
  allItems.forEach(function(item) {
    var key = (item.category || '') + '|' + (item.product || item.name || '');
    if (!map[key]) {
      map[key] = { product: item.product || item.name, category: item.category || '', qty: 0, total_sales: 0, net_sales: 0, _accounts: [] };
    }
    map[key].qty += item.qty || 0;
    map[key].total_sales += item.total_sales || 0;
    map[key].net_sales += item.net_sales || 0;
    if (item._account && map[key]._accounts.indexOf(item._account) < 0) {
      map[key]._accounts.push(item._account);
    }
  });
  return Object.values(map);
}

app.post('/api/sales/crawl', async function(req, res) {
  try {
    var body = req.body || {};
    var df = body.dateFrom || new Date().toISOString().split('T')[0];
    var dt = body.dateTo || df;
    if (!puppeteer) { return res.json({ ok: false, error: 'Puppeteer 없음 — OKPOS 크롤링은 로컬PC에서만 가능' }); }
    if (!STATE.config.okpos.id) { return res.json({ ok: false, error: 'OKPOS ID 미설정 → 설정 탭' }); }
    if (!STATE.sessions.okpos) {
      log('okpos', '📊 매출 크롤링 전 로그인 시도...');
      var loginOk = await okposLogin();
      if (!loginOk) { return res.json({ ok: false, error: 'OKPOS 로그인 실패 — 로그 탭 확인' }); }
    }
    log('okpos', '📊 수동 매출 크롤링 요청: ' + df);
    res.json({ ok: true, msg: '크롤링 시작' });
    await okposSalesCrawl(df, dt);
  } catch(e) {
    res.json({ ok: false, error: e.message });
  }
});

app.get('/api/sales/time', function(req, res) {
  res.json({ ok: true, data: STATE.timeSalesData || null });
});

app.post('/api/sales/time-crawl', async function(req, res) {
  try {
    var body = req.body || {};
    var df = body.dateFrom || new Date().toISOString().split('T')[0];
    var dt = body.dateTo || df;
    if (!puppeteer) { return res.json({ ok: false, error: 'Puppeteer 없음' }); }
    if (!STATE.config.okpos.id) { return res.json({ ok: false, error: 'OKPOS ID 미설정' }); }
    if (!STATE.sessions.okpos) {
      var loginOk = await okposLogin();
      if (!loginOk) { return res.json({ ok: false, error: 'OKPOS 로그인 실패' }); }
    }
    log('okpos', '⏰ 시간대별 매출 크롤링 요청: ' + df + ' ~ ' + dt);
    res.json({ ok: true, msg: '시간대별 크롤링 시작' });
    // 상품별도 함께 크롤링 (로그인 + 기본 데이터)
    await okposSalesCrawl(df, dt);
    await okposTimeSalesCrawl(df, dt);
  } catch(e) {
    res.json({ ok: false, error: e.message });
  }
});

// ═══ 일일마감 엑셀 생성 API ═══
// ═══ 상품 단가 매핑 API ═══
app.get('/api/sales/price-map', function(req, res) {
  res.json({ ok: true, priceMap: STATE.config.okpos.priceMap || {} });
});

// ═══ 매출 비교 API ═══
app.post('/api/sales/compare', async function(req, res) {
  try {
    if (!puppeteer) { return res.json({ ok: false, error: 'Puppeteer 없음' }); }
    if (!STATE.config.okpos.id) { return res.json({ ok: false, error: 'OKPOS ID 미설정' }); }
    if (!STATE.sessions.okpos) {
      var loginOk = await okposLogin();
      if (!loginOk) { return res.json({ ok: false, error: 'OKPOS 로그인 실패' }); }
    }
    var body = req.body || {};
    var curFrom = body.currentFrom || new Date().toISOString().split('T')[0];
    var curTo = body.currentTo || curFrom;
    var compFrom = body.compareFrom;
    var compTo = body.compareTo || compFrom;
    
    if (!compFrom) { return res.json({ ok: false, error: '비교 날짜 필요' }); }
    
    // 현재 데이터 저장
    var originalData = STATE.salesData;
    var curData = originalData;
    
    // 현재 데이터가 없거나 날짜 불일치 시 크롤링
    if (!curData || curData.dateFrom !== curFrom) {
      log('okpos', '📊 비교용 현재(' + curFrom + ') 크롤링...');
      STATE._suppressSalesBroadcast = true;
      await okposSalesCrawl(curFrom, curTo);
      curData = STATE.salesData;
      STATE._suppressSalesBroadcast = false;
    }
    
    // 비교 대상 크롤링 (브로드캐스트 억제)
    log('okpos', '📊 비교용 과거(' + compFrom + ') 크롤링...');
    STATE._suppressSalesBroadcast = true;
    await okposSalesCrawl(compFrom, compTo);
    var compData = STATE.salesData;
    STATE._suppressSalesBroadcast = false;
    
    // STATE 복원 (현재 데이터로)
    STATE.salesData = curData;
    
    res.json({
      ok: true,
      current: {
        dateFrom: curData ? curData.dateFrom : curFrom,
        dateTo: curData ? curData.dateTo : curTo,
        total_sales: curData && curData.grandTotal ? curData.grandTotal.total_sales : 0,
        total_qty: curData && curData.grandTotal ? curData.grandTotal.qty : 0,
        items: curData ? curData.items : []
      },
      compare: {
        dateFrom: compFrom, dateTo: compTo,
        total_sales: compData && compData.grandTotal ? compData.grandTotal.total_sales : 0,
        total_qty: compData && compData.grandTotal ? compData.grandTotal.qty : 0,
        items: compData ? compData.items : []
      }
    });
  } catch(e) {
    STATE._suppressSalesBroadcast = false;
    log('okpos', '비교 크롤링 오류: ' + e.message, 'error');
    res.json({ ok: false, error: e.message });
  }
});

// ═══ AI 일일 매출 분석 API ═══
app.post('/api/ai/daily-analysis', async function(req, res) {
  try {
    var apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) { return res.json({ ok: false, error: 'ANTHROPIC_API_KEY 미설정 (.env 파일 확인)' }); }
    
    var body = req.body || {};
    var summary = body.summary || '';
    var items = body.items || [];
    var date = body.date || new Date().toISOString().split('T')[0];
    
    var prompt = '당신은 한국의 체험형 박물관/레저시설 경영 컨설턴트입니다.\n'
      + '"한국잠사플레이팜"은 충북 청주 소재 누에/잠사 테마 체험농장으로,\n'
      + '입장권, 누에/오디 체험, 먹이주기, 바베큐, 캔들/비누 만들기, 식당, 매점, 양떼정원 등을 운영합니다.\n\n'
      + '아래는 ' + date + ' 일일 POS 매출 데이터입니다.\n\n'
      + summary + '\n\n'
      + '반드시 아래 HTML 형식으로 답변하세요. 마크다운 금지. HTML 태그만 사용.\n\n'
      + '형식:\n'
      + '<h3>1. 매출 요약</h3>\n'
      + '<table><tr><th>항목</th><th>수치</th><th>비고</th></tr><tr><td>총매출</td><td>₩000</td><td>설명</td></tr></table>\n\n'
      + '<h3>2. 핵심 매출원 (상위 5개)</h3>\n'
      + '<table><tr><th>순위</th><th>상품</th><th>매출</th><th>비중</th><th>분석</th></tr>...</table>\n\n'
      + '<h3>3. 채널별 입장권 분석</h3>\n'
      + '<table><tr><th>채널</th><th>건수</th><th>매출</th><th>비중</th><th>특이사항</th></tr>...</table>\n'
      + '<p>개선방안: ...</p>\n\n'
      + '<h3>4. 부가매출 분석</h3>\n'
      + '<table><tr><th>구분</th><th>매출</th><th>비중</th><th>객단가 영향</th></tr>...</table>\n\n'
      + '<h3>5. 신메뉴/신상품 추천</h3>\n'
      + '<table><tr><th>#</th><th>상품명</th><th>예상단가</th><th>타겟</th><th>기대효과</th></tr>...</table>\n\n'
      + '<h3>6. 개선점 및 운영 제안</h3>\n'
      + '<table><tr><th>#</th><th>제안</th><th>예상효과</th><th>난이도</th></tr>...</table>\n\n'
      + '<h3>7. 종합 평가</h3>\n'
      + '<p>간결한 종합 평가 2~3줄</p>\n\n'
      + '규칙:\n'
      + '- 반드시 <table>, <tr>, <th>, <td>, <h3>, <p>, <b>, <span> 태그만 사용\n'
      + '- 마크다운(##, **, - 등) 절대 사용 금지\n'
      + '- 금액은 ₩ 기호 + 천단위 콤마\n'
      + '- 표 안의 내용은 간결하게 (셀당 20자 이내)\n'
      + '- 한국어로 작성';
    
    var apiRes = await new Promise(function(resolve, reject) {
      var postData = JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 3000,
        messages: [{ role: 'user', content: prompt }]
      });
      
      var opts = {
        hostname: 'api.anthropic.com', port: 443, path: '/v1/messages', method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Length': Buffer.byteLength(postData)
        }
      };
      
      var req2 = https.request(opts, function(resp) {
        var chunks = [];
        resp.on('data', function(c) { chunks.push(c); });
        resp.on('end', function() {
          try { resolve(JSON.parse(Buffer.concat(chunks).toString())); }
          catch(e) { reject(e); }
        });
      });
      req2.on('error', reject);
      req2.write(postData);
      req2.end();
    });
    
    if (apiRes.error) {
      return res.json({ ok: false, error: apiRes.error.message || JSON.stringify(apiRes.error) });
    }
    
    var analysis = '';
    if (apiRes.content && apiRes.content.length > 0) {
      analysis = apiRes.content.map(function(c) { return c.text || ''; }).join('\n');
    }
    
    res.json({ ok: true, analysis: analysis, date: date });
  } catch(e) {
    log('ai', 'AI 분석 오류: ' + e.message, 'error');
    res.json({ ok: false, error: e.message });
  }
});

app.post('/api/sales/price-map', function(req, res) {
  var body = req.body || {};
  if (body.priceMap) {
    STATE.config.okpos.priceMap = body.priceMap;
    log('okpos', '단가 매핑 업데이트: ' + Object.keys(body.priceMap).length + '개', 'success');
    // .env에 저장
    try {
      var envPath = path.join(__dirname, '.env');
      var envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
      var pmJson = JSON.stringify(body.priceMap);
      if (envContent.indexOf('OKPOS_PRICE_MAP=') >= 0) {
        envContent = envContent.replace(/OKPOS_PRICE_MAP=.*/g, 'OKPOS_PRICE_MAP=' + pmJson);
      } else {
        envContent += '\nOKPOS_PRICE_MAP=' + pmJson;
      }
      fs.writeFileSync(envPath, envContent);
    } catch(e) { log('okpos', '.env 저장 실패: ' + e.message, 'warning'); }
  }
  res.json({ ok: true });
});

// ═══ 네이버 플레이스 유의사항 ═══
app.get('/api/naver-notice', function(req, res) {
  res.json({ 
    ok: true, 
    notice: STATE.config.msg.naverNotice || '',
    placeUrl: STATE.config.msg.naverPlaceUrl || '',
    lastCrawled: STATE.naverNoticeCrawledAt || null
  });
});

app.post('/api/naver-notice', function(req, res) {
  var body = req.body || {};
  if (body.notice !== undefined) STATE.config.msg.naverNotice = String(body.notice).substring(0, 200);
  if (body.placeUrl) STATE.config.msg.naverPlaceUrl = body.placeUrl;
  // .env에 저장
  try {
    var envPath = require('path').join(__dirname, '.env');
    var envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
    if (envContent.indexOf('NAVER_NOTICE=') >= 0) {
      envContent = envContent.replace(/NAVER_NOTICE=.*/g, 'NAVER_NOTICE=' + STATE.config.msg.naverNotice);
    } else {
      envContent += '\nNAVER_NOTICE=' + STATE.config.msg.naverNotice;
    }
    if (body.placeUrl) {
      if (envContent.indexOf('NAVER_PLACE_URL=') >= 0) {
        envContent = envContent.replace(/NAVER_PLACE_URL=.*/g, 'NAVER_PLACE_URL=' + STATE.config.msg.naverPlaceUrl);
      } else {
        envContent += '\nNAVER_PLACE_URL=' + STATE.config.msg.naverPlaceUrl;
      }
    }
    fs.writeFileSync(envPath, envContent);
  } catch(e) { log('system', '.env 저장 실패: ' + e.message, 'warning'); }
  broadcast({ type: 'config', data: { naverNotice: STATE.config.msg.naverNotice } });
  res.json({ ok: true });
});

app.post('/api/naver-notice/crawl', async function(req, res) {
  try {
    log('system', '🔍 네이버 플레이스 유의사항 크롤링 시작...');
    var placeUrl = STATE.config.msg.naverPlaceUrl;
    if (!placeUrl) return res.json({ ok: false, msg: 'Place URL 미설정' });
    
    // ★ Place ID 추출
    var placeIdMatch = placeUrl.match(/place\/(\d+)/);
    var placeId = placeIdMatch ? placeIdMatch[1] : '1591058710';
    log('system', '  Place ID: ' + placeId);
    
    var notice = '';
    
    // ★ 방법1: Naver Place API (가볍고 빠름)
    try {
      var https = require('https');
      var apiUrls = [
        'https://map.naver.com/p/api/place/page/' + placeId,
        'https://pages.map.naver.com/save-pages/v1/pages/' + placeId
      ];
      
      for (var ai = 0; ai < apiUrls.length; ai++) {
        try {
          var apiData = await new Promise(function(resolve, reject) {
            var req2 = https.get(apiUrls[ai], {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': 'https://map.naver.com/',
                'Accept': 'application/json'
              },
              timeout: 10000
            }, function(resp) {
              var data = '';
              resp.on('data', function(c) { data += c; });
              resp.on('end', function() {
                try { resolve(JSON.parse(data)); } catch(e) { resolve(null); }
              });
            });
            req2.on('error', function() { resolve(null); });
            req2.on('timeout', function() { req2.destroy(); resolve(null); });
          });
          
          if (apiData) {
            // JSON에서 유의사항/안내 추출
            var jsonStr = JSON.stringify(apiData);
            var noticePatterns = [
              /유의사항["\s:]*([^"]{10,200})/,
              /알아두세요["\s:]*([^"]{10,200})/,
              /이용안내["\s:]*([^"]{10,200})/,
              /"description"\s*:\s*"([^"]*유의[^"]{5,200})"/,
              /"notice"\s*:\s*"([^"]{10,200})"/,
              /"caution"\s*:\s*"([^"]{10,200})"/
            ];
            for (var np = 0; np < noticePatterns.length; np++) {
              var nm = jsonStr.match(noticePatterns[np]);
              if (nm && nm[1] && nm[1].length > notice.length) {
                notice = nm[1].replace(/\\n/g, '/').replace(/\\r/g, '');
              }
            }
            if (notice) {
              log('system', '  API에서 유의사항 발견: ' + notice.substring(0, 50) + '...');
              break;
            }
          }
        } catch(apiErr) {
          log('system', '  API ' + ai + ' 실패: ' + apiErr.message);
        }
      }
    } catch(apiE) {
      log('system', '  API 방식 실패: ' + apiE.message);
    }
    
    // ★ 방법2: 기존 네이버 브라우저 활용 (로그인된 상태)
    if (!notice || notice.length < 5) {
      log('system', '  → Puppeteer로 플레이스 페이지 크롤링...');
      var browser, page, ownBrowser = false;
      
      try {
        if (STATE.browsers.naver && STATE.pages.naver) {
          browser = STATE.browsers.naver;
          page = await browser.newPage();
        } else {
          var puppeteer = require('puppeteer');
          browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
          page = await browser.newPage();
          ownBrowser = true;
        }
        
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
        
        // 플레이스 상세 페이지 직접 접근
        var detailUrl = 'https://m.place.naver.com/place/' + placeId + '/home';
        log('system', '  URL: ' + detailUrl);
        await page.goto(detailUrl, { waitUntil: 'networkidle2', timeout: 20000 }).catch(function(){});
        await new Promise(function(r) { setTimeout(r, 3000); });
        
        // 본문에서 유의사항 추출
        notice = await page.evaluate(function() {
          var body = document.body ? document.body.innerText : '';
          var sections = body.split('\n');
          var capturing = false;
          var captureLines = [];
          
          for (var i = 0; i < sections.length; i++) {
            var line = sections[i].trim();
            if (!line) continue;
            
            if (/유의사항|알아두세요|이용.*안내|주의.*사항/.test(line)) {
              capturing = true;
              // "유의사항" 라인 자체에 내용이 포함된 경우
              if (line.length > 10 && !/^(유의사항|알아두세요)$/.test(line)) {
                captureLines.push(line.replace(/유의사항|알아두세요/, '').trim());
              }
              continue;
            }
            if (capturing) {
              // 다른 섹션 시작 시 중단
              if (/^(리뷰|사진|메뉴|예약|홈|주변|길찾기|저장|공유|예매|가격|영업|방문자|블로그)/.test(line)) break;
              if (line.length > 120) break;
              if (line.length > 1 && line.length < 100) {
                captureLines.push(line);
              }
              if (captureLines.length >= 15) break;
            }
          }
          
          // 핵심 내용만 필터 (번호/기호로 시작하는 항목 우선)
          var filtered = captureLines.filter(function(l) {
            return l.length > 3 && !/^(더보기|접기|닫기|확인)$/.test(l);
          });
          
          return filtered.join('/');
        });
        
        // 페이지에서 못 찾으면 iframe도 확인
        if (!notice || notice.length < 5) {
          var frames = page.frames();
          for (var fi = 0; fi < frames.length; fi++) {
            try {
              var fn = await frames[fi].evaluate(function() {
                var body = document.body ? document.body.innerText : '';
                var lines = body.split('\n');
                var cap = false, result = [];
                for (var i = 0; i < lines.length; i++) {
                  var l = lines[i].trim();
                  if (/유의사항|알아두세요/.test(l)) { cap = true; continue; }
                  if (cap) {
                    if (/^(리뷰|사진|메뉴|예약)/.test(l) || l.length > 120) break;
                    if (l.length > 3 && l.length < 100) result.push(l);
                    if (result.length >= 10) break;
                  }
                }
                return result.join('/');
              });
              if (fn && fn.length > (notice||'').length) notice = fn;
            } catch(fe) {}
          }
        }
        
        await page.close();
        if (ownBrowser) await browser.close();
        
      } catch(pupErr) {
        log('system', '  Puppeteer 오류: ' + pupErr.message, 'warning');
        if (ownBrowser && browser) try { await browser.close(); } catch(e2) {}
      }
    }
    
    if (notice && notice.length > 3) {
      // 100자 이내로 정리
      if (notice.length > 100) notice = notice.substring(0, 97) + '...';
      STATE.config.msg.naverNotice = notice;
      STATE.naverNoticeCrawledAt = new Date().toISOString();
      
      // .env에도 저장
      try {
        var envPath = require('path').join(__dirname, '.env');
        var envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
        if (envContent.indexOf('NAVER_NOTICE=') >= 0) {
          envContent = envContent.replace(/NAVER_NOTICE=.*/g, 'NAVER_NOTICE=' + notice);
        } else {
          envContent += '\nNAVER_NOTICE=' + notice;
        }
        fs.writeFileSync(envPath, envContent);
      } catch(e3) {}
      
      broadcast({ type: 'config', data: { naverNotice: notice } });
      log('system', '✅ 유의사항 크롤링 성공 (' + notice.length + '자): ' + notice, 'success');
      res.json({ ok: true, notice: notice });
    } else {
      log('system', '⚠️ 유의사항을 자동으로 찾지 못했습니다', 'warning');
      res.json({ ok: false, msg: '유의사항을 자동으로 찾지 못했습니다. 네이버 플레이스에서 직접 복사하여 입력해주세요.' });
    }
  } catch(e) {
    log('system', '❌ 유의사항 크롤링 오류: ' + e.message, 'error');
    res.json({ ok: false, msg: e.message });
  }
});

app.post('/api/sales/daily-excel', async function(req, res) {
  try {
    var body = req.body || {};
    var dateStr = body.date || new Date().toISOString().split('T')[0];
    var clientItems = body.items || [];
    var tableData = body.tableData || [];
    log('okpos', '📊 일일마감 엑셀 생성 요청: ' + dateStr + ' (화면 데이터: ' + tableData.length + '건, POS: ' + clientItems.length + '건)');
    
    var result = await generateDailyExcel(dateStr, clientItems, tableData);
    res.json(result);
  } catch(e) {
    res.json({ ok: false, error: e.message });
  }
});

app.get('/api/sales/daily-excel/:date', function(req, res) {
  var dateStr = req.params.date;
  var filePath = path.join(__dirname, 'public', 'daily_' + dateStr + '.xlsx');
  if (fs.existsSync(filePath)) {
    res.download(filePath, '일일마감_' + dateStr + '.xlsx');
  } else {
    res.status(404).json({ ok: false, error: '파일 없음' });
  }
});

// ═══ 카카오톡 ═══
// ═══ 마감일지 카카오 발송 API ═══
app.post('/api/kakao/daily-report', async function(req, res) {
  try {
    var body = req.body || {};
    var room = body.room || STATE.config.kakao.dailyRoom || STATE.config.kakao.room || '';
    var summary = body.summary || '';
    var imageBase64 = body.image || '';
    
    if (!room) return res.json({ ok: false, error: '발송 채팅방이 설정되지 않았습니다' });
    
    // 이미지 저장
    var imagePath = '';
    if (imageBase64) {
      imagePath = path.join(__dirname, '.daily_report_' + Date.now() + '.png');
      var imgData = imageBase64.replace(/^data:image\/\w+;base64,/, '');
      fs.writeFileSync(imagePath, Buffer.from(imgData, 'base64'));
      log('kakao', '마감일지 이미지 저장: ' + imagePath + ' (' + Math.round(fs.statSync(imagePath).size/1024) + 'KB)');
    }
    
    // 텍스트 먼저 전송
    var textOk = false;
    if (summary) {
      textOk = await sendKakaoPC(summary, room);
    }
    
    // 이미지 전송
    var imgOk = false;
    if (imagePath && fs.existsSync(imagePath)) {
      imgOk = await sendKakaoPCWithImage(null, imagePath, room);
      try { fs.unlinkSync(imagePath); } catch(e) {}
    }
    
    log('kakao', '마감일지 발송: 텍스트=' + (textOk ? '✅' : '❌') + ', 이미지=' + (imgOk ? '✅' : '❌') + ' → ' + room, textOk || imgOk ? 'success' : 'warning');
    
    // 텔레그램도 동시 전송
    var telegramOk = false;
    if (STATE.config.telegram.enabled && summary) {
      telegramOk = await sendTelegram('📋 일일마감일지\n\n' + summary);
    }
    
    if (!textOk && !imgOk && !telegramOk) {
      return res.json({ ok: false, error: '카톡 전송 실패. 로그 탭에서 상세 원인을 확인해주세요. (Python/카카오톡PC 실행 필요)', textSent: false, imageSent: false, room: room });
    }
    res.json({ ok: true, textSent: textOk, imageSent: imgOk, room: room });
  } catch(e) {
    log('kakao', '마감일지 발송 오류: ' + e.message, 'error');
    res.json({ ok: false, error: e.message });
  }
});

// ═══ 마감일지 발송 채팅방 설정 API ═══
// ═══ 텔레그램 API ═══
app.post('/api/telegram/settings', function(req, res) {
  var body = req.body || {};
  if (body.botToken !== undefined) STATE.config.telegram.botToken = body.botToken;
  if (body.chatId !== undefined) STATE.config.telegram.chatId = body.chatId;
  STATE.config.telegram.enabled = !!(STATE.config.telegram.botToken && STATE.config.telegram.chatId);
  log('telegram', '설정 업데이트: ' + (STATE.config.telegram.enabled ? '활성' : '비활성'));
  res.json({ ok: true, enabled: STATE.config.telegram.enabled });
});

app.post('/api/telegram/send', async function(req, res) {
  var body = req.body || {};
  var msg = body.message || '테스트 메시지';
  var ok = await sendTelegram(msg);
  res.json({ ok: ok });
});

app.post('/api/telegram/test', async function(req, res) {
  var ok = await sendTelegram('🎫 한국잠사박물관 알림 테스트\n시간: ' + new Date().toLocaleString('ko'));
  res.json({ ok: ok });
});

// ═══ 통합 알림 API (카카오+텔레그램 동시) ═══
app.post('/api/notify/all', async function(req, res) {
  var body = req.body || {};
  var msg = body.message || '';
  var room = body.room || '';
  var results = await notifyAll(msg, room);
  res.json({ ok: true, results: results });
});

app.post('/api/kakao/daily-room', function(req, res) {
  var body = req.body || {};
  if (body.room !== undefined) {
    STATE.config.kakao.dailyRoom = body.room;
    log('kakao', '마감일지 발송방 설정: ' + body.room, 'success');
    try {
      var envPath = path.join(__dirname, '.env');
      var envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
      if (envContent.indexOf('KAKAO_DAILY_ROOM=') >= 0) {
        envContent = envContent.replace(/KAKAO_DAILY_ROOM=.*/g, 'KAKAO_DAILY_ROOM=' + body.room);
      } else {
        envContent += '\nKAKAO_DAILY_ROOM=' + body.room;
      }
      fs.writeFileSync(envPath, envContent);
    } catch(e) {}
  }
  res.json({ ok: true, dailyRoom: STATE.config.kakao.dailyRoom });
});

// ═══ 섹션별 카톡 발송방 설정 API ═══
// ═══ 시간대별 카톡 발송방/자동 설정 ═══
app.post('/api/kakao/time-room', function(req, res) {
  var room = (req.body || {}).room || '';
  STATE.config.kakao.timeRoom = room;
  try {
    var envPath = path.join(__dirname, '.env');
    var envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
    if (envContent.indexOf('KAKAO_TIME_ROOM=') >= 0) envContent = envContent.replace(/KAKAO_TIME_ROOM=.*/g, 'KAKAO_TIME_ROOM=' + room);
    else envContent += '\nKAKAO_TIME_ROOM=' + room;
    fs.writeFileSync(envPath, envContent);
  } catch(e) {}
  sendState();
  res.json({ ok: true });
});

app.post('/api/kakao/time-auto', function(req, res) {
  var body = req.body || {};
  STATE.config.kakao.timeAutoTime = body.time || '';
  STATE.config.kakao.timeAutoEnabled = !!body.enabled;
  try {
    var envPath = path.join(__dirname, '.env');
    var envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
    ['KAKAO_TIME_AUTO_TIME', 'KAKAO_TIME_AUTO_ENABLED'].forEach(function(key) {
      var val = key.indexOf('TIME') >= 0 && key.indexOf('ENABLED') < 0 ? (body.time || '') : (body.enabled ? '1' : '0');
      if (envContent.indexOf(key + '=') >= 0) envContent = envContent.replace(new RegExp(key + '=.*'), key + '=' + val);
      else envContent += '\n' + key + '=' + val;
    });
    fs.writeFileSync(envPath, envContent);
  } catch(e) {}
  setupTimeAutoTimer();
  sendState();
  res.json({ ok: true });
});

// ═══ 시간대별 자동 발송 타이머 ═══
var _timeAutoTimer = null;
function setupTimeAutoTimer() {
  if (_timeAutoTimer) { clearInterval(_timeAutoTimer); _timeAutoTimer = null; }
  if (!STATE.config.kakao.timeAutoEnabled || !STATE.config.kakao.timeAutoTime) return;
  var targetTime = STATE.config.kakao.timeAutoTime;
  log('system', '⏰ 시간대별 자동 발송 타이머: 매일 ' + targetTime, 'success');
  var _lastRunDate2 = '';
  _timeAutoTimer = setInterval(function() {
    var now = new Date();
    var nowTime = String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0');
    var nowDate = now.toISOString().split('T')[0];
    if (nowTime === targetTime && nowDate !== _lastRunDate2) {
      _lastRunDate2 = nowDate;
      log('system', '⏰ 시간대별 자동 발송 트리거!');
      serverAutoTimeSales();
    }
  }, 30000);
}

async function serverAutoTimeSales() {
  var room = STATE.config.kakao.timeRoom || STATE.config.kakao.dailyRoom || STATE.config.kakao.room || '';
  if (!room) { log('system', '시간대별 자동: 발송방 미설정', 'warning'); return; }
  var today = new Date().toISOString().split('T')[0];
  log('system', '⏰ 시간대별 자동 크롤링+발송 시작: ' + today);
  try {
    STATE._suppressSalesBroadcast = true;
    await okposSalesCrawl(today, today);
    var data = STATE.salesData;
    STATE._suppressSalesBroadcast = false;
    
    var ts = STATE.timeSalesData || {};
    var hourly = ts.hourly || [];
    var gt = ts.grand_total || (data && data.grandTotal) || {};
    
    var msg = '⏰ 시간대별 POS 매출\n📅 ' + today + '\n━━━━━━━━━━━━\n';
    msg += '💰 총: ₩' + (gt.total_sales||0).toLocaleString() + ' / ' + (gt.qty||0) + '건\n\n';
    
    if (hourly.length > 0) {
      hourly.forEach(function(hr) {
        if (hr.sales > 0) msg += hr.hour + '시 ' + hr.qty + '건 ₩' + hr.sales.toLocaleString() + '\n';
      });
      var sorted = hourly.slice().sort(function(a,b){return b.sales-a.sales;});
      var peak = sorted.filter(function(h2){return h2.sales>0;}).slice(0,3);
      if (peak.length > 0) msg += '\n🏆 피크: ' + peak.map(function(p){return p.hour+'시 ₩'+p.sales.toLocaleString();}).join(', ');
    }
    
    var ok = await sendKakaoPC(msg, room);
    log('system', '⏰ 시간대별 자동 발송 ' + (ok ? '완료' : '실패'), ok ? 'success' : 'warning');
  } catch(e) {
    STATE._suppressSalesBroadcast = false;
    log('system', '시간대별 자동 오류: ' + e.message, 'error');
  }
}

app.post('/api/kakao/section-rooms', function(req, res) {
  try {
    var rooms = (req.body || {}).rooms || {};
    STATE.config.kakao.sectionRooms = rooms;
    log('kakao', '섹션별 발송방 설정: ' + JSON.stringify(rooms), 'success');
    
    var envPath = path.join(__dirname, '.env');
    var envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
    var roomsStr = JSON.stringify(rooms);
    if (envContent.indexOf('KAKAO_SECTION_ROOMS=') >= 0) {
      envContent = envContent.replace(/KAKAO_SECTION_ROOMS=.*/g, 'KAKAO_SECTION_ROOMS=' + roomsStr);
    } else {
      envContent += '\nKAKAO_SECTION_ROOMS=' + roomsStr;
    }
    fs.writeFileSync(envPath, envContent);
    sendState();
    res.json({ ok: true });
  } catch(e) {
    res.json({ ok: false, error: e.message });
  }
});

// ═══ 자동 마감 스케줄 설정 API ═══
// ═══ Anthropic API 키 관리 ═══
app.post('/api/settings/anthropic-key', function(req, res) {
  try {
    var key = (req.body || {}).key || '';
    if (!key || !key.startsWith('sk-')) {
      return res.json({ ok: false, error: '올바른 API 키 형식이 아닙니다' });
    }
    
    // .env에 저장
    var envPath = path.join(__dirname, '.env');
    var envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
    if (envContent.indexOf('ANTHROPIC_API_KEY=') >= 0) {
      envContent = envContent.replace(/ANTHROPIC_API_KEY=.*/g, 'ANTHROPIC_API_KEY=' + key);
    } else {
      envContent += '\nANTHROPIC_API_KEY=' + key;
    }
    fs.writeFileSync(envPath, envContent);
    
    // 런타임에도 적용
    process.env.ANTHROPIC_API_KEY = key;
    
    // 마스킹된 키 (앞 8자 + ... + 뒤 4자)
    var masked = key.substring(0, 8) + '...' + key.substring(key.length - 4);
    log('system', '🔑 Anthropic API 키 설정됨: ' + masked, 'success');
    
    // 클라이언트에 마스킹된 키 전달
    sendState();
    res.json({ ok: true, masked: masked });
  } catch(e) {
    res.json({ ok: false, error: e.message });
  }
});

app.delete('/api/settings/anthropic-key', function(req, res) {
  try {
    var envPath = path.join(__dirname, '.env');
    var envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
    envContent = envContent.replace(/ANTHROPIC_API_KEY=.*/g, 'ANTHROPIC_API_KEY=');
    fs.writeFileSync(envPath, envContent);
    process.env.ANTHROPIC_API_KEY = '';
    log('system', '🔑 Anthropic API 키 삭제됨', 'warning');
    sendState();
    res.json({ ok: true });
  } catch(e) {
    res.json({ ok: false, error: e.message });
  }
});

app.post('/api/kakao/daily-auto', function(req, res) {
  var body = req.body || {};
  STATE.config.kakao.dailyAutoTime = body.time || '';
  STATE.config.kakao.dailyAutoEnabled = !!body.enabled;
  log('system', '⏰ 자동 마감 ' + (body.enabled ? '설정: 매일 ' + body.time : '비활성화'), body.enabled ? 'success' : 'warning');
  
  // .env에 저장
  try {
    var envPath = path.join(__dirname, '.env');
    var envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
    var updates = {
      'KAKAO_DAILY_AUTO_TIME': body.time || '',
      'KAKAO_DAILY_AUTO_ENABLED': body.enabled ? '1' : '0'
    };
    Object.keys(updates).forEach(function(key) {
      var val = updates[key];
      if (envContent.indexOf(key + '=') >= 0) {
        envContent = envContent.replace(new RegExp(key + '=.*'), key + '=' + val);
      } else {
        envContent += '\n' + key + '=' + val;
      }
    });
    fs.writeFileSync(envPath, envContent);
  } catch(e) {}
  
  // 타이머 재설정
  setupDailyAutoTimer();
  sendState();
  res.json({ ok: true, time: STATE.config.kakao.dailyAutoTime, enabled: STATE.config.kakao.dailyAutoEnabled });
});

// ═══ 서버 자동 마감 실행 (POS→비교→AI→카톡) ═══
async function serverAutoDaily() {
  var room = STATE.config.kakao.dailyRoom || STATE.config.kakao.room || '';
  if (!room) { log('system', '⏰ 자동 마감: 발송방 미설정', 'warning'); return; }
  
  var today = new Date().toISOString().split('T')[0];
  log('system', '⏰ 자동 마감 시작: ' + today + ' → ' + room);
  broadcast({ type: 'log', data: { time: new Date().toISOString(), cat: 'system', msg: '⏰ 자동 마감 시작', status: 'info' } });
  
  try {
    // Step 1: POS 크롤링
    log('system', '⏰ [1/4] POS 크롤링...');
    await okposSalesCrawl(today, today);
    
    var sd = STATE.salesData || {};
    var items = sd.items || [];
    var totalSales = sd.grandTotal ? sd.grandTotal.total_sales : 0;
    var totalQty = sd.grandTotal ? sd.grandTotal.qty : 0;
    
    // Step 2: 전주/전년 비교 크롤링
    log('system', '⏰ [2/4] 전주/전년 비교...');
    var weekDate = new Date(); weekDate.setDate(weekDate.getDate() - 7);
    var yearDate = new Date(); yearDate.setFullYear(yearDate.getFullYear() - 1);
    var weekStr = weekDate.toISOString().split('T')[0];
    var yearStr = yearDate.toISOString().split('T')[0];
    
    var weekData = null, yearData = null;
    try {
      var saved = STATE.salesData;
      await okposSalesCrawl(weekStr, weekStr);
      weekData = STATE.salesData;
      STATE.salesData = saved;
    } catch(e) { log('system', '전주 비교 실패: ' + e.message, 'warning'); }
    
    try {
      var saved2 = STATE.salesData;
      await okposSalesCrawl(yearStr, yearStr);
      yearData = STATE.salesData;
      STATE.salesData = saved2;
    } catch(e) { log('system', '전년 비교 실패: ' + e.message, 'warning'); }
    
    // Step 3: AI 분석 (API키 있으면 AI, 없으면 규칙기반)
    log('system', '⏰ [3/4] 매출 분석...');
    var aiText = '';
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        var summaryForAi = '날짜: ' + today + ', 총매출: ₩' + totalSales.toLocaleString() + ', 총수량: ' + totalQty + '건\n';
        items.forEach(function(i) { summaryForAi += i.product + ': ' + i.qty + '건, ₩' + (i.total_sales||0).toLocaleString() + '\n'; });
        
        var aiRes = await new Promise(function(resolve, reject) {
          var postData = JSON.stringify({
            model: 'claude-sonnet-4-20250514', max_tokens: 800,
            messages: [{ role: 'user', content: '한국잠사플레이팜(충북 청주, 누에/잠사 테마 체험농장) ' + today + ' 매출 데이터입니다.\n핵심 요약(3줄) + 개선점 1개 + 내일 추천 전략 1개를 간결하게 알려주세요.\n\n' + summaryForAi }]
          });
          var opts = { hostname: 'api.anthropic.com', port: 443, path: '/v1/messages', method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'Content-Length': Buffer.byteLength(postData) }
          };
          var req2 = https.request(opts, function(resp) { var c=[]; resp.on('data',function(d){c.push(d);}); resp.on('end',function(){ try{resolve(JSON.parse(Buffer.concat(c).toString()));}catch(e){reject(e);} }); });
          req2.on('error', reject); req2.write(postData); req2.end();
        });
        if (aiRes.content) aiText = aiRes.content.map(function(c){return c.text||'';}).join('');
      } catch(e) { log('system', 'AI 분석 실패: ' + e.message, 'warning'); }
    }
    // 규칙기반 폴백
    if (!aiText && items.length > 0) {
      var paid2 = items.filter(function(i){return(i.total_sales||0)>0;}).sort(function(a,b){return b.total_sales-a.total_sales;});
      var zero2 = items.filter(function(i){return(i.total_sales||0)===0&&i.qty>0;});
      aiText = '총 ₩' + totalSales.toLocaleString() + ' / ' + totalQty + '건. ';
      if(paid2.length>0) aiText += 'TOP: ' + paid2.slice(0,3).map(function(i){return i.product+' ₩'+i.total_sales.toLocaleString();}).join(', ') + '. ';
      if(zero2.length>0) aiText += '0원상품 ' + zero2.length + '종 단가설정 필요.';
    }
    
    // Step 4: 카톡 메시지 생성 + 발송
    log('system', '⏰ [4/4] 카톡 발송...');
    var msg = '📋 한국잠사플레이팜 일일마감일지\n📅 ' + today + '\n━━━━━━━━━━━━━━━━\n';
    msg += '💰 총 매출: ₩' + totalSales.toLocaleString() + '\n';
    msg += '👥 총 판매: ' + totalQty + '건\n━━━━━━━━━━━━━━━━\n\n';
    
    // TOP 상품
    var sorted2 = items.slice().sort(function(a,b){return(b.total_sales||0)-(a.total_sales||0);});
    sorted2.filter(function(i){return i.total_sales>0;}).slice(0,8).forEach(function(i,idx){
      msg += (idx+1) + '. ' + i.product + ' ' + i.qty + '건 ₩' + (i.total_sales||0).toLocaleString() + '\n';
    });
    
    // 비교 결과
    if (weekData && weekData.grandTotal) {
      var wDiff = totalSales - (weekData.grandTotal.total_sales||0);
      var wPct = weekData.grandTotal.total_sales > 0 ? Math.round(wDiff/weekData.grandTotal.total_sales*100) : 0;
      msg += '\n📈 전주 대비: ' + (wDiff>=0?'▲':'▼') + ' ₩' + Math.abs(wDiff).toLocaleString() + ' (' + (wDiff>=0?'+':'') + wPct + '%)\n';
    }
    if (yearData && yearData.grandTotal) {
      var yDiff = totalSales - (yearData.grandTotal.total_sales||0);
      var yPct = yearData.grandTotal.total_sales > 0 ? Math.round(yDiff/yearData.grandTotal.total_sales*100) : 0;
      msg += '📈 전년 대비: ' + (yDiff>=0?'▲':'▼') + ' ₩' + Math.abs(yDiff).toLocaleString() + ' (' + (yDiff>=0?'+':'') + yPct + '%)\n';
    }
    
    if (aiText) msg += '\n🤖 분석\n' + aiText + '\n';
    
    var ok = await sendKakaoPC(msg, room);
    log('system', '⏰ 자동 마감 완료: ' + (ok ? '✅ 발송 성공' : '❌ 발송 실패'), ok ? 'success' : 'warning');
    broadcast({ type: 'log', data: { time: new Date().toISOString(), cat: 'system', msg: '⏰ 자동 마감 ' + (ok?'완료':'실패'), status: ok?'success':'error' } });
  } catch(e) {
    log('system', '⏰ 자동 마감 오류: ' + e.message, 'error');
  }
}

// ═══ 자동 마감 타이머 ═══
var _dailyAutoTimer = null;
function setupDailyAutoTimer() {
  if (_dailyAutoTimer) { clearInterval(_dailyAutoTimer); _dailyAutoTimer = null; }
  
  if (!STATE.config.kakao.dailyAutoEnabled || !STATE.config.kakao.dailyAutoTime) {
    log('system', '⏰ 자동 마감 타이머 비활성');
    return;
  }
  
  var targetTime = STATE.config.kakao.dailyAutoTime; // "21:00" 형식
  log('system', '⏰ 자동 마감 타이머 설정: 매일 ' + targetTime, 'success');
  
  var _lastRunDate = '';
  _dailyAutoTimer = setInterval(function() {
    var now = new Date();
    var nowTime = String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0');
    var nowDate = now.toISOString().split('T')[0];
    
    if (nowTime === targetTime && nowDate !== _lastRunDate) {
      _lastRunDate = nowDate;
      log('system', '⏰ 자동 마감 트리거! (' + targetTime + ')');
      serverAutoDaily();
    }
  }, 30000); // 30초마다 체크
}

app.post('/api/kakao/send', async function(req, res) {
  try {
    var body = req.body || {};
    var msg = body.message || '';
    var room = body.room || '';
    if (!msg) return res.json({ ok: false, error: '메시지 필수' });
    var ok = await sendKakaoPC(msg, room);
    res.json({ ok: ok });
  } catch(e) {
    res.json({ ok: false, error: e.message });
  }
});

app.post('/api/kakao/config', function(req, res) {
  var body = req.body || {};
  if (body.room !== undefined) STATE.config.kakao.room = body.room;
  if (body.enabled !== undefined) STATE.config.kakao.enabled = !!body.enabled;
  sendState();
  res.json({ ok: true, kakao: STATE.config.kakao });
});

app.post('/api/ticket/verify', async function(req, res) {
  try {
    var tk = STATE.tickets.find(function(t) { return String(t.id) === String(req.body.ticketId); });
    if (!tk) return res.json({ ok: false, error: '티켓 없음' });
    if (tk.status !== '사용완료') return res.json({ ok: false, error: '사용완료 상태가 아님' });
    
    log('system', '🔍 ' + tk.buyer + ' 사용처리 확인 중... (' + tk.source + ')');
    
    var result;
    try {
      if (tk.source === 'la2fdoci') {
        result = await la2fVerifyUsed(tk);
      } else if (tk.source === 'naver') {
        result = await naverVerifyUsed(tk);
      } else {
        result = { ok: false, msg: '알 수 없는 소스' };
      }
    } catch(verErr) {
      result = { ok: false, verified: false, msg: '확인 예외: ' + verErr.message };
    }
    
    // 티켓에 확인 결과 저장
    tk.adminVerified = result.ok ? result.verified : null;
    tk.verifiedAt = new Date().toISOString();
    tk.verifyMsg = result.msg || '';
    if (result.statuses) tk.verifyDetail = result.statuses;
    
    var emoji = result.verified ? '✅' : (result.ok ? '⚠️' : '❌');
    log('system', emoji + ' ' + tk.buyer + ' 확인결과: ' + result.msg, result.verified ? 'success' : 'warning');
    
    broadcast({ type: 'ticketUpdate', data: tk });
    res.json({ ok: true, result: result, ticket: tk });
  } catch(e) {
    log('system', '❌ /api/ticket/verify 오류: ' + e.message, 'error');
    res.json({ ok: false, error: '확인 오류: ' + e.message });
  }
});

// ═══ OKPOS 수동 매출등록 API ═══
app.post('/api/okpos/register', async function(req, res) {
  try {
    var tk = STATE.tickets.find(function(t) { return String(t.id) === String(req.body.ticketId); });
    if (!tk) return res.json({ ok: false, error: '티켓 없음' });
    if (tk.okposRegistered) return res.json({ ok: true, msg: '이미 등록됨' });
    
    log('okpos', '수동 매출등록: ' + tk.buyer + ' ' + ((tk.price || 0).toLocaleString()) + '원');
    var ok = false;
    try { ok = await okposRegister(tk); } catch(e) { log('okpos', '수동 등록 오류: ' + e.message, 'error'); }
    
    if (ok) {
      tk.okposRegistered = true;
      // posLog에도 반영
      var existing = STATE.posLog.find(function(p) { return p.ticketId === String(tk.id); });
      if (existing) existing.okposSync = true;
      log('okpos', '✅ 수동 매출등록 완료: ' + tk.buyer, 'success');
    }
    sendState();
    res.json({ ok: ok, error: ok ? null : 'OKPOS 등록 실패' });
  } catch(e) {
    res.json({ ok: false, error: '서버 오류: ' + e.message });
  }
});

// ═══ 사용처리 재시도 API (미반영 → 재처리 → 재확인) ═══
app.post('/api/ticket/retry-admin', async function(req, res) {
  try {
    var tk = STATE.tickets.find(function(t) { return String(t.id) === String(req.body.ticketId); });
    if (!tk) return res.json({ ok: false, error: '티켓 없음' });
    if (tk.status !== '사용완료') return res.json({ ok: false, error: '사용완료 상태가 아님' });
    
    log('system', '🔄 ' + tk.buyer + ' 사이트 재처리 시작 (' + tk.source + ')');
    
    // 1) 사이트에서 다시 사용완료 처리
    var markOk = false;
    try {
      if (tk.source === 'la2fdoci') {
        markOk = await la2fMarkUsed(tk);
      } else if (tk.source === 'naver') {
        if (tk.isOption) {
          markOk = true; // 옵션 티켓은 네이버 별도 처리 불필요
        } else {
          markOk = await naverMarkUsed(tk);
        }
      }
    } catch(markErr) {
      log('system', '재처리 예외: ' + markErr.message, 'error');
      markOk = false;
    }
    
    log('system', (markOk ? '✅' : '❌') + ' 재처리 결과: ' + (markOk ? '성공' : '실패'));
    
    // 2) 바로 재확인
    var verifyResult;
    if (markOk) {
      await new Promise(function(r) { setTimeout(r, 2000); }); // 사이트 반영 대기
      try {
        if (tk.source === 'la2fdoci') {
          verifyResult = await la2fVerifyUsed(tk);
        } else {
          verifyResult = await naverVerifyUsed(tk);
        }
      } catch(verErr) {
        verifyResult = { ok: false, verified: false, msg: '재확인 오류: ' + verErr.message };
      }
    } else {
      verifyResult = { ok: false, verified: false, msg: '재처리 실패' };
    }
    
    // 3) 결과 저장
    tk.adminOk = markOk;
    tk.adminVerified = verifyResult.ok ? verifyResult.verified : false;
    tk.verifiedAt = new Date().toISOString();
    tk.verifyMsg = verifyResult.msg || '';
    if (verifyResult.statuses) tk.verifyDetail = verifyResult.statuses;
    
    var emoji = tk.adminVerified ? '✅' : '⚠️';
    log('system', emoji + ' ' + tk.buyer + ' 재확인: ' + (verifyResult.msg || (markOk ? '처리됨' : '실패')), tk.adminVerified ? 'success' : 'warning');
    
    broadcast({ type: 'ticketUpdate', data: tk });
    res.json({ ok: true, markOk: markOk, result: verifyResult, ticket: tk });
  } catch(e) {
    log('system', '❌ /api/ticket/retry-admin 오류: ' + e.message, 'error');
    res.json({ ok: false, error: '재시도 오류: ' + e.message });
  }
});

// ─── 일괄 재처리 (처리실패 티켓 전부) ───
app.post('/api/ticket/retry-all-failed', async function(req, res) {
  var failed = STATE.tickets.filter(function(t) {
    return t.status === '사용완료' && t.adminOk !== true && t.source === 'naver' && !t.isOption;
  });
  if (failed.length === 0) return res.json({ ok: true, message: '처리실패 티켓 없음', count: 0 });

  log('system', '🔄 일괄 재처리 시작: ' + failed.length + '건');

  // 네이버 세션 먼저 확인
  if (!STATE.sessions.naver) {
    log('system', '네이버 세션 없음 → 재로그인');
    var loginOk = await naverLogin();
    if (!loginOk) return res.json({ ok: false, error: '네이버 로그인 실패' });
  }

  var success = 0, fail = 0;
  // 최대 20건까지 순차 처리 (서버 부하 방지)
  var targets = failed.slice(0, 20);
  for (var i = 0; i < targets.length; i++) {
    var tk = targets[i];
    try {
      log('system', '  [' + (i + 1) + '/' + targets.length + '] ' + tk.buyer + ' #' + (tk.orderNo || ''));
      var markOk = false;
      if (tk.source === 'la2fdoci') {
        markOk = await la2fMarkUsed(tk);
      } else {
        markOk = await naverMarkUsed(tk);
      }
      tk.adminOk = markOk;
      if (markOk) { success++; tk.adminVerified = true; }
      else { fail++; }
      // 사이트 부하 방지
      await new Promise(function(r) { setTimeout(r, 2000); });
    } catch (e) {
      fail++;
      log('system', '  ❌ ' + tk.buyer + ' 예외: ' + e.message, 'error');
    }
  }

  sendState();
  saveTicketsLocal();
  log('system', '✅ 일괄 재처리 완료: 성공 ' + success + '건, 실패 ' + fail + '건' + (failed.length > 20 ? ' (나머지 ' + (failed.length - 20) + '건 다음에)' : ''), success > 0 ? 'success' : 'warning');
  res.json({ ok: true, total: targets.length, success: success, fail: fail, remaining: Math.max(0, failed.length - 20) });
});

// ─── 처리실패 건수 조회 ───
app.get('/api/ticket/failed-count', function(req, res) {
  var failed = STATE.tickets.filter(function(t) {
    return t.status === '사용완료' && t.adminOk !== true && !t.isOption;
  });
  var naverFailed = failed.filter(function(t) { return t.source === 'naver'; }).length;
  var la2fFailed = failed.filter(function(t) { return t.source === 'la2fdoci'; }).length;
  res.json({ ok: true, total: failed.length, naver: naverFailed, la2fdoci: la2fFailed });
});

// ═══ 메시지 발송 시스템 ═══
var querystring = require('querystring');

function fillTemplate(tmplBody, tk) {
  var baseUrl = STATE.config.msg.baseUrl || ('http://localhost:' + (process.env.PORT || 3500));
  return tmplBody
    .replace(/\{buyer\}/g, tk.buyer || '')
    .replace(/\{phone\}/g, tk.phone || '')
    .replace(/\{product\}/g, (tk.product || '').substring(0, 40))
    .replace(/\{qty\}/g, String(tk.qty || 1))
    .replace(/\{price\}/g, String((tk.price || 0).toLocaleString()))
    .replace(/\{orderNo\}/g, tk.orderNo || '')
    .replace(/\{couponNo\}/g, tk.couponNo || '')
    .replace(/\{qrUrl\}/g, 'https://jamsabak.kr/qr/' + (tk.id || ''))
    .replace(/\{date\}/g, new Date().toISOString().split('T')[0])
    .replace(/\{notice\}/g, (STATE.config.msg.naverNotice || '').substring(0, 100))
    .replace(/\{sales\}/g, generateSalesSummaryServer())
    .replace(/\{reviewUrl\}/g, baseUrl + '/r')
    .replace(/\{visitUrl\}/g, baseUrl + '/v?t=' + encodeURIComponent(tk.id || tk.couponNo || tk.orderNo || ''));
}

function generateSalesSummaryServer() {
  var ts = STATE.timeSalesData || {};
  var hourly = ts.hourly || [];
  var tgt = ts.grand_total || {};
  if (hourly.length === 0) return '';
  
  var totalSales = tgt.total_sales || 0;
  var totalQty = tgt.qty || 0;
  
  // 피크 시간
  var sorted = hourly.slice().sort(function(a,b) { return (b.sales||0)-(a.sales||0); });
  var peak = sorted[0] || {};
  var peakPct = totalSales > 0 ? Math.round((peak.sales||0)/totalSales*100) : 0;
  
  // 오전/오후
  var amSales = 0, pmSales = 0;
  hourly.forEach(function(h) {
    if (parseInt(h.hour) < 12) amSales += (h.sales||0);
    else pmSales += (h.sales||0);
  });
  
  var summary = '총₩' + totalSales.toLocaleString() + '/' + totalQty + '건'
    + ' 피크' + peak.hour + '시(₩' + (peak.sales||0).toLocaleString() + '·' + peakPct + '%)'
    + ' 오전₩' + amSales.toLocaleString() + ' 오후₩' + pmSales.toLocaleString();
  
  return summary.substring(0, 100);
}

// Aligo SMS 발송
function sendAligo(phone, msg) {
  var cfg = STATE.config.msg;
  return new Promise(function(resolve, reject) {
    var postData = querystring.stringify({
      key: cfg.aligoKey, user_id: cfg.aligoId, sender: cfg.aligoSender,
      receiver: phone.replace(/[^0-9]/g, ''), msg: msg, testmode_yn: cfg.aligoKey ? 'N' : 'Y',
    });
    var req = https.request({
      hostname: 'apis.aligo.in', port: 443, path: '/send/', method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(postData) },
      timeout: 15000,
    }, function(res) {
      var chunks = [];
      res.on('data', function(c) { chunks.push(c); });
      res.on('end', function() {
        try { var d = JSON.parse(Buffer.concat(chunks).toString()); resolve(d); }
        catch(e) { resolve({ result_code: -1, message: 'parse error' }); }
      });
    });
    req.on('error', reject);
    req.on('timeout', function() { req.destroy(); reject(new Error('timeout')); });
    req.write(postData);
    req.end();
  });
}

// CoolSMS 발송
function sendCoolSms(phone, msg) {
  var cfg = STATE.config.msg;
  var body = JSON.stringify({
    message: { to: phone.replace(/[^0-9]/g, ''), from: cfg.coolsmsSender, text: msg, type: msg.length > 90 ? 'LMS' : 'SMS' }
  });
  return new Promise(function(resolve, reject) {
    var timestamp = Math.floor(Date.now() / 1000).toString();
    var crypto = require('crypto');
    var sig = crypto.createHmac('sha256', cfg.coolsmsSecret).update(timestamp).digest('hex');
    var req = https.request({
      hostname: 'api.coolsms.co.kr', port: 443, path: '/messages/v4/send', method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'HMAC-SHA256 apiKey=' + cfg.coolsmsKey + ', date=' + timestamp + ', salt=' + timestamp + ', signature=' + sig,
      },
      timeout: 15000,
    }, function(res) {
      var chunks = [];
      res.on('data', function(c) { chunks.push(c); });
      res.on('end', function() {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString())); }
        catch(e) { resolve({ statusCode: 'error' }); }
      });
    });
    req.on('error', reject);
    req.on('timeout', function() { req.destroy(); reject(new Error('timeout')); });
    req.write(body);
    req.end();
  });
}

// KakaoTalk 알림톡 발송 (Aligo 비즈메시지 API 활용)
async function sendKakao(phone, msg, templateCode) {
  var cfg = STATE.config.msg;
  var ppurioId = cfg.ppurioId;
  var ppurioKey = cfg.ppurioKey;
  var sender = cfg.ppurioSender || '';
  var senderKey = cfg.kakaoSenderKey || '';
  var tplCode = templateCode || cfg.kakaoTemplateCode || '';
  
  if (!ppurioId || !ppurioKey) return { code: -1, message: '뿌리오 계정/키 미설정' };
  if (!senderKey) return { code: -1, message: '카카오 발신프로필키 미설정' };
  
  try {
    // 1단계: 토큰 발급
    var authStr = Buffer.from(ppurioId + ':' + ppurioKey).toString('base64');
    var tokenResult = await new Promise(function(resolve, reject) {
      var tokenBody = JSON.stringify({ grantType: 'client_credentials' });
      var opts = { hostname: 'message.ppurio.com', port: 443, path: '/v1/token', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Basic ' + authStr, 'Content-Length': Buffer.byteLength(tokenBody) } };
      var req = https.request(opts, function(resp) {
        var c = []; resp.on('data', function(d) { c.push(d); });
        resp.on('end', function() { try { resolve(JSON.parse(Buffer.concat(c).toString())); } catch(e) { reject(e); } });
      });
      req.on('error', reject); req.write(tokenBody); req.end();
    });
    if (!tokenResult.token) return { code: -1, message: '토큰 발급 실패: ' + (tokenResult.description || '') };
    
    // 2단계: 알림톡 발송
    var refKey = 'KAT' + Date.now() + Math.random().toString(36).slice(2, 6);
    var sendObj = {
      account: ppurioId,
      messageType: 'AT',
      from: sender.replace(/[^0-9]/g, ''),
      content: msg,
      duplicateFlag: 'N',
      targetCount: 1,
      targets: [{ to: phone.replace(/[^0-9]/g, '') }],
      refKey: refKey,
      senderKey: senderKey,
      templateCode: tplCode,
      // SMS 대체발송 설정
      rejectType: 'SMS',
      fallbackMessageType: 'LMS',
      fallbackContent: msg,
      fallbackSubject: '[한국잠사박물관]'
    };
    var sendBody = JSON.stringify(sendObj);
    
    var sendResult = await new Promise(function(resolve, reject) {
      var opts2 = { hostname: 'message.ppurio.com', port: 443, path: '/v1/message', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tokenResult.token, 'Content-Length': Buffer.byteLength(sendBody) } };
      var req2 = https.request(opts2, function(resp) {
        var c = []; resp.on('data', function(d) { c.push(d); });
        resp.on('end', function() { try { resolve(JSON.parse(Buffer.concat(c).toString())); } catch(e) { reject(e); } });
      });
      req2.on('error', reject); req2.write(sendBody); req2.end();
    });
    
    var ok = sendResult.messageKey || sendResult.code === 'SUCCESS' || sendResult.code === '0000';
    log('msg', (ok ? '✅' : '❌') + ' 뿌리오 알림톡 → ' + phone + ': ' + (sendResult.description || sendResult.code || ''), ok ? 'success' : 'warning');
    return { code: ok ? 0 : -1, message: sendResult.description || sendResult.code || '' };
  } catch(e) {
    return { code: -1, message: '뿌리오 알림톡 오류: ' + e.message };
  }
}

// 관리자 페이지 직접 발송 (기존 la2fdoci)
async function sendDirect(tk) {
  if (tk.source !== 'la2fdoci' || !STATE.sessions.la2fdoci) return { ok: false, error: 'la2fdoci 세션 없음' };
  var page = STATE.pages.la2fdoci;
  await page.goto(STATE.config.la2fdoci.orderUrl, { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(function(){});
  await new Promise(function(r) { setTimeout(r, 80); });
  var result = await page.evaluate(function(orderNo, buyer) {
    var rows = document.querySelectorAll('table tbody tr');
    for (var i = 0; i < rows.length; i++) {
      var text = rows[i].textContent;
      if ((orderNo && text.indexOf(orderNo) >= 0) || (buyer && text.indexOf(buyer) >= 0)) {
        var btns = rows[i].querySelectorAll('a, button, input[type="button"]');
        for (var j = 0; j < btns.length; j++) {
          var bt = btns[j].textContent || '';
          var oc = btns[j].getAttribute('onclick') || '';
          if (bt.indexOf('문자') >= 0 || bt.indexOf('발송') >= 0 || oc.indexOf('sms') >= 0 || oc.indexOf('send') >= 0) {
            btns[j].click(); return { ok: true };
          }
        }
        return { ok: false, error: 'SMS 버튼 없음' };
      }
    }
    return { ok: false, error: '주문 미발견' };
  }, tk.orderNo, tk.buyer);
  if (result.ok) {
    await new Promise(function(r) { setTimeout(r, 300); });
    await page.evaluate(function() {
      document.querySelectorAll('button, input[value="확인"]').forEach(function(b) {
        if ((b.textContent || b.value || '').indexOf('확인') >= 0) b.click();
      });
    });
    await new Promise(function(r) { setTimeout(r, 80); });
  }
  return result;
}

// 통합 메시지 발송
async function sendMessage(tk, templateId) {
  var cfg = STATE.config.msg;
  var tmpl = cfg.templates.find(function(t) { return t.id === templateId; }) || cfg.templates[0];
  if (!tmpl) return { ok: false, error: '템플릿 없음' };
  if (!tk.phone) return { ok: false, error: '전화번호 없음' };
  
  var msg = fillTemplate(tmpl.body, tk);
  var provider = (tmpl.type === 'kakao') ? 'kakao' : cfg.provider;
  var result = { ok: false, provider: provider };
  
  try {
    if (provider === 'ppurio') {
      if (!cfg.ppurioKey) return { ok: false, error: '뿌리오 API 키 미설정' };
      var rp = await sendDirectMessage(tk.phone, msg);
      result.ok = rp.ok;
      result.detail = rp.detail || rp.error;
    } else if (provider === 'aligo') {
      if (!cfg.aligoKey) return { ok: false, error: 'Aligo API 키 미설정' };
      var r = await sendAligo(tk.phone, msg);
      result.ok = r.result_code === 1 || r.result_code === '1';
      result.detail = r.message || JSON.stringify(r);
    } else if (provider === 'coolsms') {
      if (!cfg.coolsmsKey) return { ok: false, error: 'CoolSMS API 키 미설정' };
      var r2 = await sendCoolSms(tk.phone, msg);
      result.ok = r2.statusCode === '2000' || !r2.errorCode;
      result.detail = r2.statusMessage || JSON.stringify(r2);
    } else if (provider === 'kakao') {
      if (!cfg.ppurioKey) return { ok: false, error: '뿌리오 API 인증키 미설정 (메시지 탭 → 카카오 알림톡 설정)' };
      if (!cfg.kakaoSenderKey) return { ok: false, error: '카카오 발신프로필키 미설정 (뿌리오 → 카카오톡 → 발신프로필 등록)' };
      var r3 = await sendKakao(tk.phone, msg, tmpl.kakaoCode);
      result.ok = r3.code === 0 || r3.code === '0';
      result.detail = r3.message || JSON.stringify(r3);
      // 알림톡 실패 시 SMS 자동 대체발송
      if (!result.ok && cfg.ppurioSender) {
        log('msg', '알림톡 실패 → SMS 대체발송 시도', 'warning');
        var fallback = await sendDirectMessage(tk.phone, msg);
        if (fallback.ok) { result.ok = true; result.detail = 'SMS 대체발송 성공'; result.provider = 'ppurio-sms'; }
      }
    } else if (provider === 'direct') {
      var r4 = await sendDirect(tk);
      result.ok = r4.ok;
      result.detail = r4.error || '관리자페이지 발송';
    } else {
      return { ok: false, error: '알 수 없는 프로바이더: ' + provider };
    }
  } catch(e) {
    result.error = e.message;
  }
  
  // 이력 저장
  var hist = {
    id: Date.now(), time: new Date().toISOString(), ticketId: tk.id,
    buyer: tk.buyer, phone: tk.phone, provider: provider,
    template: tmpl.name, ok: result.ok, detail: result.detail || result.error || '',
  };
  STATE.msgHistory.unshift(hist);
  if (STATE.msgHistory.length > 200) STATE.msgHistory.length = 200;
  
  if (result.ok) {
    tk.smsSent = true;
    tk.smsTime = new Date().toISOString();
    tk.smsProvider = provider;
    log('msg', '✅ ' + tk.buyer + ' → ' + provider + ' 발송 성공', 'success');
    broadcast({ type: 'ticketUpdate', data: tk });
  } else {
    log('msg', '❌ ' + tk.buyer + ' → ' + provider + ' 실패: ' + (result.detail || result.error), 'error');
  }
  broadcast({ type: 'msgSent', data: hist });
  
  return result;
}

// API: 메시지 발송 (티켓 기반)
app.post('/api/ticket/sms', async function(req, res) {
  var tk = STATE.tickets.find(function(t) { return t.id === req.body.ticketId; });
  if (!tk) return res.json({ ok: false, error: '티켓 없음' });
  var templateId = req.body.template || 'welcome';
  var result = await sendMessage(tk, templateId);
  res.json({ ok: result.ok, ticket: tk, detail: result.detail, error: result.error });
});

// API: 직접 메시지 발송 (번호+내용)
app.post('/api/msg/send', async function(req, res) {
  var b = req.body;
  var fakeTk = { buyer: b.name || '수신자', phone: b.phone, product: b.product || '', qty: b.qty || 1, price: 0, orderNo: '', couponNo: '', id: 'manual' };
  if (b.message) {
    // 직접 입력 메시지
    var cfg = STATE.config.msg;
    try {
      var result;
      if (cfg.provider === 'aligo') result = await sendAligo(b.phone, b.message);
      else if (cfg.provider === 'coolsms') result = await sendCoolSms(b.phone, b.message);
      else return res.json({ ok: false, error: '직접발송은 API 방식만 지원' });
      
      var hist = { id: Date.now(), time: new Date().toISOString(), buyer: b.name || '수신자', phone: b.phone, provider: cfg.provider, template: '직접입력', ok: true, detail: b.message.substring(0, 50) };
      STATE.msgHistory.unshift(hist);
      broadcast({ type: 'msgSent', data: hist });
      res.json({ ok: true, result: result });
    } catch(e) { res.json({ ok: false, error: e.message }); }
  } else {
    var result2 = await sendMessage(fakeTk, b.template || 'welcome');
    res.json({ ok: result2.ok, detail: result2.detail, error: result2.error });
  }
});

// API: 대량 발송 (사용가능 티켓 전체)
app.post('/api/msg/bulk', async function(req, res) {
  var templateId = req.body.template || 'welcome';
  var targets = STATE.tickets.filter(function(t) {
    return ['사용가능', '확정'].indexOf(t.status) >= 0 && t.phone && !t.smsSent;
  });
  log('msg', '📨 대량발송 시작: ' + targets.length + '건 [' + templateId + ']');
  var ok = 0, fail = 0;
  for (var i = 0; i < targets.length; i++) {
    var r = await sendMessage(targets[i], templateId);
    if (r.ok) ok++; else fail++;
    if (i > 0 && i % 10 === 0) {
      log('msg', '  진행: ' + (i + 1) + '/' + targets.length + ' (성공:' + ok + ' 실패:' + fail + ')');
      await new Promise(function(rv) { setTimeout(rv, 500); }); // rate limit
    }
  }
  log('msg', '📨 대량발송 완료: 성공 ' + ok + ' / 실패 ' + fail, ok > 0 ? 'success' : 'warning');
  res.json({ ok: true, total: targets.length, success: ok, fail: fail });
});

// API: 메시지 설정
app.post('/api/msg/config', function(req, res) {
  var b = req.body;
  var cfg = STATE.config.msg;
  if (b.provider !== undefined) cfg.provider = b.provider;
  if (b.ppurioId !== undefined) cfg.ppurioId = b.ppurioId;
  if (b.ppurioKey !== undefined) cfg.ppurioKey = b.ppurioKey;
  if (b.ppurioSender !== undefined) cfg.ppurioSender = b.ppurioSender;
  if (b.aligoKey !== undefined) cfg.aligoKey = b.aligoKey;
  if (b.aligoId !== undefined) cfg.aligoId = b.aligoId;
  if (b.aligoSender !== undefined) cfg.aligoSender = b.aligoSender;
  if (b.coolsmsKey !== undefined) cfg.coolsmsKey = b.coolsmsKey;
  if (b.coolsmsSecret !== undefined) cfg.coolsmsSecret = b.coolsmsSecret;
  if (b.coolsmsSender !== undefined) cfg.coolsmsSender = b.coolsmsSender;
  if (b.kakaoKey !== undefined) cfg.kakaoKey = b.kakaoKey;
  if (b.kakaoSenderKey !== undefined) cfg.kakaoSenderKey = b.kakaoSenderKey;
  if (b.kakaoTemplateCode !== undefined) cfg.kakaoTemplateCode = b.kakaoTemplateCode;
  if (b.autoSend !== undefined) cfg.autoSend = b.autoSend;
  log('msg', '⚙️ 메시지 설정 변경: ' + Object.keys(b).join(', '));
  res.json({ ok: true });
});

// API: 템플릿 관리
app.post('/api/msg/template', function(req, res) {
  var b = req.body;
  var cfg = STATE.config.msg;
  if (b.action === 'add') {
    var tmpl = { id: 'tmpl_' + Date.now(), name: b.name || '새 템플릿', type: b.type || 'sms', body: b.body || '' };
    cfg.templates.push(tmpl);
    res.json({ ok: true, template: tmpl });
  } else if (b.action === 'edit') {
    var t = cfg.templates.find(function(x) { return x.id === b.id; });
    if (!t) return res.json({ ok: false, error: '템플릿 없음' });
    if (b.name !== undefined) t.name = b.name;
    if (b.type !== undefined) t.type = b.type;
    if (b.body !== undefined) t.body = b.body;
    res.json({ ok: true, template: t });
  } else if (b.action === 'delete') {
    cfg.templates = cfg.templates.filter(function(x) { return x.id !== b.id; });
    res.json({ ok: true });
  } else {
    res.json({ ok: true, templates: cfg.templates });
  }
});

// API: 발송 이력
app.get('/api/msg/history', function(req, res) {
  res.json({ history: STATE.msgHistory });
});

// API: 사용처리 이력
app.get('/api/use/history', function(req, res) {
  res.json({ history: STATE.useHistory });
});

// API: 테스트 발송
app.post('/api/msg/test', async function(req, res) {
  var phone = req.body.phone;
  if (!phone) return res.json({ ok: false, error: '전화번호 필요' });
  var testTk = { buyer: '테스트', phone: phone, product: '테스트상품', qty: 1, price: 10000, orderNo: 'TEST001', couponNo: 'TEST', id: 'test' };
  var result = await sendMessage(testTk, req.body.template || 'welcome');
  res.json({ ok: result.ok, detail: result.detail, error: result.error, provider: result.provider });
});

// ═══ 특정 번호 직접 발송 ═══
app.post('/api/msg/send-specific', async function(req, res) {
  try {
    var phone = (req.body.phone || '').trim();
    var message = (req.body.message || '').trim();
    var templateId = req.body.template || '';
    
    if (!phone) return res.json({ ok: false, error: '전화번호 필요' });
    
    // 직접 메시지가 있으면 그대로 발송
    if (message) {
      log('msg', '📱 특정번호 발송: ' + phone + ' (' + message.length + '자)');
      var result = await sendDirectMessage(phone, message);
      return res.json(result);
    }
    
    // 템플릿 사용
    if (templateId) {
      var fakeTk = { buyer: '고객', phone: phone, product: '입장권', qty: 1, price: 13000, orderNo: '', couponNo: '', id: 'specific' };
      var result2 = await sendMessage(fakeTk, templateId);
      return res.json({ ok: result2.ok, detail: result2.detail, error: result2.error });
    }
    
    res.json({ ok: false, error: '메시지 또는 템플릿 필요' });
  } catch(e) {
    res.json({ ok: false, error: e.message });
  }
});

// ═══ 직접 메시지 발송 (Aligo/뿌리오) ═══
async function sendDirectMessage(phone, message) {
  var cfg = STATE.config.msg;
  var provider = cfg.provider || 'ppurio';
  
  // ═══ 뿌리오 SMS ═══
  if ((provider === 'ppurio' || provider === 'aligo') && cfg.ppurioKey && cfg.ppurioId) {
    try {
      var sender = cfg.ppurioSender || cfg.aligoSender || '';
      if (!sender) return { ok: false, error: '발신번호 미설정' };
      
      log('msg', '📱 뿌리오 발송: ' + phone + ' (' + message.length + '자)');
      
      // 1단계: 토큰 발급 (Basic Auth: base64(account:apikey))
      var authStr = Buffer.from(cfg.ppurioId + ':' + cfg.ppurioKey).toString('base64');
      
      var tokenResult = await new Promise(function(resolve, reject) {
        var tokenBody = JSON.stringify({ grantType: 'client_credentials' });
        var opts = { hostname: 'message.ppurio.com', port: 443, path: '/v1/token', method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Basic ' + authStr, 'Content-Length': Buffer.byteLength(tokenBody) } };
        var req2 = https.request(opts, function(resp) {
          var c = []; resp.on('data', function(d) { c.push(d); });
          resp.on('end', function() { try { resolve(JSON.parse(Buffer.concat(c).toString())); } catch(e) { reject(e); } });
        });
        req2.on('error', reject); req2.write(tokenBody); req2.end();
      });
      
      if (!tokenResult.token) {
        log('msg', '❌ 뿌리오 토큰 발급 실패: ' + JSON.stringify(tokenResult).substring(0, 200), 'error');
        return { ok: false, error: '뿌리오 인증 실패: ' + (tokenResult.description || tokenResult.code || 'token 없음') };
      }
      
      log('msg', '✅ 뿌리오 토큰 발급 성공');
      
      // 2단계: 메시지 발송 (한글=2바이트 기준, SMS 90바이트 제한 → 초과 시 LMS)
      var byteLen = 0;
      for (var ci = 0; ci < message.length; ci++) { byteLen += message.charCodeAt(ci) > 127 ? 2 : 1; }
      var msgType = byteLen > 90 ? 'LMS' : 'SMS';
      log('msg', '메시지 ' + byteLen + '바이트 → ' + msgType);
      var refKey = 'JAMSA' + Date.now() + Math.random().toString(36).slice(2, 6);
      var sendObj = {
        account: cfg.ppurioId,
        messageType: msgType,
        content: message,
        from: sender.replace(/[^0-9]/g, ''),
        duplicateFlag: 'N',
        targetCount: 1,
        targets: [{ to: phone.replace(/[^0-9]/g, '') }],
        refKey: refKey
      };
      if (msgType === 'LMS') sendObj.subject = '[한국잠사박물관]';
      var sendBody = JSON.stringify(sendObj);
      
      var sendResult = await new Promise(function(resolve, reject) {
        var opts2 = { hostname: 'message.ppurio.com', port: 443, path: '/v1/message', method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tokenResult.token, 'Content-Length': Buffer.byteLength(sendBody) } };
        var req3 = https.request(opts2, function(resp) {
          var c = []; resp.on('data', function(d) { c.push(d); });
          resp.on('end', function() { try { resolve(JSON.parse(Buffer.concat(c).toString())); } catch(e) { reject(e); } });
        });
        req3.on('error', reject); req3.write(sendBody); req3.end();
      });
      
      var ok = sendResult.code === 'SUCCESS' || sendResult.code === '0000' || sendResult.messageKey;
      log('msg', (ok ? '✅' : '❌') + ' 뿌리오 ' + msgType + ' → ' + phone + ': ' + (sendResult.description || sendResult.code || ''), ok ? 'success' : 'warning');
      return { ok: !!ok, detail: sendResult.description || sendResult.code, error: ok ? null : (sendResult.description || sendResult.code) };
    } catch(e) {
      log('msg', '❌ 뿌리오 오류: ' + e.message, 'error');
      return { ok: false, error: '뿌리오 오류: ' + e.message };
    }
  }
  
  // ═══ Aligo SMS (폴백) ═══
  if (cfg.aligoKey && cfg.aligoId) {
    try {
      var qs = require('querystring');
      var postData = qs.stringify({
        key: cfg.aligoKey, user_id: cfg.aligoId,
        sender: cfg.aligoSender || cfg.ppurioSender || '',
        receiver: phone.replace(/[^0-9]/g, ''),
        msg: message,
        msg_type: message.length > 90 ? 'LMS' : 'SMS',
      });
      
      var result = await new Promise(function(resolve, reject) {
        var opts = { hostname: 'apis.aligo.in', port: 443, path: '/send/', method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(postData) } };
        var req2 = https.request(opts, function(resp) {
          var c = []; resp.on('data', function(d) { c.push(d); });
          resp.on('end', function() { try { resolve(JSON.parse(Buffer.concat(c).toString())); } catch(e) { reject(e); } });
        });
        req2.on('error', reject); req2.write(postData); req2.end();
      });
      
      var ok2 = result.result_code === '1' || result.result_code === 1;
      return { ok: ok2, detail: result.message, error: ok2 ? null : result.message };
    } catch(e) {
      return { ok: false, error: 'Aligo 오류: ' + e.message };
    }
  }
  
  return { ok: false, error: '발송 서비스 미설정. 메시지 탭에서 뿌리오 API 키를 설정해주세요.' };
}

// ═══ Supabase 동기화 API ═══
app.post('/api/supabase/config', function(req, res) {
  var b = req.body || {};
  if (b.url) process.env.SUPABASE_URL = b.url;
  if (b.key) process.env.SUPABASE_SERVICE_KEY = b.key;
  var ok = sbSync.init(b.url || process.env.SUPABASE_URL, b.key || process.env.SUPABASE_SERVICE_KEY);
  if (ok) sbSync.startAutoSync(STATE, 60000);
  // .env에도 저장
  try {
    var envPath = path.join(__dirname, '.env');
    var envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
    if (b.url) {
      if (envContent.indexOf('SUPABASE_URL=') >= 0) envContent = envContent.replace(/SUPABASE_URL=.*/g, 'SUPABASE_URL=' + b.url);
      else envContent += '\nSUPABASE_URL=' + b.url;
    }
    if (b.key) {
      if (envContent.indexOf('SUPABASE_SERVICE_KEY=') >= 0) envContent = envContent.replace(/SUPABASE_SERVICE_KEY=.*/g, 'SUPABASE_SERVICE_KEY=' + b.key);
      else envContent += '\nSUPABASE_SERVICE_KEY=' + b.key;
    }
    fs.writeFileSync(envPath, envContent);
  } catch(e) {}
  res.json({ ok: ok });
});

app.post('/api/supabase/test', async function(req, res) {
  if (!sbSync.isEnabled()) return res.json({ ok: false, error: 'Supabase URL/Key 미설정' });
  try {
    var settings = await sbSync.getSettings('crawl');
    res.json({ ok: true, test: settings ? '설정 읽기 성공' : '빈 설정 (정상)' });
  } catch(e) {
    res.json({ ok: false, error: e.message });
  }
});

app.post('/api/supabase/sync', async function(req, res) {
  if (!sbSync.isEnabled()) return res.json({ ok: false, error: 'Supabase URL/Key 미설정' });
  try {
    var result = await sbSync.fullSync(STATE);
    res.json({ ok: true, tickets: result.tickets, sales: result.sales });
  } catch(e) {
    res.json({ ok: false, error: e.message });
  }
});

app.post('/api/test', async function(req, res) {
  var src = req.body.source;
  var ok = false;
  var diag = [];
  
  if (src === 'la2fdoci') {
    diag.push('ID: ' + (STATE.config.la2fdoci.id || '미설정'));
    diag.push('PW: ' + (STATE.config.la2fdoci.pw ? '설정됨 (' + STATE.config.la2fdoci.pw.length + '자)' : '미설정'));
    
    // 1단계: DNS + 연결 테스트
    try {
      var testStart = Date.now();
      await new Promise(function(resolve, reject) {
        var req2 = https.request({ hostname: 'la2fdoci.com', port: 443, path: '/', method: 'HEAD', timeout: 10000, rejectUnauthorized: false }, function(resp) {
          diag.push('연결: ✅ HTTP ' + resp.statusCode + ' (' + (Date.now() - testStart) + 'ms)');
          resolve();
        });
        req2.on('error', function(e) { diag.push('연결: ❌ ' + e.message); reject(e); });
        req2.on('timeout', function() { req2.destroy(); diag.push('연결: ❌ 타임아웃 (10초)'); reject(new Error('timeout')); });
        req2.end();
      });
    } catch(e) {
      diag.push('💡 la2fdoci.com에 연결할 수 없습니다: ' + e.message);
      return res.json({ ok: false, sessions: STATE.sessions, diag: diag });
    }
    
    // 2단계: 로그인 시도
    ok = await la2fLogin();
    diag.push('로그인: ' + (ok ? '✅ 성공' : '❌ 실패'));
    diag.push('세션쿠키: ' + (STATE._la2fCookies ? STATE._la2fCookies.substring(0, 50) + '...' : '없음'));
  }
  else if (src === 'naver') ok = await naverLogin();
  else if (src === 'okpos') ok = await okposLogin();
  
  sendState();
  res.json({ ok: ok, sessions: STATE.sessions, diag: diag.length > 0 ? diag : undefined });
});

// WebSocket
wss.on('connection', function(ws) {
  log('system', '클라이언트 연결');
  sendStateImmediate();
  ws.on('message', async function(raw) {
    try {
      var d = JSON.parse(raw);
      if (d.type === 'getState') sendStateImmediate();
      if (d.type === 'crawlOnce') await crawlCycle();
      if (d.type === 'useTicket') { var r = await processUse(d.ticketId); ws.send(JSON.stringify({ type: 'useResult', data: r })); }
    } catch(e) {}
  });
});

// SPA fallback
// ═══ 직원 인증 ═══
app.post('/api/auth/login', function(req, res) {
  var pin = req.body.pin;
  var staff = STATE.staff.find(function(s) { return s.pin === pin; });
  if (staff) {
    log('auth', staff.name + ' 로그인', 'success');
    res.json({ ok: true, staff: { id: staff.id, name: staff.name, role: staff.role } });
  } else {
    res.json({ ok: false, error: 'PIN 불일치' });
  }
});

// ═══ 티켓 수동 발권 ═══
app.post('/api/ticket/issue', function(req, res) {
  var b = req.body;
  if (!b.buyer || !b.phone) return res.json({ ok: false, error: '필수 정보 누락' });
  var tk = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    orderNo: 'M-' + Date.now(),
    buyer: b.buyer, phone: b.phone, product: b.product || '수동발권',
    price: b.price || 0, unitPrice: b.unitPrice || 0, qty: b.qty || 1,
    status: '사용가능', source: b.source || 'manual',
    qrCode: 'TK-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8).toUpperCase(),
    issuedAt: new Date().toISOString(), usedAt: null,
    issuedBy: b.issuedBy || '시스템', memo: b.memo || '', group: b.group || '',
    isFreePass: !b.price || b.price === 0,
  };
  STATE.tickets.unshift(tk);
  broadcast({ type: 'newTicket', data: tk });
  log('ticket', tk.buyer + ' 발권 (' + tk.source + ') by ' + tk.issuedBy, 'success');
  res.json({ ok: true, ticket: tk });
});

// ═══ 체험 프로그램 CRUD ═══
app.get('/api/experiences', function(req, res) { res.json({ ok: true, experiences: STATE.experiences }); });
app.post('/api/experience/add', function(req, res) {
  var e = req.body;
  if (!e.name) return res.json({ ok: false, error: '체험명 필수' });
  var exp = { id: 'exp-' + Date.now(), name: e.name, duration: e.duration || 30, capacity: e.capacity || 10, price: e.price || 0, color: e.color || '#10b981' };
  STATE.experiences.push(exp);
  broadcast({ type: 'expUpdate', data: STATE.experiences });
  log('experience', '"' + exp.name + '" 추가', 'success');
  res.json({ ok: true, experience: exp });
});
app.post('/api/experience/edit', function(req, res) {
  var e = req.body;
  var idx = STATE.experiences.findIndex(function(x) { return x.id === e.id; });
  if (idx < 0) return res.json({ ok: false, error: '체험 없음' });
  STATE.experiences[idx] = Object.assign(STATE.experiences[idx], e);
  broadcast({ type: 'expUpdate', data: STATE.experiences });
  log('experience', '"' + e.name + '" 수정', 'success');
  res.json({ ok: true });
});
app.post('/api/experience/delete', function(req, res) {
  var id = req.body.id;
  STATE.experiences = STATE.experiences.filter(function(x) { return x.id !== id; });
  broadcast({ type: 'expUpdate', data: STATE.experiences });
  log('experience', id + ' 삭제', 'warning');
  res.json({ ok: true });
});

// ═══ 체험 예약 ═══
app.post('/api/exp-booking/add', function(req, res) {
  var b = req.body;
  // 중복 체크
  var dup = STATE.expBookings.find(function(x) { return x.phone === b.phone && x.date === b.date && x.time === b.time && x.status !== 'cancelled'; });
  if (dup) return res.json({ ok: false, error: b.time + '에 이미 예약 있음' });
  var exp = STATE.experiences.find(function(x) { return x.id === b.expId; });
  if (!exp) return res.json({ ok: false, error: '체험 없음' });
  var count = STATE.expBookings.filter(function(x) { return x.expId === b.expId && x.date === b.date && x.time === b.time && x.status !== 'cancelled'; }).length;
  if (count + (b.count || 1) > exp.capacity) return res.json({ ok: false, error: '정원 초과' });
  var isExternal = b.source === 'la2fdoci' || b.source === 'naver';
  var bk = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    expId: b.expId, expName: exp.name, date: b.date, time: b.time,
    buyer: b.buyer, phone: b.phone, count: b.count || 1,
    price: exp.price * (b.count || 1), status: isExternal ? 'used' : 'confirmed',
    qrCode: 'EXP-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase(),
    ticketQR: b.ticketQR || '', source: b.source || 'manual',
    createdAt: new Date().toISOString(), autoUsed: isExternal,
  };
  STATE.expBookings.unshift(bk);
  broadcast({ type: 'expBookingNew', data: bk });
  log('exp-booking', bk.buyer + ' → ' + exp.name + ' ' + b.time + (isExternal ? ' ⚡즉시사용' : ''), 'success');
  res.json({ ok: true, booking: bk });
});

// ═══ 대여 예약 ═══
app.post('/api/rental-booking/add', function(req, res) {
  var b = req.body;
  var dupLoc = STATE.rentalBookings.find(function(x) { return x.rentalId === b.rentalId && x.date === b.date && x.time === b.time && x.status !== 'cancelled'; });
  if (dupLoc) return res.json({ ok: false, error: '해당 시간 이미 예약됨' });
  var dupPerson = STATE.rentalBookings.find(function(x) { return x.phone === b.phone && x.date === b.date && x.time === b.time && x.status !== 'cancelled'; });
  if (dupPerson) return res.json({ ok: false, error: b.time + ' 이미 예약 있음' });
  var rental = STATE.rentals.find(function(x) { return x.id === b.rentalId; });
  if (!rental) return res.json({ ok: false, error: '장소 없음' });
  var isExternal = b.source === 'la2fdoci' || b.source === 'naver';
  var bk = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    rentalId: rental.id, rentalName: rental.name, type: rental.type,
    date: b.date, time: b.time, buyer: b.buyer, phone: b.phone,
    price: rental.price, memo: b.memo || '', status: isExternal ? 'used' : 'confirmed',
    qrCode: 'RT-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase(),
    ticketQR: b.ticketQR || '', source: b.source || 'manual',
    createdAt: new Date().toISOString(), autoUsed: isExternal,
  };
  STATE.rentalBookings.unshift(bk);
  broadcast({ type: 'rentalBookingNew', data: bk });
  log('rental', bk.buyer + ' → ' + rental.name + ' ' + b.time + (isExternal ? ' ⚡즉시사용' : ''), 'success');
  res.json({ ok: true, booking: bk });
});

// ═══ 자동 사용처리 (1분마다) ═══
setInterval(function() {
  var now = new Date();
  var hhmm = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
  var todayStr = now.toISOString().split('T')[0];
  var changed = false;
  STATE.expBookings.forEach(function(b) {
    if (b.status === 'confirmed' && b.date === todayStr && b.time <= hhmm) {
      b.status = 'used'; b.autoUsed = true; changed = true;
      log('auto', b.buyer + ' 체험 자동사용 (' + b.expName + ' ' + b.time + ')', 'info');
    }
  });
  STATE.rentalBookings.forEach(function(b) {
    if (b.status === 'confirmed' && b.date === todayStr) {
      var start = (b.time || '').split('~')[0];
      if (start && start <= hhmm) {
        b.status = 'used'; b.autoUsed = true; changed = true;
        log('auto', b.buyer + ' 대여 자동사용 (' + b.rentalName + ' ' + b.time + ')', 'info');
      }
    }
  });
  if (changed) sendState();
}, 60000);

// ═══════════════════════════════════════════════════════════════
//  [통합 검색] 크롤링 데이터 검색 엔진
//  이름, 연락처, 상품명, 주문번호, 출처 등 통합 검색
// ═══════════════════════════════════════════════════════════════
app.get('/api/ticket/search-all', function(req, res) {
  var q = (req.query.q || '').trim().toLowerCase();
  var source = (req.query.source || '').toLowerCase(); // naver, la2fdoci, 현장, ''=전체
  var status = (req.query.status || '');                // 사용가능, 사용완료, ''=전체
  var dateFrom = req.query.from || '';
  var dateTo = req.query.to || '';
  var limit = Math.min(parseInt(req.query.limit) || 100, 500);

  var results = STATE.tickets.filter(function(tk) {
    // 출처 필터
    if (source && (tk.source || '').toLowerCase().indexOf(source) < 0) return false;
    // 상태 필터
    if (status && tk.status !== status) return false;
    // 날짜 필터
    if (dateFrom || dateTo) {
      var tkDate = (tk.usedAt || tk.bookDate || tk.createdAt || '').substring(0, 10);
      if (dateFrom && tkDate < dateFrom) return false;
      if (dateTo && tkDate > dateTo) return false;
    }
    // 키워드 검색 (빈 키워드면 전부 매칭)
    if (!q) return true;
    // 이름, 연락처, 상품명, 주문번호, 쿠폰번호 검색
    var searchable = [
      tk.buyer || '', tk.phone || '', tk.product || '',
      tk.orderNo || '', tk.couponNo || '', tk.source || '',
      String(tk.id || ''),
    ].join(' ').toLowerCase();
    return searchable.indexOf(q) >= 0;
  });

  // 최신순 정렬
  results.sort(function(a, b) {
    var da = a.usedAt || a.bookDate || a.createdAt || '';
    var db = b.usedAt || b.bookDate || b.createdAt || '';
    return db.localeCompare(da);
  });

  var total = results.length;
  results = results.slice(0, limit);

  res.json({
    ok: true, query: q, total: total, count: results.length,
    results: results.map(function(tk) {
      return {
        id: tk.id, buyer: tk.buyer || '', phone: tk.phone || '',
        phone4: tk.phone ? tk.phone.replace(/[^0-9]/g, '').slice(-4) : '',
        product: tk.product || '', qty: tk.qty || 1, price: tk.price || 0,
        status: tk.status || '', source: tk.source || '',
        orderNo: tk.orderNo || '', couponNo: tk.couponNo || '',
        usedAt: tk.usedAt || null, bookDate: tk.bookDate || '',
        history: tk.history || [],
        adminOk: tk.adminOk, adminVerified: tk.adminVerified,
      };
    }),
  });
});

// ─── 개별 크롤링 API (완전 독립 실행) ───
app.post('/api/crawl/naver-only', async function(req, res) {
  log('system', '🔄 네이버 단독 크롤링 시작');
  STATE.crawlAborted = false;
  STATE.crawlStatus.naver = 'crawling';
  sendState();
  try {
    var result = await la2fWithTimeout(naverCrawl(), 90000, 'naver');
    var cnt = Array.isArray(result) ? result.length : 0;
    STATE.crawlStatus.naver = 'idle';
    log('naver', '✅ 네이버 크롤링 완료: ' + cnt + '건', 'success');
  } catch(e) {
    STATE.crawlStatus.naver = 'error';
    log('naver', '❌ 크롤링 오류: ' + e.message, 'error');
  }
  saveTicketsLocal();
  sendState();
  res.json({ ok: true, source: 'naver', tickets: STATE.tickets.filter(function(t) { return t.source === 'naver'; }).length });
});

app.post('/api/crawl/la2f-only', async function(req, res) {
  log('system', '🔄 라이프도시 단독 크롤링 시작');
  STATE.crawlAborted = false;
  STATE.crawlStatus.la2fdoci = 'crawling';
  sendState();
  try {
    var result = await la2fWithTimeout(la2fCrawl(), 180000, 'la2fdoci');
    var cnt = Array.isArray(result) ? result.length : 0;
    STATE.crawlStatus.la2fdoci = 'idle';
    log('la2fdoci', '✅ 라이프도시 크롤링 완료: ' + cnt + '건', 'success');
  } catch(e) {
    STATE.crawlStatus.la2fdoci = 'error';
    log('la2fdoci', '❌ 크롤링 오류: ' + e.message, 'error');
  }
  saveTicketsLocal();
  sendState();
  res.json({ ok: true, source: 'la2fdoci', tickets: STATE.tickets.filter(function(t) { return t.source === 'la2fdoci'; }).length });
});

app.post('/api/crawl/okpos-only', async function(req, res) {
  log('system', '🔄 OKPOS 단독 크롤링 시작');
  STATE.crawlStatus.okpos = 'crawling';
  sendState();
  try {
    if (!STATE.config.okpos.id || !STATE.config.okpos.pw) {
      log('okpos', '⚠️ OKPOS 계정 미설정', 'warning');
      STATE.crawlStatus.okpos = 'idle';
      sendState();
      return res.json({ ok: false, error: 'OKPOS 계정 미설정' });
    }
    // 로그인
    if (!STATE.sessions.okpos) {
      log('okpos', '로그인 시도...');
      await okposLogin();
    }
    // 매출 크롤링
    if (STATE.sessions.okpos) {
      await okposSalesCrawl();
      await okposTimeSalesCrawl();
      STATE.crawlStatus.okpos = 'connected';
      log('okpos', '✅ OKPOS 크롤링 완료', 'success');
    } else {
      STATE.crawlStatus.okpos = 'error';
      log('okpos', '❌ OKPOS 로그인 실패', 'error');
    }
  } catch(e) {
    STATE.crawlStatus.okpos = 'error';
    log('okpos', '❌ OKPOS 오류: ' + e.message, 'error');
  }
  sendState();
  res.json({ ok: true, source: 'okpos', sales: (STATE.dailySales || []).length });
});

// 타임아웃 헬퍼 (개별 크롤링용)
function la2fWithTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise(function(_, reject) {
      setTimeout(function() { reject(new Error(label + ' 타임아웃 (' + (ms/1000) + '초)')); }, ms);
    })
  ]);
}

// ─── 티켓 진행이력 조회 API ───
app.get('/api/ticket/history/:id', function(req, res) {
  var tk = STATE.tickets.find(function(t) { return String(t.id) === String(req.params.id); });
  if (!tk) return res.json({ ok: false, error: '티켓 없음' });
  res.json({
    ok: true, id: tk.id, buyer: tk.buyer, product: tk.product, status: tk.status,
    history: tk.history || [], notes: tk.notes || [],
    details: { bookDate: tk.bookDate || '', usedAt: tk.usedAt || '', adminOk: tk.adminOk, txnId: tk.txnId || '', source: tk.source || '' }
  });
});

// ─── 고객 구매이력 (전화번호 기준 전체 조회) ───
app.get('/api/customer/profile/:phone', function(req, res) {
  var phone = (req.params.phone || '').replace(/[^0-9]/g, '');
  if (phone.length < 4) return res.json({ ok: false, error: '4자리 이상 입력' });

  var isLast4 = phone.length === 4;
  var tickets = STATE.tickets.filter(function(t) {
    var tp = (t.phone || '').replace(/[^0-9]/g, '');
    return isLast4 ? tp.slice(-4) === phone : tp.indexOf(phone) >= 0;
  });

  if (tickets.length === 0) return res.json({ ok: false, error: '해당 고객 없음' });

  // 고객 정보 추출
  var firstTk = tickets[0];
  var totalSpent = 0, totalVisits = 0, products = {};
  tickets.forEach(function(t) {
    totalSpent += (t.price || 0);
    if (t.status === '사용완료') totalVisits++;
    var p = t.product || '기타';
    products[p] = (products[p] || 0) + (t.qty || 1);
  });

  // 모든 구매이력 (최신순)
  var history = tickets.map(function(t) {
    return {
      id: t.id, date: t.bookDate || t.usedAt || '', product: t.product || '',
      qty: t.qty || 1, price: t.price || 0, status: t.status || '',
      source: t.source || '', usedAt: t.usedAt || null,
      history: t.history || [], notes: t.notes || [],
    };
  }).sort(function(a, b) { return (b.date || '').localeCompare(a.date || ''); });

  res.json({
    ok: true,
    customer: {
      name: firstTk.buyer || '', phone: firstTk.phone || '',
      totalPurchases: tickets.length, totalSpent: totalSpent,
      totalVisits: totalVisits, products: products,
      firstVisit: history.length > 0 ? history[history.length - 1].date : '',
      lastVisit: history.length > 0 ? history[0].date : '',
    },
    purchases: history,
  });
});

// ─── 상담이력 (메모/노트) 추가 ───
app.post('/api/ticket/note', function(req, res) {
  var b = req.body;
  var tk = STATE.tickets.find(function(t) { return String(t.id) === String(b.id); });
  if (!tk) return res.json({ ok: false, error: '티켓 없음' });
  if (!tk.notes) tk.notes = [];
  tk.notes.push({
    text: (b.text || '').substring(0, 500),
    by: b.by || '직원',
    type: b.type || 'memo',   // memo, call, complaint, refund, etc
    time: new Date().toISOString(),
  });
  sendState();
  saveTicketsLocal();
  res.json({ ok: true, notes: tk.notes });
});

// 고객 전화번호 기준 상담이력 추가
app.post('/api/customer/note', function(req, res) {
  var b = req.body;
  var phone = (b.phone || '').replace(/[^0-9]/g, '');
  if (!phone || phone.length < 4) return res.json({ ok: false, error: '전화번호 필요' });
  var isLast4 = phone.length === 4;
  var tickets = STATE.tickets.filter(function(t) {
    var tp = (t.phone || '').replace(/[^0-9]/g, '');
    return isLast4 ? tp.slice(-4) === phone : tp.indexOf(phone) >= 0;
  });
  if (tickets.length === 0) return res.json({ ok: false, error: '해당 고객 없음' });
  // 모든 티켓에 상담이력 추가
  var note = {
    text: (b.text || '').substring(0, 500),
    by: b.by || '직원',
    type: b.type || 'call',
    time: new Date().toISOString(),
  };
  tickets.forEach(function(t) { if (!t.notes) t.notes = []; t.notes.push(note); });
  sendState();
  saveTicketsLocal();
  res.json({ ok: true, affected: tickets.length, note: note });
});

// ─── 엑셀 전체 필드 내보내기 (확장판) ───
app.get('/api/export/full-excel', function(req, res) {
  res.json({
    ok: true,
    columns: [
      { key: 'source', label: '출처', desc: '네이버/라이프도시/현장/OKPOS' },
      { key: 'orderNo', label: '주문번호', desc: '플랫폼 주문번호' },
      { key: 'couponNo', label: '쿠폰코드', desc: '쿠폰/바우처 번호' },
      { key: 'buyer', label: '구매자', desc: '고객 이름' },
      { key: 'phone', label: '전화번호', desc: '연락처 (010-XXXX-XXXX)' },
      { key: 'product', label: '상품명', desc: '입장권, 종일권, 체험 등' },
      { key: 'qty', label: '매수', desc: '구매 수량' },
      { key: 'price', label: '금액', desc: '결제 금액 (원)' },
      { key: 'status', label: '상태', desc: '사용가능/사용완료/취소/부분사용' },
      { key: 'bookDate', label: '구매일', desc: '예약/구매 날짜' },
      { key: 'usedAt', label: '사용일시', desc: '사용처리 완료 시각' },
      { key: 'validDate', label: '유효기간', desc: '사용 가능 기간' },
      { key: 'naverStatus', label: '네이버상태', desc: '네이버 예약 상태' },
      { key: 'adminOk', label: '관리자처리', desc: '네이버 관리자 확인 결과' },
      { key: 'smsSent', label: '문자발송', desc: '알림 발송 여부' },
      { key: 'posOk', label: 'POS등록', desc: 'OKPOS 매출 등록 여부' },
      { key: 'txnId', label: 'POS거래번호', desc: 'OKPOS 거래 ID' },
      { key: 'history', label: '진행이력', desc: '신청→확정→사용완료 타임라인' },
      { key: 'notes', label: '상담이력', desc: '직원 메모/상담 기록' },
    ],
    totalTickets: STATE.tickets.length,
    sample: STATE.tickets.length > 0 ? STATE.tickets[0] : null,
  });
});

// ═══════════════════════════════════════════════════════════════
//  [통합] 셀프 키오스크 + 띠지 프린터 + 마감일지 엑셀
//  고객 셀프: /kiosk
//  마감일지: /closing
// ═══════════════════════════════════════════════════════════════
var netModule = require('net');
var ExcelJS; try { ExcelJS = require('exceljs'); } catch(e) { console.log('exceljs 미설치 → npm install exceljs'); }
var iconv; try { iconv = require('iconv-lite'); } catch(e) {}

var CLOSINGS_DIR = path.join(__dirname, 'closings');
if (!fs.existsSync(CLOSINGS_DIR)) fs.mkdirSync(CLOSINGS_DIR, { recursive: true });
app.use('/closings', express.static(CLOSINGS_DIR));

// 프린터 설정
var PRINTER = {
  type: 'browser',          // 'godex-usb' | 'godex-net' | 'browser'
  godexIp: '192.168.0.200', // 네트워크 모드용
  godexPort: 9100,
  godexUsbName: '',          // USB 프린터 이름 (Windows: 'Godex G500')
  godexUsbPort: '',          // USB 포트 (예: 'USB001', 'LPT1')
  paperWidth: 240, paperHeight: 25, darkness: 10, speed: 3,
};

// ─── 입장권만 띠지 출력 (체험/기념품 제외) ───
var BAND_KEYWORDS = ['입장권', '종일권', '청주시민', '경로우대', '장애인', '체험단', '초대권', '기업특판', '오후권', '시즌패스', '동반할인', '무료입장', '직원'];

// ═══ 띠지 테스트 인쇄 API ═══
app.get('/api/band/test-print', function(req, res) {
  var testBand = buildBandHtml2({
    name: '테스트', phone4: '0000',
    ticketType: '종일권 테스트', platform: 'test',
    adultCount: 1, childCount: 0,
    date: new Date().toISOString().substring(0, 10)
  }, 1, 1);
  res.json({ ok: true, bandPageHtml: wrapBandPage2(testBand), message: '테스트 띠지 생성 완료' });
});

app.get('/api/band/preview', function(req, res) {
  var testBand = buildBandHtml2({
    name: req.query.name || '방문객', phone4: req.query.phone4 || '0000',
    ticketType: req.query.type || '종일권', platform: req.query.platform || 'test',
    adultCount: req.query.adult || 1, childCount: req.query.child || 0,
    date: new Date().toISOString().substring(0, 10)
  }, 1, 1);
  
  // 미리보기용 (확대 + 기존 띠지 배경 시각화)
  var previewHtml = '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>'
    + 'body{margin:0;padding:40px;background:#f0f0f0;font-family:Malgun Gothic,sans-serif}'
    + 'h2{font-size:16px;margin-bottom:10px;color:#333}'
    + 'p{font-size:12px;color:#888;margin-bottom:16px}'
    + '.preview{transform:scale(2.5);transform-origin:top left;margin-bottom:200px}'
    + '.band{width:240mm;height:25mm;display:flex;align-items:stretch;overflow:hidden;border:1px solid #ccc}'
    + '.pre-area{width:95mm;flex-shrink:0;background:linear-gradient(135deg,#c4166a,#e91e7a);position:relative}'
    + '.pre-area::after{content:"이미 인쇄됨 (95mm)";position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-90deg);font-size:6pt;color:rgba(255,255,255,.5);white-space:nowrap}'
    + '.label-area{flex:1;display:flex;flex-direction:column;justify-content:center;padding:1mm 3mm;background:#fff;border:2px dashed #3b82f6}'
    + '.post-area{width:25mm;flex-shrink:0;background:linear-gradient(135deg,#e91e7a,#c4166a)}'
    + '.l-name{font-size:11pt;font-weight:800;color:#222;margin-bottom:.5mm}'
    + '.l-type{font-size:8pt;font-weight:600;color:#444}'
    + '.l-info{font-size:7pt;color:#666;margin-top:.3mm}'
    + '.l-date{font-size:6pt;color:#999;margin-top:.3mm}'
    + '</style></head><body>'
    + '<h2>띠지 인쇄 미리보기 (2.5배 확대)</h2>'
    + '<p>파란 점선 = 프린터가 인쇄하는 영역 / 분홍 = 기존 색깔 띠지 (인쇄 안 함)</p>'
    + '<div class="preview">' + testBand + '</div>'
    + '</body></html>';
  res.send(previewHtml);
});
function isTicketForBand(productName) {
  if (!productName) return false;
  for (var i = 0; i < BAND_KEYWORDS.length; i++) {
    if (productName.indexOf(BAND_KEYWORDS[i]) >= 0) return true;
  }
  return false;
}

// ─── Godex USB 직접 프린트 (Windows) ───
var childProcess = require('child_process');
var os = require('os');
var PRINT_TEMP_DIR = path.join(os.tmpdir(), 'godex-print');
if (!fs.existsSync(PRINT_TEMP_DIR)) fs.mkdirSync(PRINT_TEMP_DIR, { recursive: true });

function sendGodexUSB(ezplData) {
  return new Promise(function(resolve, reject) {
    // EZPL 데이터를 임시 파일에 저장
    var tmpFile = path.join(PRINT_TEMP_DIR, 'band_' + Date.now() + '.prn');
    var buf = iconv ? iconv.encode(ezplData, 'euc-kr') : Buffer.from(ezplData, 'utf-8');
    fs.writeFileSync(tmpFile, buf);

    var cmd;
    var printerName = PRINTER.godexUsbName;
    var usbPort = PRINTER.godexUsbPort;

    if (printerName) {
      // 방법 1: Windows 프린터 이름으로 출력 (가장 안정적)
      cmd = 'copy /b "' + tmpFile + '" "\\\\.' + '\\' + printerName + '"';
      // 대안: PowerShell로 RAW 데이터 전송
      var psCmd = "$bytes = [System.IO.File]::ReadAllBytes('" + tmpFile.replace(/\\/g, '\\\\') + "'); " +
        "$printer = Get-Printer -Name '" + printerName + "' -ErrorAction SilentlyContinue; " +
        "if($printer) { " +
        "  $port = (Get-PrinterPort -Name $printer.PortName).Name; " +
        "  Copy-Item '" + tmpFile + "' -Destination ('\\\\.\\'+ $port) -Force; " +
        "}";
      cmd = 'powershell -Command "' + psCmd.replace(/"/g, '\\"') + '"';
    } else if (usbPort) {
      // 방법 2: USB 포트 직접 (USB001, LPT1 등)
      cmd = 'copy /b "' + tmpFile + '" "\\\\.' + '\\' + usbPort + '"';
    } else {
      // 방법 3: 자동 검색 — Godex 프린터 찾기
      cmd = 'powershell -Command "' +
        "$p = Get-Printer | Where-Object {$_.Name -like '*Godex*' -or $_.Name -like '*G500*'} | Select-Object -First 1; " +
        "if($p) { " +
        "  $port = (Get-PrinterPort -Name $p.PortName).Name; " +
        "  Copy-Item '" + tmpFile + "' -Destination ('\\\\\\\\.\\\\'+ $port) -Force; " +
        "  Write-Host 'OK:' $p.Name; " +
        "} else { Write-Host 'ERROR: Godex printer not found'; exit 1; }" +
        '"';
    }

    childProcess.exec(cmd, { timeout: 10000 }, function(err, stdout, stderr) {
      // 임시 파일 정리
      try { fs.unlinkSync(tmpFile); } catch (e2) {}

      if (err) {
        reject(new Error('USB 프린트 실패: ' + (stderr || err.message)));
      } else {
        resolve({ ok: true, method: 'usb', output: (stdout || '').trim() });
      }
    });
  });
}

// ─── 통합 프린트 함수 (USB/네트워크/브라우저 자동 분기) ───
async function printBand(ezplData) {
  if (PRINTER.type === 'godex-usb') {
    return await sendGodexUSB(ezplData);
  } else if (PRINTER.type === 'godex-net') {
    return await sendTCP2(ezplData, PRINTER.godexIp, PRINTER.godexPort);
  }
  // browser 모드는 HTML 반환 (서버에서 프린트 안 함)
  return { ok: true, method: 'browser' };
}

// ─── 페이지 라우트 ───
app.get('/kiosk', function(req, res) { res.sendFile(path.join(__dirname, 'public', 'kiosk.html')); });
app.get('/closing', function(req, res) { res.sendFile(path.join(__dirname, 'public', 'closing.html')); });
app.get('/crm', function(req, res) { res.sendFile(path.join(__dirname, 'public', 'crm.html')); });
app.get('/rental-map', function(req, res) { res.sendFile(path.join(__dirname, 'public', 'rental-map.html')); });

// ═══ 스팟 QR 스캔 ═══
app.get('/spot/:spotId', function(req, res) {
  var spotId = req.params.spotId;
  var phone = (req.query.p || '').replace(/[^0-9]/g, '');
  var visitor = req.query.v || '방문자';
  if (!STATE.spotScans) STATE.spotScans = {};
  if (!STATE.spotScanLogs) STATE.spotScanLogs = [];
  STATE.spotScans[spotId] = (STATE.spotScans[spotId] || 0) + 1;
  var entry = { spotId: spotId, phone: phone, visitor: visitor, time: new Date().toISOString(), ip: req.ip };
  STATE.spotScanLogs.unshift(entry);
  if (STATE.spotScanLogs.length > 2000) STATE.spotScanLogs.length = 2000;
  broadcast({ type: 'spotScan', data: entry });
  log('spot', visitor + (phone ? '(' + phone.slice(-4) + ')' : '') + ' → ' + spotId, 'info');
  var spotNames = { 'SPOT-gate': '입구/매표소', 'SPOT-museum': '잠사박물관', 'SPOT-kids': '키즈/놀이존', 'SPOT-sheep': '양떼정원', 'SPOT-cabin': '오두막/불멍존', 'SPOT-restaurant': '식당/매점', 'SPOT-pool': '물놀이장', 'SPOT-sled': '사계절썰매장', 'SPOT-exp': '체험장' };
  var spotName = spotNames[spotId] || spotId;
  res.send('<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>한국잠사박물관 - ' + spotName + '</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,sans-serif;background:#080815;color:#eef;min-height:100vh;display:flex;align-items:center;justify-content:center}.card{background:#111128;border-radius:16px;padding:32px;text-align:center;max-width:380px;width:90%;box-shadow:0 8px 32px rgba(0,0,0,.5)}.icon{font-size:48px;margin-bottom:12px}.name{font-size:22px;font-weight:800;margin-bottom:4px}.cat{font-size:13px;color:#888;margin-bottom:16px}.check{display:inline-block;padding:8px 24px;background:rgba(16,185,129,.15);color:#10b981;border-radius:12px;font-size:14px;font-weight:700;margin-bottom:16px}.time{font-size:11px;color:#555}.brand{margin-top:20px;font-size:12px;color:#444}</style></head><body><div class="card"><div class="icon">' + ({'SPOT-gate':'🎫','SPOT-museum':'🏛️','SPOT-kids':'🧒','SPOT-sheep':'🐑','SPOT-cabin':'🏕️','SPOT-restaurant':'🍽️','SPOT-pool':'💧','SPOT-sled':'🛷','SPOT-exp':'🧪'}[spotId] || '📍') + '</div><div class="name">' + spotName + '</div><div class="cat">한국잠사박물관</div><div class="check">✅ 방문 기록 완료!</div><div class="time">' + new Date().toLocaleString('ko-KR') + '</div><div class="brand">🏛️ 한국잠사박물관 통합 시스템</div></div></body></html>');
});

app.get('/api/spot/scans', function(req, res) {
  res.json({ ok: true, scans: STATE.spotScans || {}, logs: (STATE.spotScanLogs || []).slice(0, 200) });
});

app.post('/api/spot/reset', function(req, res) {
  STATE.spotScans = {};
  STATE.spotScanLogs = [];
  broadcast({ type: 'spotReset' });
  log('system', '📍 스팟 스캔 데이터 초기화', 'info');
  res.json({ ok: true });
});

// ═══ 대여 시설 스팟 위치 저장/조회 API ═══
app.get('/api/rental/spots', function(req, res) {
  res.json({ ok: true, spots: STATE.rentalSpots || [] });
});
app.post('/api/rental/spots', function(req, res) {
  STATE.rentalSpots = req.body.spots || [];
  saveTicketsLocal();
  log('system', '📍 시설 스팟 ' + STATE.rentalSpots.length + '개 저장', 'success');
  res.json({ ok: true, count: STATE.rentalSpots.length });
});

// ─── CRM: 전체 고객 목록 (전화번호 기준 집계) ───
app.get('/api/crm/customers', function(req, res) {
  var q = (req.query.q || '').trim().toLowerCase();
  var phoneMap = {};
  STATE.tickets.forEach(function(tk) {
    var ph = (tk.phone || '').replace(/[^0-9]/g, '');
    if (ph.length < 4) return;
    if (!phoneMap[ph]) phoneMap[ph] = { phone: tk.phone, buyer: tk.buyer, tickets: [], totalSpent: 0, visits: 0, firstDate: '', lastDate: '' };
    var c = phoneMap[ph];
    if (tk.buyer && tk.buyer.length > (c.buyer || '').length) c.buyer = tk.buyer;
    c.tickets.push(tk);
    c.totalSpent += (tk.price || 0);
    if (tk.status === '사용완료') c.visits++;
    var d = tk.bookDate || tk.usedAt || '';
    if (d && (!c.firstDate || d < c.firstDate)) c.firstDate = d;
    if (d && (!c.lastDate || d > c.lastDate)) c.lastDate = d;
  });
  var customers = Object.values(phoneMap).sort(function(a, b) { return (b.lastDate || '').localeCompare(a.lastDate || ''); });
  if (q) customers = customers.filter(function(c) { return (c.buyer + ' ' + c.phone).toLowerCase().indexOf(q) >= 0; });
  res.json({ ok: true, total: customers.length, customers: customers.slice(0, 200).map(function(c) {
    var sources = {}; var products = {}; var noShow = 0; var cancel = 0;
    c.tickets.forEach(function(t) {
      sources[t.source || '기타'] = (sources[t.source || '기타'] || 0) + 1;
      products[t.product || '기타'] = (products[t.product || '기타'] || 0) + (t.qty || 1);
      if (t.status === '취소') cancel++;
    });
    return {
      phone: c.phone, phone4: c.phone.replace(/[^0-9]/g, '').slice(-4),
      buyer: c.buyer, totalPurchases: c.tickets.length, totalSpent: c.totalSpent,
      visits: c.visits, cancel: cancel, avgSpent: c.visits > 0 ? Math.round(c.totalSpent / c.visits) : 0,
      firstDate: (c.firstDate || '').substring(0, 10), lastDate: (c.lastDate || '').substring(0, 10),
      sources: sources, topProduct: Object.keys(products).sort(function(a, b) { return products[b] - products[a]; })[0] || '',
      notes: c.tickets.reduce(function(n, t) { return n.concat(t.notes || []); }, []),
    };
  })});
});

// ─── CRM: 외부 파일 업로드 → 고객 데이터 반영 ───
app.post('/api/crm/upload', function(req, res) {
  try {
    var b = req.body;
    if (!b.data || !b.filename) return res.json({ ok: false, error: '파일 데이터 없음' });

    var buf = Buffer.from(b.data, 'base64');
    var fname = (b.filename || '').toLowerCase();
    var imported = [];

    if (fname.endsWith('.xlsx')) {
      // ═══ XLSX 파싱 (네이버 예약 서식 등) ═══
      try {
        var XLSX = require('exceljs');
        var wb = new XLSX.Workbook();
        // exceljs는 비동기이므로 동기 대안 사용
      } catch(e) {}
      // openpyxl 대신 간단한 CSV 변환 후 파싱
      var tmpPath = path.join(__dirname, '.data', 'upload_' + Date.now() + '.xlsx');
      fs.writeFileSync(tmpPath, buf);

      try {
        var cp = require('child_process');
        // python으로 xlsx 파싱
        var pyResult = cp.execSync('python3 -c "' +
          "import pandas as pd,json,sys;df=pd.read_excel('" + tmpPath + "');print(json.dumps(df.fillna('').to_dict('records'),ensure_ascii=False,default=str))" +
          '"', { timeout: 15000, maxBuffer: 10*1024*1024 }).toString();
        var rows = JSON.parse(pyResult);

        rows.forEach(function(r) {
          var phone = String(r['전화번호'] || r['주문자 전화번호'] || '').replace(/[^0-9]/g, '');
          if (phone.length >= 4 && phone.length < 8) phone = ''; // 잘못된 번호
          var buyer = r['예매자'] || r['주문자 이름'] || r['방문자'] || '';
          if (!buyer && !phone) return;

          var status = String(r['상태'] || r['주문상태'] || '');
          var mappedStatus = '사용가능';
          if (['이용완료','완료','사용완료','배송완료'].some(function(s) { return status.indexOf(s) >= 0; })) mappedStatus = '사용완료';
          if (['취소','환불','노쇼'].some(function(s) { return status.indexOf(s) >= 0; })) mappedStatus = '취소';

          var orderNo = String(r['예약번호'] || r['주문번호'] || '');
          var product = r['상품'] || r['주문상품'] || '';
          var price = parseInt(String(r['실결제금액'] || r['총 실제금액'] || r['결제금액'] || 0).replace(/[^0-9]/g, '')) || 0;
          var qty = parseInt(r['수량'] || 1) || 1;
          var bookDate = String(r['이용일'] || r['예약일자'] || r['주문일'] || '').substring(0, 10);
          var source = 'upload';
          if (String(r['유입경로'] || '').indexOf('네이버') >= 0) source = 'naver';
          if (String(r['채널명'] || '').indexOf('기업') >= 0 || fname.indexOf('order') >= 0) source = 'la2fdoci';
          var usedAt = r['이용완료일시'] || '';
          var memo = r['직원메모'] || r['요청사항'] || '';

          // 중복 체크
          var existing = STATE.tickets.find(function(t) {
            return (orderNo && t.orderNo === orderNo) || (t.buyer === buyer && t.phone === phone && t.bookDate === bookDate && t.product === product);
          });

          if (!existing) {
            var tk = {
              id: 'UP-' + orderNo.replace(/[^a-zA-Z0-9]/g, '').substring(0, 12) + '-' + Date.now().toString(36),
              orderNo: orderNo, buyer: buyer, phone: phone, product: product,
              price: price, qty: qty, status: mappedStatus, source: source,
              bookDate: bookDate, usedAt: usedAt || null, posOk: false, adminOk: null,
              history: [{ action: '파일업로드', time: new Date().toISOString().substring(0, 16), by: fname }],
              notes: memo ? [{ text: memo, by: '업로드', type: 'memo', time: new Date().toISOString().substring(0, 10) }] : [],
              uploadedFrom: fname, detectedAt: new Date().toISOString(),
            };
            STATE.tickets.push(tk);
            imported.push(tk);
          }
        });

        try { fs.unlinkSync(tmpPath); } catch(e) {}
      } catch(pyErr) {
        try { fs.unlinkSync(tmpPath); } catch(e) {}
        return res.json({ ok: false, error: 'XLSX 파싱 실패: ' + pyErr.message });
      }
    } else if (fname.endsWith('.xls') || fname.endsWith('.csv') || fname.endsWith('.tsv')) {
      // ═══ TSV/CSV 파싱 (la2fdoci 등) ═══
      var text = '';
      try { text = buf.toString('utf-8'); } catch(e) {}
      if (text.indexOf('\ufffd') >= 0 || text.indexOf('\x00') >= 0) {
        try { var iconv = require('iconv-lite'); text = iconv.decode(buf, 'cp949'); } catch(e2) {
          text = buf.toString('latin1'); // 폴백
        }
      }

      var sep = text.indexOf('\t') >= 0 ? '\t' : ',';
      var lines = text.split('\n').filter(function(l) { return l.trim(); });
      if (lines.length < 2) return res.json({ ok: false, error: '데이터 없음' });

      var headers = lines[0].split(sep).map(function(h) { return h.trim(); });
      var nameIdx = headers.findIndex(function(h) { return h.indexOf('이름') >= 0 || h === '예매자' || h === '구매자'; });
      var phoneIdx = headers.findIndex(function(h) { return h.indexOf('전화') >= 0; });
      var orderIdx = headers.findIndex(function(h) { return h.indexOf('주문번호') >= 0; });
      var productIdx = headers.findIndex(function(h) { return h.indexOf('상품') >= 0; });
      var qtyIdx = headers.findIndex(function(h) { return h === '수량'; });
      var priceIdx = headers.findIndex(function(h) { return h.indexOf('금액') >= 0 || h.indexOf('단가') >= 0; });
      var statusIdx = headers.findIndex(function(h) { return h.indexOf('상태') >= 0; });
      var dateIdx = headers.findIndex(function(h) { return h.indexOf('주문일') >= 0 || h.indexOf('날짜') >= 0; });

      for (var li = 1; li < lines.length; li++) {
        var cols = lines[li].split(sep);
        var buyer = (cols[nameIdx] || '').trim();
        var phone = (cols[phoneIdx] || '').replace(/[^0-9\-]/g, '').trim();
        if (!buyer && !phone) continue;
        var orderNo = (cols[orderIdx] || '').trim();

        var existing = STATE.tickets.find(function(t) { return orderNo && t.orderNo === orderNo; });
        if (existing) continue;

        var status = (cols[statusIdx] || '').trim();
        var mappedStatus = '사용가능';
        if (['완료','배송완료','사용완료','이용완료'].some(function(s) { return status.indexOf(s) >= 0; })) mappedStatus = '사용완료';
        if (['취소','환불'].some(function(s) { return status.indexOf(s) >= 0; })) mappedStatus = '취소';

        var tk = {
          id: 'UP-' + (orderNo || li).toString().replace(/[^a-zA-Z0-9]/g, '').substring(0, 12) + '-' + Date.now().toString(36),
          orderNo: orderNo, buyer: buyer, phone: phone,
          product: (cols[productIdx] || '').trim().substring(0, 80),
          qty: parseInt(cols[qtyIdx]) || 1,
          price: parseInt(String(cols[priceIdx] || '0').replace(/[^0-9]/g, '')) || 0,
          status: mappedStatus, source: 'upload',
          bookDate: (cols[dateIdx] || '').trim().substring(0, 10),
          history: [{ action: '파일업로드', time: new Date().toISOString().substring(0, 16), by: fname }],
          notes: [], uploadedFrom: fname, detectedAt: new Date().toISOString(),
        };
        STATE.tickets.push(tk);
        imported.push(tk);
      }
    } else {
      return res.json({ ok: false, error: '지원 형식: .xlsx, .xls, .csv, .tsv' });
    }

    if (imported.length > 0) {
      sendState();
      saveTicketsLocal();
      log('system', '📥 파일 업로드: ' + fname + ' → ' + imported.length + '건 반영', 'success');
    }

    res.json({ ok: true, imported: imported.length, filename: b.filename, total: STATE.tickets.length });
  } catch(e) {
    log('system', '업로드 오류: ' + e.message, 'error');
    res.json({ ok: false, error: e.message });
  }
});
app.get('/api/crm/customer/:phone', function(req, res) {
  var phone = (req.params.phone || '').replace(/[^0-9]/g, '');
  var isLast4 = phone.length === 4;
  var tks = STATE.tickets.filter(function(t) {
    var tp = (t.phone || '').replace(/[^0-9]/g, '');
    return isLast4 ? tp.slice(-4) === phone : tp === phone;
  });
  if (!tks.length) return res.json({ ok: false, error: '고객 없음' });
  var first = tks[0];
  var totalSpent = 0, visits = 0, cancel = 0, sources = {}, products = {}, monthlyVisits = {};
  tks.forEach(function(t) {
    totalSpent += (t.price || 0);
    if (t.status === '사용완료') { visits++; var m = (t.bookDate || '').substring(0, 7); if (m) monthlyVisits[m] = (monthlyVisits[m] || 0) + 1; }
    if (t.status === '취소') cancel++;
    sources[t.source || '기타'] = (sources[t.source || '기타'] || 0) + 1;
    var p = t.product || '기타'; products[p] = (products[p] || 0) + (t.qty || 1);
  });
  var dates = tks.map(function(t) { return t.bookDate || t.usedAt || ''; }).filter(Boolean).sort();
  var allNotes = tks.reduce(function(n, t) { return n.concat((t.notes || []).map(function(nt) { return Object.assign({ ticketId: t.id, product: t.product }, nt); })); }, []);
  allNotes.sort(function(a, b) { return (b.time || '').localeCompare(a.time || ''); });
  res.json({ ok: true, customer: {
    buyer: first.buyer, phone: first.phone, totalPurchases: tks.length, totalSpent: totalSpent,
    visits: visits, cancel: cancel, avgSpent: visits > 0 ? Math.round(totalSpent / visits) : 0,
    firstDate: dates.length > 0 ? dates[0].substring(0, 10) : '', lastDate: dates.length > 0 ? dates[dates.length - 1].substring(0, 10) : '',
    sources: sources, products: products, monthlyVisits: monthlyVisits,
    revisitDays: dates.length >= 2 ? Math.round((new Date(dates[dates.length-1]) - new Date(dates[0])) / (86400000 * Math.max(1, visits - 1))) : 0,
  }, purchases: tks.map(function(t) {
    return { id: t.id, date: t.bookDate || '', product: t.product || '', qty: t.qty || 1, price: t.price || 0, status: t.status || '', source: t.source || '', usedAt: t.usedAt || null, orderNo: t.orderNo || '', history: t.history || [], adminOk: t.adminOk };
  }).sort(function(a, b) { return (b.date || '').localeCompare(a.date || ''); }),
  notes: allNotes });
});

// ─── 셀프 키오스크: 뒤4자리 조회 (기존 STATE.tickets 활용) ───
app.get('/api/kiosk/search/:phone4', function(req, res) {
  var q = (req.params.phone4 || '').trim();
  if (q.length < 2) return res.json({ ok: false, error: '2자리 이상' });

  var matches = STATE.tickets.filter(function(t) {
    return t.phone && t.phone.replace(/[^0-9]/g, '').slice(-4) === q
      && ['사용가능', '확정'].indexOf(t.status) >= 0;
  });

  res.json({
    ok: true, query: q, count: matches.length,
    results: matches.map(function(tk) {
      var name = tk.buyer || '고객';
      var mid = tk.phone ? tk.phone.replace(/[^0-9]/g, '').substring(3, 7) : '';
      return {
        id: tk.id,
        name: name,
        nameDisplay: name.length > 1 ? name[0] + '*'.repeat(Math.max(1, name.length - 2)) + name[name.length - 1] : name,
        phone4: q,
        phoneMid: mid,
        platform: tk.source || '네이버',
        ticketType: tk.product || '입장권',
        qty: tk.qty || 1,
        totalAmount: tk.price || 0,
        status: tk.status,
        usedAt: tk.usedAt || null,
        orderNo: tk.orderNo || '',
        items: tk.items || [{ n: tk.product || '입장권', q: tk.qty || 1, p: tk.price || 0 }],
      };
    }),
  });
});

// ─── 셀프 키오스크: 중간번호 인증 → 사용처리 ───
app.post('/api/kiosk/verify-and-use', async function(req, res) {
  try {
    var id = req.body.id;
    var phoneMid = req.body.phoneMid || '';
    var tk = STATE.tickets.find(function(t) { return String(t.id) === String(id); });
    if (!tk) return res.json({ ok: false, error: '티켓 없음' });
    if (['사용가능', '확정'].indexOf(tk.status) < 0) return res.json({ ok: false, error: '이미 사용처리됨', usedAt: tk.usedAt });

    // 중간번호 인증
    var storedMid = tk.phone ? tk.phone.replace(/[^0-9]/g, '').substring(3, 7) : '';
    if (storedMid && phoneMid !== storedMid) {
      return res.json({ ok: false, error: '중간번호 불일치', needVerify: true });
    }

    // 기존 processUse 호출 (POS 연동 포함)
    var result = await processUse(tk.id, tk.qty);
    if (!result.ok) return res.json(result);

    // ★ 입장권만 띠지 출력 (체험/기념품은 제외)
    var needBand = isTicketForBand(tk.product);
    var totalPeople = needBand ? (tk.qty || 1) : 0;
    var rData = {
      name: tk.buyer || '고객', phone4: tk.phone ? tk.phone.replace(/[^0-9]/g, '').slice(-4) : '',
      platform: tk.source || '', ticketType: tk.product || '입장권',
      adultCount: tk.qty || 1, childCount: 0, totalAmount: tk.price || 0,
      date: new Date().toISOString().split('T')[0],
      usedAt: new Date().getHours().toString().padStart(2, '0') + ':' + new Date().getMinutes().toString().padStart(2, '0'),
      items: tk.items || [{ n: tk.product, q: tk.qty, p: tk.price }],
      needBand: needBand,
    };

    // 띠지 생성 (입장권만)
    var bandsHtml = '';
    if (needBand) {
      for (var i = 0; i < totalPeople; i++) bandsHtml += buildBandHtml2(rData, i + 1, totalPeople);
    }

    // Godex 프린터 출력 (USB 또는 네트워크)
    var godexResult = null;
    if (needBand && (PRINTER.type === 'godex-usb' || PRINTER.type === 'godex-net')) {
      godexResult = { success: 0, failed: 0 };
      for (var j = 0; j < totalPeople; j++) {
        try { await printBand(buildEZPL2(rData, j + 1, totalPeople)); godexResult.success++; }
        catch (e) { godexResult.failed++; log('system', '🖨️ 띠지 출력 실패: ' + e.message, 'error'); }
        if (j < totalPeople - 1) await new Promise(function(r) { setTimeout(r, 150); });
      }
    }

    // ★ Supabase 동기화 + 로컬 저장
    try {
      sbSync.updateTicketStatus(tk.id, tk.status, tk.usedAt);
      sbSync.saveUseHistory({ ticketId: tk.id, orderNo: tk.orderNo, buyer: tk.buyer, phone: tk.phone, product: tk.product, qty: tk.qty, price: tk.price, source: tk.source, method: 'kiosk' });
    } catch(se) {}
    saveTicketsLocal();

    res.json({
      ok: true,
      reservation: rData,
      totalBands: totalPeople,
      receiptHtml: buildReceiptHtml2(rData),
      bandPageHtml: wrapBandPage2(bandsHtml),
      godexResult: godexResult,
    });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

// ─── 현장 결제 ───
app.post('/api/kiosk/walkin', async function(req, res) {
  try {
    var b = req.body;
    if (!b.name) return res.json({ ok: false, error: '고객명 필요' });
    var qty = (Number(b.adultCount) || 1) + (Number(b.childCount) || 0);

    // STATE.tickets에 추가 + 즉시 사용처리
    var newTk = {
      id: 'W' + Date.now(),
      buyer: b.name, phone: b.phone4 ? '010____' + b.phone4 : '',
      product: b.ticketType || '입장권', qty: qty,
      price: Number(b.totalAmount) || 0, source: '현장',
      status: '사용완료', usedAt: new Date().toISOString(),
      orderNo: 'W' + Date.now().toString(36),
    };
    STATE.tickets.push(newTk);
    try { sendState(); } catch (e2) {}

    var rData = {
      name: b.name, phone4: b.phone4 || '', platform: '현장',
      ticketType: b.ticketType || '입장권',
      adultCount: Number(b.adultCount) || 1, childCount: Number(b.childCount) || 0,
      totalAmount: Number(b.totalAmount) || 0, payMethod: b.payMethod || '카드',
      date: new Date().toISOString().split('T')[0],
      usedAt: new Date().getHours().toString().padStart(2, '0') + ':' + new Date().getMinutes().toString().padStart(2, '0'),
      items: [{ n: b.ticketType || '입장권', q: qty, p: Number(b.totalAmount) || 0 }],
    };

    // ★ 입장권만 띠지 출력
    var needBand = isTicketForBand(b.ticketType);
    var bandQty = needBand ? qty : 0;
    var bandsHtml = '';
    if (needBand) {
      for (var i = 0; i < qty; i++) bandsHtml += buildBandHtml2(rData, i + 1, qty);
    }

    var godexResult = null;
    if (needBand && (PRINTER.type === 'godex-usb' || PRINTER.type === 'godex-net')) {
      godexResult = { success: 0, failed: 0 };
      for (var j = 0; j < qty; j++) {
        try { await printBand(buildEZPL2(rData, j + 1, qty)); godexResult.success++; }
        catch (e) { godexResult.failed++; }
        if (j < qty - 1) await new Promise(function(r) { setTimeout(r, 150); });
      }
    }
    rData.needBand = needBand;

    res.json({ ok: true, reservation: rData, totalBands: bandQty, receiptHtml: buildReceiptHtml2(rData), bandPageHtml: needBand ? wrapBandPage2(bandsHtml) : '', godexResult: godexResult });
  } catch (e) { res.json({ ok: false, error: e.message }); }
});

// ─── 프린터 설정 ───
app.post('/api/printer/settings', function(req, res) {
  Object.assign(PRINTER, req.body);
  res.json({ ok: true, printer: PRINTER });
});
app.get('/api/printer/settings', function(req, res) { res.json({ ok: true, printer: PRINTER }); });
app.post('/api/printer/test', async function(req, res) {
  try {
    var testEzpl = '^Q25,3\r\n^W240\r\n^H10\r\n^S3\r\n^P1\r\n^L\r\nAC,2,100,50,1,1,TEST OK\r\nE\r\n';
    if (PRINTER.type === 'godex-usb') {
      var r = await sendGodexUSB(testEzpl);
      res.json({ ok: true, method: 'usb', output: r.output });
    } else if (PRINTER.type === 'godex-net') {
      await sendTCP2(testEzpl, req.body.ip || PRINTER.godexIp, Number(req.body.port) || PRINTER.godexPort);
      res.json({ ok: true, method: 'network' });
    } else {
      res.json({ ok: true, method: 'browser', message: '브라우저 인쇄 모드' });
    }
  } catch (e) { res.json({ ok: false, error: e.message }); }
});

// ─── USB 프린터 자동 검색 (Windows) ───
app.get('/api/printer/detect', function(req, res) {
  if (process.platform !== 'win32') return res.json({ ok: false, error: 'Windows만 지원' });
  childProcess.exec('powershell -Command "Get-Printer | Select-Object Name,PortName,DriverName | ConvertTo-Json"', { timeout: 10000 }, function(err, stdout) {
    if (err) return res.json({ ok: false, error: err.message });
    try {
      var printers = JSON.parse(stdout);
      if (!Array.isArray(printers)) printers = [printers];
      // Godex 프린터 필터
      var godexPrinters = printers.filter(function(p) {
        return (p.Name || '').toLowerCase().indexOf('godex') >= 0 || (p.DriverName || '').toLowerCase().indexOf('godex') >= 0;
      });
      res.json({
        ok: true,
        allPrinters: printers.map(function(p) { return { name: p.Name, port: p.PortName, driver: p.DriverName }; }),
        godexPrinters: godexPrinters.map(function(p) { return { name: p.Name, port: p.PortName, driver: p.DriverName }; }),
      });
    } catch (e) { res.json({ ok: false, error: '파싱 실패', raw: stdout }); }
  });
});

// ─── 마감일지 엑셀 (수정본 DOM 변환) ───
app.post('/api/sales/daily-excel-from-dom', async function(req, res) {
  if (!ExcelJS) return res.json({ ok: false, error: 'npm install exceljs 필요' });
  try {
    var b = req.body;
    var sections = b.sections || [];
    if (!sections.length) return res.json({ ok: false, error: 'sections 비어있음' });
    var wb = new ExcelJS.Workbook();
    var ws = wb.addWorksheet('일일마감일지', { pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 1 } });
    var FN = function(s, bo, o) { return { name: '맑은 고딕', size: s, bold: !!bo, ...(o || {}) }; };
    var FL = function(c) { return { type: 'pattern', pattern: 'solid', fgColor: { argb: c } }; };
    var BD = function() { return { top: { style: 'thin', color: { argb: 'FF808080' } }, bottom: { style: 'thin', color: { argb: 'FF808080' } }, left: { style: 'thin', color: { argb: 'FF808080' } }, right: { style: 'thin', color: { argb: 'FF808080' } } }; };
    var CT = { horizontal: 'center', vertical: 'middle', wrapText: true };
    ws.columns = [{ width: 4 }, { width: 14 }, { width: 4 }, { width: 26 }, { width: 12 }, { width: 12 }, { width: 14 }, { width: 16 }];
    ws.mergeCells('B3:H3'); ws.getCell('B3').value = '한국잠사플레이팜 일일마감일지'; ws.getCell('B3').font = FN(18, true); ws.getCell('B3').alignment = CT; ws.getRow(3).height = 34;
    var cur = 6, sm = [];
    for (var si = 0; si < sections.length; si++) {
      var sec = sections[si], ss = cur, rows = sec.rows || [];
      for (var ri = 0; ri < rows.length; ri++) {
        var r = rows[ri], row = ws.getRow(cur);
        row.getCell(1).value = r.no; row.getCell(4).value = r.product;
        row.getCell(5).value = Number(r.qty) || 0; row.getCell(6).value = Number(r.real) || 0;
        row.getCell(7).value = Number(r.card) || 0; row.getCell(8).value = Number(r.sales) || 0;
        for (var c = 1; c <= 8; c++) { row.getCell(c).font = FN(10); row.getCell(c).border = BD(); }
        row.getCell(7).numFmt = '#,##0'; row.getCell(8).numFmt = '#,##0';
        if (r.tag === 'newkiosk') for (var c2 = 1; c2 <= 8; c2++) row.getCell(c2).fill = FL('FFFFF2CC');
        cur++;
      }
      var se = cur - 1;
      if (se >= ss) { ws.mergeCells(ss, 2, se, 3); ws.getCell(ss, 2).value = sec.name; ws.getCell(ss, 2).font = FN(11, true); ws.getCell(ss, 2).fill = FL('FFF2F2F2'); ws.getCell(ss, 2).alignment = CT; }
      ws.mergeCells(cur, 1, cur, 4); ws.getRow(cur).getCell(1).value = sec.subtotalLabel || (sec.name + ' 소계');
      for (var c3 = 1; c3 <= 8; c3++) { ws.getRow(cur).getCell(c3).fill = FL('FFFBE4D5'); ws.getRow(cur).getCell(c3).border = BD(); ws.getRow(cur).getCell(c3).font = FN(11, true); }
      ws.getRow(cur).getCell(5).value = { formula: 'SUM(E' + ss + ':E' + se + ')' };
      ws.getRow(cur).getCell(6).value = { formula: 'SUM(F' + ss + ':F' + se + ')' };
      ws.getRow(cur).getCell(7).value = { formula: 'SUM(G' + ss + ':G' + se + ')' };
      ws.getRow(cur).getCell(8).value = { formula: 'SUM(H' + ss + ':H' + se + ')' };
      ws.getRow(cur).getCell(7).numFmt = '#,##0'; ws.getRow(cur).getCell(8).numFmt = '#,##0';
      sm.push({ s: ss, e: se, r: cur }); cur++;
    }
    // 총계
    ws.mergeCells(cur, 1, cur, 4); ws.getRow(cur).getCell(1).value = '총  계'; ws.getRow(cur).getCell(1).font = FN(14, true); ws.getRow(cur).getCell(1).alignment = CT;
    for (var c4 = 1; c4 <= 8; c4++) { ws.getRow(cur).getCell(c4).fill = FL('FFD9E2F3'); ws.getRow(cur).getCell(c4).border = BD(); ws.getRow(cur).getCell(c4).font = FN(14, true); }
    ['E', 'F', 'G', 'H'].forEach(function(col, i) { ws.getRow(cur).getCell(5 + i).value = { formula: sm.map(function(m) { return col + m.r; }).join('+') }; });
    ws.getRow(cur).getCell(7).numFmt = '#,##0'; ws.getRow(cur).getCell(8).numFmt = '#,##0';
    cur += 2;
    // 특이사항
    var notes = b.notes || ['* [특이사항 없음]'];
    ws.mergeCells(cur, 2, cur, 8); ws.getCell(cur, 2).value = '📌 특이사항'; ws.getCell(cur, 2).font = FN(11, true); ws.getCell(cur, 2).fill = FL('FFE2EFDA'); cur++;
    for (var ni = 0; ni < notes.length; ni++) { ws.mergeCells(cur, 2, cur, 8); ws.getCell(cur, 2).value = notes[ni]; ws.getCell(cur, 2).font = FN(10, false, { italic: true }); cur++; }
    var safeDate = (b.date || 'today').replace(/-/g, '');
    var fileName = '일일마감일지_' + safeDate + '_수정본.xlsx';
    await wb.xlsx.writeFile(path.join(CLOSINGS_DIR, fileName));
    res.json({ ok: true, file: fileName, path: '/closings/' + encodeURIComponent(fileName) });
  } catch (e) { res.json({ ok: false, error: e.message }); }
});

// ─── EZPL 명령 (Godex G500 240x25mm) ───
function buildEZPL2(r, seq, total) {
  var name = r.name || '방문객', phone = r.phone4 ? '(' + r.phone4 + ')' : '';
  var type = r.ticketType || '입장권', plat = r.platform ? '[' + r.platform + ']' : '';
  var parts = []; if (Number(r.adultCount) > 0) parts.push('성인' + r.adultCount); if (Number(r.childCount) > 0) parts.push('아동' + r.childCount);
  var countStr = parts.length ? parts.join('/') : (r.qty || 1) + '명';
  var date = r.date || new Date().toISOString().split('T')[0];
  var seqStr = total > 1 ? seq + '/' + total : '';
  var D = 8;
  return ['^Q' + PRINTER.paperHeight + ',3', '^W' + PRINTER.paperWidth, '^H' + PRINTER.darkness, '^S' + PRINTER.speed, '^P1', '^L',
    'Lo,' + (175 * D) + ',' + (1 * D) + ',' + (175 * D + 2) + ',' + (24 * D),
    'AK,2,' + (178 * D) + ',' + (2 * D) + ',1,1,' + name + phone,
    'AK,1,' + (178 * D) + ',' + (9 * D) + ',1,1,' + type + plat + ' ' + countStr,
    'AK,1,' + (178 * D) + ',' + (16 * D) + ',1,1,' + date + ' ' + seqStr, 'E'].join('\r\n') + '\r\n';
}

// ─── 영수증 HTML ───
function buildReceiptHtml2(r) {
  var parts = []; if (Number(r.adultCount) > 0) parts.push('성인 ' + r.adultCount); if (Number(r.childCount) > 0) parts.push('아동 ' + r.childCount);
  var amt = Number(r.totalAmount) || 0;
  return '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>@page{size:80mm auto;margin:2mm}*{margin:0;padding:0;box-sizing:border-box}body{font-family:Malgun Gothic,sans-serif;width:76mm;padding:3mm;color:#000;font-size:11px;line-height:1.5}.c{text-align:center}.b{font-weight:700}.line{border-top:1px dashed #000;margin:4px 0}.dline{border-top:2px solid #000;margin:4px 0}.row{display:flex;justify-content:space-between}</style></head><body>' +
    '<div class="c"><b style="font-size:16px">한국잠사박물관</b><br>이용 확인증</div><div class="dline"></div>' +
    '<div class="row"><span>고객명</span><span class="b">' + (r.name || '-') + '</span></div>' +
    '<div class="row"><span>티켓</span><span class="b">' + (r.ticketType || '-') + '</span></div>' +
    '<div class="row"><span>인원</span><span class="b">' + (parts.join(' / ') || '1명') + '</span></div>' +
    '<div class="row"><span>플랫폼</span><span>' + (r.platform || '-') + '</span></div><div class="line"></div>' +
    (amt > 0 ? '<div class="row" style="font-size:14px;font-weight:700"><span>결제금액</span><span>' + amt.toLocaleString() + '원</span></div><div class="line"></div>' : '') +
    '<div class="row"><span>사용일시</span><span>' + (r.date || '') + ' ' + (r.usedAt || '') + '</span></div><div class="dline"></div>' +
    '<div class="c" style="font-size:9px;color:#666;margin-top:4px">팔찌를 반드시 착용해 주세요<br>양도·환불·재발급 불가<br><br>이용해 주셔서 감사합니다</div></body></html>';
}

// ─── 띠지 HTML (240x25mm) ───
function buildBandHtml2(r, seq, total) {
  var name = r.name || '방문객', phone = r.phone4 ? '(' + r.phone4 + ')' : '';
  var type = r.ticketType || '입장권', plat = r.platform ? '[' + r.platform + ']' : '';
  var parts = []; if (Number(r.adultCount) > 0) parts.push('성인' + r.adultCount); if (Number(r.childCount) > 0) parts.push('아동' + r.childCount);
  var seqStr = total > 1 ? seq + '/' + total : '';
  // ★ 기존 색깔 띠지 위의 흰색 라벨 영역에만 인쇄
  // 흰색 라벨: 왼쪽 ~95mm부터 시작, 너비 ~120mm, 높이 ~18mm (위아래 3.5mm 마진)
  return '<div class="band">'
    + '<div class="pre-area"></div>'   // 왼쪽 95mm: 이미 인쇄됨 (비움)
    + '<div class="label-area">'       // 흰색 라벨 영역
    + '<div class="l-name">' + name + ' ' + phone + '</div>'
    + '<div class="l-type">' + type + ' ' + plat + '</div>'
    + '<div class="l-info">' + (parts.join(' / ') || '') + (seqStr ? ' · ' + seqStr : '') + '</div>'
    + '<div class="l-date">' + (r.date || '') + '</div>'
    + '</div>'
    + '<div class="post-area"></div>'   // 오른쪽: 이미 인쇄됨 (비움)
    + '</div>';
}
function wrapBandPage2(html) {
  return '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>'
    + '@page{size:240mm 25mm;margin:0}'
    + '*{box-sizing:border-box;margin:0;padding:0}'
    + 'body{font-family:Malgun Gothic,sans-serif}'
    + '.band{width:240mm;height:25mm;display:flex;align-items:stretch;page-break-after:always;overflow:hidden}'
    + '.pre-area{width:95mm;flex-shrink:0}'   // 이미 인쇄된 영역 (비움)
    + '.label-area{flex:1;display:flex;flex-direction:column;justify-content:center;padding:1mm 3mm}'
    + '.post-area{width:25mm;flex-shrink:0}'  // 이미 인쇄된 영역 (비움)
    + '.l-name{font-size:11pt;font-weight:800;color:#222;margin-bottom:.5mm}'
    + '.l-type{font-size:8pt;font-weight:600;color:#444}'
    + '.l-info{font-size:7pt;color:#666;margin-top:.3mm}'
    + '.l-date{font-size:6pt;color:#999;margin-top:.3mm}'
    + '@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}'
    + '</style></head><body>' + html + '</body></html>';
}

// ─── TCP 전송 (프린터) ───
function sendTCP2(data, ip, port) {
  return new Promise(function(resolve, reject) {
    var c = new netModule.Socket(); c.setTimeout(8000);
    c.connect(port, ip, function() {
      var buf = iconv ? iconv.encode(data, 'euc-kr') : Buffer.from(data, 'utf-8');
      c.write(buf, function() { c.end(); resolve({ ok: true }); });
    });
    c.on('timeout', function() { c.destroy(); reject(new Error('시간초과')); });
    c.on('error', function(e) { reject(e); });
  });
}

// ═══ [통합 끝] ═══════════════════════════════════════════════

app.get('*', function(req, res) {
  // /c, /customer → customer.html (이미 위에서 처리됨)
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

var PORT = process.env.PORT || 3500;
// ═══ Supabase 초기화 + 데이터 복원 후 서버 시작 ═══
(async function() {
  // Supabase 연결
  var sbOk = sbSync.init(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY);
  
  if (sbOk) {
    // 서버 시작 전 Supabase에서 데이터 복원
    var restored = await sbSync.loadFromSupabase();
    if (restored) {
      // 티켓 복원 (로컬에 없는 것만 추가)
      if (restored.tickets.length > 0) {
        var existingIds = STATE.tickets.map(function(t) { return t.id; });
        var newTks = restored.tickets.filter(function(t) { return existingIds.indexOf(t.id) < 0; });
        STATE.tickets = STATE.tickets.concat(newTks);
        console.log('  ☁️  티켓 복원: ' + newTks.length + '건 추가 (전체 ' + STATE.tickets.length + '건)');
      }
      // 사용이력 복원
      if (restored.useHistory.length > 0 && STATE.useHistory.length === 0) {
        STATE.useHistory = restored.useHistory.map(function(u) {
          return { id: u.id, time: u.created_at, ticketId: u.ticket_id, buyer: u.buyer, phone: u.phone, product: u.product, qty: u.qty, price: u.price, source: u.source, method: u.method };
        });
      }
      // 템플릿 복원
      if (restored.templates.length > 0) {
        STATE.config.msg.templates = restored.templates.map(function(t) {
          return { id: t.id, name: t.name, type: t.type, body: t.body, kakaoCode: t.kakao_code };
        });
      }
    }
  }

server.listen(PORT, '0.0.0.0', function() {
  // LAN IP 주소 확인
  var lanIp = 'localhost';
  try {
    var os = require('os');
    var nets = os.networkInterfaces();
    Object.keys(nets).forEach(function(name) {
      nets[name].forEach(function(net) {
        if (net.family === 'IPv4' && !net.internal && net.address !== '127.0.0.1') {
          lanIp = net.address;
        }
      });
    });
  } catch(e) {}
  
  var localUrl = 'http://localhost:' + PORT;
  var lanUrl = 'http://' + lanIp + ':' + PORT;
  
  console.log('');
  console.log('══════════════════════════════════════════════');
  console.log('  🎫 한국잠사박물관 통합 시스템 v2.0');
  console.log('══════════════════════════════════════════════');
  console.log('  🖥  이 PC:    ' + localUrl);
  console.log('  📱 내부망:    ' + lanUrl);
  console.log('  👤 고객용:    ' + lanUrl + '/c');
  console.log('  🎫 셀프키오:  ' + lanUrl + '/kiosk');
  console.log('  📊 마감일지:  ' + lanUrl + '/closing');
  console.log('  👤 고객관리:  ' + lanUrl + '/crm');
  console.log('  🗺️  시설배치:  ' + lanUrl + '/rental-map');
  console.log('══════════════════════════════════════════════');
  console.log('  la2fdoci: ' + (STATE.config.la2fdoci.id || '⚠️ .env에 LA2F_ID 설정'));
  console.log('  네이버:   ' + (STATE.config.naver.id || '⚠️ .env에 NAVER_ID 설정'));
  console.log('  OKPOS:    ' + (STATE.config.okpos.id || '⚠️ .env에 OKPOS_ID 설정'));
  console.log('══════════════════════════════════════════════');
  console.log('');

  // ⏰ 자동 마감 타이머 초기화
  setupDailyAutoTimer();
  setupTimeAutoTimer();
  
  // 🔧 브라우저 자동 복구 워치독 (60초마다 체크)
  if (puppeteer) {
    setInterval(async function() {
      var keys = ['la2fdoci', 'naver'];
      for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        try {
          if (STATE.browsers[key]) {
            // 브라우저 프로세스가 살아있는지 확인
            var proc = STATE.browsers[key].process();
            if (!proc || proc.killed || proc.exitCode !== null) {
              log(key, '🔧 워치독: 브라우저 프로세스 죽음 감지 → 재시작', 'warning');
              STATE.browsers[key] = null;
              STATE.pages[key] = null;
              STATE.sessions[key] = false;
              await getPage(key);
            } else if (STATE.pages[key]) {
              // 페이지가 응답하는지 확인
              try {
                await Promise.race([
                  STATE.pages[key].evaluate(function() { return document.title; }),
                  new Promise(function(_, rej) { setTimeout(function() { rej(new Error('timeout')); }, 5000); })
                ]);
              } catch(pe) {
                log(key, '🔧 워치독: 페이지 응답 없음 → 재시작', 'warning');
                try { await STATE.browsers[key].close(); } catch(ce) {}
                STATE.browsers[key] = null;
                STATE.pages[key] = null;
                STATE.sessions[key] = false;
                await getPage(key);
              }
            }
          }
        } catch(we) {
          log(key, '🔧 워치독 오류: ' + we.message, 'error');
        }
      }
    }, 60000);
    log('system', '🔧 브라우저 워치독 활성화 (60초 간격)');
  }
  
  // ☁️ Supabase 동기화 초기화
  if (sbSync.init(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY)) {
    sbSync.startAutoSync(STATE, parseInt(process.env.SYNC_INTERVAL) || 60000);
    // 첫 동기화
    setTimeout(function() { sbSync.fullSync(STATE).catch(function(){}); }, 5000);
    
    // ☁️ 원격 명령 핸들러 등록 (클라우드에서 크롤링/POS 제어)
    sbSync.startCommandListener(STATE, {
      // 크롤링 명령
      'crawl_all': async function(p) {
        log('system', '☁️ 원격 명령: 전체 크롤링');
        await crawlCycle(); 
        await sbSync.fullSync(STATE);
        return { ok: true, tickets: STATE.tickets.length };
      },
      'crawl_naver': async function(p) {
        log('system', '☁️ 원격 명령: 네이버 크롤링');
        if (!STATE.sessions.naver) await naverLogin();
        var bookings = await naverCrawl();
        await sbSync.fullSync(STATE);
        return { ok: true, count: bookings ? bookings.length : 0 };
      },
      'crawl_la2f': async function(p) {
        log('system', '☁️ 원격 명령: 라이프도시 크롤링');
        var tickets = await la2fCrawl();
        await sbSync.fullSync(STATE);
        return { ok: true, count: tickets ? tickets.length : 0 };
      },
      // POS 매출 크롤링
      'crawl_sales': async function(p) {
        log('system', '☁️ 원격 명령: POS 매출 크롤링');
        // okposCrawlSales가 있으면 호출
        if (typeof okposCrawlSales === 'function') {
          var r = await okposCrawlSales(p.date || new Date().toISOString().split('T')[0]);
          await sbSync.fullSync(STATE);
          return { ok: true, sales: r };
        }
        return { ok: false, error: 'POS 크롤링 함수 없음' };
      },
      // 사용처리
      'use_ticket': async function(p) {
        if (!p.ticketId) return { ok: false, error: 'ticketId 필요' };
        log('system', '☁️ 원격 명령: 사용처리 ' + p.ticketId);
        var r = await processUse(p.ticketId, p.useQty);
        return r;
      },
      // 카톡 발송
      'kakao_send': async function(p) {
        if (!p.room || !p.message) return { ok: false, error: 'room/message 필요' };
        log('system', '☁️ 원격 명령: 카톡 발송 → ' + p.room);
        var ok = await sendKakaoPC(p.message, p.room);
        return { ok: ok };
      },
      // SMS 발송
      'sms_send': async function(p) {
        if (!p.phone || !p.message) return { ok: false, error: 'phone/message 필요' };
        var r = await sendDirectMessage(p.phone, p.message);
        return r;
      },
      // 상태 조회
      'status': async function() {
        return { ok: true, tickets: STATE.tickets.length, sessions: STATE.sessions, 
          crawlStatus: STATE.crawlStatus, uptime: process.uptime() };
      },
    });
    
    // 워커 온라인 등록
    sbSync.updateWorkerStatus('online', STATE.sessions);
  }
  if (STATE.config.kakao.dailyAutoEnabled && STATE.config.kakao.dailyAutoTime) {
    console.log('  ⏰ 자동 마감: 매일 ' + STATE.config.kakao.dailyAutoTime + ' → ' + (STATE.config.kakao.dailyRoom || STATE.config.kakao.room || '미설정'));
  }
  if (STATE.config.kakao.timeAutoEnabled && STATE.config.kakao.timeAutoTime) {
    console.log('  ⏰ 시간대별: 매일 ' + STATE.config.kakao.timeAutoTime + ' → ' + (STATE.config.kakao.timeRoom || STATE.config.kakao.dailyRoom || '미설정'));
  }

  // 브라우저 자동 열기 (PM2에서는 건너뜀)
  if (process.env.NO_BROWSER !== '1' && !process.env.PM2_HOME && !process.env.pm_id) {
    var cmd;
    var fs2 = require('fs');
    switch (process.platform) {
      case 'win32':
        var homeDir = process.env.USERPROFILE || process.env.HOMEPATH || '';
        var localAppData = process.env.LOCALAPPDATA || (homeDir + '\\AppData\\Local');
        var paths = [
          'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
          'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
          'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
          'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
          localAppData + '\\Google\\Chrome\\Application\\chrome.exe',
          localAppData + '\\Microsoft\\Edge\\Application\\msedge.exe'
        ];
        var found = false;
        for (var i = 0; i < paths.length && !found; i++) {
          if (fs2.existsSync(paths[i])) { cmd = '"' + paths[i] + '" "' + localUrl + '"'; found = true; }
        }
        if (!found) cmd = 'start "" "' + localUrl + '"';
        break;
      case 'darwin': cmd = 'open "' + localUrl + '"'; break;
      default: cmd = 'xdg-open "' + localUrl + '"'; break;
    }
    require('child_process').exec(cmd, function() {});
    console.log('  🌐 브라우저 자동 열기...');
  } else {
    console.log('  ✅ 24시간 서버 모드 (브라우저 자동 열기 비활성)');
  }
});
})(); // async IIFE 닫기

process.on('SIGINT', async function() {
  console.log('\n종료중...');
  // 최종 Supabase 동기화
  if (sbSync.isEnabled()) {
    console.log('☁️ 최종 동기화...');
    await sbSync.fullSync(STATE).catch(function(){});
    sbSync.stopAutoSync();
  }
  for (var key in STATE.browsers) { try { await STATE.browsers[key].close(); } catch(e) {} }
  process.exit(0);
});

// ═══ Vercel 서버리스 호환 ═══
module.exports = app;
