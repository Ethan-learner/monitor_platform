import json
from datetime import datetime
from typing import List, Dict, Optional

import httpx
import paramiko
import yaml
from fastapi import APIRouter, HTTPException

from app.config import settings
from app.db import get_db

router = APIRouter(prefix="/api/scrape", tags=["scrape"])

# ── SSH ──────────────────────────────────────────────────────

def _ssh(cmd: str) -> str:
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(settings.ssh_host, settings.ssh_port or 22, settings.ssh_user, settings.ssh_password, timeout=10)
    _, stdout, stderr = ssh.exec_command(cmd)
    out = stdout.read().decode().strip()
    err = stderr.read().decode().strip()
    ssh.close()
    if err and not out:
        raise HTTPException(502, detail=f"ssh_error: {err}")
    return out


def _read(path: str) -> str:
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(settings.ssh_host, settings.ssh_port or 22, settings.ssh_user, settings.ssh_password, timeout=10)
    try:
        sftp = ssh.open_sftp()
        with sftp.open(path, "r") as f:
            return f.read().decode()
    except FileNotFoundError:
        raise HTTPException(404, "file_not_found")
    except Exception as e:
        raise HTTPException(502, detail=f"read_failed: {e}")
    finally:
        ssh.close()


def _write(path: str, content: str) -> None:
    import base64
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(settings.ssh_host, settings.ssh_port or 22, settings.ssh_user, settings.ssh_password, timeout=10)
    try:
        content_b64 = base64.b64encode(content.encode('utf-8')).decode('ascii')
        parent = '/'.join(path.split('/')[:-1])
        cmd = f"mkdir -p '{parent}' && echo '{content_b64}' | base64 -d > '{path}'"
        stdin, stdout, stderr = ssh.exec_command(cmd)
        channel = stdout.channel
        channel.settimeout(10)
        exit_status = channel.recv_exit_status()
        err = stderr.read().decode('utf-8', errors='replace').strip()
        if exit_status != 0 or err:
            raise HTTPException(502, detail=f"write_failed: exit={exit_status} stderr={err}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(502, detail=f"write_failed: {e}")
    finally:
        ssh.close()


def _rm(path: str) -> None:
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(settings.ssh_host, settings.ssh_port or 22, settings.ssh_user, settings.ssh_password, timeout=10)
    try:
        stdin, stdout, stderr = ssh.exec_command(f"rm -f '{path}'")
        stdout.channel.recv_exit_status()
    except Exception:
        pass
    finally:
        ssh.close()


def _mv(src: str, dst: str) -> None:
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(settings.ssh_host, settings.ssh_port or 22, settings.ssh_user, settings.ssh_password, timeout=10)
    try:
        parent = '/'.join(dst.split('/')[:-1])
        stdin, stdout, stderr = ssh.exec_command(f"mkdir -p '{parent}' && mv '{src}' '{dst}'")
        stdout.channel.recv_exit_status()
    except Exception:
        pass
    finally:
        ssh.close()


def _mv(src: str, dst: str) -> None:
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(settings.ssh_host, settings.ssh_port or 22, settings.ssh_user, settings.ssh_password, timeout=10)
    try:
        parent = '/'.join(dst.split('/')[:-1])
        _, stdout, stderr = ssh.exec_command(f"mkdir -p '{parent}' && mv '{src}' '{dst}'")
        stdout.read(); stderr.read()
    except Exception:
        pass
    finally:
        ssh.close()


# ── 同步 YAML 文件（每个 target 独立 _disabled / _deleted）──

def _sync_file(dept: str, cat: str) -> None:
    base = settings.prometheus_targets_dir
    yp = f"{base}/{dept}/{cat}.yaml"

    try:
        with get_db(readonly=True) as conn:
            cur = conn.cursor()
            cur.execute("SELECT id, target, labels, status FROM scrape_targets WHERE department=%s AND category=%s AND status IN (1,0,-1)", (dept, cat))
            rows = cur.fetchall()
            cur.close()

        active_docs = []
        for tid, target, labels_raw, status in rows:
            labels = json.loads(labels_raw) if labels_raw else {}
            entry = {"targets": [target], "labels": labels}

            if status == 1:
                active_docs.append(entry)
                # 清除旧的 _disabled 和 _deleted 文件
                dp = f"{base}/{dept}/_disabled/{cat}_target_{tid}.yaml"
                glob = f"{base}/{dept}/_deleted/{cat}_target_{tid}_*.yaml"
                try:
                    ssh = paramiko.SSHClient()
                    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
                    ssh.connect(settings.ssh_host, settings.ssh_port or 22, settings.ssh_user, settings.ssh_password, timeout=10)
                    ssh.exec_command(f"rm -f {dp} {glob}")
                    ssh.close()
                except Exception:
                    pass
            elif status == 0:
                # 禁用 → 写入 _disabled/
                dp = f"{base}/{dept}/_disabled/{cat}_target_{tid}.yaml"
                _write(dp, yaml.dump([entry], default_flow_style=False, allow_unicode=True))
            elif status == -1:
                # 删除 → 写入 _deleted/ 带时间戳
                ts = datetime.now().strftime('%Y%m%d%H%M%S')
                rp = f"{base}/{dept}/_deleted/{cat}_target_{tid}_{ts}.yaml"
                # 清除旧的 _disabled 文件
                dp = f"{base}/{dept}/_disabled/{cat}_target_{tid}.yaml"
                _rm(dp)
                if not _exists(rp):
                    _write(rp, yaml.dump([entry], default_flow_style=False, allow_unicode=True))

        # 写入主 YAML（仅活跃目标）
        if active_docs:
            _write(yp, yaml.dump(active_docs, default_flow_style=False, allow_unicode=True))
        else:
            _rm(yp)
    except Exception:
        pass


def _exists(path: str) -> bool:
    try:
        out = _ssh(f"test -f '{path}' && echo 1 || echo 0")
        return out == "1"
    except Exception:
        return False


# ── 删除整个文件夹 ──

def _delete_folder(name: str) -> None:
    base = settings.prometheus_targets_dir
    src = f"{base}/{name}"
    ts = datetime.now().strftime('%Y%m%d%H%M%S')
    dst = f"{base}/_deleted/{name}_{ts}"

    try:
        _mv(src, dst)
    except Exception:
        raise HTTPException(502, detail="folder_move_failed")

    try:
        with get_db(readonly=False) as conn:
            cur = conn.cursor()
            # 级联删除该部门下的所有 target
            cur.execute("UPDATE scrape_targets SET status=-1 WHERE department=%s AND status != -1", (name,))
            # 禁用目录表中的记录
            cur.execute("UPDATE scrape_directories SET enabled=-1 WHERE name=%s AND enabled != -1", (name,))
            cur.close()
    except Exception:
        pass


# ── 解析服务器 YAML ──────────────────────────────────────────

def _parse_yaml_entries(content: str) -> List[dict]:
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


def _scan_remote() -> List[dict]:
    """扫描服务器所有 YAML，返回 [{department, category, target, labels}]"""
    base = settings.prometheus_targets_dir
    try:
        raw = _ssh(f"ls -1 {base}")
    except Exception:
        return []
    if not raw:
        return []

    rows = []
    for line in raw.split("\n"):
        dept = line.strip()
        if not dept or dept.startswith('_'):
            continue
        dp = f"{base}/{dept}"
        try:
            if _ssh(f"test -d '{dp}' && echo 1 || echo 0") != "1":
                continue
            raw_files = _ssh(f"ls -1 '{dp}'/*.yaml 2>/dev/null || true")
            if not raw_files:
                continue
        except Exception:
            continue

        for fn in raw_files.split("\n"):
            fn = fn.strip().rsplit("/", 1)[-1]
            if not fn or not fn.endswith(".yaml"):
                continue
            cat = fn[:-5]
            try:
                content = _read(f"{dp}/{fn}")
                entries = _parse_yaml_entries(content)
            except Exception:
                continue
            for e in entries:
                rows.append({"department": dept, "category": cat, "target": e["target"], "labels": e["labels"]})
    return rows


# ── 目录文件列表 API ─────────────────────────────────────────

@router.get("/directories")
async def list_directories() -> List[dict]:
    """返回文件列表树结构"""
    try:
        with get_db(readonly=True) as conn:
            cur = conn.cursor()
            cur.execute("SELECT id, name, category, label, description, owner, enabled, created_at FROM scrape_directories ORDER BY name, category")
            rows = cur.fetchall()
            cur.close()
            return [{
                "id": r[0], "name": r[1], "category": r[2] or "", "label": r[3] or "",
                "description": r[4] or "", "owner": r[5] or "", "enabled": r[6],
                "createdAt": str(r[7] or ""),
            } for r in rows]
    except Exception as e:
        raise HTTPException(502, detail=f"db_error: {e}")


@router.post("/directories")
async def create_directory(body: dict) -> dict:
    """新建文件夹或配置文件"""
    name = body.get("name", "").strip()
    category = body.get("category", "").strip()
    description = body.get("description", "") or ""
    if not name:
        raise HTTPException(400, detail="name required")
    if ".." in name or "/" in name or (category and ".." in category) or (category and "/" in category):
        raise HTTPException(400, detail="invalid name")

    now = datetime.now()
    try:
        with get_db(readonly=False) as conn:
            cur = conn.cursor()
            cur.execute("SELECT id FROM scrape_directories WHERE name=%s AND category=%s AND enabled != -1", (name, category))
            if cur.fetchone():
                raise HTTPException(409, detail="already exists")
            # 如果是创建配置文件，确保部门文件夹记录也存在
            if category:
                cur.execute("SELECT id FROM scrape_directories WHERE name=%s AND category='' AND enabled != -1", (name,))
                if not cur.fetchone():
                    cur.execute(
                        "INSERT INTO scrape_directories (name, category, label, description, owner, enabled, created_at, updated_at) "
                        "VALUES (%s,'',%s,%s,%s,1,%s,%s)",
                        (name, name, "", "admin", now, now))
            cur.execute(
                "INSERT INTO scrape_directories (name, category, label, description, owner, enabled, created_at, updated_at) "
                "VALUES (%s,%s,%s,%s,%s,1,%s,%s)",
                (name, category, category or name, description, "admin", now, now))
            new_id = cur.lastrowid
            cur.close()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(400, detail=str(e))

    # 创建空 YAML 文件（失败不阻塞，等 _sync_file 写入）
    base = settings.prometheus_targets_dir
    if category:
        try:
            yp = f"{base}/{name}/{category}.yaml"
            _write(yp, "[]\n")
        except Exception:
            pass
    else:
        try:
            _ssh(f"mkdir -p '{base}/{name}'")
        except Exception:
            pass

    return {"id": new_id, "status": "created"}


@router.delete("/directories/{did}")
async def delete_directory(did: int) -> dict:
    """删除文件夹（移入 _deleted + 级联）"""
    try:
        with get_db(readonly=True) as conn:
            cur = conn.cursor()
            cur.execute("SELECT name FROM scrape_directories WHERE id=%s", (did,))
            row = cur.fetchone()
            cur.close()
            if not row:
                raise HTTPException(404, detail="not found")
            name = row[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(400, detail=str(e))

    _delete_folder(name)
    return {"status": "deleted"}


@router.delete("/file/{dept}/{cat}")
async def delete_file(dept: str, cat: str) -> dict:
    """删除配置文件（级联所有 target → -1，文件移入 _deleted/）"""
    base = settings.prometheus_targets_dir
    src = f"{base}/{dept}/{cat}.yaml"
    ts = datetime.now().strftime('%Y%m%d%H%M%S')
    dst = f"{base}/{dept}/_deleted/{cat}_{ts}.yaml"

    try:
        with get_db(readonly=False) as conn:
            cur = conn.cursor()
            cur.execute("UPDATE scrape_targets SET status=-1 WHERE department=%s AND category=%s AND status != -1", (dept, cat))
            cur.execute("UPDATE scrape_directories SET enabled=-1 WHERE name=%s AND category=%s AND enabled != -1", (dept, cat))
            cur.close()
    except Exception:
        pass

    try:
        _mv(src, dst)
    except Exception:
        pass

    return {"status": "deleted"}


@router.put("/directories/{did}")
async def update_directory(did: int, body: dict) -> dict:
    """更新文件夹信息（description等）"""
    description = body.get("description", "")
    try:
        with get_db(readonly=False) as conn:
            cur = conn.cursor()
            cur.execute("UPDATE scrape_directories SET description=%s, updated_at=%s WHERE id=%s",
                         (description, datetime.now(), did))
            cur.close()
        return {"status": "updated"}
    except Exception as e:
        raise HTTPException(400, detail=str(e))


# ── 抓取目标 API ─────────────────────────────────────────────

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
                     "首次扫描同步", "system", now, now))
            except Exception:
                pass
        cur.close()


@router.get("/targets")
async def list_targets() -> List[dict]:
    _ensure_synced()
    try:
        with get_db(readonly=True) as conn:
            cur = conn.cursor()
            cur.execute(
                "SELECT id, department, category, target, labels, status, description, operator, created_at "
                "FROM scrape_targets WHERE status != -1 ORDER BY department, category, id")
            return [{
                "id": r[0], "department": r[1], "category": r[2], "target": r[3],
                "labels": json.loads(r[4]) if r[4] else {},
                "status": r[5], "description": r[6] or "",
                "operator": r[7] or "", "createdAt": str(r[8] or ""),
            } for r in cur.fetchall()]
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


@router.post("/targets")
async def create_target(body: dict) -> dict:
    department = body.get("department", "").strip()
    category = body.get("category", "").strip()
    target = body.get("target", "").strip()
    labels = body.get("labels", {}) or {}
    description = body.get("description", "") or ""

    if not department or not category or not target:
        raise HTTPException(400, detail="department, category and target required")

    now = datetime.now()
    try:
        with get_db(readonly=False) as conn:
            cur = conn.cursor()
            cur.execute(
                "INSERT INTO scrape_targets (department, category, target, labels, status, description, operator, created_at, updated_at) "
                "VALUES (%s,%s,%s,%s,1,%s,%s,%s,%s)",
                (department, category, target, json.dumps(labels, ensure_ascii=False), description, "admin", now, now))
            new_id = cur.lastrowid
            cur.close()
    except Exception as e:
        raise HTTPException(400, detail=str(e))

    _sync_file(department, category)
    return {"id": new_id, "status": "created"}


@router.put("/targets/{tid}")
async def update_target(tid: int, body: dict) -> dict:
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
            if body.get("target"):
                sets.append("target=%s")
                params.append(body["target"])
            if "labels" in body:
                sets.append("labels=%s")
                params.append(json.dumps(body["labels"], ensure_ascii=False))
            if "description" in body:
                sets.append("description=%s")
                params.append(body["description"])
            sets.append("updated_at=%s")
            params.append(datetime.now())
            params.append(tid)
            cur.execute(f"UPDATE scrape_targets SET {','.join(sets)} WHERE id=%s", params)
            cur.close()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(400, detail=str(e))

    _sync_file(dept, cat)
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
            cur.execute("DELETE FROM scrape_target_health WHERE scrape_target_id=%s", (tid,))
            cur.close()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(400, detail=str(e))

    _sync_file(dept, cat)
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

    _sync_file(dept, cat)
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
                    cur.execute(
                        "UPDATE scrape_targets SET labels=%s, updated_at=%s WHERE department=%s AND category=%s AND target=%s",
                        (json.dumps(r["labels"], ensure_ascii=False), now, r["department"], r["category"], r["target"]))
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


# ── 抓取效果监控（Prometheus 同步 + 查询） ─────────

# 缓存上次同步结果（避免频繁拉 Prometheus）
_HEALTH_CACHE: Dict = {"checked_at": None, "summary": None, "targets": None, "by_target": {}}
_HEALTH_CACHE_TTL = 30  # 秒


def _normalize_target(t: str) -> str:
    """提取 host:port 用于匹配，不保留协议和路径"""
    t = t.strip()
    for prefix in ("https://", "http://"):
        if t.startswith(prefix):
            t = t[len(prefix):]
            break
    if "/" in t:
        t = t.split("/", 1)[0]
    return t


def _build_target_index(targets: list) -> Dict[str, dict]:
    """构建多维度目标索引"""
    index: Dict[str, dict] = {}
    for t in targets:
        labels = t.get("labels", {}) or {}
        keys = set()
        # 1. 从 scrapeUrl 中提取 host:port（最可靠）
        scrape_url = (t.get("scrapeUrl") or "")
        if "://" in scrape_url:
            url_part = scrape_url.split("://", 1)[1].split("/", 1)[0]
            if url_part:
                keys.add(url_part)
                # host only
                if ":" in url_part:
                    keys.add(url_part.rsplit(":", 1)[0])
        # 2. __address__
        addr = (labels.get("__address__") or "").strip()
        if addr:
            keys.add(addr)
            if ":" in addr:
                keys.add(addr.rsplit(":", 1)[0])
        # 3. instance
        inst = (labels.get("instance") or "").strip()
        if inst:
            keys.add(inst)
        # 4. __param_target
        pt = (labels.get("__param_target") or "").strip()
        if pt:
            keys.add(_normalize_target(pt))
        # 5. host
        tmp_host = (labels.get("host") or labels.get("__meta_host") or "").strip()
        if tmp_host:
            keys.add(tmp_host)

        item = {
            "health": t.get("health", "unknown"),
            "lastScrape": t.get("lastScrape", ""),
            "lastError": t.get("lastError", ""),
            "scrapeUrl": t.get("scrapeUrl", ""),
        }
        for k in keys:
            if k and k not in index:
                index[k] = item
    return index


def _fetch_prometheus_targets() -> Dict[str, dict]:
    """从 Prometheus 拉取 activeTargets，构建多维度匹配索引"""
    result: Dict[str, dict] = {}
    try:
        with httpx.Client(timeout=10.0, verify=False) as cli:
            r = cli.get(f"{settings.prometheus_url}/api/v1/targets", params={"state": "active"})
            if r.status_code != 200:
                return result
            data = r.json()
            active = data.get("data", {}).get("activeTargets", [])
            result = _build_target_index(active)
    except Exception as e:
        print(f"[health] prometheus fetch error: {e}")
    return result


def _sync_health() -> Dict:
    """从 DB 拉所有 status=1 目标，与 Prometheus 对比，写入 scrape_target_health 表"""
    with get_db(readonly=True) as conn:
        cur = conn.cursor()
        cur.execute("SELECT id, department, category, target FROM scrape_targets WHERE status=1")
        rows = cur.fetchall()
        cur.close()
    if not rows:
        return {"effective": 0, "ineffective": 0, "invalid": 0, "synced": 0}

    prom_targets = _fetch_prometheus_targets()
    now = datetime.now()
    summary = {"effective": 0, "ineffective": 0, "invalid": 0, "synced": 0}

    with get_db(readonly=False) as conn:
        cur = conn.cursor()
        for tid, dept, cat, tgt in rows:
            norm = _normalize_target(tgt)
            prom = prom_targets.get(norm)
            # 尝试多种匹配策略
            if prom is None:
                # host 匹配（不带端口）
                if ":" in norm:
                    host = norm.rsplit(":", 1)[0]
                    prom = prom_targets.get(host)
            if prom is None:
                # 原始 target 字符串匹配（用于 HTTP 黑盒探测）
                prom = prom_targets.get(tgt)
            if prom is None:
                status = "ineffective"
                p_health = None
                last_scrape = None
                last_error = "Prometheus 未发现该目标（可能未配置或已被丢弃）"
            elif prom["health"] == "up":
                status = "effective"
                p_health = "up"
                last_scrape = prom.get("lastScrape")
                last_error = None
            else:
                status = "invalid"
                p_health = prom["health"]
                last_scrape = prom.get("lastScrape")
                last_error = prom.get("lastError", "")
            try:
                cur.execute(
                    "INSERT INTO scrape_target_health (scrape_target_id, department, category, target, health_status, prometheus_health, last_scrape, last_error, last_check_at, updated_at) "
                    "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) "
                    "ON DUPLICATE KEY UPDATE department=VALUES(department), category=VALUES(category), target=VALUES(target), "
                    "health_status=VALUES(health_status), prometheus_health=VALUES(prometheus_health), "
                    "last_scrape=VALUES(last_scrape), last_error=VALUES(last_error), last_check_at=VALUES(last_check_at), updated_at=VALUES(updated_at)",
                    (tid, dept, cat, tgt, status, p_health, last_scrape, last_error, now, now))
                summary[status] += 1
                summary["synced"] += 1
            except Exception:
                pass
        cur.close()
    return summary


@router.get("/health")
async def get_health() -> dict:
    """查当前采集效果快照（带缓存）"""
    now = datetime.now()
    cache_age = (now - _HEALTH_CACHE["checked_at"]).total_seconds() if _HEALTH_CACHE["checked_at"] else 999
    if cache_age > _HEALTH_CACHE_TTL or _HEALTH_CACHE["targets"] is None:
        summary = _sync_health()
        _HEALTH_CACHE["checked_at"] = now
        _HEALTH_CACHE["summary"] = {k: v for k, v in summary.items() if k != "synced"}

    if _HEALTH_CACHE["targets"] is None:
        with get_db(readonly=True) as conn:
            cur = conn.cursor()
            cur.execute("SELECT scrape_target_id, department, category, target, health_status, prometheus_health, last_scrape, last_error, last_check_at FROM scrape_target_health ORDER BY department, category")
            _HEALTH_CACHE["targets"] = [
                {
                    "id": r[0], "department": r[1], "category": r[2], "target": r[3],
                    "health": r[4], "prometheusHealth": r[5],
                    "lastScrape": str(r[6]) if r[6] else None,
                    "lastError": r[7], "lastCheckAt": str(r[8]) if r[8] else None,
                }
                for r in cur.fetchall()
            ]
            cur.close()

    return {
        "summary": _HEALTH_CACHE["summary"],
        "targets": _HEALTH_CACHE["targets"],
        "checkedAt": str(_HEALTH_CACHE["checked_at"]) if _HEALTH_CACHE["checked_at"] else None,
        "stale": cache_age > _HEALTH_CACHE_TTL,
    }


@router.post("/health/refresh")
async def refresh_health() -> dict:
    """强制刷新缓存（拉取 Prometheus 重新同步）"""
    _HEALTH_CACHE["checked_at"] = None
    _HEALTH_CACHE["targets"] = None
    _HEALTH_CACHE["summary"] = None
    return await get_health()


@router.delete("/health/by-target/{tid}")
async def delete_health_by_target(tid: int) -> dict:
    """删除目标时级联删除其 health 记录"""
    try:
        with get_db(readonly=False) as conn:
            cur = conn.cursor()
            cur.execute("DELETE FROM scrape_target_health WHERE scrape_target_id=%s", (tid,))
            cur.close()
        return {"status": "deleted"}
    except Exception as e:
        raise HTTPException(400, detail=str(e))
