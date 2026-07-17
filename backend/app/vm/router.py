from fastapi import APIRouter, HTTPException, Query
import httpx

router = APIRouter(prefix="/api/vm", tags=["vm"])

VM_URL = "http://172.16.10.27:8481/select/0/prometheus"


@router.get("/query")
async def vm_query(query: str = Query(...), time: str = Query("")):
    """即时查询"""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            params = {"query": query}
            if time:
                params["time"] = time
            resp = await client.get(f"{VM_URL}/api/v1/query", params=params)
            return resp.json()
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="VM query timeout")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"VM query failed: {str(e)[:100]}")


@router.get("/query_range")
async def vm_query_range(query: str = Query(...), start: str = Query(...), end: str = Query(...), step: str = Query("15s")):
    """范围查询"""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(f"{VM_URL}/api/v1/query_range", params={"query": query, "start": start, "end": end, "step": step})
            return resp.json()
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="VM query timeout")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"VM query_range failed: {str(e)[:100]}")


@router.get("/labels")
async def vm_labels(match: str = Query("")):
    """获取标签名列表"""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            params = {"match[]": match} if match else {}
            resp = await client.get(f"{VM_URL}/api/v1/labels", params=params)
            return resp.json()
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e)[:100])


@router.get("/label/{name}/values")
async def vm_label_values(name: str, match: str = Query("")):
    """获取指定标签的值列表"""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            params = {"match[]": match} if match else {}
            resp = await client.get(f"{VM_URL}/api/v1/label/{name}/values", params=params)
            return resp.json()
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e)[:100])
