# proxmox-swarm

A simple TypeScript CLI app to manage Proxmox LXC like a Docker Swarm using the Proxmox CLI.

## Usage

Ensure the Proxmox CLI is installed and accessible on your system.

Install dependencies:

```bash
npm install
```

Build the command-line interface:

```bash
npm run build
```

Run the command-line interface:

```bash
node dist/cli.js --host <HOST> --user <USER> --password <PASSWORD> [--sdn-network <NETWORK> --create-sdn] <subcommand>
```

Available subcommands:

* `deploy` – Deploy a new VM (placeholder).
* `start <vmid>` – Start an existing VM.
* `stop <vmid>` – Stop a running VM.

When `--sdn-network` is specified, newly created containers are attached to the
given overlay network using the Proxmox SDN API. Network tags and VLAN IDs can
be defined per service in the compose file via `tags` and `vlan` fields.

Additional subcommands can be added in the future using the extensible architecture in `src/cli.ts`.
