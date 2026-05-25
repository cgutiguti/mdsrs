import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDeckTree, parseCollection, type Card, type DeckSource, type DeckTreeNode } from '@mdsrs/core';

const frontmatterPattern = /^---\s*\n([\s\S]*?)\n---\s*\n?/;
const externalUrlPattern = /^(?:[a-z][a-z0-9+.-]*:|#|\/)/i;

const defaultAssetExtensions = new Set([
	'.avif',
	'.gif',
	'.jpeg',
	'.jpg',
	'.m4a',
	'.m4v',
	'.mov',
	'.mp3',
	'.mp4',
	'.ogg',
	'.png',
	'.svg',
	'.wav',
	'.webm',
	'.webp'
]);

export interface LoadCollectionOptions {
	assetExtensions?: Iterable<string>;
	includeHidden?: boolean;
}

export interface CollectionAsset {
	path: string;
	absolutePath: string;
}

export interface LoadedCollection {
	rootPath: string;
	sources: DeckSource[];
	cards: Card[];
	deckTree: DeckTreeNode[];
	assets: CollectionAsset[];
}

const toRootPath = (root: string | URL) =>
	path.resolve(root instanceof URL ? fileURLToPath(root) : root);

const toPosixPath = (value: string) => value.split(path.sep).join('/');

const parseFrontmatterName = (text: string) => {
	const match = text.match(frontmatterPattern);
	const frontmatter = match?.[1] ?? '';
	const name = frontmatter.match(/^name\s*=\s*"(.+)"\s*$/m)?.[1];

	return name ?? null;
};

const stripFrontmatter = (text: string) => text.replace(frontmatterPattern, '');

const fileStem = (filePath: string) => filePath.split('/').at(-1)?.replace(/\.md$/, '') ?? 'Untitled';

const titleize = (value: string) =>
	value
		.split(/[-_\s]+/)
		.filter(Boolean)
		.map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
		.join(' ');

export const sourceHierarchy = (filePath: string, frontmatterName: string | null) => {
	const pathWithoutExtension = filePath.replace(/\.md$/, '');
	const parts = pathWithoutExtension.split('/').filter(Boolean);
	const isIndex = parts.at(-1) === 'index';
	const nodeParts = isIndex ? parts.slice(0, -1) : parts;
	const folderParts = isIndex ? nodeParts : nodeParts.slice(0, -1);
	const nodePath = nodeParts.join('/');
	const folderPath = folderParts.join('/');
	const fallbackName = titleize(nodeParts.at(-1) ?? fileStem(filePath));
	const displayName = frontmatterName ?? fallbackName;

	return {
		folderPath,
		nodePath,
		displayName,
		deckName: nodePath || displayName
	};
};

const normalizeContentPath = (contentPath: string) => {
	const parts: string[] = [];

	for (const part of contentPath.split('/')) {
		if (!part || part === '.') continue;
		if (part === '..') {
			if (parts.length === 0) return null;
			parts.pop();
			continue;
		}
		parts.push(part);
	}

	return parts.join('/');
};

export const resolveContentAssetPath = (filePath: string, assetPath: string) => {
	if (externalUrlPattern.test(assetPath)) return assetPath;

	return assetPath.startsWith('@/')
		? normalizeContentPath(assetPath.slice(2))
		: normalizeContentPath(`${filePath.split('/').slice(0, -1).join('/')}/${assetPath}`);
};

export const resolveCollectionAssetPath = (rootPath: string, contentAssetPath: string) => {
	if (externalUrlPattern.test(contentAssetPath)) return contentAssetPath;
	const normalized = normalizeContentPath(contentAssetPath);
	return normalized ? path.join(rootPath, ...normalized.split('/')) : null;
};

export const loadDeckSources = async (
	root: string | URL,
	options: LoadCollectionOptions = {}
): Promise<DeckSource[]> => {
	const rootPath = toRootPath(root);
	const files = await walkFiles(rootPath, options);
	const markdownFiles = files
		.filter((filePath) => filePath.toLowerCase().endsWith('.md'))
		.sort((left, right) => left.localeCompare(right));

	return Promise.all(
		markdownFiles.map(async (absolutePath) => {
			const filePath = toPosixPath(path.relative(rootPath, absolutePath));
			const text = await readFile(absolutePath, 'utf8');
			const hierarchy = sourceHierarchy(filePath, parseFrontmatterName(text));

			return {
				deckName: hierarchy.deckName,
				filePath,
				folderPath: hierarchy.folderPath,
				nodePath: hierarchy.nodePath,
				displayName: hierarchy.displayName,
				text: stripFrontmatter(text)
			};
		})
	);
};

export const loadAssets = async (
	root: string | URL,
	options: LoadCollectionOptions = {}
): Promise<CollectionAsset[]> => {
	const rootPath = toRootPath(root);
	const assetExtensions = new Set(
		[...(options.assetExtensions ?? defaultAssetExtensions)].map((extension) =>
			extension.startsWith('.') ? extension.toLowerCase() : `.${extension.toLowerCase()}`
		)
	);
	const files = await walkFiles(rootPath, options);

	return files
		.filter((filePath) => assetExtensions.has(path.extname(filePath).toLowerCase()))
		.sort((left, right) => left.localeCompare(right))
		.map((absolutePath) => ({
			path: toPosixPath(path.relative(rootPath, absolutePath)),
			absolutePath
		}));
};

export const loadCollection = async (
	root: string | URL,
	options: LoadCollectionOptions = {}
): Promise<LoadedCollection> => {
	const rootPath = toRootPath(root);
	const [sources, assets] = await Promise.all([
		loadDeckSources(rootPath, options),
		loadAssets(rootPath, options)
	]);
	const cards = parseCollection(sources);

	return {
		rootPath,
		sources,
		cards,
		deckTree: buildDeckTree(cards),
		assets
	};
};

const walkFiles = async (rootPath: string, options: LoadCollectionOptions) => {
	const rootStats = await stat(rootPath);
	if (!rootStats.isDirectory()) {
		throw new Error(`Collection root must be a directory: ${rootPath}`);
	}

	const files: string[] = [];
	const visit = async (directoryPath: string) => {
		const entries = await readdir(directoryPath, { withFileTypes: true });
		entries.sort((left, right) => left.name.localeCompare(right.name));

		for (const entry of entries) {
			if (!options.includeHidden && entry.name.startsWith('.')) continue;

			const entryPath = path.join(directoryPath, entry.name);
			if (entry.isDirectory()) await visit(entryPath);
			else if (entry.isFile()) files.push(entryPath);
		}
	};

	await visit(rootPath);
	return files;
};

