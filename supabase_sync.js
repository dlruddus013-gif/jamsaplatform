// supabase_sync.js v3 - Supabase 영구저장 + 실시간동기화 + 원격명령수신
const https = require('https');
let cfg = { url: '', key: '', enabled: false, timer: null, cmdTimer: null, STATE: null };

function init(url, key) {
  cfg.url = (url || '').replace(/\/$/, '');
  cfg.key = key || '';
  cfg.enabled = !!(cfg.url && cfg.key);
  if (cfg.enabled) console.log('  ☁️  Supabase: ' + cfg.url.substring(0, 45) + '...');
  return cfg.enabled;
}
function isEnabled() { return cfg.enabled; }

// ═══ REST API ═══
function sb(path, method, body, headers) {
  return new Promise(function(resolve, reject) {
    if (!cfg.enabled) return resolve(null);
    var url; try { url = new URL(cfg.url + '/rest/v1/' + path); } catch(e) { return reject(e); }
    var d = body ? JSON.stringify(body) : '';
    var h = { 'apikey': cfg.key, 'Authorization': 'Bearer ' + cfg.key, 'Content-Type': 'application/json',
      'Prefer': method === 'POST' ? 'return=representation,resolution=merge-duplicates' : 'return=representation' };
    if (headers) Object.assign(h, headers);
    if (d && method !== 'GET') h['Content-Length'] = Buffer.byteLength(d);
    var o = { hostname: url.hostname, port: 443, path: url.pathname + url.search, method: method || 'GET', headers: h, timeout: 20000 };
    var req = https.request(o, function(resp) {
      var c = []; resp.on('data', function(ch) { c.push(ch); });
      resp.on('end', function() { var r = Buffer.concat(c).toString(); try { resolve(JSON.parse(r)); } catch(e) { resolve(r); } });
    });
    req.on('error', reject); req.on('timeout', function() { req.destroy(); reject(new Error('timeout')); });
    if (d && method !== 'GET') req.write(d); req.end();
  });
}

// ═══ 데이터 변환 ═══
function toSb(t) {
  return { id: t.id, order_no: t.orderNo||null, coupon_no: t.couponNo||null, coupon_nos: t.couponNos||[], internal_ids: t.internalIds||[],
    source: t.source||'manual', product: t.product||'', buyer: t.buyer||'', phone: (t.phone||'').replace(/[^0-9\-]/g,''),
    price: t.price||0, qty: t.qty||1, person_count: t.personCount||t.qty||1, status: t.status||'사용가능',
    naver_status: t.naverStatus||null, sms_sent: !!t.smsSent, use_date: t.useDate||t.bookDate||null,
    book_date: t.bookDate||null, valid_date: t.validDate||null, items: t.items||[],
    used_at: t.usedAt||null, pos_ok: !!t.posOk, txn_id: t.txnId||null,
    admin_ok: t.adminOk||null, admin_verified: t.adminVerified||null,
    history: t.history||[], notes: t.notes||[], detected_at: t.detectedAt||new Date().toISOString() };
}
function fromSb(r) {
  return { id: r.id, orderNo: r.order_no, couponNo: r.coupon_no, couponNos: r.coupon_nos||[], internalIds: r.internal_ids||[],
    source: r.source, product: r.product, buyer: r.buyer, phone: r.phone, price: r.price||0, qty: r.qty||1,
    personCount: r.person_count||r.qty||1, status: r.status||'사용가능', naverStatus: r.naver_status,
    smsSent: !!r.sms_sent, useDate: r.use_date, bookDate: r.book_date, validDate: r.valid_date,
    items: r.items||[], usedAt: r.used_at, posOk: !!r.pos_ok, txnId: r.txn_id,
    adminOk: r.admin_ok, adminVerified: r.admin_verified,
    history: r.history||[], notes: r.notes||[], detectedAt: r.detected_at };
}

// ═══ CRUD ═══
async function saveTicket(t) { if (!cfg.enabled) return; try { await sb('tickets', 'POST', toSb(t)); } catch(e) {} }
async function saveTickets(ts) { if (!cfg.enabled||!ts||!ts.length) return {ok:false}; try { await sb('tickets', 'POST', ts.slice(0,200).map(toSb)); return {ok:true,count:ts.length}; } catch(e) { return {ok:false,error:e.message}; } }
async function updateTicketStatus(id, status, usedAt) { if (!cfg.enabled) return; try { var b={status:status,updated_at:new Date().toISOString()}; if(usedAt)b.used_at=usedAt; await sb('tickets?id=eq.'+id,'PATCH',b); } catch(e) {} }
async function saveUseHistory(e) { if (!cfg.enabled) return; try { await sb('use_history','POST',{ticket_id:e.ticketId||e.id,order_no:e.orderNo,buyer:e.buyer,phone:e.phone,product:e.product,qty:e.qty||1,price:e.price||0,source:e.source,method:e.method||'qr'}); } catch(e2) {} }
async function savePosLog(e) { if (!cfg.enabled) return; try { await sb('pos_log','POST',{txn_id:e.txnId,ticket_id:e.ticketId,source:e.source,buyer:e.buyer,phone:e.phone,product:e.product,amount:e.amount||0,qty:e.qty||1,items:e.items||[]}); } catch(e2) {} }
async function saveDailySales(date, d) { if (!cfg.enabled) return; try { await sb('daily_sales','POST',{sale_date:date,total_sales:d.sales||0,total_qty:d.qty||0,visitors:d.visitors||0,items:d.items||[],hourly:d.hourly||{}}); } catch(e) {} }
async function saveMsgHistory(e) { if (!cfg.enabled) return; try { await sb('msg_history','POST',{ticket_id:e.ticketId,buyer:e.buyer,phone:e.phone,provider:e.provider,template_name:e.template,message:(e.message||'').substring(0,500),ok:!!e.ok,detail:e.detail}); } catch(e2) {} }
async function saveLog(src, lvl, msg) { if (!cfg.enabled) return; try { await sb('crawl_logs','POST',{source:src,level:lvl,message:(msg||'').substring(0,500)}); } catch(e) {} }
async function getSettings(key) { if (!cfg.enabled) return null; try { var d = await sb('settings?key=eq.'+key+'&select=value','GET'); return d&&d[0]?d[0].value:null; } catch(e) { return null; } }
async function saveSettings(key, val) { if (!cfg.enabled) return; try { await sb('settings','POST',{key:key,value:val,updated_at:new Date().toISOString()}); } catch(e) {} }
async function deleteTicket(id) { if (!cfg.enabled) return; try { await sb('tickets?id=eq.'+id,'DELETE',null); } catch(e) {} }

// ═══ 신규 테이블 CRUD ═══
async function saveFoodOrder(o) { if (!cfg.enabled) return; try { await sb('food_orders','POST',{id:o.id,phone:o.phone,name:o.name||'',items:o.items||[],total:o.total||0,order_date:o.date,order_time:o.time,status:o.status||'pending',cancel_deadline:o.cancelDeadline||null}); } catch(e) {} }
async function updateFoodOrder(id,status) { if (!cfg.enabled) return; try { var b={status:status}; if(status==='ready')b.ready_at=new Date().toISOString(); await sb('food_orders?id=eq.'+id,'PATCH',b); } catch(e) {} }
async function saveFoodReview(r) { if (!cfg.enabled) return; try { await sb('food_reviews','POST',{id:r.id,phone:r.phone,name:r.name||'',rating:r.rating||5,comment:r.comment||'',coupon_code:r.couponCode,coupon_used:!!r.couponUsed}); } catch(e) {} }
async function saveSpotVisit(visitorId,spotId) { if (!cfg.enabled) return; try { await sb('spot_visits','POST',{visitor_id:visitorId,spot_id:spotId}); } catch(e) {} }
async function saveStampReward(visitorId,code) { if (!cfg.enabled) return; try { await sb('stamp_rewards','POST',{id:'SR'+Date.now(),visitor_id:visitorId,coupon_code:code,coupon_type:'juice'}); } catch(e) {} }
async function saveExperienceApp(a) { if (!cfg.enabled) return; try { await sb('experience_apps','POST',{id:a.id,name:a.name,phone:a.phone,sns:a.sns||'',sns_account:a.snsAccount||'',followers:a.followers||'',experience:a.experience||'',prefer_date:a.preferDate||'',intro:a.intro||'',status:a.status||'pending'}); } catch(e) {} }
async function saveEventSub(phone) { if (!cfg.enabled) return; try { await sb('event_subscribers','POST',{phone:phone}); } catch(e) {} }
async function saveDetailedReview(r) { if (!cfg.enabled) return; try { await sb('detailed_reviews','POST',{id:r.id,name:r.name,phone:r.phone,platform:r.platform||'direct',review_url:r.reviewUrl||'',content:r.content||'',rating:r.rating||5,photos:r.photos||0,ticket_code:r.ticketCode,ticket_expiry:r.ticketExpiry,ticket_used:!!r.ticketUsed}); } catch(e) {} }
async function updateDetailedReviewUsed(code) { if (!cfg.enabled) return; try { await sb('detailed_reviews?ticket_code=eq.'+code,'PATCH',{ticket_used:true,ticket_used_at:new Date().toISOString()}); } catch(e) {} }
async function saveRentalBooking(b) { if (!cfg.enabled) return; try { await sb('rental_bookings','POST',{id:b.id,rental_id:b.rentalId,rental_name:b.rentalName||'',phone:b.phone,buyer:b.buyer||'',booking_date:b.date,time_slot:b.timeSlot||'종일',price:b.price||0,status:b.status||'confirmed'}); } catch(e) {} }

// ═══ 서버 시작 시 복원 ═══
async function loadFromSupabase() {
  if (!cfg.enabled) return null;
  try {
    console.log('  ☁️  Supabase 데이터 복원 중...');
    var weekAgo = new Date(Date.now()-7*86400000).toISOString().split('T')[0];
    var today = new Date().toISOString().split('T')[0];
    var tickets = await sb('tickets?use_date=gte.'+weekAgo+'&order=detected_at.desc&limit=500','GET');
    var settings = await sb('settings?select=key,value','GET');
    var templates = await sb('msg_templates?order=sort_order','GET');
    var useHistory = await sb('use_history?order=created_at.desc&limit=100','GET');
    var foodOrders = await sb('food_orders?order_date=gte.'+weekAgo+'&order=created_at.desc&limit=200','GET');
    var foodReviews = await sb('food_reviews?order=created_at.desc&limit=200','GET');
    var spotVisits = await sb('spot_visits?order=visited_at.desc&limit=500','GET');
    var stampRewards = await sb('stamp_rewards?order=created_at.desc&limit=200','GET');
    var experienceApps = await sb('experience_apps?order=created_at.desc&limit=200','GET');
    var eventSubs = await sb('event_subscribers?order=created_at.desc&limit=500','GET');
    var detailedReviews = await sb('detailed_reviews?order=created_at.desc&limit=200','GET');
    var rentalBookings = await sb('rental_bookings?booking_date=gte.'+today+'&order=created_at.desc&limit=200','GET');
    var r = {
      tickets: Array.isArray(tickets)?tickets.map(fromSb):[], settings: {}, templates: Array.isArray(templates)?templates:[], useHistory: Array.isArray(useHistory)?useHistory:[],
      foodOrders: Array.isArray(foodOrders)?foodOrders:[],
      foodReviews: Array.isArray(foodReviews)?foodReviews:[],
      spotVisits: Array.isArray(spotVisits)?spotVisits:[],
      stampRewards: Array.isArray(stampRewards)?stampRewards:[],
      experienceApps: Array.isArray(experienceApps)?experienceApps:[],
      eventSubs: Array.isArray(eventSubs)?eventSubs:[],
      detailedReviews: Array.isArray(detailedReviews)?detailedReviews:[],
      rentalBookings: Array.isArray(rentalBookings)?rentalBookings:[]
    };
    if (Array.isArray(settings)) settings.forEach(function(s){r.settings[s.key]=s.value;});
    console.log('  ☁️  복원: 티켓 '+r.tickets.length+'건, 주문 '+r.foodOrders.length+'건, 리뷰 '+r.detailedReviews.length+'건, 설정 '+Object.keys(r.settings).length+'개');
    return r;
  } catch(e) { console.log('  ☁️  복원 실패: '+e.message); return null; }
}

// ═══ 전체 동기화 ═══
async function fullSync(STATE) {
  if (!cfg.enabled) return {tickets:0};
  var r = {tickets:0};
  try {
    if (STATE.tickets&&STATE.tickets.length>0) { var res=await saveTickets(STATE.tickets); if(res&&res.ok) r.tickets=res.count; }
    var today=new Date().toISOString().split('T')[0];
    if (STATE.monthlyData&&STATE.monthlyData[today]) await saveDailySales(today,STATE.monthlyData[today]);
    if (STATE.foodOrders) for(var i=0;i<STATE.foodOrders.length;i++) await saveFoodOrder(STATE.foodOrders[i]);
    if (STATE.foodReviews) for(var i=0;i<STATE.foodReviews.length;i++) await saveFoodReview(STATE.foodReviews[i]);
    if (STATE.experienceApps) for(var i=0;i<STATE.experienceApps.length;i++) await saveExperienceApp(STATE.experienceApps[i]);
    if (STATE.detailedReviews) for(var i=0;i<STATE.detailedReviews.length;i++) await saveDetailedReview(STATE.detailedReviews[i]);
  } catch(e) {}
  return r;
}

// ═══ 워커 상태 업데이트 ═══
async function updateWorkerStatus(status, sessions) {
  if (!cfg.enabled) return;
  try {
    var ip = '';
    try { var os=require('os'); var nets=os.networkInterfaces(); Object.keys(nets).forEach(function(n){nets[n].forEach(function(net){if(net.family==='IPv4'&&!net.internal)ip=net.address;});}); } catch(e){}
    await sb('workers', 'POST', { id:'main', name:'매표소 PC', status:status, ip:ip, last_seen:new Date().toISOString(), sessions:sessions||{} });
  } catch(e) {}
}

// ═══ 원격 명령 폴링 ═══
function startCommandListener(STATE, handlers) {
  if (!cfg.enabled || cfg.cmdTimer) return;
  cfg.STATE = STATE;
  
  cfg.cmdTimer = setInterval(async function() {
    try {
      // pending 명령 확인
      var cmds = await sb('commands?status=eq.pending&order=created_at.asc&limit=5', 'GET');
      if (!Array.isArray(cmds) || cmds.length === 0) return;
      
      for (var i = 0; i < cmds.length; i++) {
        var cmd = cmds[i];
        console.log('[cmd] ☁️ 원격 명령 수신: ' + cmd.command);
        
        // 상태 → running
        await sb('commands?id=eq.' + cmd.id, 'PATCH', { status: 'running', started_at: new Date().toISOString() });
        await updateWorkerStatus('busy', STATE.sessions);
        
        var result = { ok: false };
        try {
          if (handlers[cmd.command]) {
            result = await handlers[cmd.command](cmd.params || {});
          } else {
            result = { ok: false, error: '알 수 없는 명령: ' + cmd.command };
          }
        } catch(e) {
          result = { ok: false, error: e.message };
        }
        
        // 완료 처리
        await sb('commands?id=eq.' + cmd.id, 'PATCH', {
          status: result.ok ? 'done' : 'error',
          result: result,
          completed_at: new Date().toISOString()
        });
        
        // 로그
        await saveLog('command', result.ok ? 'success' : 'error', cmd.command + ': ' + JSON.stringify(result).substring(0, 200));
      }
      
      await updateWorkerStatus('online', STATE.sessions);
    } catch(e) {
      // 폴링 오류 무시
    }
  }, 5000); // 5초마다 폴링
  
  console.log('  ☁️  원격 명령 리스너 시작 (5초 폴링)');
}

function startAutoSync(STATE, ms) {
  if (cfg.timer) clearInterval(cfg.timer);
  ms = ms || 60000;
  cfg.timer = setInterval(function() { fullSync(STATE).catch(function(){}); }, ms);
  // 워커 heartbeat (30초)
  setInterval(function() { updateWorkerStatus('online', STATE.sessions).catch(function(){}); }, 30000);
  console.log('  ☁️  자동 동기화: ' + (ms/1000) + '초 / 워커 heartbeat: 30초');
}
function stopAutoSync() { if(cfg.timer){clearInterval(cfg.timer);cfg.timer=null;} if(cfg.cmdTimer){clearInterval(cfg.cmdTimer);cfg.cmdTimer=null;} }

module.exports = {
  init, isEnabled, loadFromSupabase, fromSb,
  saveTicket, saveTickets, updateTicketStatus, deleteTicket, saveUseHistory, savePosLog,
  saveDailySales, saveMsgHistory, saveLog, getSettings, saveSettings,
  saveFoodOrder, updateFoodOrder, saveFoodReview,
  saveSpotVisit, saveStampReward, saveExperienceApp, saveEventSub,
  saveDetailedReview, updateDetailedReviewUsed, saveRentalBooking,
  fullSync, startAutoSync, stopAutoSync, updateWorkerStatus, startCommandListener,
  syncTickets: saveTickets, syncDailySales: saveDailySales, syncUseHistory: saveUseHistory, syncLog: saveLog,
};
