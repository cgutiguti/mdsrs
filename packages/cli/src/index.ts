#!/usr/bin/env node
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Grade, ReviewQueueItem } from '@mdsrs/core';
import { createFileStore } from '@mdsrs/file-store';
import { loadCollection, type LoadedCollection } from '@mdsrs/fs';

export interface CliIo {
	stdout: Pick<NodeJS.WriteStream, 'write'>;
	stderr: Pick<NodeJS.WriteStream, 'write'>;
}

interface CliOptions {
	db: string | null;
	force: boolean;
	limit: number | null;
	pretty: boolean;
}

const usage = `Usage:
  mdsrs init <root> [--force]
  mdsrs check <root>
  mdsrs export <root> [--pretty]
  mdsrs sync <root> [--db <file>]
  mdsrs due <root> [--db <file>] [--limit <count>]
  mdsrs review <root> <card-hash> <forgot|hard|good|easy> [--db <file>]
  mdsrs help
`;

export const runCli = async (
	argv: string[],
	io: CliIo = { stdout: process.stdout, stderr: process.stderr }
) => {
	const [command, ...args] = argv;

	try {
		if (!command || command === 'help' || command === '--help' || command === '-h') {
			io.stdout.write(usage);
			return 0;
		}

		if (command === 'init') {
			const { root, options } = parseRootCommand(args);
			rejectUnusedOptions(options, ['db', 'limit', 'pretty']);
			const result = await initCollection(root, { force: options.force });
			io.stdout.write(formatInitSummary(result));
			return 0;
		}

		if (command === 'check') {
			const { root, options } = parseRootCommand(args);
			rejectUnusedOptions(options, ['db', 'force', 'limit', 'pretty']);
			const collection = await loadCollection(root);
			io.stdout.write(formatSummary(collection));
			return 0;
		}

		if (command === 'export') {
			const { root, options } = parseRootCommand(args);
			rejectUnusedOptions(options, ['db', 'force', 'limit']);
			const collection = await loadCollection(root);
			io.stdout.write(`${JSON.stringify(collection, null, options.pretty ? 2 : 0)}\n`);
			return 0;
		}

		if (command === 'sync') {
			const { root, options } = parseRootCommand(args);
			rejectUnusedOptions(options, ['force', 'limit', 'pretty']);
			const collection = await loadCollection(root);
			const store = await createFileStore(resolveDbPath(root, options.db));
			await store.syncCards(collection.cards);
			io.stdout.write(formatSyncSummary(collection, store.filePath));
			return 0;
		}

		if (command === 'due') {
			const { root, options } = parseRootCommand(args);
			rejectUnusedOptions(options, ['force', 'pretty']);
			const collection = await loadCollection(root);
			const store = await createFileStore(resolveDbPath(root, options.db));
			await store.syncCards(collection.cards);
			const queue = await store.getDueCards(collection.cards, {
				burySiblings: true,
				...(options.limit == null ? {} : { limit: options.limit })
			});
			io.stdout.write(formatDueSummary(queue));
			return 0;
		}

		if (command === 'review') {
			const { root, cardHash, grade, options } = parseReviewCommand(args);
			rejectUnusedOptions(options, ['force', 'limit', 'pretty']);
			const collection = await loadCollection(root);
			const store = await createFileStore(resolveDbPath(root, options.db));
			await store.syncCards(collection.cards);
			const result = await store.reviewCard(cardHash, grade);
			io.stdout.write(
				[
					`reviewed: ${cardHash}`,
					`grade: ${result.grade}`,
					`due: ${result.dueDate}`,
					`reviews: ${result.reviewCount}`
				].join('\n') + '\n'
			);
			return 0;
		}

		io.stderr.write(`Unknown command: ${command}\n\n${usage}`);
		return 1;
	} catch (error) {
		io.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		return 1;
	}
};

const parseRootCommand = (args: string[]) => {
	const { positionals, options } = parseArgs(args);

	const [root, extra] = positionals;
	if (!root) throw new Error(`Missing collection root.\n\n${usage}`);
	if (extra) throw new Error(`Unexpected argument: ${extra}`);

	return {
		root,
		options
	};
};

const parseReviewCommand = (args: string[]) => {
	const { positionals, options } = parseArgs(args);
	const [root, cardHash, grade, extra] = positionals;

	if (!root) throw new Error(`Missing collection root.\n\n${usage}`);
	if (!cardHash) throw new Error(`Missing card hash.\n\n${usage}`);
	if (!grade) throw new Error(`Missing review grade.\n\n${usage}`);
	if (extra) throw new Error(`Unexpected argument: ${extra}`);
	if (!isGrade(grade)) throw new Error(`Invalid review grade: ${grade}`);

	return {
		root,
		cardHash,
		grade,
		options
	};
};

const parseArgs = (args: string[]) => {
	const options: CliOptions = { db: null, force: false, limit: null, pretty: false };
	const positionals: string[] = [];

	for (let index = 0; index < args.length; index += 1) {
		const arg = args[index];
		if (arg === '--force') options.force = true;
		else if (arg === '--pretty') options.pretty = true;
		else if (arg === '--db') {
			const value = args[++index];
			if (!value) throw new Error('Missing value for --db');
			options.db = value;
		} else if (arg === '--limit') {
			const value = args[++index];
			if (!value) throw new Error('Missing value for --limit');
			options.limit = parseLimit(value);
		} else if (arg?.startsWith('-')) {
			throw new Error(`Unknown option: ${arg}`);
		} else if (arg) {
			positionals.push(arg);
		}
	}

	return {
		positionals,
		options
	};
};

const rejectUnusedOptions = (options: CliOptions, unusedOptions: Array<keyof CliOptions>) => {
	for (const option of unusedOptions) {
		if (options[option] != null && options[option] !== false) {
			throw new Error(`Option is not supported for this command: --${option}`);
		}
	}
};

interface InitCollectionOptions {
	force?: boolean;
}

interface InitCollectionResult {
	rootPath: string;
	writtenFiles: string[];
}

const starterFiles = {
	'README.md': `# mdsrs cards

This folder is a Markdown-native spaced repetition collection.

Run:

\`\`\`sh
mdsrs check .
mdsrs export . --pretty
\`\`\`

Cards live in Markdown files. Use \`Q:\` and \`A:\` for basic cards, or \`C:\`
with bracketed text for cloze cards.
`,
	'cards/index.md': `---
name = "Cards"
---

Q: What is the source of truth in mdsrs?
A: Markdown files.

---

C: Editing card [content] changes its deterministic hash.
`,
	'cards/example/math.md': `---
name = "Math"
---

Q: What is the derivative of $x^2$?
A: $2x$.

---

C: Euler's identity is $e^{i\\pi} + [1] = 0$.
`,
	'cards/example/concepts.md': `---
name = "Concepts"
---

Q: What does a card hash identify?
A: The normalized card content, not a database row.

---

C: Nested folders become nested [decks].
`
} satisfies Record<string, string>;

export const initCollection = async (
	root: string,
	options: InitCollectionOptions = {}
): Promise<InitCollectionResult> => {
	const rootPath = path.resolve(root);
	await mkdir(rootPath, { recursive: true });

	const entries = await readdir(rootPath);
	if (!options.force && entries.length > 0) {
		throw new Error(`Refusing to initialize non-empty directory without --force: ${rootPath}`);
	}

	const writtenFiles: string[] = [];
	for (const [relativePath, content] of Object.entries(starterFiles)) {
		const absolutePath = path.join(rootPath, ...relativePath.split('/'));
		await mkdir(path.dirname(absolutePath), { recursive: true });
		await writeFile(absolutePath, content, 'utf8');
		writtenFiles.push(relativePath);
	}

	return {
		rootPath,
		writtenFiles
	};
};

const countDeckNodes = (nodes: LoadedCollection['deckTree']): number =>
	nodes.reduce((total, node) => total + 1 + countDeckNodes(node.children), 0);

const formatSummary = (collection: LoadedCollection) =>
	[
		`root: ${collection.rootPath}`,
		`sources: ${collection.sources.length}`,
		`cards: ${collection.cards.length}`,
		`decks: ${countDeckNodes(collection.deckTree)}`,
		`assets: ${collection.assets.length}`
	].join('\n') + '\n';

const formatSyncSummary = (collection: LoadedCollection, filePath: string) =>
	[
		`db: ${filePath}`,
		`cards: ${collection.cards.length}`,
		`sources: ${collection.sources.length}`,
		`decks: ${countDeckNodes(collection.deckTree)}`
	].join('\n') + '\n';

const formatDueSummary = (queue: ReviewQueueItem[]) => {
	if (queue.length === 0) return 'due: 0\n';

	return [
		`due: ${queue.length}`,
		...queue.map(({ card }) =>
			[
				card.hash,
				card.deckName,
				oneLine(card.frontMarkdown)
			].join('\t')
		)
	].join('\n') + '\n';
};

const formatInitSummary = (result: InitCollectionResult) =>
	[
		`initialized: ${result.rootPath}`,
		`files: ${result.writtenFiles.length}`,
		...result.writtenFiles.map((filePath) => `created: ${filePath}`)
	].join('\n') + '\n';

const resolveDbPath = (root: string, dbPath: string | null) =>
	dbPath ? path.resolve(dbPath) : path.join(path.resolve(root), '.mdsrs', 'srs.json');

const parseLimit = (value: string) => {
	const limit = Number(value);
	if (!Number.isInteger(limit) || limit < 1) throw new Error(`Invalid limit: ${value}`);
	return limit;
};

const isGrade = (value: string): value is Grade =>
	value === 'forgot' || value === 'hard' || value === 'good' || value === 'easy';

const oneLine = (value: string) => value.replace(/\s+/g, ' ').trim();

const isMain = () => {
	const entrypoint = process.argv[1];
	return entrypoint ? path.resolve(entrypoint) === fileURLToPath(import.meta.url) : false;
};

if (isMain()) {
	process.exitCode = await runCli(process.argv.slice(2));
}
