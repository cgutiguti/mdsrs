#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCollection, type LoadedCollection } from '@mdsrs/fs';

export interface CliIo {
	stdout: Pick<NodeJS.WriteStream, 'write'>;
	stderr: Pick<NodeJS.WriteStream, 'write'>;
}

interface CliOptions {
	pretty: boolean;
}

const usage = `Usage:
  mdsrs check <root>
  mdsrs export <root> [--pretty]
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

		if (command === 'check') {
			const { root, options } = parseRootCommand(args);
			rejectUnusedOptions(options, ['pretty']);
			const collection = await loadCollection(root);
			io.stdout.write(formatSummary(collection));
			return 0;
		}

		if (command === 'export') {
			const { root, options } = parseRootCommand(args);
			const collection = await loadCollection(root);
			io.stdout.write(`${JSON.stringify(collection, null, options.pretty ? 2 : 0)}\n`);
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
	const options: CliOptions = { pretty: false };
	const positionals: string[] = [];

	for (const arg of args) {
		if (arg === '--pretty') {
			options.pretty = true;
		} else if (arg.startsWith('-')) {
			throw new Error(`Unknown option: ${arg}`);
		} else {
			positionals.push(arg);
		}
	}

	const [root, extra] = positionals;
	if (!root) throw new Error(`Missing collection root.\n\n${usage}`);
	if (extra) throw new Error(`Unexpected argument: ${extra}`);

	return {
		root,
		options
	};
};

const rejectUnusedOptions = (options: CliOptions, unusedOptions: Array<keyof CliOptions>) => {
	for (const option of unusedOptions) {
		if (options[option]) throw new Error(`Option is not supported for this command: --${option}`);
	}
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

const isMain = () => {
	const entrypoint = process.argv[1];
	return entrypoint ? path.resolve(entrypoint) === fileURLToPath(import.meta.url) : false;
};

if (isMain()) {
	process.exitCode = await runCli(process.argv.slice(2));
}

