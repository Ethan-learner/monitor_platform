from typing import List

from app.config import settings

_PRECEDENCE = ("ops", "dev", "mgmt")


def map_role(groups: List[str]) -> str:
    group_set = set(groups or [])
    group_to_role = {
        settings.role_group_ops: "ops",
        settings.role_group_dev: "dev",
        settings.role_group_mgmt: "mgmt",
    }
    for role in _PRECEDENCE:
        if group_to_role[role] and any(g == group_to_role[role] for g in group_set):
            return role
    return "dev"
