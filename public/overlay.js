// overlay.js — 잠사박물관 기능 확장 (원본 index.html 수정 없이 주입)
(function(){

// ═══ 전역 함수: retryAllFailed (index.html 버튼에서 호출) ═══
window.retryAllFailed = function(){
  fetch('/api/ticket/failed-count').then(function(r){return r.json()}).then(function(d){
    if(!d.total){toast('처리실패 없음','info');return;}
    if(!confirm('처리실패 '+d.total+'건 재처리?'))return;
    toast('🔄 재처리중...','info');
    fetch('/api/ticket/retry-all-failed',{method:'POST'}).then(function(r){return r.json()}).then(function(r2){
      if(r2.ok) toast('완료! 성공:'+r2.success+' 실패:'+r2.fail,'success');
      if(typeof render==='function') render();
    });
  });
};


// ═══ 1. 플로팅 버튼 (NV/LA/검색) ═══
var btnHtml = '<div id="_ovBtns" style="position:fixed;bottom:20px;right:20px;display:flex;flex-direction:column;gap:6px;z-index:9998">'
  + '<div onclick="_ovCrawl(\'naver\',this)" style="width:42px;height:42px;background:#03C75A;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:11px;font-weight:700;color:#fff;box-shadow:0 2px 8px rgba(3,199,90,.3)" title="네이버만 크롤링">NV</div>'
  + '<div onclick="_ovCrawl(\'la2f\',this)" style="width:42px;height:42px;background:#6366f1;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:11px;font-weight:700;color:#fff;box-shadow:0 2px 8px rgba(99,102,241,.3)" title="라이프만 크롤링">LA</div>'
  + '<div onclick="_ovCrawl(\'okpos\',this)" style="width:42px;height:42px;background:#FF6B35;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:10px;font-weight:700;color:#fff;box-shadow:0 2px 8px rgba(255,107,53,.3)" title="OKPOS만 크롤링">POS</div>'
  + '<div onclick="_ovToggleSearch()" style="width:52px;height:52px;background:linear-gradient(135deg,#e91e7a,#c4166a);border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:22px;box-shadow:0 4px 16px rgba(233,30,122,.4)">🔍</div>'
  + '</div>';

// ═══ 2. 검색 위젯 패널 ═══
var searchHtml = '<div id="_ovSearch" style="display:none;position:fixed;top:60px;right:20px;width:420px;max-height:80vh;background:#111128;border:2px solid #e91e7a;border-radius:14px;box-shadow:0 8px 40px rgba(0,0,0,.6);z-index:9999;overflow:hidden;font-family:Malgun Gothic,sans-serif">'
  + '<div style="padding:10px 14px;background:linear-gradient(135deg,#e91e7a,#c4166a);display:flex;align-items:center;gap:8px">'
  + '<span style="font-size:14px;font-weight:800;color:#fff;flex:1">🔍 통합 검색</span>'
  + '<span onclick="_ovToggleSearch()" style="cursor:pointer;color:#fff;font-size:18px;opacity:.7">✕</span></div>'
  + '<div style="padding:10px">'
  + '<input id="_ovQ" type="text" placeholder="이름, 연락처, 상품명, 주문번호..." oninput="_ovDoSearch()" style="width:100%;padding:10px;background:#1a1a3a;border:1px solid #252550;border-radius:8px;color:#fff;font-size:13px;outline:none">'
  + '<div style="display:flex;gap:4px;margin-top:6px">'
  + '<select id="_ovSrc" onchange="_ovDoSearch()" style="flex:1;padding:5px;background:#1a1a3a;border:1px solid #252550;border-radius:6px;color:#aaa;font-size:10px"><option value="">전체</option><option value="naver">네이버</option><option value="la2f">라이프</option><option value="현장">현장</option></select>'
  + '<select id="_ovSt" onchange="_ovDoSearch()" style="flex:1;padding:5px;background:#1a1a3a;border:1px solid #252550;border-radius:6px;color:#aaa;font-size:10px"><option value="">전체</option><option value="사용가능">사용가능</option><option value="사용완료">사용완료</option></select>'
  + '</div><div id="_ovCnt" style="font-size:10px;color:#666;margin-top:4px"></div></div>'
  + '<div id="_ovRes" style="max-height:calc(80vh - 150px);overflow-y:auto;padding:0 10px 10px"></div></div>';

var wrap = document.createElement('div');
wrap.innerHTML = btnHtml + searchHtml;
document.body.appendChild(wrap);

// ═══ 함수들 ═══
var _ovTimer = null;

window._ovToggleSearch = function(){
  var w = document.getElementById('_ovSearch');
  w.style.display = w.style.display === 'none' ? 'block' : 'none';
  if(w.style.display === 'block'){ document.getElementById('_ovQ').focus(); _ovDoSearch(); }
};

window._ovDoSearch = function(){
  clearTimeout(_ovTimer);
  _ovTimer = setTimeout(function(){
    var q = document.getElementById('_ovQ').value.trim();
    var src = document.getElementById('_ovSrc').value;
    var st = document.getElementById('_ovSt').value;
    var url = '/api/ticket/search-all?limit=50';
    if(q) url += '&q=' + encodeURIComponent(q);
    if(src) url += '&source=' + encodeURIComponent(src);
    if(st) url += '&status=' + encodeURIComponent(st);
    fetch(url).then(function(r){return r.json()}).then(function(d){
      document.getElementById('_ovCnt').textContent = d.total + '건 중 ' + d.count + '건';
      var box = document.getElementById('_ovRes');
      if(!d.results || !d.results.length){ box.innerHTML = '<div style="text-align:center;padding:20px;color:#666">결과 없음</div>'; return; }
      window._ovSearchResults = d.results;
      box.innerHTML = d.results.map(function(r, idx){
        var sc = r.source==='naver' ? '#03C75A' : r.source==='la2fdoci' ? '#6366f1' : '#f59e0b';
        var stc = r.status==='사용가능' ? '#3b82f6' : r.status==='사용완료' ? '#10b981' : r.status==='부분사용' ? '#f59e0b' : '#ef4444';
        var canUse = r.status==='사용가능' || r.status==='부분사용';
        return '<div onclick="_ovExpandResult('+idx+')" style="padding:8px;border-bottom:1px solid #1a1a3a;cursor:pointer;border-radius:6px;transition:background .1s" onmouseover="this.style.background=\'#1a1a3a\'" onmouseout="this.style.background=\'transparent\'">'
          + '<div style="display:flex;gap:6px;align-items:center">'
          + '<div style="flex:1"><div style="font-weight:700;font-size:13px">' + r.buyer + '</div>'
          + '<div style="font-size:10px;color:#888"><span style="color:' + sc + '">' + r.source + '</span> · ' + (r.qty||1) + '매 · ' + (r.bookDate||r.date||'') + '</div></div>'
          + '<span style="font-size:9px;padding:2px 6px;border-radius:4px;background:' + stc + '18;color:' + stc + ';font-weight:600">' + r.status + '</span>'
          + '</div>'
          + '<div style="font-size:9px;color:#666;margin-top:2px">' + (r.product||'').substring(0,40) + '</div>'
          + '<div id="_ovDetail'+idx+'" style="display:none"></div>'
          + '</div>';
      }).join('');
    });
  }, 300);
};

// 검색 결과 클릭 → 상세 펼침
window._ovExpandResult = function(idx){
  var detail = document.getElementById('_ovDetail'+idx);
  if(!detail) return;
  if(detail.style.display === 'block'){ detail.style.display = 'none'; return; }

  // 다른 상세 닫기
  document.querySelectorAll('[id^="_ovDetail"]').forEach(function(d){ d.style.display='none'; });

  var r = (window._ovSearchResults||[])[idx];
  if(!r){ detail.style.display = 'none'; return; }

  var sc = r.source==='naver' ? '#03C75A' : r.source==='la2fdoci' ? '#6366f1' : '#f59e0b';
  var stc = r.status==='사용가능' ? '#3b82f6' : r.status==='사용완료' ? '#10b981' : '#f59e0b';
  var canUse = r.status==='사용가능' || r.status==='부분사용';
  var hist = r.history || [];
  var notes = r.notes || [];

  var h = '<div style="margin-top:8px;padding:10px;background:#0a0a18;border:1px solid #252550;border-radius:8px">';

  // 기본 정보
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px">';
  h += '<div><span style="font-size:8px;color:#666">구매자</span><div style="font-size:12px;font-weight:700">' + r.buyer + '</div></div>';
  h += '<div><span style="font-size:8px;color:#666">전화번호</span><div style="font-size:12px">' + (r.phone||'없음') + '</div></div>';
  h += '<div><span style="font-size:8px;color:#666">주문번호</span><div style="font-size:10px;color:#888;font-family:monospace">' + (r.orderNo||r.id||'') + '</div></div>';
  h += '<div><span style="font-size:8px;color:#666">금액</span><div style="font-size:12px;font-weight:700;color:#e91e7a">' + (r.price||0).toLocaleString() + '원</div></div>';
  h += '</div>';

  // 상품 정보
  h += '<div style="padding:6px 8px;background:#111128;border-radius:6px;margin-bottom:6px">';
  h += '<div style="font-size:8px;color:#666">상품</div>';
  h += '<div style="font-size:11px;color:#ccc;line-height:1.4">' + (r.product||'') + '</div>';
  h += '</div>';

  // 날짜 정보
  h += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;margin-bottom:6px">';
  h += '<div style="padding:4px 6px;background:#111128;border-radius:4px;text-align:center"><div style="font-size:7px;color:#666">구매일</div><div style="font-size:10px;color:#3b82f6;font-weight:600">' + (r.bookDate||r.date||'-') + '</div></div>';
  h += '<div style="padding:4px 6px;background:#111128;border-radius:4px;text-align:center"><div style="font-size:7px;color:#666">사용일시</div><div style="font-size:10px;color:#10b981;font-weight:600">' + (r.usedAt||'-') + '</div></div>';
  h += '<div style="padding:4px 6px;background:#111128;border-radius:4px;text-align:center"><div style="font-size:7px;color:#666">유효기간</div><div style="font-size:10px;color:#888">' + (r.validDate||'-') + '</div></div>';
  h += '</div>';

  // 진행이력
  if(hist.length > 0){
    h += '<div style="margin-bottom:6px"><div style="font-size:9px;font-weight:700;color:#888;margin-bottom:3px">📋 진행이력</div>';
    h += '<div style="display:flex;gap:0;align-items:center;flex-wrap:wrap">';
    hist.forEach(function(step, i){
      var action = step.action || step.a || '';
      var time = step.time || step.t || '';
      var ac = action.indexOf('완료')>=0 ? '#10b981' : action.indexOf('신청')>=0 ? '#3b82f6' : action.indexOf('확정')>=0 ? '#6366f1' : '#888';
      h += '<div style="display:flex;align-items:center;gap:0">';
      h += '<div style="padding:3px 6px;background:' + ac + '15;border:1px solid ' + ac + '33;border-radius:4px;text-align:center">';
      h += '<div style="font-size:9px;font-weight:700;color:' + ac + '">' + action + '</div>';
      h += '<div style="font-size:7px;color:#666">' + time + '</div></div>';
      if(i < hist.length - 1) h += '<span style="color:#333;font-size:8px;margin:0 2px">→</span>';
      h += '</div>';
    });
    h += '</div></div>';
  }

  // 상담이력
  if(notes.length > 0){
    h += '<div style="margin-bottom:6px"><div style="font-size:9px;font-weight:700;color:#888;margin-bottom:3px">💬 상담이력</div>';
    notes.forEach(function(n){
      h += '<div style="padding:3px 0;font-size:9px;border-bottom:1px solid #1a1a3a"><span style="color:#6366f1">[' + (n.type||'memo') + ']</span> <span style="color:#aaa">' + (n.text||'') + '</span> <span style="color:#555">' + (n.by||'') + ' ' + (n.time||'') + '</span></div>';
    });
    h += '</div>';
  }

  // 액션 버튼
  h += '<div style="display:flex;gap:4px;margin-top:6px">';
  if(canUse){
    h += '<button onclick="event.stopPropagation();if(typeof useTk===\'function\')useTk(\'' + (r.id||'') + '\')" style="flex:1;padding:6px;background:#10b981;color:#fff;border:none;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer">🎫 사용처리</button>';
  }
  h += '<button onclick="event.stopPropagation();if(typeof showRcpt===\'function\')showRcpt(\'' + (r.id||'') + '\')" style="padding:6px 10px;background:#252540;color:#FF6B35;border:none;border-radius:6px;font-size:10px;cursor:pointer">🖨 영수증</button>';
  h += '<button onclick="event.stopPropagation();window.open(\'/crm#' + encodeURIComponent(r.phone||'') + '\')" style="padding:6px 10px;background:#252540;color:#6366f1;border:none;border-radius:6px;font-size:10px;cursor:pointer">👤 CRM</button>';
  h += '</div>';

  h += '</div>';
  detail.innerHTML = h;
  detail.style.display = 'block';
};

window._ovCrawl = function(src, el){
  if(el){ el.style.opacity = '.5'; el.textContent = '...'; }
  var url = src === 'naver' ? '/api/crawl/naver-only' : src === 'la2f' ? '/api/crawl/la2f-only' : '/api/crawl/okpos-only';
  var label = src === 'naver' ? '네이버' : src === 'la2f' ? '라이프' : 'OKPOS';
  var btnText = src === 'naver' ? 'NV' : src === 'la2f' ? 'LA' : 'POS';
  fetch(url, {method:'POST'}).then(function(r){return r.json()}).then(function(d){
    if(el){ el.style.opacity = '1'; el.textContent = btnText; }
    if(d.ok) alert(label + ' 크롤링 완료: ' + (d.tickets || d.sales || 0) + '건');
    else alert(label + ' 크롤링 실패: ' + (d.error || ''));
    if(typeof render === 'function') render();
  }).catch(function(e){ if(el){ el.style.opacity = '1'; el.textContent = btnText; } alert(label + ' 오류: ' + e.message); });
};

// ═══ 3. 처리실패 재처리 버튼 주입 ═══
window._ovRetryAll = function(){
  fetch('/api/ticket/failed-count').then(function(r){return r.json()}).then(function(d){
    if(!d.total){ alert('처리실패 없음'); return; }
    if(!confirm('처리실패 ' + d.total + '건 일괄 재처리?')) return;
    fetch('/api/ticket/retry-all-failed', {method:'POST'}).then(function(r){return r.json()}).then(function(r2){
      if(r2.ok) alert('완료! 성공:' + r2.success + ' 실패:' + r2.fail);
      location.reload();
    });
  });
};

// 기존 동기화 검증 버튼 옆에 재처리 버튼 삽입 (DOM 감시)
function injectRetryBtn(){
  var btns = document.querySelectorAll('button');
  for(var i = 0; i < btns.length; i++){
    if(btns[i].textContent.indexOf('동기화 검증') >= 0 && !btns[i]._ovDone){
      btns[i]._ovDone = true;
      var rb = document.createElement('button');
      rb.className = 'btn';
      rb.onclick = _ovRetryAll;
      rb.style.cssText = 'padding:6px 14px;background:rgba(245,158,11,.15);color:#f59e0b;border:1px solid rgba(245,158,11,.3);border-radius:6px;font-size:11px;cursor:pointer;font-weight:700;margin-left:4px';
      rb.textContent = '🔄 처리실패 재처리';
      btns[i].parentElement.insertBefore(rb, btns[i].nextSibling);
    }
  }
}

// ═══ 4. Ctrl+K 단축키 ═══
document.addEventListener('keydown', function(e){
  if(e.ctrlKey && e.key === 'k'){ e.preventDefault(); _ovToggleSearch(); }
});

// ═══ 6. 브라우저 띠지 자동 프린트 (프린터만 연결하면 됨) ═══
window._ovPrintBand = function(bandPageHtml, bandCount){
  if(!bandPageHtml) return;
  console.log('[띠지] 프린트 시작: ' + (bandCount||1) + '매');
  
  // 방법1: 새 창으로 열고 자동 프린트
  var w = window.open('', '_blank', 'width=920,height=200,menubar=no,toolbar=no');
  if(w){
    w.document.write(bandPageHtml);
    w.document.close();
    w.document.title = '띠지 인쇄';
    setTimeout(function(){
      try {
        w.focus();
        w.print();
        console.log('[띠지] 프린트 다이얼로그 열림');
      } catch(e){
        console.error('[띠지] 프린트 실패:', e);
        alert('팝업이 차단되었습니다. 브라우저 주소 옆의 팝업 차단 아이콘을 클릭하여 허용해주세요.');
      }
    }, 600);
  } else {
    // 팝업 차단됨 → 현재 페이지에서 프린트 미리보기
    alert('팝업이 차단되어 띠지를 출력할 수 없습니다.\n\n해결: 브라우저 주소창 오른쪽의 팝업 차단 아이콘 클릭 → 허용');
    
    // 폴백: 현재 페이지 내 모달로 띠지 표시
    var modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.8);z-index:99999;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:10px';
    modal.innerHTML = '<div style="background:#fff;border-radius:8px;padding:20px;max-width:920px;width:95%">'
      + '<div style="margin-bottom:10px;display:flex;justify-content:space-between;align-items:center">'
      + '<b style="color:#000">띠지 미리보기 (' + (bandCount||1) + '매)</b>'
      + '<button onclick="this.closest(\'div\').parentElement.parentElement.remove()" style="padding:6px 16px;background:#333;color:#fff;border:none;border-radius:4px;cursor:pointer">닫기</button>'
      + '</div>'
      + '<iframe style="width:100%;height:80px;border:1px solid #ddd;border-radius:4px" srcdoc="' + bandPageHtml.replace(/"/g,'&quot;') + '"></iframe>'
      + '<button onclick="var f=this.previousElementSibling;f.contentWindow.print()" style="margin-top:8px;padding:10px 24px;background:#e91e7a;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:700;font-size:14px">🖨️ 인쇄</button>'
      + '</div>';
    document.body.appendChild(modal);
    modal.addEventListener('click', function(e){ if(e.target===modal) modal.remove(); });
  }
};

// 기존 처리 버튼 클릭 이벤트 가로채기 — 사용처리 후 자동 프린트
var _origFetch = window.fetch;
window.fetch = function(url, opts) {
  return _origFetch.apply(this, arguments).then(function(response) {
    // /api/ticket/use 또는 /api/kiosk/verify-and-use 응답 가로채기
    if (typeof url === 'string' && (url.indexOf('/api/ticket/use') >= 0 || url.indexOf('/api/kiosk/verify-and-use') >= 0) && opts && opts.method === 'POST') {
      var cloned = response.clone();
      cloned.json().then(function(data) {
        if (data.ok && data.bandPageHtml) {
          console.log('🖨️ 띠지 자동 프린트: ' + (data.printBands || data.bandCount || 1) + '매');
          _ovPrintBand(data.bandPageHtml, data.printBands || data.bandCount || 1);
        }
      }).catch(function(){});
    }
    return response;
  });
};

// ═══ 5. DOM 변경 감시하여 재처리 버튼 + 부분사용 처리 버튼 주입 ═══
// ═══ 통합 DOM 감시 (디바운스 300ms — 깜빡임 방지) ═══
var _ovDebounceTimer = null;
var _ovInjecting = false;
function _ovRunAll(){
  if(_ovInjecting) return;
  _ovInjecting = true;
  try { injectRetryBtn(); } catch(e){}
  try { injectPartialUseBtn(); } catch(e){}
  try { injectCrawlEnhancements(); } catch(e){}
  try { enhanceTicketTab(); } catch(e){}
  try { enhanceIssueForm(); } catch(e){}
  try { injectRentalMapBtn(); } catch(e){}
  _ovInjecting = false;
}
var _ovObs = new MutationObserver(function(){
  if(_ovInjecting) return;
  clearTimeout(_ovDebounceTimer);
  _ovDebounceTimer = setTimeout(_ovRunAll, 300);
});
_ovObs.observe(document.body, { childList: true, subtree: true });
setTimeout(_ovRunAll, 1500);

// ═══ 8. 크롤링 탭 강화 — OKPOS 버튼 + 독립 실행 버튼 주입 ═══
function injectCrawlEnhancements(){
  // ▶ NV 버튼 찾기 → 옆에 OKPOS 버튼 추가
  var btns = document.querySelectorAll('button');
  btns.forEach(function(btn){
    if((btn.textContent||'').trim()==='▶ NV' && !btn._ovOkposDone){
      btn._ovOkposDone = true;
      var parent = btn.parentElement;
      if(parent){
        // ▶ POS 버튼 추가
        var posBtn = document.createElement('button');
        posBtn.className = 'btn';
        posBtn.textContent = '▶ POS';
        posBtn.style.cssText = 'flex:1;padding:8px;background:#FF6B35;color:#fff;font-size:11px;font-weight:600;border:none;border-radius:6px;cursor:pointer';
        posBtn.onclick = function(e){ e.stopPropagation(); _ovStartCrawl('okpos'); };
        parent.appendChild(posBtn);
      }
    }
    // 🔄 NV 버튼 찾기 → 옆에 🔄 POS 추가
    if((btn.textContent||'').indexOf('NV')>=0 && (btn.textContent||'').indexOf('🔄')>=0 && !btn._ovOkposOnceDone){
      btn._ovOkposOnceDone = true;
      var parent2 = btn.parentElement;
      if(parent2){
        var posOnce = document.createElement('button');
        posOnce.className = 'btn';
        posOnce.textContent = '🔄 POS';
        posOnce.style.cssText = 'flex:1;padding:6px;background:#252540;color:#FF6B35;font-size:10px;border:1px solid rgba(255,107,53,.2);border-radius:6px;cursor:pointer;font-weight:600';
        posOnce.onclick = function(e){ e.stopPropagation(); _ovCrawlOnce('okpos'); };
        parent2.appendChild(posOnce);
      }
    }
  });

  // 크롤링 상태바 하단에 OKPOS 상태 추가
  var statusDivs = document.querySelectorAll('[style*="la2fdoci"]');
  statusDivs.forEach(function(div){
    var parent = div.parentElement;
    if(parent && !parent._ovOkposStatus && div.textContent.indexOf('la2fdoci')>=0){
      // OKPOS 상태 영역이 없으면 추가
      var siblings = parent.children;
      var hasOkpos = false;
      for(var i=0;i<siblings.length;i++){ if(siblings[i].textContent.indexOf('OKPOS')>=0) hasOkpos=true; }
      if(!hasOkpos){
        var okDiv = document.createElement('div');
        okDiv.style.cssText = 'flex:1;text-align:center;padding:4px;border-left:1px solid #252550';
        okDiv.innerHTML = '<div style="font-size:10px;font-weight:700;color:#FF6B35">OKPOS</div><div style="font-size:9px;color:#666" id="_ovOkposStatus">수동</div>';
        parent.appendChild(okDiv);
        parent._ovOkposStatus = true;
      }
    }
  });
}

// OKPOS 자동 크롤링 시작
window._ovStartCrawl = function(ch){
  if(ch === 'okpos'){
    toast('🔄 OKPOS 단독 크롤링 시작...', 'info');
    fetch('/api/crawl/okpos-only', {method:'POST'}).then(function(r){return r.json()}).then(function(d){
      if(d.ok) toast('✅ OKPOS 완료: ' + (d.sales||0) + '건', 'success');
      else toast('❌ OKPOS: ' + (d.error||'실패'), 'error');
      var st = document.getElementById('_ovOkposStatus');
      if(st) st.textContent = d.ok ? '연결됨' : '실패';
      if(typeof render === 'function') render();
    }).catch(function(e){ toast('❌ OKPOS 오류', 'error'); });
  }
};

// OKPOS 1회 크롤링
window._ovCrawlOnce = function(ch){
  if(ch === 'okpos'){
    toast('🔄 OKPOS 1회 크롤링...', 'info');
    fetch('/api/crawl/okpos-only', {method:'POST'}).then(function(r){return r.json()}).then(function(d){
      if(d.ok) toast('✅ OKPOS 완료', 'success');
      else toast('❌ ' + (d.error||''), 'error');
      if(typeof render === 'function') render();
    });
  }
};

// toast 헬퍼 (기존 toast 없으면 alert 폴백)
if(typeof window.toast !== 'function'){
  window.toast = function(msg){ alert(msg); };
}

// 부분사용 티켓에 "사용처리" 버튼 주입
function injectPartialUseBtn(){
  var rows = document.querySelectorAll('tr, [data-ticket-id]');
  rows.forEach(function(row){
    if(row._ovPartialDone) return;
    var text = row.textContent || '';
    if(text.indexOf('부분사용') >= 0 && text.indexOf('처리') < 0){
      // "부분사용" 텍스트가 있는 행에 처리 버튼 추가
      var cells = row.querySelectorAll('td');
      if(cells.length > 8){
        var lastCell = cells[cells.length - 1];
        if(lastCell && !lastCell.querySelector('._ovPartialBtn')){
          var existingBtn = lastCell.querySelector('button, .btn');
          // 처리 버튼이 없으면 추가
          var hasUseBtn = false;
          lastCell.querySelectorAll('button, .btn, span').forEach(function(b){
            if((b.textContent||'').indexOf('처리') >= 0) hasUseBtn = true;
          });
          if(!hasUseBtn){
            var btn = document.createElement('span');
            btn.className = '_ovPartialBtn';
            btn.textContent = '🔄처리';
            btn.style.cssText = 'display:inline-block;padding:2px 6px;background:#f59e0b;color:#000;border-radius:4px;cursor:pointer;font-size:9px;font-weight:700;margin-left:2px';
            btn.onclick = function(e){
              e.stopPropagation();
              // 행에서 티켓 ID 추출 시도
              var idEl = row.querySelector('[data-id], a[href*="ticket"]');
              var ticketId = idEl ? (idEl.dataset.id || idEl.textContent.trim()) : null;
              if(!ticketId){
                // 주문번호로 찾기
                var orderMatch = text.match(/[LN]\d{10,}/);
                if(orderMatch) ticketId = orderMatch[0];
              }
              if(ticketId){
                if(confirm('부분사용 티켓을 사용처리합니까?')){
                  fetch('/api/ticket/use',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ticketId:ticketId})})
                  .then(function(r){return r.json()}).then(function(d){
                    if(d.ok) alert('사용처리 완료');
                    else alert('실패: '+(d.error||''));
                    location.reload();
                  });
                }
              }else{
                alert('티켓 ID를 찾을 수 없습니다. 수동 처리 탭에서 처리해주세요.');
              }
            };
            lastCell.appendChild(btn);
          }
        }
      }
      row._ovPartialDone = true;
    }
  });
}

// ═══ 9. 발권 폼: 체험단/초대권 세분화 + 사유 필드 ═══
function enhanceIssueForm(){
  var sel = document.getElementById('issProd');
  if(!sel || sel._ovEnhanced) return;
  sel._ovEnhanced = true;

  // "무료/체험단" optgroup에 추가 옵션
  var groups = sel.querySelectorAll('optgroup');
  var freeGroup = null;
  groups.forEach(function(g){ if((g.label||'').indexOf('무료')>=0||(g.label||'').indexOf('체험')>=0) freeGroup=g; });
  if(freeGroup){
    var existing={};
    freeGroup.querySelectorAll('option').forEach(function(o){existing[o.value]=true});
    [{id:'p9',n:'체험단(인스타그래머)'},{id:'p10',n:'체험단(기자/언론)'},{id:'p11',n:'체험단(맘카페)'},
     {id:'p12',n:'초대권(지역단체)'},{id:'p13',n:'초대권(협력업체)'},{id:'p14',n:'초대권(교육기관)'},
     {id:'p15',n:'무료입장(경로/장애)'}].forEach(function(e){
      if(!existing[e.id]){var o=document.createElement('option');o.value=e.id;o.dataset.p='0';o.textContent=e.n;freeGroup.appendChild(o)}
    });
  }

  // 사유 입력란 (메모 필드 바로 위에)
  var card = sel.closest('.card');
  if(!card || document.getElementById('issReason')) return;
  var memoDiv = null;
  card.querySelectorAll('label').forEach(function(l){if(l.textContent.indexOf('메모')>=0) memoDiv=l.parentElement});
  if(!memoDiv) return;

  var wrap = document.createElement('div');
  wrap.id = '_ovReasonWrap';
  wrap.style.cssText = 'margin-top:8px;display:none';
  wrap.innerHTML = '<label style="font-size:10px;color:#f59e0b;font-weight:700">⚠️ 사유 (필수)</label>'
    +'<div style="display:grid;grid-template-columns:120px 1fr;gap:6px;margin-top:3px">'
    +'<select id="issReasonType" style="padding:6px;font-size:11px;background:#1a1a2e;border:1px solid #f59e0b44;border-radius:6px;color:#f59e0b">'
    +'<option value="체험단">체험단 협찬</option><option value="초대">초대/VIP</option>'
    +'<option value="교환">교환/재발급</option><option value="이벤트">이벤트 당첨</option>'
    +'<option value="직원">직원/관계자</option><option value="기타">기타</option></select>'
    +'<input id="issReason" placeholder="블로그 URL, 초대 사유, 승인자 등" style="padding:6px;font-size:11px;background:#1a1a2e;border:1px solid #f59e0b44;border-radius:6px;color:#fff"></div>';
  memoDiv.parentElement.insertBefore(wrap, memoDiv);

  // 상품 변경 시 무료면 사유 표시
  sel.addEventListener('change', function(){
    var w=document.getElementById('_ovReasonWrap');
    if(!w) return;
    var opt=sel.options[sel.selectedIndex];
    w.style.display = (opt && opt.dataset && opt.dataset.p==='0') ? 'block' : 'none';
  });
}

// doIssue 가로채기 — 사유 필수 검증
var _origDoIssue = window.doIssue;
if(typeof _origDoIssue === 'function'){
  window.doIssue = function(){
    var wrap=document.getElementById('_ovReasonWrap');
    var input=document.getElementById('issReason');
    var typeEl=document.getElementById('issReasonType');
    if(wrap && wrap.style.display!=='none'){
      if(!input||!input.value.trim()){alert('무료/체험단/초대권은 사유를 입력해주세요.');if(input)input.focus();return}
      var memo=document.getElementById('issMemo');
      if(memo){var pf='['+(typeEl?typeEl.value:'')+'] ';if(memo.value.indexOf(pf)<0)memo.value=pf+input.value.trim()+(memo.value?' | '+memo.value:'')}
    }
    _origDoIssue();
  };
}

// ═══ 11. 대여 탭에 위성지도 버튼 + iframe 주입 ═══
function injectRentalMapBtn(){
  // "티켓 확인 필요" 텍스트가 있는 카드 찾기 (대여 탭 식별)
  var cards = document.querySelectorAll('.card');
  var rentalCard = null;
  cards.forEach(function(c){
    if(c.textContent.indexOf('대여 예약')>=0 || c.textContent.indexOf('티켓 확인 필요')>=0){
      var parent = c.parentElement;
      if(parent && !parent._ovMapDone) rentalCard = parent;
    }
  });
  // 대여 테이블 찾기 (오두막/평상 키워드)
  if(!rentalCard){
    var tables = document.querySelectorAll('table');
    tables.forEach(function(t){
      if(t.textContent.indexOf('오두막')>=0 && t.textContent.indexOf('평상')>=0){
        var parent = t.closest('div') || t.parentElement;
        if(parent && !parent._ovMapDone) rentalCard = parent;
      }
    });
  }
  if(!rentalCard || rentalCard._ovMapDone) return;
  rentalCard._ovMapDone = true;

  // 상단에 뷰 토글 버튼 삽입
  var toolbar = document.createElement('div');
  toolbar.style.cssText = 'display:flex;gap:6px;margin-bottom:10px;align-items:center';
  toolbar.innerHTML = '<button id="_ovViewTable" onclick="_ovSwitchRentalView(\'table\')" style="padding:6px 14px;background:#10b98118;color:#10b981;border:1px solid #10b98133;border-radius:6px;font-size:11px;cursor:pointer;font-weight:700">📋 테이블</button>'
    + '<button id="_ovViewMap" onclick="_ovSwitchRentalView(\'map\')" style="padding:6px 14px;background:#252540;color:#888;border:1px solid #252550;border-radius:6px;font-size:11px;cursor:pointer;font-weight:700">🗺️ 위성지도</button>'
    + '<span style="margin-left:auto;font-size:9px;color:#666">네이버 Maps API 필요</span>';
  rentalCard.insertBefore(toolbar, rentalCard.firstChild);

  // iframe (처음엔 숨김)
  var mapFrame = document.createElement('div');
  mapFrame.id = '_ovMapFrame';
  mapFrame.style.cssText = 'display:none;margin-bottom:10px';
  mapFrame.innerHTML = '<iframe src="/rental-map" style="width:100%;height:600px;border:1px solid #252550;border-radius:10px" frameborder="0"></iframe>';
  toolbar.after(mapFrame);
}

// 테이블/지도 뷰 전환
window._ovSwitchRentalView = function(view){
  var frame = document.getElementById('_ovMapFrame');
  var tableBtn = document.getElementById('_ovViewTable');
  var mapBtn = document.getElementById('_ovViewMap');
  if(!frame) return;

  if(view === 'map'){
    frame.style.display = 'block';
    // 테이블 요소들 숨기기
    var parent = frame.parentElement;
    if(parent){
      Array.from(parent.children).forEach(function(ch){
        if(ch.id !== '_ovMapFrame' && ch !== frame.previousElementSibling && ch.tagName !== 'SCRIPT'){
          if(!ch._ovOrigDisplay) ch._ovOrigDisplay = ch.style.display;
          if(ch.id !== '_ovMapFrame' && ch !== tableBtn.parentElement) ch.style.display = 'none';
        }
      });
    }
    if(mapBtn){ mapBtn.style.background = '#10b98118'; mapBtn.style.color = '#10b981'; mapBtn.style.borderColor = '#10b98133'; }
    if(tableBtn){ tableBtn.style.background = '#252540'; tableBtn.style.color = '#888'; tableBtn.style.borderColor = '#252550'; }
  } else {
    frame.style.display = 'none';
    var parent = frame.parentElement;
    if(parent){
      Array.from(parent.children).forEach(function(ch){
        if(ch._ovOrigDisplay !== undefined) ch.style.display = ch._ovOrigDisplay;
      });
    }
    if(tableBtn){ tableBtn.style.background = '#10b98118'; tableBtn.style.color = '#10b981'; tableBtn.style.borderColor = '#10b98133'; }
    if(mapBtn){ mapBtn.style.background = '#252540'; mapBtn.style.color = '#888'; mapBtn.style.borderColor = '#252550'; }
  }
};

// (enhanceIssueForm + enhanceTicketTab은 통합 DOM 감시에서 처리됨)

})();

// ═══ 10. 티켓 탭 강화: 기간통계 + 검색 + 이력 로그 ═══
function enhanceTicketTab(){
  // 티켓 테이블 찾기
  var headers = document.querySelectorAll('th');
  var ticketTable = null;
  headers.forEach(function(th){ if(th.textContent==='출처' && th.nextElementSibling && th.nextElementSibling.textContent.indexOf('주문번호')>=0) ticketTable = th.closest('table'); });
  if(!ticketTable || ticketTable._ovEnhanced) return;
  ticketTable._ovEnhanced = true;

  var parent = ticketTable.parentElement;

  // ── 검색 바 삽입 ──
  var searchBar = document.createElement('div');
  searchBar.style.cssText = 'margin-bottom:8px;display:flex;gap:6px;align-items:center';
  searchBar.innerHTML = '<input id="_ovTicketSearch" placeholder="🔍 이름, 전화번호, 상품, 주문번호 검색..." oninput="_ovFilterTickets()" style="flex:1;padding:8px 12px;background:#1a1a2e;border:1px solid #333;border-radius:8px;color:#fff;font-size:12px;outline:none">'
    +'<select id="_ovDateRange" onchange="_ovFilterTickets()" style="padding:8px;background:#1a1a2e;border:1px solid #333;border-radius:8px;color:#aaa;font-size:10px">'
    +'<option value="all">전체</option><option value="today">오늘</option><option value="yesterday">어제</option><option value="7d">7일</option><option value="30d">30일</option><option value="custom">기간선택</option></select>'
    +'<input type="date" id="_ovDateFrom" style="display:none;padding:6px;background:#1a1a2e;border:1px solid #333;border-radius:6px;color:#fff;font-size:10px">'
    +'<input type="date" id="_ovDateTo" style="display:none;padding:6px;background:#1a1a2e;border:1px solid #333;border-radius:6px;color:#fff;font-size:10px">'
    +'<select id="_ovStatusFilter" onchange="_ovFilterTickets()" style="padding:8px;background:#1a1a2e;border:1px solid #333;border-radius:8px;color:#aaa;font-size:10px">'
    +'<option value="">전체상태</option><option value="사용가능">사용가능</option><option value="사용완료">사용완료</option><option value="부분사용">부분사용</option><option value="취소">취소</option></select>'
    +'<span id="_ovTicketCnt" style="font-size:10px;color:#888;white-space:nowrap">0건</span>';
  parent.insertBefore(searchBar, ticketTable);

  // 기간선택 토글
  document.getElementById('_ovDateRange').addEventListener('change', function(){
    var isCustom = this.value === 'custom';
    document.getElementById('_ovDateFrom').style.display = isCustom ? 'inline' : 'none';
    document.getElementById('_ovDateTo').style.display = isCustom ? 'inline' : 'none';
  });

  // ── 기간 통계 패널 삽입 ──
  var statsPanel = document.createElement('div');
  statsPanel.id = '_ovTicketStats';
  statsPanel.style.cssText = 'margin-bottom:8px;display:grid;grid-template-columns:repeat(6,1fr);gap:4px';
  parent.insertBefore(statsPanel, searchBar);

  // ── 이력 로그 버튼 ──
  var logBtn = document.createElement('div');
  logBtn.style.cssText = 'margin-bottom:8px;display:flex;gap:4px';
  logBtn.innerHTML = '<button onclick="_ovToggleLog()" class="btn" style="padding:5px 10px;background:#6366f118;color:#6366f1;border:1px solid #6366f133;border-radius:6px;font-size:10px;cursor:pointer;font-weight:600">📋 수정이력 보기</button>'
    +'<button onclick="_ovExportLog()" class="btn" style="padding:5px 10px;background:#10b98118;color:#10b981;border:1px solid #10b98133;border-radius:6px;font-size:10px;cursor:pointer;font-weight:600">📥 이력 다운로드</button>';
  parent.insertBefore(logBtn, searchBar.nextSibling);

  // 이력 로그 패널 (숨김)
  var logPanel = document.createElement('div');
  logPanel.id = '_ovLogPanel';
  logPanel.style.cssText = 'display:none;margin-bottom:8px;max-height:200px;overflow-y:auto;background:#0a0a18;border:1px solid #252550;border-radius:8px;padding:8px';
  parent.insertBefore(logPanel, logBtn.nextSibling);

  // 초기 통계 업데이트
  _ovUpdateStats();
}

// 티켓 필터링
window._ovFilterTickets = function(){
  var q = (document.getElementById('_ovTicketSearch')||{}).value || '';
  var range = (document.getElementById('_ovDateRange')||{}).value || 'all';
  var status = (document.getElementById('_ovStatusFilter')||{}).value || '';
  q = q.toLowerCase().trim();

  if(typeof S === 'undefined' || !S.tickets) return;

  var now = new Date();
  var from = null, to = null;
  if(range==='today'){ from=new Date(now.getFullYear(),now.getMonth(),now.getDate()); to=new Date(from.getTime()+86400000); }
  else if(range==='yesterday'){ to=new Date(now.getFullYear(),now.getMonth(),now.getDate()); from=new Date(to.getTime()-86400000); }
  else if(range==='7d'){ to=new Date(); from=new Date(to.getTime()-7*86400000); }
  else if(range==='30d'){ to=new Date(); from=new Date(to.getTime()-30*86400000); }
  else if(range==='custom'){
    var df=document.getElementById('_ovDateFrom').value;
    var dt=document.getElementById('_ovDateTo').value;
    if(df) from=new Date(df);
    if(dt) to=new Date(dt+'T23:59:59');
  }

  // 테이블 행 필터
  var rows = document.querySelectorAll('table tr');
  var cnt = 0;
  rows.forEach(function(row){
    if(row.querySelector('th')) return; // 헤더 스킵
    var cells = row.querySelectorAll('td');
    if(cells.length < 5) return;
    var text = row.textContent.toLowerCase();
    var dateText = '';
    cells.forEach(function(c){ if(c.textContent.match(/\d{4}-\d{2}-\d{2}/)) dateText = c.textContent.match(/\d{4}-\d{2}-\d{2}/)[0]; });

    var matchQ = !q || text.indexOf(q) >= 0;
    var matchStatus = !status || text.indexOf(status) >= 0;
    var matchDate = true;
    if(dateText && (from || to)){
      var d = new Date(dateText);
      if(from && d < from) matchDate = false;
      if(to && d > to) matchDate = false;
    }

    row.style.display = (matchQ && matchStatus && matchDate) ? '' : 'none';
    if(matchQ && matchStatus && matchDate) cnt++;
  });

  var cntEl = document.getElementById('_ovTicketCnt');
  if(cntEl) cntEl.textContent = cnt + '건';

  _ovUpdateStats();
};

// 기간 통계 업데이트
window._ovUpdateStats = function(){
  var panel = document.getElementById('_ovTicketStats');
  if(!panel || typeof S === 'undefined' || !S.tickets) return;

  var tks = S.tickets;
  var avail = tks.filter(function(t){return t.status==='사용가능'}).length;
  var done = tks.filter(function(t){return t.status==='사용완료'}).length;
  var partial = tks.filter(function(t){return t.status==='부분사용'}).length;
  var cancel = tks.filter(function(t){return t.status==='취소'}).length;
  var failed = tks.filter(function(t){return t.status==='사용완료'&&!t.adminOk}).length;
  var revenue = tks.reduce(function(s,t){return s+(t.price||0)},0);

  var stats = [
    {n:tks.length,l:'전체',c:'#888'},
    {n:avail,l:'사용가능',c:'#3b82f6'},
    {n:done,l:'사용완료',c:'#10b981'},
    {n:partial,l:'부분사용',c:'#f59e0b'},
    {n:failed,l:'처리실패',c:'#ef4444'},
    {n:'₩'+revenue.toLocaleString(),l:'매출합계',c:'#e91e7a'},
  ];

  panel.innerHTML = stats.map(function(s){
    return '<div style="background:#111128;border:1px solid #252550;border-radius:6px;padding:6px;text-align:center">'
      +'<div style="font-size:16px;font-weight:800;color:'+s.c+'">'+(typeof s.n==='number'?s.n:s.n)+'</div>'
      +'<div style="font-size:8px;color:#666">'+s.l+'</div></div>';
  }).join('');
};

// 이력 로그 토글
window._ovToggleLog = function(){
  var panel = document.getElementById('_ovLogPanel');
  if(!panel) return;
  var isHidden = panel.style.display === 'none';
  panel.style.display = isHidden ? 'block' : 'none';
  if(isHidden) _ovRenderLog();
};

// 이력 로그 렌더링
window._ovRenderLog = function(){
  var panel = document.getElementById('_ovLogPanel');
  if(!panel || typeof S === 'undefined') return;

  // 모든 티켓의 history + notes 수집
  var allLogs = [];
  (S.tickets||[]).forEach(function(t){
    (t.history||[]).forEach(function(h){
      allLogs.push({time:h.time||h.t||'',action:h.action||h.a||'',buyer:t.buyer,product:t.product,by:h.by||'',ticketId:t.id,type:'action'});
    });
    (t.notes||[]).forEach(function(n){
      allLogs.push({time:n.time||'',action:n.text||'',buyer:t.buyer,product:t.product,by:n.by||'',ticketId:t.id,type:n.type||'memo'});
    });
  });

  // 시간 역순 정렬
  allLogs.sort(function(a,b){return(b.time||'').localeCompare(a.time||'')});

  if(allLogs.length === 0){
    panel.innerHTML = '<div style="text-align:center;color:#555;font-size:10px;padding:10px">이력 없음</div>';
    return;
  }

  var typeColors = {action:'#3b82f6',memo:'#888',call:'#10b981',complaint:'#ef4444',request:'#f59e0b'};

  panel.innerHTML = '<div style="font-size:10px;font-weight:700;color:#888;margin-bottom:4px">📋 전체 수정/사용 이력 ('+allLogs.length+'건)</div>'
    + '<table style="width:100%;border-collapse:collapse">'
    + '<tr><th style="padding:3px 4px;font-size:8px;color:#666;text-align:left;border-bottom:1px solid #252550">시간</th>'
    + '<th style="padding:3px 4px;font-size:8px;color:#666;text-align:left;border-bottom:1px solid #252550">유형</th>'
    + '<th style="padding:3px 4px;font-size:8px;color:#666;text-align:left;border-bottom:1px solid #252550">구매자</th>'
    + '<th style="padding:3px 4px;font-size:8px;color:#666;text-align:left;border-bottom:1px solid #252550">내용</th>'
    + '<th style="padding:3px 4px;font-size:8px;color:#666;text-align:left;border-bottom:1px solid #252550">담당</th></tr>'
    + allLogs.slice(0,100).map(function(l){
      var tc = typeColors[l.type]||'#888';
      return '<tr><td style="padding:3px 4px;font-size:9px;color:#555;border-bottom:1px solid #151530;white-space:nowrap">'+l.time+'</td>'
        +'<td style="padding:3px 4px;border-bottom:1px solid #151530"><span style="font-size:8px;padding:1px 4px;border-radius:3px;background:'+tc+'18;color:'+tc+';font-weight:600">'+l.type+'</span></td>'
        +'<td style="padding:3px 4px;font-size:10px;color:#ccc;font-weight:600;border-bottom:1px solid #151530">'+l.buyer+'</td>'
        +'<td style="padding:3px 4px;font-size:9px;color:#aaa;border-bottom:1px solid #151530">'+l.action+'</td>'
        +'<td style="padding:3px 4px;font-size:9px;color:#666;border-bottom:1px solid #151530">'+l.by+'</td></tr>';
    }).join('') + '</table>';
};

// 이력 CSV 다운로드
window._ovExportLog = function(){
  if(typeof S==='undefined'||!S.tickets) return;
  var rows = [['시간','유형','구매자','상품','내용','담당','티켓ID']];
  S.tickets.forEach(function(t){
    (t.history||[]).forEach(function(h){rows.push([h.time||h.t||'','action',t.buyer,t.product,h.action||h.a||'',h.by||'',t.id])});
    (t.notes||[]).forEach(function(n){rows.push([n.time||'',n.type||'memo',t.buyer,t.product,n.text||'',n.by||'',t.id])});
  });
  var csv = '\uFEFF'+rows.map(function(r){return r.join(',')}).join('\n');
  var blob = new Blob([csv],{type:'text/csv;charset=utf-8'});
  var a=document.createElement('a');a.href=URL.createObjectURL(blob);
  a.download='ticket_log_'+new Date().toISOString().substring(0,10)+'.csv';
  a.click();
};

// ═══ 12. 크롤링 실시간 진행 패널 ═══

// ═══ 13. 마감일지 계정별 분리 뷰 ═══
(function(){
  var acctData = null;

  // WebSocket에서 salesByAccount 수신
  function hookForAccounts(){
    if(!window.ws || window.ws._ovAcctHooked) return;
    window.ws._ovAcctHooked = true;
    var orig = window.ws.onmessage;
    window.ws.onmessage = function(evt){
      try {
        var msg = JSON.parse(evt.data);
        if(msg.type === 'salesByAccount' && msg.data){
          acctData = msg.data;
          injectAccountTabs();
        }
        if(msg.type === 'salesData' && msg.data && msg.data.accountResults){
          if(!acctData) acctData = { results: msg.data.accountResults };
          injectAccountTabs();
        }
      } catch(e){}
      if(orig) orig.call(window.ws, evt);
    };
  }
  setInterval(function(){ if(window.ws && !window.ws._ovAcctHooked) hookForAccounts(); }, 2000);

  function injectAccountTabs(){
    var table = document.getElementById('dailyTable');
    if(!table || !acctData) return;
    var parent = table.parentElement;
    if(!parent || parent.querySelector('#_ovAcctTabs')) return;

    var results = acctData.results || [];
    if(results.length < 2) return; // 계정 1개면 탭 불필요

    var tabs = document.createElement('div');
    tabs.id = '_ovAcctTabs';
    tabs.style.cssText = 'display:flex;gap:4px;margin-bottom:8px;flex-wrap:wrap';

    var html = '<span class="_ovAcctTab _ovAcctActive" data-acct="all" onclick="_ovFilterAccount(\'all\',this)" style="padding:5px 12px;font-size:10px;font-weight:700;border-radius:6px;cursor:pointer;background:#e91e7a20;color:#e91e7a;border:1px solid #e91e7a33">📊 통합</span>';
    results.forEach(function(r){
      if(r.skipped) return;
      var label = (r.name || r.id) + ' (₩' + (r.total||0).toLocaleString() + ')';
      html += '<span class="_ovAcctTab" data-acct="' + (r.name||r.id) + '" onclick="_ovFilterAccount(\'' + (r.name||r.id).replace(/'/g,'') + '\',this)" style="padding:5px 12px;font-size:10px;font-weight:600;border-radius:6px;cursor:pointer;background:#252540;color:#888;border:1px solid #252550">' + label + '</span>';
    });
    tabs.innerHTML = html;
    parent.insertBefore(tabs, table);
  }

  window._ovFilterAccount = function(acct, el){
    // 탭 스타일
    document.querySelectorAll('._ovAcctTab').forEach(function(t){
      t.style.background = '#252540'; t.style.color = '#888'; t.style.borderColor = '#252550';
      t.classList.remove('_ovAcctActive');
    });
    if(el){ el.style.background = '#e91e7a20'; el.style.color = '#e91e7a'; el.style.borderColor = '#e91e7a33'; el.classList.add('_ovAcctActive'); }

    var table = document.getElementById('dailyTable');
    if(!table) return;

    // 테이블 행 필터링
    var rows = table.querySelectorAll('tr');
    rows.forEach(function(row){
      // 헤더/타이틀/소계/총계 행은 항상 표시
      var cells = row.querySelectorAll('td');
      if(cells.length < 4) { row.style.display = ''; return; }
      var firstCell = cells[0];
      if(firstCell.getAttribute('rowspan') || firstCell.getAttribute('colspan')) { row.style.display = ''; return; }

      if(acct === 'all'){
        row.style.display = '';
        return;
      }

      // _account 속성으로 필터 (데이터 행에 적용)
      var acctAttr = row.getAttribute('data-account') || '';
      if(acctAttr){
        row.style.display = (acctAttr === acct) ? '' : 'none';
      }
    });
  };
})();

(function(){
  // 플로팅 패널 생성
  var panel = document.createElement('div');
  panel.id = '_ovCrawlPanel';
  panel.style.cssText = 'display:none;position:fixed;bottom:80px;left:20px;width:360px;max-height:300px;background:#111128ee;border:1px solid #252550;border-radius:12px;z-index:9997;backdrop-filter:blur(8px);overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,.5)';
  panel.innerHTML = '<div id="_ovCrawlHead" style="padding:8px 12px;border-bottom:1px solid #252550;display:flex;align-items:center;gap:6px;cursor:pointer" onclick="_ovToggleCrawlPanel()">'
    + '<span style="font-size:12px;font-weight:800;color:#10b981;flex:1" id="_ovCrawlTitle">🔄 크롤링 진행</span>'
    + '<span id="_ovCrawlBadge" style="font-size:9px;padding:1px 6px;border-radius:8px;background:#10b98118;color:#10b981;font-weight:600">0건</span>'
    + '<span style="font-size:10px;color:#666;cursor:pointer" onclick="event.stopPropagation();document.getElementById(\'_ovCrawlPanel\').style.display=\'none\'">✕</span>'
    + '</div>'
    + '<div id="_ovCrawlBody" style="max-height:240px;overflow-y:auto;padding:6px 10px"></div>';
  document.body.appendChild(panel);

  var crawlLogs = [];
  var crawlActive = false;
  var hideTimer = null;

  // WebSocket 메시지 가로채기
  var origWsHandler = null;
  function hookWebSocket(){
    if(!window.ws || window.ws._ovHooked) return;
    window.ws._ovHooked = true;
    var origOnMsg = window.ws.onmessage;
    window.ws.onmessage = function(evt){
      try {
        var msg = JSON.parse(evt.data);
        if(msg.type === 'log' && msg.data){
          var d = msg.data;
          var cat = d.category || d.cat || '';
          var text = d.message || d.msg || '';
          var status = d.status || '';

          // 크롤링 관련 로그만 패널에 표시
          if(cat === 'la2fdoci' || cat === 'naver' || cat === 'okpos' || cat === 'system'){
            if(text.indexOf('크롤링')>=0 || text.indexOf('로그인')>=0 || text.indexOf('페이지')>=0 || text.indexOf('파싱')>=0 || text.indexOf('완료')>=0 || text.indexOf('시작')>=0 || text.indexOf('건')>=0 || text.indexOf('누적')>=0){
              addCrawlLog(cat, text, status);
            }
          }
        }
        // 상태 업데이트
        if(msg.type === 'state' || msg.type === 'init'){
          var st = msg.crawlStatus || (msg.data && msg.data.crawlStatus);
          if(st){
            var anyRunning = Object.values(st).some(function(v){return v==='crawling'||v==='running'});
            if(anyRunning && !crawlActive){
              crawlActive = true;
              panel.style.display = 'block';
              clearTimeout(hideTimer);
            }
            if(!anyRunning && crawlActive){
              crawlActive = false;
              hideTimer = setTimeout(function(){/* 패널 유지 — 수동 닫기 */}, 5000);
            }
          }
        }
        if(msg.type === 'crawlStatus'){
          var anyR = false;
          var d2 = msg.data || {};
          for(var k in d2){ if(d2[k]==='crawling'||d2[k]==='running') anyR=true; }
          if(anyR){ crawlActive=true; panel.style.display='block'; }
        }
      } catch(e){}
      // 원래 핸들러 호출
      if(origOnMsg) origOnMsg.call(window.ws, evt);
    };
  }

  function addCrawlLog(cat, text, status){
    var catColors = {la2fdoci:'#6366f1',naver:'#03C75A',okpos:'#FF6B35',system:'#888'};
    var time = new Date().toLocaleTimeString('ko').substring(0,5);
    crawlLogs.unshift({cat:cat,text:text,status:status,time:time});
    if(crawlLogs.length > 50) crawlLogs = crawlLogs.slice(0, 50);

    // 패널 표시
    panel.style.display = 'block';

    // 뱃지 업데이트
    var badge = document.getElementById('_ovCrawlBadge');
    if(badge){
      var match = text.match(/누적\s*(\d+)/);
      if(match) badge.textContent = match[1] + '건';
      else if(text.indexOf('완료')>=0) badge.textContent = '✅ 완료';
    }

    // 타이틀 업데이트
    var title = document.getElementById('_ovCrawlTitle');
    if(title){
      var icon = text.indexOf('완료')>=0 ? '✅' : text.indexOf('실패')>=0 ? '❌' : '🔄';
      title.innerHTML = icon + ' <span style="color:' + (catColors[cat]||'#888') + '">' + cat + '</span>';
    }

    // 로그 본문 렌더링
    var body = document.getElementById('_ovCrawlBody');
    if(body){
      body.innerHTML = crawlLogs.slice(0, 30).map(function(l){
        var cc = catColors[l.cat] || '#888';
        var sc = l.status==='success' ? '#10b981' : l.status==='error' ? '#ef4444' : l.status==='warning' ? '#f59e0b' : '#888';
        var isImportant = l.text.indexOf('완료')>=0 || l.text.indexOf('성공')>=0 || l.text.indexOf('실패')>=0;
        return '<div style="padding:2px 0;border-bottom:1px solid #1a1a3a;font-size:9px;' + (isImportant?'background:#10b98108;padding:3px 4px;border-radius:3px;margin:1px 0':'') + '">'
          + '<span style="color:#555;font-family:monospace">' + l.time + '</span> '
          + '<span style="color:' + cc + ';font-weight:600">[' + l.cat + ']</span> '
          + '<span style="color:' + sc + '">' + l.text + '</span>'
          + '</div>';
      }).join('');
    }
  }

  // WebSocket 연결 감시 (재연결 시 다시 훅)
  setInterval(function(){
    if(window.ws && !window.ws._ovHooked) hookWebSocket();
  }, 2000);
  setTimeout(hookWebSocket, 1500);
})();

window._ovToggleCrawlPanel = function(){
  var body = document.getElementById('_ovCrawlBody');
  if(body) body.style.display = body.style.display === 'none' ? 'block' : 'none';
};

// ═══ 7. AI 매출 분석 표 렌더링 ═══
var _ovStyleInjected = false;
function injectAiTableStyle(){
  if(_ovStyleInjected) return;
  var style = document.createElement('style');
  style.textContent = '.ai-tbl{width:100%;border-collapse:collapse;margin:8px 0;font-size:11px}.ai-tbl th{background:#1a1a3a;color:#f59e0b;padding:6px 8px;text-align:left;border:1px solid #333;font-weight:700;font-size:10px}.ai-tbl td{padding:5px 8px;border:1px solid #252550;color:#ccc}.ai-tbl tr:nth-child(even) td{background:#0d0d20}'

  // ═══ 마감일지 공식 보고서 스타일 ═══
  + '#dailyTable{background:#fff!important;border:2px solid #1a365d!important;border-radius:8px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.3)}'
  + '#dailyTable td,#dailyTable th{border-color:#c8d6e5!important;padding:6px 10px!important;font-size:11px!important;line-height:1.5!important}'

  // 타이틀 행
  + '#dailyTable tr:first-child td{background:linear-gradient(135deg,#1a365d,#2c5282)!important;color:#fff!important;font-size:16px!important;font-weight:800!important;letter-spacing:2px!important;padding:14px!important;text-align:center!important;border:none!important}'

  // 일자/담당자 행
  + '#dailyTable tr:nth-child(2) td{background:#edf2f7!important;color:#1a365d!important;font-size:12px!important}'
  + '#dailyTable tr:nth-child(2) td:nth-child(odd){background:#dce6f1!important;font-weight:700!important;text-align:center!important}'

  // 헤더 행
  + '#dailyTable tr:nth-child(3){background:linear-gradient(135deg,#2d3748,#4a5568)!important}'
  + '#dailyTable tr:nth-child(3) td{color:#fff!important;font-weight:700!important;text-align:center!important;font-size:11px!important;padding:8px 6px!important;border-color:#4a5568!important}'

  // 구분 셀 (매표/단체/매점 등)
  + '#dailyTable td[rowspan]{background:#f0f4f8!important;color:#1a365d!important;font-weight:800!important;text-align:center!important;font-size:12px!important;border-right:2px solid #2c5282!important;vertical-align:middle!important}'

  // 내용 셀
  + '#dailyTable td:nth-child(2){color:#4a5568!important;font-weight:600!important}'

  // 상품명 셀 (굵은 글씨 = 대분류)
  + '#dailyTable td:nth-child(3){color:#2d3748!important}'

  // 숫자 셀 (실입장객, 카드결제, 매출합계)
  + '#dailyTable td:nth-child(4),#dailyTable td:nth-child(5),#dailyTable td:nth-child(6){text-align:right!important;font-family:\"D2Coding\",\"Consolas\",monospace!important;color:#1a365d!important}'

  // 소계 행
  + '#dailyTable tr td[colspan]{background:#e2e8f0!important;color:#1a365d!important;font-weight:800!important;text-align:center!important;font-size:12px!important;border-top:2px solid #2c5282!important}'

  // 총계 행 (맨 마지막)
  + '#dailyTable tr:last-child td{background:linear-gradient(135deg,#1a365d,#2c5282)!important;color:#fff!important;font-weight:800!important;font-size:13px!important;border:none!important}'

  // 매출 숫자 강조
  + '#dailyTable td[contenteditable]{background:#fefcbf!important;color:#744210!important}'

  // 짝수 행 (데이터 행만)
  + '#dailyTable tr:nth-child(even) td:not([rowspan]):not([colspan]){background:#f7fafc!important}'

  // 인쇄 최적화
  + '@media print{#dailyTable{box-shadow:none!important;border-radius:0!important}#dailyTable td,#dailyTable th{font-size:10px!important;padding:3px 6px!important}}'
  ;
  document.head.appendChild(style);
  _ovStyleInjected = true;
}
// AI 분석 결과가 DOM에 추가될 때 표 스타일 적용
var _ovAiObs = new MutationObserver(function(muts){
  muts.forEach(function(m){
    m.addedNodes.forEach(function(n){
      if(n.nodeType===1 && n.innerHTML && n.innerHTML.indexOf('<table')>=0){
        injectAiTableStyle();
        var tables = n.querySelectorAll('table:not(.ai-tbl)');
        tables.forEach(function(t){ t.classList.add('ai-tbl'); });
      }
    });
  });
});
_ovAiObs.observe(document.body, { childList:true, subtree:true });
