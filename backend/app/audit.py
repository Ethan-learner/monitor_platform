"""审计日志写入模块"""
from datetime import datetime

from app.db import get_db


def log_audit(operator: str, module: str, action: str, target: str = "", detail: str = ""):
    """写入一条审计日志。"""
    try:
        with get_db(readonly=False) as conn:
            cur = conn.cursor()
            cur.execute(
                "INSERT INTO audit_log (operator, module, action, target, detail, created_at) VALUES (%s, %s, %s, %s, %s, %s)",
                (operator, module, action, target, detail, datetime.now()),
            )
    except Exception as e:
        print(f"[audit] write failed: {e}")
