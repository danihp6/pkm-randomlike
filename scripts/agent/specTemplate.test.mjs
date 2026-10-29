import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const TEMPLATE = readFileSync(join(ROOT, 'docs', 'agent-spec-template.md'), 'utf8');
const AGENTS = readFileSync(join(ROOT, 'AGENTS.md'), 'utf8');

const TEMPLATE_SECTIONS = [
  '🎯 Scope',
  'Exclusive paths (single writer)',
  'Inputs (read-only)',
  '🔒 Contract',
  '🧩 Data and configuration',
  '🧪 Test and Validation Plan (for QA)',
  '📣 Coordination',
  '⛔ Out of scope',
];

const SCREEN_INPUTS = ['design/exports/<slug>.png', 'design/screens/<slug>.json'];

const INPUT_TOKENS = [
  'caption',
  'exactly as the board draws it',
  '03 Route HUD',
  '03-route-hud',
  'routed screen',
  'HUD panel',
  'not ready to launch',
  'D57',
];

const CRITERION_TOKENS = ['pixel', 'not a criterion', 'D57'];

const AGENTS_TOKENS = [
  'design/screens/<slug>.json',
  'design/exports/<slug>.png',
  'caption',
  'not ready to launch',
  'D57',
  'docs/agent-spec-template.md',
  'plus `AGENTS.md`',
];

function sections(markdown) {
  const lines = markdown.split(/\r?\n/);
  const headings = [];
  lines.forEach((line, index) => {
    const match = /^(#{1,3})\s+(.+?)\s*$/.exec(line);
    if (match) headings.push({ level: match[1].length, title: match[2], index });
  });
  const map = new Map();
  headings.forEach((heading, position) => {
    const next = headings.slice(position + 1).find((candidate) => candidate.level <= heading.level);
    map.set(heading.title, lines.slice(heading.index + 1, next ? next.index : lines.length).join('\n'));
  });
  return map;
}

function requiredInputs(markdown) {
  const body = sections(markdown).get('Inputs (read-only)') ?? '';
  const paths = Array.from(body.matchAll(/`([^`]+)`/g), (match) => match[1]);
  return paths.filter((path) => /^design\/(screens|exports)\//.test(path)).sort();
}

function specsBullet(markdown) {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((line) => line.startsWith('- **Specs.**'));
  if (start === -1) return '';
  const end = lines.findIndex((line, index) => index > start && line.startsWith('- **'));
  return lines.slice(start, end === -1 ? lines.length : end).join('\n');
}

const template = sections(TEMPLATE);
const inputs = template.get('Inputs (read-only)') ?? '';
const plan = template.get('🧪 Test and Validation Plan (for QA)') ?? '';

describe('the spec template', () => {
  it('keeps all eight sections the template owns', () => {
    for (const title of TEMPLATE_SECTIONS) expect(template.has(title), title).toBe(true);
    expect(template.size).toBeGreaterThanOrEqual(TEMPLATE_SECTIONS.length);
  });

  it('names both screen files in its Inputs section, so a spec written from it cannot omit one', () => {
    expect(requiredInputs(TEMPLATE)).toEqual(SCREEN_INPUTS);
  });

  it('states the caption rule, the slug rule and the launch consequence', () => {
    for (const token of INPUT_TOKENS) expect(inputs, token).toContain(token);
  });

  it('keeps a pixel diff out of the acceptance criteria', () => {
    expect(plan).toContain('[unit]');
    expect(plan).toContain('[live]');
    for (const token of CRITERION_TOKENS) expect(plan, token).toContain(token);
  });
});

describe('AGENTS.md', () => {
  it('makes a screen task name its spec before it is ready to launch', () => {
    const bullet = specsBullet(AGENTS);
    expect(bullet).not.toBe('');
    for (const token of AGENTS_TOKENS) expect(bullet, token).toContain(token);
  });
});
