// ═══════════════════════════════════════════════════════════════
// okpos_bridge.js — Vercel/클라우드 ↔ 로컬 OKPos.exe 브릿지
//
// 이 PC에서 항상 실행되어 있어야 합니다 (START_BRIDGE.bat 사용).
// Supabase commands 테이블을 폴링해서 'pos:register' 명령이 들어오면
// okpos_pos_helper.py를 실행해 OKPos.exe 창에 자동 클릭으로 품목을 입력합니다.
//
// 필수 환경변수 (.env):
//   SUPABASE_URL              - Supabase 프로젝트 URL
//   SUPABASE_SERVICE_KEY      - service_role 키 (Settings → API)
// 선택:
//   BRIDGE_POLL_INTERVAL      - 폴링 간격(ms), 기본 2000
//   BRIDGE_WORKER_ID          - 워커 식별자, 기본 'okpos-bridge'
// ═══════════════════════════════════════════════════════════════
'use strict';

require('dotenv').config();
const https = require('https');
const path = require('path');
const fs = require('fs');
const cp = require('child_process');

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || '';
const HELPER = path.join(__dirname, 'okpos_pos_helper.py');
const POLL = parseInt(process.env.BRIDGE_POLL_INTERVAL || '2000', 10);
const WORKER_ID = process.env.BRIDGE_WORKER_ID || 'okpos-bridge';
const PY_PRIMARY = process.platform === 'win32' ? 'python' : 'python3';
const PY_FALLBACK = process.platform === 'win32' ? 'py' : 'python';

function banner() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  OKPOS Bridge  —  Cloud → Local POS automation');
  console.log('  Supabase: ' + (SUPABASE_URL || '(미설정)'));
  console.log('  Helper:   ' + HELPER);
  console.log('  Poll:     ' + POLL + 'ms');
  console.log('  Worker:   ' + WORKER_ID);
  console.log('═══════════════════════════════════════════════════════════');
}

function preflight() {
  var errs = [];
  if (!SUPABASE_URL) errs.push('SUPABASE_URL 미설정');
  if (!SUPABASE_KEY) errs.push('SUPABASE_SERVICE_KEY 미설정 (Supabase → Settings → API → service_role)');
  if (!fs.existsSync(HELPER)) errs.push('okpos_pos_helper.py 파일 없음');
  if (errs.length) {
    errs.forEach(function(e) { console.error('  ❌ ' + e); });
    console.error('\n.env 파일을 확인해주세요. (예: SUPABASE_URL=https://xxx.supabase.co)');
    process.exit(1);
  }
}

function sb(p, method, body) {
  return new Promise(function(resolve, reject) {
    var u;
    try { u = new URL(SUPABASE_URL + '/rest/v1/' + p); } catch(e) { return reject(e); }
    var d = body ? JSON.stringify(body) : '';
    var h = {
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
      'Content-Type': 'application/json',
      'Prefer': method === 'POST' ? 'return=representation' : 'return=representation',
    };
    if (d && method !== 'GET') h['Content-Length'] = Buffer.byteLength(d);
    var req = https.request({
      hostname: u.hostname, port: 443, path: u.pathname + u.search,
      method: method, headers: h, timeout: 15000,
    }, function(res) {
      var chunks = [];
      res.on('data', function(c) { chunks.push(c); });
      res.on('end', function() {
        var s = Buffer.concat(chunks).toString();
        if (res.statusCode >= 400) return reject(new Error('HTTP ' + res.statusCode + ': ' + s.substring(0, 200)));
        try { resolve(JSON.parse(s)); } catch(e) { resolve(s); }
      });
    });
    req.on('error', reject);
    req.on('timeout', function() { req.destroy(); reject(new Error('timeout')); });
    if (d && method !== 'GET') req.write(d);
    req.end();
  });
}

function runHelper(params) {
  return new Promise(function(resolve) {
    var tmp = path.join(__dirname, '.okpos_bridge_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6) + '.json');
    try { fs.writeFileSync(tmp, JSON.stringify(params), 'utf8'); }
    catch(e) { return resolve({ ok: false, error: 'tmp 파일 생성 실패: ' + e.message }); }

    function attempt(bin) {
      var cmd = '"' + bin + '" "' + HELPER + '" --jsonfile "' + tmp + '"';
      cp.exec(cmd, { timeout: 25000, encoding: 'utf8', windowsHide: true }, function(err, stdout, stderr) {
        try { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); } catch(_) {}
        var out = (stdout || '').trim();
        var serr = (stderr || '').trim();
        if (err) {
          if (bin === PY_PRIMARY) {
            try { fs.writeFileSync(tmp, JSON.stringify(params), 'utf8'); } catch(_) {}
            return attempt(PY_FALLBACK);
          }
          return resolve({ ok: false, error: serr || err.message || 'python 실행 실패', stdout: out });
        }
        if (out.indexOf('OK') >= 0) return resolve({ ok: true, output: out, stderr: serr });
        return resolve({ ok: false, output: out, stderr: serr });
      });
    }
    attempt(PY_PRIMARY);
  });
}

async function reportWorker(status) {
  try {
    var ip = '';
    try {
      var nets = require('os').networkInterfaces();
      Object.keys(nets).forEach(function(n) {
        nets[n].forEach(function(net) {
          if (net.family === 'IPv4' && !net.internal) ip = net.address;
        });
      });
    } catch(_) {}
    await sb('workers', 'POST', {
      id: WORKER_ID, name: 'OKPOS Bridge', status: status,
      ip: ip, last_seen: new Date().toISOString(), sessions: { okpos: true },
    });
  } catch(_) {}
}

var busy = false;
async function tick() {
  if (busy) return;
  busy = true;
  try {
    // command 컬럼: pos:register / params: { product, qty, source, price, buyer, ticketId, ... }
    var cmds = await sb('commands?status=eq.pending&command=eq.pos%3Aregister&order=created_at.asc&limit=3', 'GET');
    if (!Array.isArray(cmds) || cmds.length === 0) return;

    for (var i = 0; i < cmds.length; i++) {
      var c = cmds[i];
      var params = c.params || {};
      console.log('\n[' + new Date().toISOString().substring(11,19) + '] cmd #' + c.id +
        ' ▶ ' + (params.product || '?') + ' x' + (params.qty || 1) +
        ' (' + (params.source || '') + ')' +
        (params.buyer ? ' / ' + params.buyer : ''));

      try { await sb('commands?id=eq.' + c.id, 'PATCH', { status: 'processing' }); } catch(_) {}

      var r = await runHelper({
        product: params.product, qty: params.qty || 1,
        source: params.source || '', price: params.price || 0,
      });

      try {
        await sb('commands?id=eq.' + c.id, 'PATCH', {
          status: r.ok ? 'done' : 'error',
          result: r,
          processed_at: new Date().toISOString(),
        });
      } catch(e) { console.error('   결과 업데이트 실패: ' + e.message); }

      if (r.ok) console.log('   ✅ ' + (r.output || 'OK'));
      else console.log('   ❌ ' + (r.error || r.output || 'fail') + (r.stderr ? '\n      stderr: ' + r.stderr.substring(0, 200) : ''));
    }
  } catch(e) {
    console.error('[poll error] ' + e.message);
  } finally {
    busy = false;
  }
}

banner();
preflight();

reportWorker('online');
setInterval(function() { reportWorker('online').catch(function(){}); }, 30000);
setInterval(tick, POLL);
tick();

process.on('SIGINT', async function() {
  console.log('\n브릿지 종료...');
  try { await reportWorker('offline'); } catch(_) {}
  process.exit(0);
});
