import asyncio
import json
import os
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

import paramiko
import yaml
from fastapi import APIRouter, HTTPException

from app.config import settings
from app.db import get_db

router = APIRouter(prefix="/api/scrape", tags=["scrape"])


# ── SSH 连接 ──────────────────────────────────────────────────

def _ssh_connect() -> paramiko.SSHClient:
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(
        settings.ssh_host, port=settings.ssh_port or 22,
        username=settings.ssh_user, password=settings.ssh_password,
        timeout=10,
    )
    return ssh


def _ssh_exec(cmd: str) -> str:
    ssh = _ssh_connect()
    _, stdout, stderr = ssh.exec_command(cmd)
    out = stdout.read().decode("utf-8", errors="replace").strip()
    err = stderr.read().decode("utf-8", errors="replace").strip()
    ssh.close()
    if err and not out:
        raise HTTPException(status_code=502, detail=f"ssh_error: {err}")
    return out


def _ssh_read_file(path: str) -> str:
    ssh = _ssh_connect()
    try:
        sftp = ssh.open_sftp()
        with sftp.open(path, "r") as f:
            content = f.read().decode("utf-8")
        sftp.close()
        ssh.close()
        return content
    except FileNotFoundError:
        ssh.close()
        raise HTTPException(status_code=404, detail="file_not_found")
    except Exception as e:
        ssh.close()
        raise HTTPException(status_code=502, detail=f"ssh_read_failed: {e}")


def _ssh_write_file(path: str, content: str) -> None:
    ssh = _ssh_connect()
    try:
        dir_path = str(Path(path).parent)
        _ssh_exec(f"mkdir -p {dir_path}")
        sftp = ssh.open_sftp()
        with sftp.open(path, "w") as f:
            f.write(content.encode("utf-8"))
        sftp.close()
        ssh.close()
    except Exception as e:
        ssh.close()
        raise HTTPException(status_code=502, detail=f"ssh_write_failed: {e}")


def _ssh_remove(path: str) -> None:
    try:
        _ssh_exec(f"rm -f {path}")
    except Exception:
        pass


def _ssh_move(src: str, dst: str) -> None:
    try:
        dir_path = str(Path(dst).parent)
        _ssh_exec(f"mkdir -p {dir_path} && mv {src} {dst}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"ssh_move_failed: {e}")


# ── 扫描服务器现有目录结构 ─────────────────────────────────────

def _scan_remote_dirs() -> Dict[str, List[dict]]:
    """扫描 prometheus_targets_dir 下的目录和 YAML 文件，返回 {部门: [{category, targets, labels}]}"""
    base = settings.prometheus_targets_dir
    result: Dict[str, List[dict]] = {}
    try:
        raw = _ssh_exec(f"ls -1 {base}")
        if not raw:
            return result
    except Exception:
        return result

    for line in raw.split("\n"):
        dept = line.strip()
        if not dept:
            continue
        dept_path = f"{base}/{dept}"
        try:
            # 判断是否为目录
            out = _ssh_exec(f"test -d '{dept_path}' && echo 1 || echo 0")
            if out != "1":
                continue
            # 列出该目录下的 .yaml 文件（路径不引号，否则 glob 不展开）
            files_raw = _ssh_exec(f"ls -1 {dept_path}/*.yaml 2>/dev/null || true")
            if not files_raw:
                continue
        except Exception:
            continue

        files_list: List[dict] = []
        for fname in files_raw.split("\n"):
            fname = fname.strip().rsplit("/", 1)[-1]
            if not fname or not fname.endswith(".yaml"):
                continue
            category = fname[:-5]
            try:
                content = _ssh_read_file(f"{dept_path}/{fname}")
                parsed = yaml.safe_load(content) or []
                targets = []
                labels = {}
                for item in parsed if isinstance(parsed, list) else [parsed]:
                    if isinstance(item, dict):
                        t = item.get("targets", [])
                        if isinstance(t, list):
                            targets.extend(t)
                        labels = item.get("labels", {}) or {}
            except Exception:
                continue
            files_list.append({
                "category": category,
                "targets": targets,
                "labels": labels,
            })
        if files_list:
            result[dept] = files_list
    return result


# ── YAML 文件内容生成 ──────────────────────────────────────────

def _build_yaml(targets: List[str], labels: dict) -> str:
    doc = [{"targets": targets, "labels": labels or {}}]
    return yaml.dump(doc, default_flow_style=False, allow_unicode=True)


# ── 从 MySQL 读取（兼容首次从 SSH 同步到 MySQL） ───────────────

def _ensure_synced() -> None:
    """检查 scrape_targets 表是否有数据，没有则从 SSH 扫描同步"""
    try:
        with get_db(readonly=True) as conn:
            cur = conn.cursor()
            cur.execute("SELECT COUNT(*) FROM scrape_targets")
            count = cur.fetchone()[0]
            cur.close()
        if count > 0:
            return
    except Exception:
        pass

    # 首次同步：从 SSH 扫描写入 MySQL
    remote = _scan_remote_dirs()
    if not remote:
        return

    now = datetime.now()
    with get_db(readonly=False) as conn:
        cur = conn.cursor()
        for dept, files in remote.items():
            for f in files:
                try:
                    cur.execute(
                        "INSERT INTO scrape_targets (department, category, targets, labels, status, description, operator, created_at, updated_at) "
                        "VALUES (%s,%s,%s,%s,1,%s,%s,%s,%s)",
                        (dept, f["category"],
                         json.dumps(f["targets"], ensure_ascii=False),
                         json.dumps(f["labels"], ensure_ascii=False),
                         f"首次扫描同步", "system", now, now),
                    )
                except Exception:
                    pass
        cur.close()


# ── SSH 同步（每次 CRUD 后写回 YAML） ──────────────────────────

def _sync_yaml_target(dept: str, category: str, targets: List[str], labels: dict, status: int) -> None:
    base = settings.prometheus_targets_dir
    dept_dir = os.path.join(base, dept)
    yaml_path = os.path.join(dept_dir, f"{category}.yaml")
    disabled_path = os.path.join(dept_dir, f"{category}.yaml.disabled")

    if status == -1:
        _ssh_remove(yaml_path)
        _ssh_remove(disabled_path)
    elif status == 0:
        try:
            _ssh_exec(f"mv {yaml_path} {disabled_path}")
        except Exception:
            pass
    else:
        content = _build_yaml(targets, labels)
        _ssh_write_file(yaml_path, content)
        try:
            _ssh_exec(f"test -f {disabled_path} && mv {disabled_path} {yaml_path} || true")
        except Exception:
            pass


# ── API ───────────────────────────────────────────────────────

@router.get("/targets")
async def list_targets() -> List[dict]:
    """列表（MySQL），首次自动从 SSH 同步"""
    _ensure_synced()
    try:
        with get_db(readonly=True) as conn:
            cur = conn.cursor()
            cur.execute(
                "SELECT id, department, category, targets, labels, status, description, operator, created_at, updated_at "
                "FROM scrape_targets WHERE status != -1 ORDER BY department, category"
            )
            rows = cur.fetchall()
            cur.close()
            return [
                {
                    "id": r[0], "department": r[1], "category": r[2],
                    "targets": json.loads(r[3]) if r[3] else [],
                    "labels": json.loads(r[4]) if r[4] else {},
                    "status": r[5], "description": r[6] or "",
                    "operator": r[7] or "", "createdAt": str(r[8] or ""),
                }
                for r in rows
            ]
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"db_error: {e}")


@router.get("/departments")
async def list_departments() -> List[str]:
    """获取所有部门名"""
    _ensure_synced()
    try:
        with get_db(readonly=True) as conn:
            cur = conn.cursor()
            cur.execute("SELECT DISTINCT department FROM scrape_targets WHERE status != -1 ORDER BY department")
            rows = [r[0] for r in cur.fetchall()]
            cur.close()
            return rows
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"db_error: {e}")


@router.post("/targets")
async def create_target(body: dict) -> dict:
    """创建抓取配置"""
    department = body.get("department", "").strip()
    category = body.get("category", "").strip()
    targets = body.get("targets", [])
    labels = body.get("labels", {}) or {}
    description = body.get("description", "") or ""

    if not department or not category:
        raise HTTPException(status_code=400, detail="department and category required")
    if ".." in category or "/" in category:
        raise HTTPException(status_code=400, detail="invalid category name")

    try:
        with get_db(readonly=False) as conn:
            cur = conn.cursor()
            cur.execute("SELECT id FROM scrape_targets WHERE department=%s AND category=%s AND status != -1", (department, category))
            if cur.fetchone():
                raise HTTPException(status_code=409, detail=f"category '{category}' already exists in {department}")
            now = datetime.now()
            cur.execute(
                "INSERT INTO scrape_targets (department, category, targets, labels, status, description, operator, created_at, updated_at) "
                "VALUES (%s,%s,%s,%s,1,%s,%s,%s,%s)",
                (department, category,
                 json.dumps(targets, ensure_ascii=False),
                 json.dumps(labels, ensure_ascii=False),
                 description, "admin", now, now),
            )
            new_id = cur.lastrowid
            cur.close()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    _sync_yaml_target(department, category, targets, labels, 1)
    return {"id": new_id, "status": "created"}


@router.put("/targets/{tid}")
async def update_target(tid: int, body: dict) -> dict:
    """更新抓取配置"""
    targets = body.get("targets", [])
    labels = body.get("labels", {}) or {}
    description = body.get("description", "") or ""

    try:
        with get_db(readonly=False) as conn:
            cur = conn.cursor()
            cur.execute("SELECT department, category FROM scrape_targets WHERE id=%s AND status != -1", (tid,))
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="not found")
            dept, cat = row
            now = datetime.now()
            cur.execute(
                "UPDATE scrape_targets SET targets=%s, labels=%s, description=%s, updated_at=%s WHERE id=%s",
                (json.dumps(targets, ensure_ascii=False),
                 json.dumps(labels, ensure_ascii=False),
                 description, now, tid),
            )
            cur.close()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    _sync_yaml_target(dept, cat, targets, labels, 1)
    return {"status": "updated"}


@router.delete("/targets/{tid}")
async def delete_target(tid: int) -> dict:
    """删除（软删除 + 删除 YAML）"""
    try:
        with get_db(readonly=False) as conn:
            cur = conn.cursor()
            cur.execute("SELECT department, category FROM scrape_targets WHERE id=%s AND status != -1", (tid,))
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="not found")
            dept, cat = row
            cur.execute("UPDATE scrape_targets SET status=-1 WHERE id=%s", (tid,))
            cur.close()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    _sync_yaml_target(dept, cat, [], {}, -1)
    return {"status": "deleted"}


@router.post("/targets/{tid}/toggle")
async def toggle_target(tid: int) -> dict:
    """启用/禁用切换"""
    try:
        with get_db(readonly=False) as conn:
            cur = conn.cursor()
            cur.execute("SELECT department, category, targets, labels, status FROM scrape_targets WHERE id=%s AND status != -1", (tid,))
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="not found")
            dept, cat, targets_raw, labels_raw, cur_status = row
            new_status = 0 if cur_status == 1 else 1
            cur.execute("UPDATE scrape_targets SET status=%s WHERE id=%s", (new_status, tid))
            cur.close()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    targets = json.loads(targets_raw) if targets_raw else []
    labels = json.loads(labels_raw) if labels_raw else {}
    _sync_yaml_target(dept, cat, targets, labels, new_status)
    return {"status": "disabled" if new_status == 0 else "enabled"}


@router.get("/scan-test")
async def scan_test() -> dict:
    """直接测试扫描（不经过 ensure_synced）"""
    try:
        base = settings.prometheus_targets_dir
        raw = _ssh_exec(f"ls -1 {base}")
        depts = raw.split("\n") if raw else []
        results = []
        for dept in depts:
            dept = dept.strip()
            if not dept: continue
            dp = f"{base}/{dept}"
            try:
                out = _ssh_exec(f"test -d '{dp}' && echo 1 || echo 0")
                if out != "1": continue
                fr = _ssh_exec(f"ls -1 {dp}/*.yaml 2>/dev/null || true")
                if not fr: continue
            except: continue
            files = []
            for fn in fr.split("\n"):
                fn = fn.strip().rsplit("/", 1)[-1]
                if not fn or not fn.endswith(".yaml"): continue
                try:
                    content = _ssh_read_file(f"{dp}/{fn}")
                    files.append({"name": fn, "size": len(content)})
                except Exception as e:
                    files.append({"name": fn, "error": str(e)})
            if files:
                results.append({"dept": dept, "files": files})
        return {"ok": True, "base": base, "departments": depts, "parsed": results}
    except Exception as e:
        return {"ok": False, "error": str(e), "type": type(e).__name__}


@router.post("/sync")
async def sync_from_server() -> dict:
    """从服务器强制同步目录结构到 MySQL（不删除已有记录）"""
    remote = _scan_remote_dirs()
    now = datetime.now()
    synced = 0
    with get_db(readonly=False) as conn:
        cur = conn.cursor()
        for dept, files in remote.items():
            for f in files:
                cur.execute(
                    "SELECT id FROM scrape_targets WHERE department=%s AND category=%s AND status != -1",
                    (dept, f["category"]),
                )
                if cur.fetchone():
                    cur.execute(
                        "UPDATE scrape_targets SET targets=%s, labels=%s, updated_at=%s WHERE department=%s AND category=%s",
                        (json.dumps(f["targets"], ensure_ascii=False),
                         json.dumps(f["labels"], ensure_ascii=False),
                         now, dept, f["category"]),
                    )
                else:
                    cur.execute(
                        "INSERT INTO scrape_targets (department, category, targets, labels, status, description, operator, created_at, updated_at) "
                        "VALUES (%s,%s,%s,%s,1,%s,%s,%s,%s)",
                        (dept, f["category"],
                         json.dumps(f["targets"], ensure_ascii=False),
                         json.dumps(f["labels"], ensure_ascii=False),
                         "从服务器同步", "system", now, now),
                    )
                synced += 1
        cur.close()
    return {"synced": synced, "departments": len(remote)}
