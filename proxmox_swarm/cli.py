"""Command line interface for the Python rewrite."""
from __future__ import annotations

import argparse
from typing import Any

from .api import ProxmoxClient
from .stack import load_stack


def cmd_deploy(client: ProxmoxClient, stack_path: str, default_node: str | None) -> None:
    """Deploy all services described in ``stack_path``."""
    for service in load_stack(stack_path):
        params = service.to_lxc_params()
        node = params.pop("node", default_node)
        if node is None:
            raise SystemExit("A target node must be specified via --node or service configuration")
        client.create_lxc(node, **params)


def cmd_start(client: ProxmoxClient, node: str, vmid: int) -> None:
    client.start_lxc(node, vmid)


def cmd_stop(client: ProxmoxClient, node: str, vmid: int) -> None:
    client.stop_lxc(node, vmid)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Manage Proxmox LXC containers using Python")
    parser.add_argument("--host", required=True, help="Proxmox host")
    parser.add_argument("--user", required=True, help="Proxmox user, e.g. root@pam")
    parser.add_argument("--password", required=True, help="Password for the user")
    parser.add_argument("--node", help="Default node when deploying services")
    parser.add_argument("--verify-ssl", action="store_true", help="Verify TLS certificates")

    sub = parser.add_subparsers(dest="command", required=True)

    deploy = sub.add_parser("deploy", help="Deploy services from a stack file")
    deploy.add_argument("stack", help="Path to stack YAML file")

    start = sub.add_parser("start", help="Start an existing container")
    start.add_argument("node", help="Proxmox node hosting the container")
    start.add_argument("vmid", type=int, help="ID of the container")

    stop = sub.add_parser("stop", help="Stop a running container")
    stop.add_argument("node", help="Proxmox node hosting the container")
    stop.add_argument("vmid", type=int, help="ID of the container")

    return parser


def main(argv: list[str] | None = None) -> None:
    parser = build_parser()
    args = parser.parse_args(argv)

    client = ProxmoxClient(
        args.host,
        user=args.user,
        password=args.password,
        verify_ssl=args.verify_ssl,
    )

    if args.command == "deploy":
        cmd_deploy(client, args.stack, args.node)
    elif args.command == "start":
        cmd_start(client, args.node, args.vmid)
    elif args.command == "stop":
        cmd_stop(client, args.node, args.vmid)
    else:
        parser.print_help()


if __name__ == "__main__":  # pragma: no cover - CLI entry point
    main()
