"""Utilities to parse a simplified compose-like stack file."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Iterable, List

import yaml


@dataclass
class Service:
    """Represents a service definition from the stack file."""

    name: str
    config: Dict[str, Any]

    def to_lxc_params(self) -> Dict[str, Any]:
        """Translate service config to parameters accepted by Proxmox.

        Only a tiny subset of Compose fields is recognised.  Missing
        values fall back to safe defaults so small examples are easy to
        run.
        """

        params: Dict[str, Any] = {
            "vmid": self.config.get("vmid"),
            "hostname": self.name,
            "ostemplate": self.config.get("image"),
            "memory": self.config.get("memory", 512),
            "cores": self.config.get("cores", 1),
        }

        # Basic network configuration; users can override with ``net0``
        # or provide ``bridge`` and ``ip`` fields in the stack file.
        if "net0" in self.config:
            params["net0"] = self.config["net0"]
        else:
            bridge = self.config.get("bridge", "vmbr0")
            ip = self.config.get("ip")
            net = f"name=eth0,bridge={bridge}"
            if ip:
                net += f",ip={ip}"
            params["net0"] = net

        # optional rootfs size or storage
        if "rootfs" in self.config:
            params["rootfs"] = self.config["rootfs"]

        if "password" in self.config:
            params["password"] = self.config["password"]

        if "features" in self.config:
            params["features"] = self.config["features"]

        return params


def load_stack(path: str) -> List[Service]:
    """Load stack definition from *path*.

    The file format is a subset of Docker Compose with only the
    ``services`` mapping being used.  Each service is converted to a
    :class:`Service` instance.
    """

    with open(path, "r", encoding="utf8") as fh:
        data: Dict[str, Any] = yaml.safe_load(fh) or {}

    services: Dict[str, Dict[str, Any]] = data.get("services", {})
    return [Service(name, cfg) for name, cfg in services.items()]
