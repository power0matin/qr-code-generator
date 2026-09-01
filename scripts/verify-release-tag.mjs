import { readFile } from 'node:fs/promises';

const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const packageVersion = packageJson.version;
const tag = process.argv[2] ?? process.env.GITHUB_REF_NAME;

if (typeof packageVersion !== 'string' || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(packageVersion)) {
  throw new Error(`Invalid root package version: ${String(packageVersion)}`);
}

if (!tag) {
  throw new Error('Release tag is missing. Pass it as an argument or set GITHUB_REF_NAME.');
}

const expectedTag = `v${packageVersion}`;
if (tag !== expectedTag) {
  throw new Error(`Release tag ${tag} does not match root package version ${packageVersion}. Expected ${expectedTag}.`);
}

process.stdout.write(`Release tag verified: ${tag}\n`);
