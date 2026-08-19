import { readFileSync } from 'node:fs';

const config = JSON.parse(readFileSync(0, 'utf8'));

const fail = (message) => {
  throw new Error(`Compose networking check failed: ${message}`);
};

if (config.networks?.core?.internal !== true) {
  fail('the core network must remain internal');
}

const hostAccess = config.networks?.['host-access'];
if (!hostAccess || hostAccess.internal === true) {
  fail('host-access must be a non-internal network for loopback port forwarding');
}

if (hostAccess.driver_opts?.['com.docker.network.bridge.host_binding_ipv4'] !== '127.0.0.1') {
  fail('host-access must default published ports to 127.0.0.1');
}

const expectedDiagnosticPorts = {
  postgres: [['5432', '54320']],
  redis: [['6379', '63790']],
  minio: [
    ['9000', '9000'],
    ['9001', '9001'],
  ],
  mailpit: [
    ['1025', '1025'],
    ['8025', '8025'],
  ],
};

for (const [serviceName, expectedPorts] of Object.entries(expectedDiagnosticPorts)) {
  const service = config.services?.[serviceName];
  if (!service) {
    fail(`missing service ${serviceName}`);
  }

  const networkNames = Object.keys(service.networks ?? {});
  if (!networkNames.includes('core') || !networkNames.includes('host-access')) {
    fail(`${serviceName} must join both core and host-access`);
  }

  const actualPorts = service.ports ?? [];
  for (const [target, published] of expectedPorts) {
    const port = actualPorts.find(
      (candidate) =>
        String(candidate.target) === target && String(candidate.published) === published,
    );
    if (!port) {
      fail(`${serviceName} must publish 127.0.0.1:${published} to port ${target}`);
    }
    if (port.host_ip !== '127.0.0.1') {
      fail(`${serviceName} port ${published} must bind only to 127.0.0.1`);
    }
  }
}

for (const [serviceName, service] of Object.entries(config.services ?? {})) {
  for (const port of service.ports ?? []) {
    if (port.host_ip !== '127.0.0.1') {
      fail(`${serviceName} has a published port that is not loopback-only`);
    }
  }

  if (
    !(serviceName in expectedDiagnosticPorts) &&
    Object.hasOwn(service.networks ?? {}, 'host-access')
  ) {
    fail(`${serviceName} must not join the diagnostic host-access network`);
  }
}

console.log('Compose networking constraints are valid.');
