# -*- coding: utf-8 -*-
"""카카오톡 PC 자동 발송 헬퍼 v5
포커스 강제 전환 강화 + 브라우저 검색 방지
"""
import sys, time, os

if sys.platform == 'win32':
    try:
        import io
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')
    except: pass

def ensure_deps():
    try:
        import pyautogui, pyperclip
        return pyautogui, pyperclip
    except ImportError:
        import subprocess
        subprocess.check_call([sys.executable, '-m', 'pip', 'install', 'pyautogui', 'pyperclip', 'Pillow', '-q'],
                              stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        import pyautogui, pyperclip
        return pyautogui, pyperclip

def send(room_name, message=None, image_path=None):
    import ctypes, ctypes.wintypes
    pyautogui, pyperclip = ensure_deps()
    pyautogui.FAILSAFE = False
    pyautogui.PAUSE = 0.15

    user32 = ctypes.windll.user32
    kernel32 = ctypes.windll.kernel32
    WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.wintypes.BOOL, ctypes.wintypes.HWND, ctypes.wintypes.LPARAM)

    def get_text(hwnd):
        n = user32.GetWindowTextLengthW(hwnd)
        if n == 0: return ""
        buf = ctypes.create_unicode_buffer(n + 1)
        user32.GetWindowTextW(hwnd, buf, n + 1)
        return buf.value

    def get_class(hwnd):
        buf = ctypes.create_unicode_buffer(256)
        user32.GetClassNameW(hwnd, buf, 256)
        return buf.value

    def force_activate(hwnd):
        """강제 포커스 전환 (브라우저에서 카카오톡으로 확실히 전환)"""
        # 1) 최소화 복원
        if user32.IsIconic(hwnd):
            user32.ShowWindow(hwnd, 9)  # SW_RESTORE
            time.sleep(0.5)
        
        # 2) 현재 포그라운드 스레드 → 대상 스레드 연결
        fg = user32.GetForegroundWindow()
        fg_tid = user32.GetWindowThreadProcessId(fg, None)
        my_tid = user32.GetWindowThreadProcessId(hwnd, None)
        
        if fg_tid != my_tid:
            user32.AttachThreadInput(fg_tid, my_tid, True)
        
        # 3) 윈도우를 최상위로
        user32.BringWindowToTop(hwnd)
        user32.ShowWindow(hwnd, 5)  # SW_SHOW
        time.sleep(0.1)
        
        # 4) SetForegroundWindow
        user32.SetForegroundWindow(hwnd)
        time.sleep(0.2)
        
        # 5) Alt 키로 포커스 강제
        user32.keybd_event(0x12, 0, 0, 0)  # Alt down
        time.sleep(0.05)
        user32.keybd_event(0x12, 0, 2, 0)  # Alt up
        time.sleep(0.1)
        user32.SetForegroundWindow(hwnd)
        time.sleep(0.3)
        
        # 6) 스레드 연결 해제
        if fg_tid != my_tid:
            user32.AttachThreadInput(fg_tid, my_tid, False)
        
        # 7) 포커스 확인
        time.sleep(0.3)
        cur_fg = user32.GetForegroundWindow()
        if cur_fg == hwnd:
            return True
        
        # 8) 재시도
        user32.SetForegroundWindow(hwnd)
        time.sleep(0.5)
        return user32.GetForegroundWindow() == hwnd

    def is_focused(hwnd):
        return user32.GetForegroundWindow() == hwnd

    def find_chat_window(name):
        exact = []
        partial = []
        name_clean = name.replace('[', '').replace(']', '').strip()
        
        def cb(h, _):
            if user32.IsWindowVisible(h):
                t = get_text(h)
                if not t: return True
                cls = get_class(h)
                # 브라우저 창 제외
                if cls in ('Chrome_WidgetWin_1', 'MozillaWindowClass', 'IEFrame'): return True
                if t == name: exact.append(h)
                elif name in t: partial.append(h)
                t_clean = t.replace('[', '').replace(']', '').strip()
                if name_clean and name_clean in t_clean and h not in exact and h not in partial:
                    partial.append(h)
            return True
        user32.EnumWindows(WNDENUMPROC(cb), 0)
        if exact: return exact[0]
        if partial: return partial[0]
        return None

    def find_kakao_main():
        results = []
        def cb(h, _):
            if user32.IsWindowVisible(h):
                t = get_text(h)
                cls = get_class(h)
                if t == '\uce74\uce74\uc624\ud1a1' or (cls in ('EVA_Window_Dblclk', 'EVA_Window') and '\uce74\uce74\uc624\ud1a1' in t):
                    results.append(h)
            return True
        user32.EnumWindows(WNDENUMPROC(cb), 0)
        return results[0] if results else None

    def send_text(text):
        pyperclip.copy(text)
        time.sleep(0.2)
        pyautogui.hotkey('ctrl', 'v')
        time.sleep(0.3)
        pyautogui.press('enter')
        time.sleep(0.5)

    def send_image(img_path):
        try:
            from PIL import Image
            import io as iox
            img = Image.open(img_path)
            if img.mode != 'RGBA': img = img.convert('RGBA')
            output = iox.BytesIO()
            img.save(output, 'BMP')
            bmp_data = output.getvalue()[14:]
            CF_DIB = 8
            GMEM_MOVEABLE = 0x0002
            for _ in range(3):
                if user32.OpenClipboard(0): break
                time.sleep(0.3)
            else: return False
            user32.EmptyClipboard()
            h_mem = kernel32.GlobalAlloc(GMEM_MOVEABLE, len(bmp_data))
            p_mem = kernel32.GlobalLock(h_mem)
            ctypes.memmove(p_mem, bmp_data, len(bmp_data))
            kernel32.GlobalUnlock(h_mem)
            user32.SetClipboardData(CF_DIB, h_mem)
            user32.CloseClipboard()
            time.sleep(0.3)
            pyautogui.hotkey('ctrl', 'v')
            time.sleep(1.5)
            pyautogui.press('enter')
            time.sleep(1)
            return True
        except Exception as e:
            print(f"IMG_ERR:{e}", file=sys.stderr)
            return False

    # 검색 키워드 (대괄호 제거)
    import re
    search_name = room_name
    if '[' in room_name and ']' in room_name:
        after = re.sub(r'\[.*?\]', '', room_name).strip()
        if after and len(after) >= 2:
            search_name = after

    # ═══ 전략 1: 이미 열린 채팅방 ═══
    chat = find_chat_window(room_name)
    if chat:
        print("[1] chat found", file=sys.stderr)
        force_activate(chat)
        time.sleep(0.3)
        if message: send_text(message)
        if image_path and os.path.exists(image_path):
            time.sleep(0.5)
            send_image(image_path)
        user32.ShowWindow(chat, 6)
        print("OK")
        return True

    # ═══ 전략 2: 카카오톡 메인 → 검색 ═══
    kakao = find_kakao_main()
    if not kakao:
        print("ERR:KakaoTalk not running")
        return False

    print(f"[2] main search: '{search_name}'", file=sys.stderr)
    
    # ★ 핵심: force_activate로 카카오톡에 확실히 포커스
    force_activate(kakao)
    time.sleep(0.5)
    
    # 포커스 확인
    if not is_focused(kakao):
        print("[!] focus retry", file=sys.stderr)
        force_activate(kakao)
        time.sleep(0.5)
    
    # ESC로 초기화
    pyautogui.press('escape')
    time.sleep(0.3)
    pyautogui.press('escape')
    time.sleep(0.3)
    
    # ★ 포커스 재확인 후 Ctrl+F
    force_activate(kakao)
    time.sleep(0.3)
    
    pyautogui.hotkey('ctrl', 'f')
    time.sleep(1.0)
    
    pyperclip.copy(search_name)
    time.sleep(0.1)
    pyautogui.hotkey('ctrl', 'a')
    time.sleep(0.1)
    pyautogui.hotkey('ctrl', 'v')
    time.sleep(1.5)
    pyautogui.press('enter')
    time.sleep(2.0)

    chat2 = find_chat_window(room_name)
    if chat2:
        print("[2] opened", file=sys.stderr)
        force_activate(chat2)
        time.sleep(0.3)
        if message: send_text(message)
        if image_path and os.path.exists(image_path):
            time.sleep(0.5)
            send_image(image_path)
        print("OK")
        return True

    # ═══ 전략 3: 채팅 탭 ═══
    print("[3] chat tab", file=sys.stderr)
    force_activate(kakao)
    time.sleep(0.3)
    pyautogui.press('escape')
    time.sleep(0.3)

    rect = ctypes.wintypes.RECT()
    user32.GetWindowRect(kakao, ctypes.byref(rect))
    kw = rect.right - rect.left
    kh = rect.bottom - rect.top
    pyautogui.click(rect.left + int(kw * 0.14), rect.top + int(kh * 0.04))
    time.sleep(0.5)

    # 포커스 재확인
    force_activate(kakao)
    time.sleep(0.3)
    
    pyautogui.hotkey('ctrl', 'f')
    time.sleep(0.5)
    pyperclip.copy(search_name)
    pyautogui.hotkey('ctrl', 'a')
    time.sleep(0.1)
    pyautogui.hotkey('ctrl', 'v')
    time.sleep(1.5)
    pyautogui.press('enter')
    time.sleep(2.0)

    chat3 = find_chat_window(room_name)
    if chat3:
        print("[3] opened", file=sys.stderr)
        force_activate(chat3)
        time.sleep(0.3)
        if message: send_text(message)
        if image_path and os.path.exists(image_path):
            time.sleep(0.5)
            send_image(image_path)
        print("OK")
        return True

    # ═══ 전략 4: 더블클릭 ═══
    print("[4] dblclick", file=sys.stderr)
    force_activate(kakao)
    time.sleep(0.3)
    pyautogui.doubleClick(rect.left + int(kw * 0.5), rect.top + int(kh * 0.22))
    time.sleep(2.0)

    chat4 = find_chat_window(room_name)
    if chat4:
        print("[4] opened", file=sys.stderr)
        force_activate(chat4)
        time.sleep(0.3)
        if message: send_text(message)
        if image_path and os.path.exists(image_path):
            time.sleep(0.5)
            send_image(image_path)
        print("OK")
        return True

    print(f"ERR:failed to open '{room_name}' - open the chat room in KakaoTalk first")
    return False

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("ERR:args")
        sys.exit(1)

    room = sys.argv[1]
    message = None
    image_path = None
    i = 2
    while i < len(sys.argv):
        if sys.argv[i] == '--file' and i + 1 < len(sys.argv):
            try:
                with open(sys.argv[i + 1], 'r', encoding='utf-8') as f: message = f.read()
            except Exception as e:
                print(f"ERR:file:{e}"); sys.exit(1)
            i += 2
        elif sys.argv[i] == '--image' and i + 1 < len(sys.argv):
            image_path = sys.argv[i + 1]; i += 2
        else:
            if not message: message = sys.argv[i]
            i += 1

    if not message and not image_path:
        print("ERR:no message"); sys.exit(1)

    try:
        ok = send(room, message, image_path)
        sys.exit(0 if ok else 1)
    except Exception as e:
        print(f"ERR:{e}"); sys.exit(1)
