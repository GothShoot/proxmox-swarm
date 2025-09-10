"""Proxmox API client wrapper.

The original project relied on the external LWS CLI to communicate
with the Proxmox REST API.  This module provides a thin wrapper
around :mod:`proxmoxer` so the orchestration logic can interact with
Proxmox directly using Python.
"""
from __future__ import annotations

from typing import Any, Dict, List

from proxmoxer import ProxmoxAPI


class ProxmoxClient:
    """Minimal wrapper around :class:`proxmoxer.ProxmoxAPI`.

    Parameters
    ----------
    host:
        Proxmox host name or IP address.
    user:
        Proxmox username including realm (e.g. ``root@pam``).
    password:
        Password for the user.
    verify_ssl:
        Whether to verify TLS certificates.  Disabled by default to
        ease development with self‑signed certificates.
    """

    def __init__(
        self,
        host: str,
        user: str,
        password: str,
        verify_ssl: bool = False,
    ) -> None:
        self._api = ProxmoxAPI(host, user=user, password=password, verify_ssl=verify_ssl)

    # -- basic helpers -------------------------------------------------
    def list_nodes(self) -> List[Dict[str, Any]]:
        """Return nodes available in the Proxmox cluster."""
        return self._api.nodes.get()

    def create_lxc(self, node: str, **params: Any) -> Dict[str, Any]:
        """Create a new LXC container on ``node`` with the given params."""
        return self._api.nodes(node).lxc.post(**params)

    def start_lxc(self, node: str, vmid: int) -> None:
        """Start an existing container."""
        self._api.nodes(node).lxc(vmid).status.start.post()

    def stop_lxc(self, node: str, vmid: int) -> None:
        """Stop a running container."""
        self._api.nodes(node).lxc(vmid).status.stop.post()
