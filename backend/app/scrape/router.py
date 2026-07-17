import json
from datetime import datetime
from pathlib import Path
from typing import Dict, List

import paramiko
import yaml
from fastapi import APIRouter, HTTPException

from app.config import settings
from app.db import get_db

router = APIRouter(prefix="/api/scrape", tags=["scrape"])


# ── SSH ──────────────────────────────────────────────────────

def _ssh_connect() -> paramiko.SSHClient:
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(settings.ssh_host, settings.ssh_port or 22,
                settings.ssh_user, settings.ssh_password, timeout=10)
    return ssh


def _ssh_exec(cmd: str) -> str:
    ssh = _ssh_connect()
    _, stdout, stderr = ssh.exec_command(cmd)
    out = stdout.read().decode().strip()
    err = stderr.read().decode().strip()
    ssh.close()
    if err and not out:
        raise HTTPException(502, detail=f"ssh_error: {err}")
    return out


def _ssh_read(path: str) -> str:
    ssh = _ssh_connect()
    try:
        sftp = ssh.open_sftp()
        with sftp.open(path, "r") as f:
            return f.read().decode()
    except FileNotFoundError:
        raise HTTPException(404, "file_not_found")
    except Exception as e:
        raise HTTPException(502, detail=f"ssh_read_failed: {e}")
    finally:
        ssh.close()


def _ssh_write(path: str, content: str) -> None:
    ssh = _ssh_connect()
    try:
        _ssh_exec(f"mkdir -p {Path(path).parent}")
        sftp = ssh.open_sftp()
        with sftp.open(path, "w") as f:
            f.write(content.encode())
        sftp.close()
    except Exception as e:
        raise HTTPException(502, detail=f"ssh_write_failed: {e}")
    finally:
        ssh.close()


def _ssh_rm(path: str) -> None:
    try:
        _ssh_exec(f"rm -f {path}")
    except Exception:
        pass


def _ssh_mv(src: str, dst: str) -> None:
    try:
        _ssh_exec(f"mkdir -p {Path(dst).parent} && mv {src} {dst}")
    except Exception:
        raise HTTPException(502, detail="ssh_move_failed")


# ── YAML ─────────────────────────────────────────────────────

def _build_yaml(entries: List[dict]) -> str:
    """生成 YAML，每条记录一个 - targets: [...] 块"""
    docs = []
    for e in entries:
        docs.append({"targets": [e["target"]], "labels": e.get("labels", {}) or {}})
    return yaml.dump(docs, default_flow_style=False, allow_unicode=True)


def _parse_yaml_entries(content: str) -> List[dict]:
    """解析 YAML，返回 [{target: str, labels: dict}] 每条一个 target"""
    try:
        parsed = yaml.safe_load(content) or []
        result = []
        for item in parsed if isinstance(parsed, list) else [parsed]:
            if not isinstance(item, dict):
                continue
            targets = item.get("targets", [])
            labels = item.get("labels", {}) or {}
            if isinstance(targets, list):
                for t in targets:
                    result.append({"target": str(t), "labels": labels})
        return result
    except Exception:
        return []


# ── SSH 扫描目录，按单条 target 返回 ─────────────────────────

def _scan_remote() -> List[dict]:
    """返回 [{department, category, target, labels}]"""
    base = settings.prometheus_targets_dir
    try:
        raw = _ssh_exec(f"ls -1 {base}")
    except Exception:
        return []
    if not raw:
        return []

    rows = []
    for line in raw.split("\n"):
        dept = line.strip()
        if not dept:
            continue
        dp = f"{base}/{dept}"
        try:
            if _ssh_exec(f"test -d '{dp}' && echo 1 || echo 0") != "1":
                continue
            files_raw = _ssh_exec(f"ls -1 {dp}/*.yaml 2>/dev/null || true")
            if not files_raw:
                continue
        except Exception:
            continue

        for fn in files_raw.split("\n"):
            fn = fn.strip().rsplit("/", 1)[-1]
            if not fn or not fn.endswith(".yaml"):
                continue
            cat = fn[:-5]
            try:
                content = _ssh_read(f"{dp}/{fn}")
                entries = _parse_yaml_entries(content)
            except Exception:
                continue
            for e in entries:
                rows.append({
                    "department": dept,
                    "category": cat,
                    "target": e["target"],
                    "labels": e["labels"],
                })
    return rows


# ── 按 department+category 聚合后写 YAML ───────────────────

def _sync_yaml(dept: str, cat: str) -> None:
    base = settings.prometheus_targets_dir
    yp = f"{base}/{dept}/{cat}.yaml"
    dp = f"{base}/{dept}/{cat}.yaml.disabled"

    try:
        with get_db(readonly=True) as conn:
            cur = conn.cursor()
            cur.execute("SELECT target, labels FROM scrape_targets WHERE department=%s AND category=%s AND status=1",
                         (dept, cat))
            active = [{"target": r[0], "labels": json.loads(r[1]) if r[1] else {}}
                      for r in cur.fetchall()]
            cur.execute("SELECT COUNT(*) FROM scrape_targets WHERE department=%s AND category=%s AND status=0",
                         (dept, cat))
            has_disabled = cur.fetchone()[0] > 0
            cur.close()

        if active:
            _ssh_write(yp, _build_yaml(active))
            _ssh_rm(dp)
        elif has_disabled:
            _ssh_rm(yp)
        else:
            _ssh_rm(yp)
            _ssh_rm(dp)
    except Exception:
        pass


# ── 首次同步 ────────────────────────────────────────────────

def _ensure_synced() -> None:
    try:
        with get_db(readonly=True) as conn:
            cur = conn.cursor()
            cur.execute("SELECT COUNT(*) FROM scrape_targets")
            if cur.fetchone()[0] > 0:
                return
            cur.close()
    except Exception:
        pass

    rows = _scan_remote()
    if not rows:
        return

    now = datetime.now()
    with get_db(readonly=False) as conn:
        cur = conn.cursor()
        for r in rows:
            try:
                cur.execute(
                    "INSERT INTO scrape_targets (department, category, target, labels, status, description, operator, created_at, updated_at) "
                    "VALUES (%s,%s,%s,%s,1,%s,%s,%s,%s)",
                    (r["department"], r["category"], r["target"],
                     json.dumps(r["labels"], ensure_ascii=False),
                     "首次扫描同步", "system", now, now),
                )
            except Exception:
                pass
        cur.close()


# ── API ──────────────────────────────────────────────────────

@router.get("/targets")
async def list_targets() -> List[dict]:
    _ensure_synced()
    try:
        with get_db(readonly=True) as conn:
            cur = conn.cursor()
            cur.execute(
                "SELECT id, department, category, target, labels, status, description, operator, created_at "
                "FROM scrape_targets WHERE status != -1 ORDER BY department, category, id")
            return [
                {"id": r[0], "department": r[1], "category": r[2],
                 "target": r[3],
                 "labels": json.loads(r[4]) if r[4] else {},
                 "status": r[5], "description": r[6] or "",
                 "operator": r[7] or "", "createdAt": str(r[8] or "")}
                for r in cur.fetchall()
            ]
    except Exception as e:
        raise HTTPException(502, detail=f"db_error: {e}")


@router.get("/departments")
async def list_departments() -> List[str]:
    _ensure_synced()
    try:
        with get_db(readonly=True) as conn:
            cur = conn.cursor()
            cur.execute("SELECT DISTINCT department FROM scrape_targets WHERE status != -1 ORDER BY department")
            rows = [r[0] for r in cur.fetchall()]
            cur.close()
            return rows
    except Exception as e:
        raise HTTPException(502, detail=f"db_error: {e}")


@router.get("/categories")
async def list_categories() -> List[dict]:
    """返回所有 {department, category, count}"""
    _ensure_synced()
    try:
        with get_db(readonly=True) as conn:
            cur = conn.cursor()
            cur.execute(
                "SELECT department, category, COUNT(*) as cnt FROM scrape_targets WHERE status != -1 GROUP BY department, category ORDER BY department, category")
            rows = [{"department": r[0], "category": r[1], "count": r[2]} for r in cur.fetchall()]
            cur.close()
            return rows
    except Exception as e:
        raise HTTPException(502, detail=f"db_error: {e}")


@router.post("/targets")
async def create_target(body: dict) -> dict:
    department = body.get("department", "").strip()
    category = body.get("category", "").strip()
    target = body.get("target", "").strip()
    labels = body.get("labels", {}) or {}
    description = body.get("description", "") or ""

    if not department or not category or not target:
        raise HTTPException(400, detail="department, category and target required")
    if ".." in target or "/" in target:
        raise HTTPException(400, detail="invalid target")

    now = datetime.now()
    try:
        with get_db(readonly=False) as conn:
            cur = conn.cursor()
            # 检查同 department+category 是否有 labels 记录，没有则用新传入的
            cur.execute("SELECT labels FROM scrape_targets WHERE department=%s AND category=%s AND status != -1 LIMIT 1",
                         (department, category))
            existing = cur.fetchone()
            labels_json = existing[0] if existing and existing[0] else json.dumps(labels, ensure_ascii=False)

            cur.execute(
                "INSERT INTO scrape_targets (department, category, target, labels, status, description, operator, created_at, updated_at) "
                "VALUES (%s,%s,%s,%s,1,%s,%s,%s,%s)",
                (department, category, target, labels_json, description, "admin", now, now))
            new_id = cur.lastrowid
            cur.close()
    except Exception as e:
        raise HTTPException(400, detail=str(e))

    _sync_yaml(department, category)
    return {"id": new_id, "status": "created"}


@router.put("/targets/{tid}")
async def update_target(tid: int, body: dict) -> dict:
    target = body.get("target", "").strip()
    labels = body.get("labels")
    description = body.get("description")

    try:
        with get_db(readonly=False) as conn:
            cur = conn.cursor()
            cur.execute("SELECT department, category FROM scrape_targets WHERE id=%s AND status != -1", (tid,))
            row = cur.fetchone()
            if not row:
                raise HTTPException(404, detail="not found")
            dept, cat = row

            sets = []
            params = []
            if target:
                sets.append("target=%s")
                params.append(target)
            if labels is not None:
                labels_json = json.dumps(labels, ensure_ascii=False)
                sets.append("labels=%s")
                params.append(labels_json)
            if description is not None:
                sets.append("description=%s")
                params.append(description)
            sets.append("updated_at=%s")
            params.append(datetime.now())
            params.append(tid)

            cur.execute(f"UPDATE scrape_targets SET {','.join(sets)} WHERE id=%s", params)
            cur.close()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(400, detail=str(e))

    _sync_yaml(dept, cat)
    return {"status": "updated"}


@router.delete("/targets/{tid}")
async def delete_target(tid: int) -> dict:
    try:
        with get_db(readonly=False) as conn:
            cur = conn.cursor()
            cur.execute("SELECT department, category FROM scrape_targets WHERE id=%s AND status != -1", (tid,))
            row = cur.fetchone()
            if not row:
                raise HTTPException(404, detail="not found")
            dept, cat = row
            cur.execute("UPDATE scrape_targets SET status=-1 WHERE id=%s", (tid,))
            cur.close()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(400, detail=str(e))

    _sync_yaml(dept, cat)
    return {"status": "deleted"}


@router.post("/targets/{tid}/toggle")
async def toggle_target(tid: int) -> dict:
    try:
        with get_db(readonly=False) as conn:
            cur = conn.cursor()
            cur.execute("SELECT department, category, status FROM scrape_targets WHERE id=%s AND status != -1", (tid,))
            row = cur.fetchone()
            if not row:
                raise HTTPException(404, detail="not found")
            dept, cat, cur_st = row
            new_st = 0 if cur_st == 1 else 1
            cur.execute("UPDATE scrape_targets SET status=%s WHERE id=%s", (new_st, tid))
            cur.close()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(400, detail=str(e))

    _sync_yaml(dept, cat)
    return {"status": "disabled" if new_st == 0 else "enabled"}


@router.post("/sync")
async def sync_from_server() -> dict:
    rows = _scan_remote()
    if not rows:
        return {"synced": 0, "departments": 0}

    now = datetime.now()
    depts = set()
    synced = 0
    with get_db(readonly=False) as conn:
        cur = conn.cursor()
        for r in rows:
            try:
                cur.execute(
                    "SELECT id FROM scrape_targets WHERE department=%s AND category=%s AND target=%s AND status != -1",
                    (r["department"], r["category"], r["target"]))
                if cur.fetchone():
                    cur.execute("UPDATE scrape_targets SET labels=%s, updated_at=%s WHERE department=%s AND category=%s AND target=%s",
                                 (json.dumps(r["labels"], ensure_ascii=False), now,
                                  r["department"], r["category"], r["target"]))
                else:
                    cur.execute(
                        "INSERT INTO scrape_targets (department, category, target, labels, status, description, operator, created_at, updated_at) "
                        "VALUES (%s,%s,%s,%s,1,%s,%s,%s,%s)",
                        (r["department"], r["category"], r["target"],
                         json.dumps(r["labels"], ensure_ascii=False),
                         "服务器同步", "system", now, now))
                depts.add(r["department"])
                synced += 1
            except Exception:
                pass
        cur.close()
    return {"synced": synced, "departments": len(depts)}
