import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url));

async function readPackage(relativePath) {
  const filePath = path.join(repositoryRoot, relativePath, 'package.json');
  const packageJson = JSON.parse(await readFile(filePath, 'utf8'));
  return { relativePath, packageJson };
}

async function listWorkspaceDirectories(relativePath) {
  return (await readdir(path.join(repositoryRoot, relativePath), { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => relativePath + '/' + entry.name);
}

const rootEntry = await readPackage('.');
const packageVersion = rootEntry.packageJson.version;
const tag = process.argv[2] ?? (process.env['GITHUB_REF_TYPE'] === 'tag' ? process.env['GITHUB_REF_NAME'] : undefined) ?? (typeof packageVersion === 'string' ? 'v' + packageVersion : undefined);

if (typeof packageVersion !== 'string' || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(packageVersion)) {
  throw new Error('Invalid root package version: ' + String(packageVersion));
}

const workspaceDirectories = [
  ...(await listWorkspaceDirectories('apps')),
  ...(await listWorkspaceDirectories('packages')),
].sort();
const workspaceEntries = await Promise.all(workspaceDirectories.map(readPackage));
const mismatches = workspaceEntries.filter(({ packageJson }) => packageJson.version !== packageVersion);

if (mismatches.length > 0) {
  const details = mismatches.map(({ relativePath, packageJson }) => relativePath + ': ' + String(packageJson.version)).join(', ');
  throw new Error('Workspace package versions must match the root version ' + packageVersion + '. Mismatches: ' + details);
}

if (!tag) throw new Error('Release tag is missing. Pass it as an argument or set GITHUB_REF_NAME.');

const expectedTag = 'v' + packageVersion;
if (tag !== expectedTag) {
  throw new Error('Release tag ' + tag + ' does not match root package version ' + packageVersion + '. Expected ' + expectedTag + '.');
}

const releaseNotesPath = path.join(repositoryRoot, 'docs', 'releases', expectedTag + '.md');
const releaseNotes = await readFile(releaseNotesPath, 'utf8');
if (!releaseNotes.startsWith('# ModuQR ' + expectedTag) || !releaseNotes.includes('## Validation')) {
  throw new Error('Release notes for ' + expectedTag + ' are missing the expected title or validation section: ' + releaseNotesPath);
}

process.stdout.write('Release tag, ' + (workspaceEntries.length + 1) + ' workspace package versions and release notes verified: ' + tag + '\n');
