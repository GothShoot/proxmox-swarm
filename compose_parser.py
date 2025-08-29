"""Parser for Docker Compose files mapping services to LXC configurations.

This module leverages PyYAML to read Docker Compose YAML files and converts
service definitions into LXC-friendly configuration objects.  It supports
Swarm-specific extensions such as replica counts and placement constraints.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List
import logging
import os
import yaml


@dataclass
class LXCServiceConfig:
    """Simplified representation of an LXC service configuration."""
    image: str
    ports: List[str] = field(default_factory=list)
    environment: Dict[str, str] = field(default_factory=dict)
    replicas: int = 1
    constraints: List[str] = field(default_factory=list)


def _parse_environment(env: object) -> Dict[str, str]:
    """Normalise the environment section of a service definition."""
    if isinstance(env, dict):
        parsed: Dict[str, str] = {}
        for k, v in env.items():
            key = str(k)
            if v is None:
                parsed[key] = os.environ.get(key, "")
            else:
                parsed[key] = str(v)
        return parsed
    if isinstance(env, list):
        parsed: Dict[str, str] = {}
        for item in env:
            if isinstance(item, str) and "=" in item:
                key, value = item.split("=", 1)
                parsed[key] = value
            else:
                logging.warning("Ignoring malformed environment entry: %r", item)
        return parsed
    if env is not None:
        logging.warning("Unrecognised environment type: %r", type(env))
    return {}


def parse_compose(path: str) -> Dict[str, LXCServiceConfig]:
    """Parse a Docker Compose file into LXC service configurations."""
    try:
        with open(path, "r", encoding="utf-8") as fh:
            try:
                data = yaml.safe_load(fh) or {}
            except yaml.YAMLError as exc:
                raise ValueError(f"Invalid YAML in {path}: {exc}") from exc
    except OSError as exc:
        raise FileNotFoundError(f"Failed to read compose file {path}: {exc}") from exc

    services = data.get("services", {})
    configs: Dict[str, LXCServiceConfig] = {}

    for name, spec in services.items():
        image = spec.get("image", "")
        ports = spec.get("ports", [])
        environment = _parse_environment(spec.get("environment"))

        deploy = spec.get("deploy", {})
        replicas = deploy.get("replicas")
        placement = deploy.get("placement", {})
        constraints = placement.get("constraints", [])

        configs[name] = LXCServiceConfig(
            image=image,
            ports=list(ports) if isinstance(ports, list) else [],
            environment=environment,
            replicas=int(replicas) if replicas is not None else 1,
            constraints=list(constraints) if isinstance(constraints, list) else [],
        )

    return configs


__all__ = ["LXCServiceConfig", "parse_compose"]
