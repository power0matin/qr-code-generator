import { describe, expect, it } from 'vitest';
import { MAX_BATCH_ROWS, parseBatchRows, prepareBatchJobs } from './batch-core';

describe('batch preparation', () => {
  it('parses quoted CSV cells and template variables', () => {
    const jobs = prepareBatchJobs('name,url\n"Ada, Inc.",https://example.com/a\nBob,https://example.com/b', 'csv', '{{url}}?name={{name}}', '{{name}}-{{index}}');
    expect(jobs).toHaveLength(2);
    expect(jobs[0]?.payload).toBe('https://example.com/a?name=Ada, Inc.');
    expect(jobs[0]?.filename).toBe('Ada,-Inc.-1');
  });

  it('supports TSV and JSON arrays', () => {
    expect(parseBatchRows('name\turl\nA\thttps://a.example', 'tsv')).toHaveLength(1);
    expect(prepareBatchJobs('[{"url":"https://a.example"},{"url":"https://b.example"}]', 'json', '{{url}}', 'qr-{{index}}')).toHaveLength(2);
  });

  it('accepts 500 rows and rejects row 501', () => {
    const make = (count: number) => ['url', ...Array.from({ length: count }, (_value, index) => `https://example.com/${index}`)].join('\n');
    expect(prepareBatchJobs(make(MAX_BATCH_ROWS), 'csv', '{{url}}', 'qr-{{index}}')).toHaveLength(MAX_BATCH_ROWS);
    expect(() => prepareBatchJobs(make(MAX_BATCH_ROWS + 1), 'csv', '{{url}}', 'qr-{{index}}')).toThrow(/500 rows/);
  });

  it('rejects empty payload templates per row', () => {
    expect(() => prepareBatchJobs('name\nAda', 'csv', '{{missing}}', '{{name}}')).toThrow(/empty payload/);
  });

  it('does not resolve inherited prototype property names as template variables', () => {
    const jobs = prepareBatchJobs('name\nhello', 'csv', '{{constructor}}/{{name}}', '{{__proto__}}-{{index}}');
    expect(jobs[0]?.payload).toBe('/hello');
    expect(jobs[0]?.filename).toBe('1');
  });

});
