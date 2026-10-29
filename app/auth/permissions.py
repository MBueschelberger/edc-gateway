"""RBAC permission enums for scopes and operations."""

from enum import Enum


class PermissionScope(str, Enum):
    """Top-level permission scope (edc or user)."""

    EDC = "edc"
    USER = "user"


class EDCOperation(str, Enum):
    """Operations a user can perform on an EDC resource."""

    MANAGE = "manage"
    CONSUME = "consume"
    CREATE_ASSET = "create_asset"
    CATALOG = "catalog"
    STATUS = "status"
    BPN_DISCOVERY = "bpn-discovery"
    INSPECT_EDC = "inspect"


class UserOperation(str, Enum):
    """Operations a user can perform on user-management resources."""

    MANAGE = "manage"
