# -*- coding: utf-8 -*-
"""OKPOS POS 전체화면 품목 자동 등록 v3
Win32 API로 POS 창을 직접 찾아 활성화 → 클릭 → 원래 창 복귀
"""
import sys, time, os, json

def ensure_deps():
    try:
        import pyautogui
        return pyautogui
    except ImportError:
        import subprocess
        subprocess.check_call([sys.executable, '-m', 'pip', 'install', 'pyautogui', 'Pillow', '-q'],
                              stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        import pyautogui
        return pyautogui

import ctypes, ctypes.wintypes
user32 = ctypes.windll.user32

def get_screen_size():
    return user32.GetSystemMetrics(0), user32.GetSystemMetrics(1)

def find_window_by_keywords(keywords):
    """윈도우 타이틀에 키워드가 포함된 창 찾기"""
    results = []
    WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.wintypes.BOOL, ctypes.wintypes.HWND, ctypes.wintypes.LPARAM)
    def callback(hwnd, lParam):
        if user32.IsWindowVisible(hwnd):
            n = user32.GetWindowTextLengthW(hwnd)
            if n > 0:
                buf = ctypes.create_unicode_buffer(n + 1)
                user32.GetWindowTextW(hwnd, buf, n + 1)
                title = buf.value
                for kw in keywords:
                    if kw in title:
                        results.append((hwnd, title))
                        break
        return True
    user32.EnumWindows(WNDENUMPROC(callback), 0)
    return results

def activate_window(hwnd):
    """창 강제 활성화 (전체화면 POS 대응)"""
    SW_RESTORE = 9
    SW_SHOW = 5
    SW_SHOWMAXIMIZED = 3
    
    user32.ShowWindow(hwnd, SW_RESTORE)
    time.sleep(0.1)
    user32.ShowWindow(hwnd, SW_SHOW)
    time.sleep(0.1)
    
    # 포그라운드 강제 설정
    cur_thread = ctypes.windll.kernel32.GetCurrentThreadId()
    fg_thread = user32.GetWindowThreadProcessId(user32.GetForegroundWindow(), None)
    if cur_thread != fg_thread:
        user32.AttachThreadInput(cur_thread, fg_thread, True)
    user32.SetForegroundWindow(hwnd)
    user32.BringWindowToTop(hwnd)
    if cur_thread != fg_thread:
        user32.AttachThreadInput(cur_thread, fg_thread, False)
    
    time.sleep(0.5)

# ═══ POS 좌표 (비율 기반 - 전체화면) ═══
TABS = {
    '현장':      (0.545, 0.110),
    '라이프도시': (0.650, 0.110),
    '체험':      (0.745, 0.110),
    '단체':      (0.835, 0.110),
    '네이버':    (0.930, 0.110),
    '단체패키지': (0.545, 0.175),
    '제휴':      (0.650, 0.175),
    '무료입장':  (0.745, 0.175),
    '기념품':    (0.835, 0.175),
}

PRODUCTS = {
    # 현장
    '현장|입장권':          (0.595, 0.285),
    '현장|입장권_청주시민':  (0.595, 0.380),
    '현장|장애인/경로우대':  (0.595, 0.475),
    '현장|평상 보증금':      (0.835, 0.260),
    '현장|주간평상대여':     (0.945, 0.260),
    # 라이프도시
    '라이프도시|라이프도시 입장권':      (0.595, 0.260),
    '라이프도시|라이프도시 종일권':      (0.660, 0.260),
    '라이프도시|라이프도시 오후권':      (0.745, 0.260),
    '라이프도시|라이프도시 누에 3종체험': (0.595, 0.350),
    '라이프도시|라이프도시 오디 3종체험': (0.595, 0.440),
    '라이프도시|라이프도시 불멍체험':    (0.595, 0.620),
    '라이프도시|라이프도시 캔들체험':    (0.945, 0.530),
    '라이프도시|라이프도시 바베큐 패키지': (0.870, 0.620),
    '라이프도시|라이프도시 먹이3종체험': (0.870, 0.710),
    # 네이버
    '네이버|네이버 입장권':      (0.595, 0.260),
    '네이버|네이버 오후권':      (0.595, 0.350),
    '네이버|네이버 오두막(3만원)': (0.595, 0.440),
    '네이버|네이버 오두막(6만원)': (0.595, 0.530),
    '네이버|네이버 달고나체험':   (0.595, 0.620),
    '네이버|네이버 빼빼로만들기': (0.595, 0.710),
    '네이버|네이버 누에 3종 체험': (0.930, 0.260),
    '네이버|네이버 오디 3종체험': (0.930, 0.350),
    '네이버|네이버 비단체험':     (0.930, 0.440),
    '네이버|네이버 바베큐 패키지': (0.930, 0.530),
    '네이버|네이버 불멍패키지':   (0.930, 0.620),
    '네이버|네이버 먹이 3종세트': (0.930, 0.710),
}

ALIASES = {
    '네이버 입장권': '네이버|네이버 입장권',
    '네이버입장권': '네이버|네이버 입장권',
    '네이버 오후권': '네이버|네이버 오후권',
    '네이버 먹이 3종세트': '네이버|네이버 먹이 3종세트',
    '네이버 먹이 3종 세트': '네이버|네이버 먹이 3종세트',
    '네이버 누에 3종 체험': '네이버|네이버 누에 3종 체험',
    '네이버 오디3종': '네이버|네이버 오디 3종체험',
    '네이버 오디 3종체험': '네이버|네이버 오디 3종체험',
    '네이버 비단체험': '네이버|네이버 비단체험',
    '네이버 달고나체험': '네이버|네이버 달고나체험',
    '네이버 바베큐 패키지': '네이버|네이버 바베큐 패키지',
    '네이버 불멍패키지': '네이버|네이버 불멍패키지',
    '라이프 입장권': '라이프도시|라이프도시 입장권',
    '라이프도시 입장권': '라이프도시|라이프도시 입장권',
    '라이프 종일권': '라이프도시|라이프도시 종일권',
    '라이프도시 종일권': '라이프도시|라이프도시 종일권',
    '라이프 오후권': '라이프도시|라이프도시 오후권',
    '라이프도시 오후권': '라이프도시|라이프도시 오후권',
    '라이프도시 불멍체험': '라이프도시|라이프도시 불멍체험',
    '라이프도시 캔들체험': '라이프도시|라이프도시 캔들체험',
    '라이프도시 바베큐 패키지': '라이프도시|라이프도시 바베큐 패키지',
    '입장권': '현장|입장권',
    '입장권_청주시민': '현장|입장권_청주시민',
    '장애인/경로우대': '현장|장애인/경로우대',
}

def find_product_key(product, source=''):
    # 직접 매핑
    if product in ALIASES: return ALIASES[product]
    clean = product.replace(' ', '')
    for a, k in ALIASES.items():
        if a.replace(' ', '') == clean: return k
    for a, k in ALIASES.items():
        if a in product or product in a: return k
    # 소스 기반 기본값
    if source == 'naver' or '네이버' in product: return '네이버|네이버 입장권'
    if source == 'la2fdoci' or '라이프' in product: return '라이프도시|라이프도시 입장권'
    return '현장|입장권'

def register_on_pos(product, qty=1, source='', price=0):
    pyautogui = ensure_deps()
    pyautogui.FAILSAFE = False
    pyautogui.PAUSE = 0.12
    
    sw, sh = get_screen_size()
    print(f"[POS] 화면:{sw}x{sh} 상품:{product} x{qty} ({source})", file=sys.stderr)
    
    # 1) 현재 활성 창 저장 (복귀용)
    prev_hwnd = user32.GetForegroundWindow()
    
    # 2) POS 창 찾기
    pos_windows = find_window_by_keywords(['OKPOS', 'NICE정보통신', 'NICE 정보통신', '한국잠사플레이팜'])
    if not pos_windows:
        # 전체화면 POS는 타이틀이 안 보일 수 있음 → 클래스로 검색
        pos_windows = find_window_by_keywords(['OKPOS', 'POS'])
    
    if not pos_windows:
        print("ERR:POS 창 없음. OKPOS 실행 확인", file=sys.stderr)
        # Alt+Tab 폴백
        print("[POS] Alt+Tab 폴백 시도", file=sys.stderr)
        pyautogui.hotkey('alt', 'tab')
        time.sleep(1.5)
    else:
        pos_hwnd = pos_windows[0][0]
        print(f"[POS] 창 발견: {pos_windows[0][1]} (hwnd={pos_hwnd})", file=sys.stderr)
        activate_window(pos_hwnd)
    
    time.sleep(0.5)
    
    # 3) 상품 키 결정
    pkey = find_product_key(product, source)
    tab = pkey.split('|')[0]
    print(f"[POS] 매핑: {product} -> {pkey} (탭:{tab})", file=sys.stderr)
    
    # 4) 탭 클릭
    if tab in TABS:
        tx = int(sw * TABS[tab][0])
        ty = int(sh * TABS[tab][1])
        print(f"[POS] 탭 클릭: {tab} ({tx},{ty})", file=sys.stderr)
        pyautogui.click(tx, ty)
        time.sleep(0.6)
    
    # 5) 상품 버튼 클릭
    if pkey in PRODUCTS:
        px = int(sw * PRODUCTS[pkey][0])
        py = int(sh * PRODUCTS[pkey][1])
        print(f"[POS] 상품 클릭: ({px},{py}) x{qty}", file=sys.stderr)
        
        for i in range(qty):
            pyautogui.click(px, py)
            time.sleep(0.4)
        
        time.sleep(0.5)
        success = True
    else:
        print(f"[POS] 상품 좌표 없음: {pkey}", file=sys.stderr)
        success = False
    
    # 6) 원래 창 복귀
    time.sleep(0.3)
    if prev_hwnd and user32.IsWindow(prev_hwnd):
        activate_window(prev_hwnd)
    else:
        pyautogui.hotkey('alt', 'tab')
        time.sleep(0.5)
    
    if success:
        print("OK")
    else:
        print(f"MANUAL:{tab}")
    return success

if __name__ == '__main__':
    product = ''
    qty = 1
    source = ''
    price = 0
    
    i = 1
    while i < len(sys.argv):
        if sys.argv[i] == '--product' and i + 1 < len(sys.argv):
            product = sys.argv[i + 1]; i += 2
        elif sys.argv[i] == '--qty' and i + 1 < len(sys.argv):
            qty = int(sys.argv[i + 1]); i += 2
        elif sys.argv[i] == '--source' and i + 1 < len(sys.argv):
            source = sys.argv[i + 1]; i += 2
        elif sys.argv[i] == '--price' and i + 1 < len(sys.argv):
            price = int(sys.argv[i + 1]); i += 2
        elif sys.argv[i] == '--jsonfile' and i + 1 < len(sys.argv):
            fpath = sys.argv[i + 1]
            try:
                with open(fpath, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                product = data.get('product', '')
                qty = data.get('qty', 1)
                source = data.get('source', '')
                price = data.get('price', 0)
            except Exception as e:
                print(f"ERR:{e}")
                sys.exit(1)
            finally:
                try: os.unlink(fpath)
                except: pass
            i += 2
        else:
            i += 1
    
    if not product:
        print("ERR:상품명 필요")
        sys.exit(1)
    
    try:
        ok = register_on_pos(product, qty, source, price)
        sys.exit(0 if ok else 1)
    except Exception as e:
        print(f"ERR:{e}")
        import traceback
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)
