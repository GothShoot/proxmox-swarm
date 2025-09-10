# proxmox-swarm

A Python CLI to orchestrate LXC containers on Proxmox VE similar to Docker
Swarm.

This rewrite simplifies the previous TypeScript prototype by talking directly
to the Proxmox API using the `proxmoxer` library and removes the dependency on
the external LWS tool.

## Prerequisites

- Python 3.9+
- Proxmox VE cluster with optional SDN and CephFS configured
- Install Python dependencies: `pip install -r requirements.txt`

## Example stack file

```yaml
services:
  web:
    vmid: 101
    image: local:vztmpl/debian-12-standard_12.0-1_amd64.tar.zst
    memory: 512
    cores: 1
    bridge: vmbr0
```

## Usage

```bash
pip install -r requirements.txt
python -m proxmox_swarm.cli --host <HOST> --user <USER> --password <PASSWORD> --node <NODE> deploy stack.yml
```

The CLI also provides simple lifecycle helpers:

```bash
python -m proxmox_swarm.cli --host <HOST> --user <USER> --password <PASSWORD> start <NODE> <VMID>
python -m proxmox_swarm.cli --host <HOST> --user <USER> --password <PASSWORD> stop <NODE> <VMID>
```

## Legacy TypeScript implementation

The original Node.js sources and tests remain under `src/` for reference but
are no longer required to use the Python CLI.
