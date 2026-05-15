"""
OKPOS 영업정보시스템 크롤링 API v3 (정확한 XHR 파라미터)
==========================================================
NICE정보통신 웹 표준 버전 (nice.okpos.co.kr)
IBSheet + ddd.htmlSheetAction

실제 캡처된 XHR Payload:
  _CONTROLLER: sale.sale.prod011
  _METHOD: search
  _SHEETSEQ: 1
  _SAVENAME: sSeq|LCLS_NM|MCLS_NM|SCLS_NM|...
  date1_1: 2026-02-28
  date1_2: 2026-02-28

사용법:
  API 서버: python okpos_api_v3.py
  CLI:      python okpos_api_v3.py --cli --date 2026-02-28
  디버그:   python okpos_api_v3.py --cli --debug --date 2026-02-28
"""

import requests
from bs4 import BeautifulSoup
import xml.etree.ElementTree as ET
import pandas as pd
import json
import re
import sys
import os
import argparse
from datetime import datetime, timedelta
from typing import Optional, Dict, List, Any
from urllib.parse import urljoin, urlencode
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("okpos")


# ==============================================================
# IBSheet 컬럼 매핑 (SAVENAME → 한글)
# ==============================================================
COLUMN_MAP = {
    "sSeq":         "No",
    "LCLS_NM":      "대분류",
    "MCLS_NM":      "중분류",
    "SCLS_NM":      "소분류",
    "SALE_DATE":    "판매일자",
    "PROD_CD":      "상품코드",
    "BAR_CD":       "바코드",
    "MAP_PROD_CD":  "매핑코드",
    "PROD_NM":      "상품명",
    "VENDORS_NM":   "거래처",
    "COLOR_CD":     "색상코드",
    "SIZE_STR_CD":  "사이즈코드",
    "SALE_QTY":     "수량",
    "PROD_WEIGHT":  "중량",
    "TOT_SALE_AMT": "총매출액",
    "TOT_DC_AMT":   "총할인액",
    "DCM_SALE_AMT": "실매출액",
    "DC_AMT_GEN":   "일반할인",
    "DC_AMT_SVC":   "서비스금액",
    "DC_AMT_JCD":   "할인(제휴)",
    "DC_AMT_CPN":   "할인(쿠폰)",
    "DC_AMT_CST":   "할인(고객)",
    "DC_AMT_FOD":   "할인(음식)",
    "DC_AMT_PACK":  "할인(포장)",
    "DC_AMT_YAP":   "할인(얍)",
    "SHOP_CD":      "매장코드",
    "SHOP_NM":      "매장명",
}

# ==============================================================
# 매출 메뉴별 _CONTROLLER 매핑
# ==============================================================
CONTROLLERS = {
    # 매출관리 > 매출현황
    "상품별":         {"_CONTROLLER": "sale.sale.prod011",     "_SHEETSEQ": "1"},
    "상품매출순위":    {"_CONTROLLER": "sale.sale.prod012",     "_SHEETSEQ": "1"},
    "결제수단별":      {"_CONTROLLER": "sale.sale.pay011",      "_SHEETSEQ": "1"},
    "시간대별":        {"_CONTROLLER": "sale.sale.time011",     "_SHEETSEQ": "1"},
    "일자별":         {"_CONTROLLER": "sale.sale.date011",     "_SHEETSEQ": "1"},
    "당일매출종합":    {"_CONTROLLER": "sale.sale.daily011",    "_SHEETSEQ": "1"},
    "당일매출상세":    {"_CONTROLLER": "sale.sale.daily012",    "_SHEETSEQ": "1"},
    "요일별":         {"_CONTROLLER": "sale.sale.week011",     "_SHEETSEQ": "1"},
    "월별":           {"_CONTROLLER": "sale.sale.month011",    "_SHEETSEQ": "1"},
    "일기간":         {"_CONTROLLER": "sale.sale.period011",   "_SHEETSEQ": "1"},
    "브랜드별":       {"_CONTROLLER": "sale.sale.brand011",    "_SHEETSEQ": "1"},
    "포스별":         {"_CONTROLLER": "sale.sale.pos011",      "_SHEETSEQ": "1"},
    "매장상품별":     {"_CONTROLLER": "sale.sale.shopprod011", "_SHEETSEQ": "1"},
    "판매자별":       {"_CONTROLLER": "sale.sale.seller011",   "_SHEETSEQ": "1"},
    "주문자별":       {"_CONTROLLER": "sale.sale.order011",    "_SHEETSEQ": "1"},
    "거래처별":       {"_CONTROLLER": "sale.sale.vendor011",   "_SHEETSEQ": "1"},
    "바코드별":       {"_CONTROLLER": "sale.sale.barcode011",  "_SHEETSEQ": "1"},
    "반품현황":       {"_CONTROLLER": "sale.sale.return011",   "_SHEETSEQ": "1"},
    "할인구분별":     {"_CONTROLLER": "sale.sale.dc011",       "_SHEETSEQ": "1"},
}

# 상품별 매출의 _SAVENAME (전체 컬럼)
SAVENAME_PRODUCT = (
    "sSeq|LCLS_NM|MCLS_NM|SCLS_NM|SALE_DATE|PROD_CD|BAR_CD|"
    "MAP_PROD_CD|PROD_NM|VENDORS_NM|COLOR_CD|SIZE_STR_CD|"
    "SALE_QTY|PROD_WEIGHT|TOT_SALE_AMT|TOT_DC_AMT|DCM_SALE_AMT|"
    "DC_AMT_GEN|DC_AMT_SVC|DC_AMT_JCD|DC_AMT_CPN|DC_AMT_CST|"
    "DC_AMT_FOD|DC_AMT_PACK|DC_AMT_YAP|SHOP_CD"
)


class OKPOSClient:
    """OKPOS NICE정보통신 영업정보시스템 크롤러 (정확한 XHR 파라미터)"""

    BASE_URL = "https://nice.okpos.co.kr"
    SHEET_ACTION_URL = f"{BASE_URL}/ddd.htmlSheetAction"

    def __init__(self, user_id: str = "hhbq", password: str = "a2351267!!"):
        self.user_id = user_id
        self.password = password
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                          "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
            "Accept-Encoding": "gzip, deflate, br",
            "Connection": "keep-alive",
        })
        self.logged_in = False

    # ----------------------------------------------------------
    # 로그인
    # ----------------------------------------------------------
    def login(self) -> bool:
        """OKPOS 시스템 로그인"""
        try:
            # 1) 로그인 페이지 → JSESSIONID 쿠키 획득
            resp = self.session.get(f"{self.BASE_URL}/login/login_form.jsp", timeout=15)
            logger.info(f"로그인 페이지: {resp.status_code}")

            # 폼 파싱
            soup = BeautifulSoup(resp.text, "html.parser")
            form = soup.find("form")
            
            login_data = {}
            action_url = f"{self.BASE_URL}/login/loginProc.jsp"
            
            if form:
                action = form.get("action", "")
                if action:
                    action_url = urljoin(self.BASE_URL, action)
                
                for inp in form.find_all("input"):
                    name = inp.get("name")
                    if not name:
                        continue
                    t = inp.get("type", "text").lower()
                    if t == "hidden":
                        login_data[name] = inp.get("value", "")
                    elif t == "text":
                        login_data[name] = self.user_id
                    elif t == "password":
                        login_data[name] = self.password

            if not any(v == self.user_id for v in login_data.values()):
                login_data = {"userId": self.user_id, "userPw": self.password}

            # 2) 로그인 POST
            resp2 = self.session.post(action_url, data=login_data, timeout=15, allow_redirects=True)
            logger.info(f"로그인 POST: {resp2.status_code}")

            # 3) top_frame으로 로그인 확인
            resp3 = self.session.get(f"{self.BASE_URL}/login/top_frame.jsp", timeout=15)
            
            if "매출관리" in resp3.text or "기초관리" in resp3.text:
                self.logged_in = True
                logger.info("✅ OKPOS 로그인 성공")
                return True
            
            if "login_form" in resp3.url:
                logger.error("❌ 로그인 실패")
                return False

            self.logged_in = True
            return True

        except Exception as e:
            logger.error(f"❌ 로그인 오류: {e}")
            return False

    def _ensure_login(self):
        if not self.logged_in:
            if not self.login():
                raise Exception("로그인 실패")

    # ----------------------------------------------------------
    # 핵심: ddd.htmlSheetAction XHR 요청
    # ----------------------------------------------------------
    def _sheet_request(self, params: Dict[str, str]) -> str:
        """IBSheet ddd.htmlSheetAction POST 요청"""
        self._ensure_login()

        headers = {
            "X-Requested-With": "XMLHttpRequest",
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "Referer": f"{self.BASE_URL}/login/top_frame.jsp",
            "Accept": "*/*",
        }

        try:
            resp = self.session.post(
                self.SHEET_ACTION_URL,
                data=params,
                headers=headers,
                timeout=30,
            )
            if resp.status_code == 200:
                logger.info(f"✅ SheetAction 응답: {len(resp.text)}bytes")
                return resp.text
            else:
                logger.warning(f"SheetAction HTTP {resp.status_code}")
                return ""
        except Exception as e:
            logger.error(f"SheetAction 오류: {e}")
            return ""

    # ----------------------------------------------------------
    # 응답 파싱
    # ----------------------------------------------------------
    def _parse_response(self, text: str, savename: str = "") -> pd.DataFrame:
        """IBSheet 응답 파싱 (XML/JSON/파이프 구분)"""
        if not text or len(text.strip()) < 10:
            return pd.DataFrame()
        
        text = text.strip()
        if text.startswith('\ufeff'):
            text = text[1:]
        
        # XML
        if text.startswith("<") or text.startswith("<?"):
            return self._parse_xml(text)
        # JSON
        if text.startswith("{") or text.startswith("["):
            try:
                return self._parse_json(text)
            except:
                pass
        # 파이프 구분
        if "|" in text:
            return self._parse_pipe(text, savename)
        
        logger.warning(f"알 수 없는 응답 (200자): {text[:200]}")
        return pd.DataFrame()

    def _parse_xml(self, xml_text: str) -> pd.DataFrame:
        """IBSheet XML 파싱"""
        try:
            root = ET.fromstring(xml_text)
            rows = []
            
            # <Data><Sheet><Row .../></Sheet></Data>
            for row_el in root.iter("Row"):
                if row_el.attrib:
                    rows.append(dict(row_el.attrib))
            
            if not rows:
                for tag in ["row", "record", "data", "item"]:
                    for el in root.iter(tag):
                        if el.attrib:
                            rows.append(dict(el.attrib))
                        else:
                            row = {c.tag: (c.text or "") for c in el}
                            if row:
                                rows.append(row)
                    if rows:
                        break
            
            # 속성이 3개 이상인 모든 요소
            if not rows:
                for el in root.iter():
                    if len(el.attrib) >= 3:
                        rows.append(dict(el.attrib))

            if rows:
                df = pd.DataFrame(rows)
                logger.info(f"✅ XML: {len(df)}건, 컬럼: {list(df.columns)}")
                return df
            
            logger.warning(f"XML 데이터 없음. root={root.tag}")
            return pd.DataFrame()

        except ET.ParseError as e:
            logger.warning(f"XML 파싱 실패: {e}")
            return pd.DataFrame()

    def _parse_json(self, text: str) -> pd.DataFrame:
        data = json.loads(text)
        if isinstance(data, list):
            return pd.DataFrame(data)
        if isinstance(data, dict):
            for k in ["Data", "data", "rows", "Rows", "list", "result"]:
                if k in data and isinstance(data[k], list):
                    return pd.DataFrame(data[k])
        return pd.DataFrame()

    def _parse_pipe(self, text: str, savename: str = "") -> pd.DataFrame:
        """파이프 구분 텍스트"""
        lines = text.strip().split("\n")
        cols = savename.split("|") if savename else []
        rows = [line.split("|") for line in lines if line.strip()]
        if not rows:
            return pd.DataFrame()
        if not cols:
            cols = rows[0]
            rows = rows[1:]
        mc = max(len(cols), max(len(r) for r in rows))
        cols = (cols + [f"c{i}" for i in range(mc)])[:mc]
        rows = [(r + [""] * mc)[:mc] for r in rows]
        return pd.DataFrame(rows, columns=cols)

    # ----------------------------------------------------------
    # 데이터 정리
    # ----------------------------------------------------------
    def _clean(self, df: pd.DataFrame) -> pd.DataFrame:
        if df.empty:
            return df
        rename = {k: v for k, v in COLUMN_MAP.items() if k in df.columns}
        if rename:
            df = df.rename(columns=rename)
        for col in df.columns:
            if any(kw in col for kw in ["수량", "매출", "할인", "금액", "서비스", "건수", "AMT", "QTY", "CNT"]):
                df[col] = pd.to_numeric(
                    df[col].astype(str).str.replace(",", "").str.strip(),
                    errors="coerce"
                ).fillna(0).astype(int)
        return df

    # ----------------------------------------------------------
    # 매출 조회 메서드
    # ----------------------------------------------------------
    def get_sales_by_product(self, date_from=None, date_to=None, 
                              shop_cd="", shop_nm="전체",
                              prod_cd="", prod_nm="", bar_cd="",
                              lcls_cd="", cls_text="전체", vendor_cd="") -> pd.DataFrame:
        """매출관리 > 매출현황 > 상품별 (sale.sale.prod011)"""
        today = datetime.now().strftime("%Y-%m-%d")
        date_from = date_from or today
        date_to = date_to or today

        params = {
            "_CONTROLLER":  "sale.sale.prod011",
            "_METHOD":      "search",
            "_SHEETSEQ":    "1",
            "_SAVENAME":    SAVENAME_PRODUCT,
            "_ORDERBY":     "",
            "_PROD_FG":     "N",
            "date1_1":      date_from,
            "date1_2":      date_to,
            "date_period1": "366",
            "_PROD_CD":     prod_cd,
            "_PROD_NM":     prod_nm,
            "_LCLS_CD":     lcls_cd,
            "_MCLS_CD":     "",
            "_SCLS_CD":     "",
            "_SIZE_CLS_CD": "",
            "_CLS_TEXT":    cls_text,
            "_BAR_CD":      bar_cd,
            "_SHOP_CD":     shop_cd,
            "_SHOP_NM":     shop_nm,
            "_SHOP_INFO":   "",
            "_VENDOR_CD":   vendor_cd,
        }
        logger.info(f"📊 상품별: {date_from} ~ {date_to}")
        resp = self._sheet_request(params)
        return self._clean(self._parse_response(resp, SAVENAME_PRODUCT))

    def get_daily_summary(self, date=None) -> pd.DataFrame:
        """당일매출종합 (sale.sale.daily011)"""
        today = datetime.now().strftime("%Y-%m-%d")
        date = date or today
        params = {
            "_CONTROLLER": "sale.sale.daily011", "_METHOD": "search",
            "_SHEETSEQ": "1", "_SAVENAME": "",
            "date1_1": date, "date1_2": date,
            "_SHOP_CD": "", "_SHOP_NM": "전체",
        }
        resp = self._sheet_request(params)
        return self._clean(self._parse_response(resp))

    def get_sales_by_date(self, date_from=None, date_to=None) -> pd.DataFrame:
        """일자별 (sale.sale.date011)"""
        today = datetime.now().strftime("%Y-%m-%d")
        date_from = date_from or (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d")
        date_to = date_to or today
        params = {
            "_CONTROLLER": "sale.sale.date011", "_METHOD": "search",
            "_SHEETSEQ": "1", "_SAVENAME": "",
            "date1_1": date_from, "date1_2": date_to, "date_period1": "366",
            "_SHOP_CD": "", "_SHOP_NM": "전체",
        }
        resp = self._sheet_request(params)
        return self._clean(self._parse_response(resp))

    def get_sales_by_payment(self, date_from=None, date_to=None) -> pd.DataFrame:
        """결제수단별 (sale.sale.pay011)"""
        today = datetime.now().strftime("%Y-%m-%d")
        date_from = date_from or today
        date_to = date_to or today
        params = {
            "_CONTROLLER": "sale.sale.pay011", "_METHOD": "search",
            "_SHEETSEQ": "1", "_SAVENAME": "",
            "date1_1": date_from, "date1_2": date_to, "date_period1": "366",
            "_SHOP_CD": "", "_SHOP_NM": "전체",
        }
        resp = self._sheet_request(params)
        return self._clean(self._parse_response(resp))

    def get_sales_by_time(self, date_from=None, date_to=None) -> pd.DataFrame:
        """시간대별 (sale.sale.time011)"""
        today = datetime.now().strftime("%Y-%m-%d")
        date_from = date_from or today
        date_to = date_to or today
        params = {
            "_CONTROLLER": "sale.sale.time011", "_METHOD": "search",
            "_SHEETSEQ": "1", "_SAVENAME": "",
            "date1_1": date_from, "date1_2": date_to, "date_period1": "366",
            "_SHOP_CD": "", "_SHOP_NM": "전체",
        }
        resp = self._sheet_request(params)
        return self._clean(self._parse_response(resp))

    def get_sales_by_month(self, date_from=None, date_to=None) -> pd.DataFrame:
        """월별 (sale.sale.month011)"""
        today = datetime.now().strftime("%Y-%m-%d")
        date_from = date_from or (datetime.now() - timedelta(days=365)).strftime("%Y-%m-%d")
        date_to = date_to or today
        params = {
            "_CONTROLLER": "sale.sale.month011", "_METHOD": "search",
            "_SHEETSEQ": "1", "_SAVENAME": "",
            "date1_1": date_from, "date1_2": date_to, "date_period1": "366",
            "_SHOP_CD": "", "_SHOP_NM": "전체",
        }
        resp = self._sheet_request(params)
        return self._clean(self._parse_response(resp))

    def get_sales_ranking(self, date_from=None, date_to=None) -> pd.DataFrame:
        """상품매출순위 (sale.sale.prod012)"""
        today = datetime.now().strftime("%Y-%m-%d")
        date_from = date_from or today
        date_to = date_to or today
        params = {
            "_CONTROLLER": "sale.sale.prod012", "_METHOD": "search",
            "_SHEETSEQ": "1", "_SAVENAME": "",
            "date1_1": date_from, "date1_2": date_to, "date_period1": "366",
            "_SHOP_CD": "", "_SHOP_NM": "전체",
        }
        resp = self._sheet_request(params)
        return self._clean(self._parse_response(resp))

    def raw_request(self, controller, method="search", date_from=None, date_to=None, extra=None) -> str:
        """범용 요청 (원본 응답)"""
        today = datetime.now().strftime("%Y-%m-%d")
        params = {
            "_CONTROLLER": controller, "_METHOD": method,
            "_SHEETSEQ": "1", "_SAVENAME": "",
            "date1_1": date_from or today, "date1_2": date_to or today,
            "date_period1": "366", "_SHOP_CD": "", "_SHOP_NM": "전체",
        }
        if extra:
            params.update(extra)
        return self._sheet_request(params)

    # 내보내기
    def to_excel(self, df, filename=None):
        if not filename:
            filename = f"okpos_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
        df.to_excel(filename, index=False, engine="openpyxl")
        logger.info(f"📁 {filename}")
        return filename

    def to_json(self, df):
        return df.to_json(orient="records", force_ascii=False, indent=2)

    def to_dict(self, df):
        return json.loads(df.to_json(orient="records", force_ascii=False))


# ==============================================================
# FastAPI
# ==============================================================
def create_app():
    from fastapi import FastAPI, Query, HTTPException
    from fastapi.responses import FileResponse
    from fastapi.middleware.cors import CORSMiddleware

    app = FastAPI(
        title="OKPOS 매출 API",
        description="한국잠사플레이팜 [HHBQ] - IBSheet ddd.htmlSheetAction 기반",
        version="3.0.0",
    )
    app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
    client = OKPOSClient()

    def _resp(df, q=None):
        recs = client.to_dict(df) if not df.empty else []
        s = {}
        for c in ["수량","총매출액","총할인액","실매출액"]:
            if c in df.columns and pd.api.types.is_numeric_dtype(df[c]):
                s[c] = int(df[c].sum())
        return {"status":"ok","query":q or {},"count":len(recs),"summary":s,"data":recs}

    @app.get("/")
    def root():
        return {"service":"OKPOS API v3","store":"[HHBQ] 한국잠사플레이팜(주)",
                "docs":"GET /docs for Swagger UI"}

    @app.post("/login")
    def login():
        if client.login(): return {"status":"ok"}
        raise HTTPException(401,"로그인 실패")

    @app.get("/sales/product")
    def sp(date_from:str=Query(None),date_to:str=Query(None),
           shop_cd:str=Query(""),prod_cd:str=Query(""),prod_nm:str=Query(""),bar_cd:str=Query("")):
        df = client.get_sales_by_product(date_from,date_to,shop_cd=shop_cd,prod_cd=prod_cd,prod_nm=prod_nm,bar_cd=bar_cd)
        return _resp(df,{"date_from":date_from,"date_to":date_to})

    @app.get("/sales/product/excel")
    def spe(date_from:str=Query(None),date_to:str=Query(None)):
        df = client.get_sales_by_product(date_from,date_to)
        if df.empty: raise HTTPException(404)
        p = client.to_excel(df); return FileResponse(p,filename=os.path.basename(p))

    @app.get("/sales/daily")
    def sd(date:str=Query(None)):
        return _resp(client.get_daily_summary(date),{"date":date})

    @app.get("/sales/date")
    def sdt(date_from:str=Query(None),date_to:str=Query(None)):
        return _resp(client.get_sales_by_date(date_from,date_to))

    @app.get("/sales/payment")
    def spay(date_from:str=Query(None),date_to:str=Query(None)):
        return _resp(client.get_sales_by_payment(date_from,date_to))

    @app.get("/sales/time")
    def st(date_from:str=Query(None),date_to:str=Query(None)):
        return _resp(client.get_sales_by_time(date_from,date_to))

    @app.get("/sales/month")
    def sm(date_from:str=Query(None),date_to:str=Query(None)):
        return _resp(client.get_sales_by_month(date_from,date_to))

    @app.get("/sales/ranking")
    def sr(date_from:str=Query(None),date_to:str=Query(None)):
        return _resp(client.get_sales_ranking(date_from,date_to))

    @app.get("/debug/raw")
    def dr(controller:str=Query("sale.sale.prod011"),date_from:str=Query(None),date_to:str=Query(None)):
        r = client.raw_request(controller,"search",date_from,date_to)
        return {"controller":controller,"len":len(r),
                "type":"xml" if r.strip().startswith("<") else "other",
                "preview":r[:3000]}

    @app.get("/debug/controllers")
    def dc():
        return CONTROLLERS

    return app


# ==============================================================
# CLI
# ==============================================================
def main():
    p = argparse.ArgumentParser(description="OKPOS API v3")
    p.add_argument("--cli", action="store_true")
    p.add_argument("--port", type=int, default=8000)
    p.add_argument("--date", type=str)
    p.add_argument("--from", dest="df", type=str)
    p.add_argument("--to", dest="dt", type=str)
    p.add_argument("--type", choices=["product","daily","date","payment","time","month","ranking"], default="product")
    p.add_argument("--excel", action="store_true")
    p.add_argument("--json", action="store_true")
    p.add_argument("--debug", action="store_true")
    p.add_argument("--controller", type=str)
    a = p.parse_args()

    if not a.cli:
        import uvicorn
        app = create_app()
        print(f"🚀 OKPOS API → http://localhost:{a.port}/docs")
        uvicorn.run(app, host="0.0.0.0", port=a.port)
        return

    c = OKPOSClient()
    if not c.login(): print("❌ 로그인 실패"); sys.exit(1)

    df_, dt_ = a.date or a.df, a.date or a.dt

    if a.debug:
        ctrl = a.controller or CONTROLLERS.get(
            {"product":"상품별","daily":"당일매출종합","date":"일자별",
             "payment":"결제수단별","time":"시간대별","month":"월별","ranking":"상품매출순위"}[a.type],{}
        ).get("_CONTROLLER","sale.sale.prod011")
        r = c.raw_request(ctrl,"search",df_,dt_)
        print(f"\n🔍 {ctrl}\n📦 {len(r)}bytes\n{r[:5000]}")
        return

    fns = {
        "product": lambda: c.get_sales_by_product(df_,dt_),
        "daily":   lambda: c.get_daily_summary(df_),
        "date":    lambda: c.get_sales_by_date(df_,dt_),
        "payment": lambda: c.get_sales_by_payment(df_,dt_),
        "time":    lambda: c.get_sales_by_time(df_,dt_),
        "month":   lambda: c.get_sales_by_month(df_,dt_),
        "ranking": lambda: c.get_sales_ranking(df_,dt_),
    }
    df = fns[a.type]()

    if df.empty:
        print("⚠️ 결과 없음")
        print(f"💡 python okpos_api_v3.py --cli --debug --type {a.type} --date {df_ or '오늘'}")
        sys.exit(0)

    if a.json: print(c.to_json(df))
    elif a.excel: c.to_excel(df)
    else:
        pd.set_option('display.max_columns',None); pd.set_option('display.width',200)
        print(f"\n📊 {a.type} ({len(df)}건):\n{df.to_string(index=False)}")
        for col in ["수량","총매출액","실매출액","SALE_QTY","TOT_SALE_AMT","DCM_SALE_AMT"]:
            if col in df.columns and pd.api.types.is_numeric_dtype(df[col]):
                print(f"  {col}: {df[col].sum():,.0f}")

if __name__ == "__main__":
    main()
