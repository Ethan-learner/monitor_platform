from typing import List, Tuple

from app.config import settings

# (name, health_path) — health_path 为各组件健康检查/探活端点
COMPONENTS: List[Tuple[str, str]] = [
    ("grafana", f"{settings.grafana_url}/api/health"),
    ("pmm", settings.pmm_url),
    ("glowroot", settings.glowroot_url),
    ("prometheus", f"{settings.prometheus_url}/-/healthy"),
    ("loki", f"{settings.loki_url}/ready"),
    ("vmselect", f"{settings.vmselect_url}/health"),
    ("alertmanager", f"{settings.alertmanager_url}/-/healthy"),
]
