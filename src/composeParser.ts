import fs from 'fs';
import yaml from 'js-yaml';

export interface LXCServiceConfig {
  image: string;
  ports: string[];
  environment: Record<string, string>;
  replicas: number;
  constraints: string[];
}

export function parseCompose(filePath: string): Record<string, LXCServiceConfig> {
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

    result[name] = { image, ports, environment, replicas: normalizedReplicas, constraints };
  }

  return result;
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

