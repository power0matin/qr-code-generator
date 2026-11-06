import { createApiDatabase } from './database-client.js';
import { loadApiConfig } from './config.js';
import { bootstrapTenant } from './api-key-service.js';

async function main(): Promise<void> {
  const tenantName = process.argv.slice(2).join(' ').trim();
  if (!tenantName) {
    process.stderr.write('Usage: pnpm --filter @moduqr/api bootstrap -- <tenant name>\n');
    process.exitCode = 2;
    return;
  }

  let config: ReturnType<typeof loadApiConfig>;
  try {
    config = loadApiConfig(process.env);
  } catch {
    process.stderr.write('Bootstrap configuration is invalid or incomplete.\n');
    process.exitCode = 1;
    return;
  }

  const database = createApiDatabase(config.databaseUrl);
  try {
    const result = await bootstrapTenant(database, tenantName);
    process.stdout.write('Bootstrap tenant created.\n');
    process.stdout.write('Tenant ID: ' + result.tenantId + '\n');
    process.stdout.write('Tenant name: ' + result.tenantName + '\n');
    process.stdout.write('API key (shown once): ' + result.apiKey.token + '\n');
    process.stdout.write('Store this key in a secret manager. It cannot be retrieved again.\n');
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    process.stderr.write(
      message === 'A bootstrap tenant already exists'
        ? 'A bootstrap tenant already exists; bootstrap is disabled.\n'
        : message === 'Tenant name must contain between 1 and 120 characters'
          ? 'Tenant name must contain between 1 and 120 characters.\n'
          : 'Bootstrap failed. Check database availability and migration state.\n',
    );
    process.exitCode = 1;
  } finally {
    await database.end({ timeout: 5 }).catch(() => {
      process.exitCode = 1;
    });
  }
}

void main();
