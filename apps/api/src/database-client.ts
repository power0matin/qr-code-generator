import postgres from 'postgres';

export type ApiDatabase = ReturnType<typeof postgres>;

export function createApiDatabase(databaseUrl: string): ApiDatabase {
  return postgres(databaseUrl, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 5,
    max_lifetime: 1_800,
    prepare: false,
    onnotice: () => undefined,
  });
}
