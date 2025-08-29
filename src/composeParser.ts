import fs from 'fs';
import yaml from 'js-yaml';

export interface VolumeDefinition {
  subvolume: string;
  options?: Record<string, string>;
}

export interface VolumeMount {
  volume: string;
  target: string;
  mode?: string;
}

export interface LXCServiceConfig {
  image: string;
  ports: string[];
  environment: Record<string, string>;
  replicas: number;
  constraints: string[];
  tags?: string[];
  vlan?: number;
  volumes: VolumeMount[];
}

export interface ComposeConfig {
  services: Record<string, LXCServiceConfig>;
  volumes: Record<string, VolumeDefinition>;
}

export function parseCompose(filePath: string): ComposeConfig {
  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    throw new Error(`Failed to read compose file at ${filePath}: ${(err as Error).message}`);
  }

  let data: any;
  try {
    data = yaml.load(content);
  } catch (err) {
    throw new Error(`Failed to parse YAML in ${filePath}: ${(err as Error).message}`);
  }

  if (typeof data !== 'object' || data === null || !('services' in data)) {
    throw new Error('Compose file missing services definition');
  }

  const services = (data as any).services as Record<string, any>;
  const volumeDefs = parseVolumes((data as any).volumes);
  const result: Record<string, LXCServiceConfig> = {};

  for (const [name, svc] of Object.entries(services)) {
    const image: string = svc.image;
    const ports: string[] = Array.isArray(svc.ports) ? svc.ports.map((p: any) => String(p)) : [];
    const environment = parseEnvironment(svc.environment);
    const replicasVal = svc.deploy?.replicas;
    const replicas = replicasVal !== undefined && replicasVal !== null ? parseInt(String(replicasVal), 10) : 1;
    const normalizedReplicas = Number.isNaN(replicas) ? 1 : replicas;
    const constraints: string[] = Array.isArray(svc.deploy?.placement?.constraints)
      ? svc.deploy.placement.constraints.map((c: any) => String(c))
      : [];
    const tags: string[] | undefined = Array.isArray(svc.tags)
      ? svc.tags.map((t: any) => String(t))
      : undefined;
    const vlanVal = svc.vlan;
    let vlan: number | undefined;
    if (vlanVal !== undefined && vlanVal !== null) {
      const parsedVlan = parseInt(String(vlanVal), 10);
      if (
        Number.isNaN(parsedVlan) ||
        parsedVlan < 0 ||
        parsedVlan > 4094
      ) {
        throw new Error(`Invalid VLAN ID for service ${name}: ${vlanVal}`);
      }
      vlan = parsedVlan;
    }

    const volumes: VolumeMount[] = Array.isArray(svc.volumes)
      ? svc.volumes.map((v: any) => parseVolumeMount(v)).filter(Boolean) as VolumeMount[]
      : [];

    result[name] = {
      image,
      ports,
      environment,
      replicas: normalizedReplicas,
      constraints,
      tags,
      vlan,
      volumes,
    };
  }

  return { services: result, volumes: volumeDefs };
}

function parseEnvironment(env: any): Record<string, string> {
  const result: Record<string, string> = {};

  if (Array.isArray(env)) {
    for (const item of env) {
      if (typeof item !== 'string') {
        console.warn(`Ignoring non-string environment entry: ${JSON.stringify(item)}`);
        continue;
      }
      const idx = item.indexOf('=');
      if (idx === -1) {
        console.warn(`Ignoring malformed environment entry: ${item}`);
        continue;
      }
      const key = item.slice(0, idx);
      const value = item.slice(idx + 1);
      result[key] = value;
    }
  } else if (typeof env === 'object' && env !== null) {
    for (const [key, value] of Object.entries(env)) {
      if (value === null) {
        result[key] = process.env[key] ?? '';
      } else {
        result[key] = String(value);
      }
    }
  }

  return result;
}

function parseVolumeMount(entry: any): VolumeMount | null {
  if (typeof entry === 'string') {
    const parts = entry.split(':');
    if (parts.length < 2) {
      console.warn(`Ignoring malformed volume entry: ${entry}`);
      return null;
    }
    const [volume, target, mode] = parts;
    return { volume, target, mode };
  } else if (typeof entry === 'object' && entry !== null) {
    const volume = String(entry.source ?? entry.volume ?? '');
    const target = String(entry.target ?? entry.destination ?? '');
    if (!volume || !target) {
      console.warn(`Ignoring malformed volume entry: ${JSON.stringify(entry)}`);
      return null;
    }
    const mode = entry.mode !== undefined ? String(entry.mode) : undefined;
    return { volume, target, mode };
  }
  console.warn(`Ignoring malformed volume entry: ${JSON.stringify(entry)}`);
  return null;
}

function parseVolumes(vols: any): Record<string, VolumeDefinition> {
  const result: Record<string, VolumeDefinition> = {};
  if (vols && typeof vols === 'object') {
    for (const [name, cfg] of Object.entries(vols as Record<string, any>)) {
      if (typeof cfg === 'string') {
        result[name] = { subvolume: cfg };
      } else if (cfg && typeof cfg === 'object') {
        const obj = cfg as Record<string, any>;
        const subvolume = obj.subvolume ?? name;
        const options: Record<string, string> | undefined = obj.options && typeof obj.options === 'object'
          ? Object.fromEntries(
              Object.entries(obj.options).map(([k, v]) => [k, String(v)])
            )
          : undefined;
        result[name] = { subvolume, options };
      }
    }
  }
  return result;
}

