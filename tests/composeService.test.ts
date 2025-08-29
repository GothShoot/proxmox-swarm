import fs from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, it, expect } from 'vitest';
import { ComposeService } from '../src/services/composeService';

describe('ComposeService', () => {
  it('parses services and volumes from a compose file', () => {
    const yaml = `
services:
  app:
    image: myimage
    ports: ['80:80']
    environment:
      NODE_ENV: production
    deploy:
      replicas: 2
      placement:
        constraints: ['node.labels.region==us']
    tags: ['app', 'web']
    vlan: 100
    volumes:
      - data:/data:rw
volumes:
  data:
    subvolume: /ceph/data
`;
    const dir = fs.mkdtempSync(join(tmpdir(), 'compose-test-'));
    const path = join(dir, 'compose.yml');
    try {
      fs.writeFileSync(path, yaml);
      const svc = new ComposeService();
      const result = svc.parse(path);
      expect(result.services.app.image).toBe('myimage');
      expect(result.services.app.environment.NODE_ENV).toBe('production');
      expect(result.services.app.replicas).toBe(2);
      expect(result.services.app.constraints).toContain('node.labels.region==us');
      expect(result.services.app.tags).toEqual(['app', 'web']);
      expect(result.services.app.vlan).toBe(100);
      expect(result.services.app.volumes[0]).toEqual({ volume: 'data', target: '/data', mode: 'rw' });
      expect(result.volumes.data.subvolume).toBe('/ceph/data');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('throws for invalid VLAN values', () => {
    const yaml = `
services:
  bad:
    image: test
    vlan: 5000
`;
    const dir = fs.mkdtempSync(join(tmpdir(), 'compose-test-'));
    const path = join(dir, 'bad.yml');
    try {
      fs.writeFileSync(path, yaml);
      const svc = new ComposeService();
      expect(() => svc.parse(path)).toThrow(/Invalid VLAN ID/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
