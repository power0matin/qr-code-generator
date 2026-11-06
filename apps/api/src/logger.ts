export type LogLevel = 'info' | 'warn' | 'error';
export type LogFields = Readonly<Record<string, string | number | boolean>>;

export function writeLog(
  level: LogLevel,
  event: string,
  fields: LogFields = {},
): void {
  const entry = {
    time: new Date().toISOString(),
    level,
    event,
    ...fields,
  };
  process.stdout.write(JSON.stringify(entry) + '\n');
}
