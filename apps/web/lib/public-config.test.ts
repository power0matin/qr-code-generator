import { afterEach, describe, expect, it } from 'vitest';
import { getPublicSiteUrl, getRepositoryUrl } from './public-config';

const originalSiteUrl = process.env['NEXT_PUBLIC_SITE_URL'];
const originalRepositoryUrl = process.env['NEXT_PUBLIC_REPOSITORY_URL'];

afterEach(() => {
  restoreEnv('NEXT_PUBLIC_SITE_URL', originalSiteUrl);
  restoreEnv('NEXT_PUBLIC_REPOSITORY_URL', originalRepositoryUrl);
});

describe('getPublicSiteUrl', () => {
  it('falls back to localhost when no public URL is configured', () => {
    delete process.env['NEXT_PUBLIC_SITE_URL'];
    expect(getPublicSiteUrl().toString()).toBe('http://localhost:3000/');
  });

  it('normalizes a configured public URL to its origin', () => {
    process.env['NEXT_PUBLIC_SITE_URL'] = 'https://moduqr.example/path?query=1';
    expect(getPublicSiteUrl().toString()).toBe('https://moduqr.example/');
  });

  it('rejects credentials and unsupported protocols', () => {
    process.env['NEXT_PUBLIC_SITE_URL'] = 'https://user:secret@moduqr.example';
    expect(getPublicSiteUrl().toString()).toBe('http://localhost:3000/');

    process.env['NEXT_PUBLIC_SITE_URL'] = 'javascript:alert(1)';
    expect(getPublicSiteUrl().toString()).toBe('http://localhost:3000/');
  });
});

describe('getRepositoryUrl', () => {
  it('accepts and normalizes a two-segment HTTPS GitHub repository URL', () => {
    process.env['NEXT_PUBLIC_REPOSITORY_URL'] = 'https://github.com/power0matin/qr-code-generator/';
    expect(getRepositoryUrl()).toBe('https://github.com/power0matin/qr-code-generator');
  });

  it('rejects non-GitHub, credentialed, and nested URLs', () => {
    process.env['NEXT_PUBLIC_REPOSITORY_URL'] = 'https://example.com/power0matin/qr-code-generator';
    expect(getRepositoryUrl()).toBeNull();

    process.env['NEXT_PUBLIC_REPOSITORY_URL'] = 'https://user:secret@github.com/power0matin/qr-code-generator';
    expect(getRepositoryUrl()).toBeNull();

    process.env['NEXT_PUBLIC_REPOSITORY_URL'] = 'https://github.com/power0matin/qr-code-generator/issues';
    expect(getRepositoryUrl()).toBeNull();
  });
});

function restoreEnv(key: 'NEXT_PUBLIC_SITE_URL' | 'NEXT_PUBLIC_REPOSITORY_URL', value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }
  process.env[key] = value;
}
