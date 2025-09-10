"""Python rewrite of proxmox-swarm CLI.

This package provides a minimal client for interacting with the
Proxmox API directly using the ``proxmoxer`` library.  It is
intended to replace the previous Node.js implementation and to
avoid relying on the external LWS tool.
"""

__all__ = ["ProxmoxClient", "load_stack"]

from .api import ProxmoxClient
from .stack import load_stack
