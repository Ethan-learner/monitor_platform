"""MySQL 元数据库连接模块 (读写分离)"""
import pymysql
from contextlib import contextmanager
from typing import Optional

from app.config import settings


def _connect(readonly: bool = False) -> pymysql.Connection:
    return pymysql.connect(
        host=settings.mysql_read_host if readonly else settings.mysql_write_host,
        port=settings.mysql_read_port if readonly else settings.mysql_write_port,
        user=settings.mysql_user,
        password=settings.mysql_password,
        database=settings.mysql_database,
        charset="utf8mb4",
        autocommit=True,
    )


@contextmanager
def get_db(readonly: bool = False):
    """获取数据库连接（自动关闭）"""
    conn: Optional[pymysql.Connection] = None
    try:
        conn = _connect(readonly)
        yield conn
    finally:
        if conn:
            conn.close()
