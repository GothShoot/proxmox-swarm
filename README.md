# proxmox-swarm

A simple TypeScript CLI app to manage Proxmox LXC like a Docker Swarm using the Proxmox CLI.

/!\ WARNING : MVP is hardely vibe-coded for rapid prototyping, must contain some breaking changes and errors /!\

## Prérequis

- Proxmox VE installé et accessible via la CLI `pve`.
- Fonctionnalité SDN activée sur le cluster.
- Cluster Ceph opérationnel pour les volumes CephFS.
- Node.js et npm pour exécuter les scripts.

## Exemple de fichier Compose et commandes

```yaml
services:
  web:
    image: local:vztmpl/debian-12-standard_12.0-1_amd64.tar.zst
    ports:
      - "8080:80"
    environment:
      NODE_ENV: production
    replicas: 2
    tags: ["overlay"]
    vlan: 100
    volumes:
      - webdata:/var/www/html
  db:
    image: local:vztmpl/mariadb-10.11-standard_10.11-1_amd64.tar.zst
    environment:
      MYSQL_ROOT_PASSWORD: exemple
    volumes:
      - dbdata:/var/lib/mysql

volumes:
  webdata:
    subvolume: cephfs/web
  dbdata:
    subvolume: cephfs/db
```

Installation et déploiement :

```bash
npm install
npm run build
node dist/cli.js --host <HOST> --user <USER> --password <PASSWORD> --sdn-network <NETWORK> --create-sdn deploy stack.yml
```

Commandes supplémentaires :

```bash
node dist/cli.js --host <HOST> --user <USER> --password <PASSWORD> start <vmid>
node dist/cli.js --host <HOST> --user <USER> --password <PASSWORD> stop <vmid>
```

## Limitations

- Seuls les champs de base du format compose sont interprétés.
- Aucune planification avancée ; les contraintes sont passées directement à Proxmox.
- L'intégration SDN se limite à l'attachement à un réseau existant.
- Les volumes pris en charge sont uniquement des sous-volumes CephFS.
- Gestion des erreurs encore rudimentaire.

## Feuille de route

- Support d'autres types de volumes et d'options de montage avancées.
- Gestion étendue des réseaux SDN (création, suppression, etc.).
- Commandes pour mettre à jour ou supprimer des services déployés.
- Ajout de tests automatisés et de validations plus strictes.
- Amélioration de la gestion des erreurs et des journaux.

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
be defined per service in the compose file via `tags` and `vlan` fields. VLAN IDs
must be integers between 0 and 4094.

CephFS subvolumes can be defined in the compose file's `volumes` section. These
subvolumes are created (if necessary) during deployment and mounted into each
container based on the `volumes` lists of individual services. Mount options such
as read/write mode or quotas can be specified under the volume's `options`.
Volumes marked `external: true` are referenced but not created during deployment.
Only a limited set of safe CephFS options is passed to the underlying CLI; any
unsupported keys are ignored.

Additional subcommands can be added in the future using the extensible architecture in `src/cli.ts`.
