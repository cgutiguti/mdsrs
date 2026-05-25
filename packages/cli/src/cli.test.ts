import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { runCli, type CliIo } from './index.js';

const fixtureRoot = fileURLToPath(new URL('../../fs/test-fixtures/collection', import.meta.url));

const createIo = () => {
	let stdout = '';
	let stderr = '';
	const io: CliIo = {
		stdout: {
			write: (chunk: string | Uint8Array) => {
				stdout += String(chunk);
				return true;
			}
		},
		stderr: {
			write: (chunk: string | Uint8Array) => {
				stderr += String(chunk);
				return true;
			}
		}
	};

	return {
		io,
		get stdout() {
			return stdout;
		},
		get stderr() {
			return stderr;
		}
	};
};

describe('runCli', () => {
	it('prints help', async () => {
		const capture = createIo();

		await expect(runCli(['help'], capture.io)).resolves.toBe(0);
		expect(capture.stdout).toContain('mdsrs check <root>');
		expect(capture.stderr).toBe('');
	});

	it('checks a collection and prints a summary', async () => {
		const capture = createIo();

		await expect(runCli(['check', fixtureRoot], capture.io)).resolves.toBe(0);
		expect(capture.stdout).toContain(`root: ${fixtureRoot}`);
		expect(capture.stdout).toContain('sources: 2');
		expect(capture.stdout).toContain('cards: 4');
		expect(capture.stdout).toContain('decks: 3');
		expect(capture.stdout).toContain('assets: 1');
		expect(capture.stderr).toBe('');
	});

	it('exports compact collection JSON', async () => {
		const capture = createIo();

		await expect(runCli(['export', fixtureRoot], capture.io)).resolves.toBe(0);
		const exported = JSON.parse(capture.stdout) as {
			sources: unknown[];
			cards: unknown[];
			deckTree: unknown[];
			assets: unknown[];
		};

		expect(exported.sources).toHaveLength(2);
		expect(exported.cards).toHaveLength(4);
		expect(exported.deckTree).toHaveLength(1);
		expect(exported.assets).toHaveLength(1);
		expect(capture.stdout).not.toContain('\n  "');
	});

	it('exports pretty collection JSON', async () => {
		const capture = createIo();

		await expect(runCli(['export', fixtureRoot, '--pretty'], capture.io)).resolves.toBe(0);
		expect(capture.stdout).toContain('\n  "rootPath"');
		expect(JSON.parse(capture.stdout)).toMatchObject({
			sources: expect.any(Array),
			cards: expect.any(Array)
		});
	});

	it('returns nonzero for unknown commands and load errors', async () => {
		const unknown = createIo();
		const missing = createIo();

		await expect(runCli(['wat'], unknown.io)).resolves.toBe(1);
		expect(unknown.stderr).toContain('Unknown command: wat');

		await expect(runCli(['check', `${fixtureRoot}/missing`], missing.io)).resolves.toBe(1);
		expect(missing.stderr).toContain('ENOENT');
	});
});

