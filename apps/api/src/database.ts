import { spawn } from 'node:child_process';

export type DatabaseProbe = () => Promise<boolean>;

export function createDatabaseProbe(
  databaseEnvironment: NodeJS.ProcessEnv,
  timeoutMs = 3_000,
): DatabaseProbe {
  return () =>
    new Promise<boolean>((resolve) => {
      const childEnvironment: NodeJS.ProcessEnv = {
        ...process.env,
        ...databaseEnvironment,
        PGCONNECT_TIMEOUT: '2',
      };
      delete childEnvironment['DATABASE_URL'];

      let output = '';
      let settled = false;
      let child: ReturnType<typeof spawn> | undefined;

      const finish = (available: boolean): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        resolve(available);
      };

      const timeout = setTimeout(() => {
        child?.kill('SIGKILL');
        finish(false);
      }, timeoutMs);
      timeout.unref();

      try {
        child = spawn(
          'psql',
          ['-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '--no-password', '-c', 'SELECT 1'],
          {
            env: childEnvironment,
            stdio: ['ignore', 'pipe', 'ignore'],
            windowsHide: true,
          },
        );
      } catch {
        finish(false);
        return;
      }

      child.stdout?.setEncoding('utf8');
      child.stdout?.on('data', (chunk: string) => {
        if (output.length < 16) output += chunk.slice(0, 16 - output.length);
      });

      child.once('error', () => finish(false));
      child.once('close', (code) => finish(code === 0 && output.trim() === '1'));
    });
}
