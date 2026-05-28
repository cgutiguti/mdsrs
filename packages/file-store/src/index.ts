import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Card, Grade } from '@mdsrs/core';
import {
	createMemoryStore,
	type MemoryStoreSnapshot,
	type SrsStore,
	type StoredCard,
	type StoredReview
} from '@mdsrs/store';

export const fileStoreSchemaVersion = 1;

export interface FileStoreDocument extends MemoryStoreSnapshot {
	schemaVersion: typeof fileStoreSchemaVersion;
}

export interface FileStoreOptions {
	createIfMissing?: boolean;
}

export type FileSrsStore = SrsStore & {
	filePath: string;
	snapshot(): FileStoreDocument;
	save(): Promise<void>;
};

export const createFileStore = async (
	filePath: string,
	options: FileStoreOptions = {}
): Promise<FileSrsStore> => {
	const absolutePath = path.resolve(filePath);
	const createIfMissing = options.createIfMissing ?? true;
	const initialSnapshot = await loadSnapshot(absolutePath, createIfMissing);
	const memory = createMemoryStore(initialSnapshot);

	const snapshot = (): FileStoreDocument => ({
		schemaVersion: fileStoreSchemaVersion,
		...memory.snapshot()
	});

	const save = async () => {
		await writeSnapshot(absolutePath, snapshot());
	};

	return {
		filePath: absolutePath,
		snapshot,
		save,

		async syncCards(cards: Card[], syncedAt?: Date) {
			await memory.syncCards(cards, syncedAt);
			await save();
		},

		getCards: (cardHashes?: string[]) => memory.getCards(cardHashes),
		getPerformances: (cardHashes: string[]) => memory.getPerformances(cardHashes),
		getDueCards: (cards, options) => memory.getDueCards(cards, options),

		async reviewCard(cardHash: string, grade: Grade, reviewedAt?: Date) {
			const result = await memory.reviewCard(cardHash, grade, reviewedAt);
			await save();
			return result;
		},

		getReviews: (cardHashes?: string[]) => memory.getReviews(cardHashes),
		getCardStats: (cardHashes: string[]) => memory.getCardStats(cardHashes)
	};
};

const loadSnapshot = async (
	filePath: string,
	createIfMissing: boolean
): Promise<Partial<MemoryStoreSnapshot>> => {
	try {
		const text = await readFile(filePath, 'utf8');
		return parseSnapshot(JSON.parse(text));
	} catch (error) {
		if (isNotFoundError(error) && createIfMissing) return {};
		throw error;
	}
};

const parseSnapshot = (value: unknown): MemoryStoreSnapshot => {
	if (!isRecord(value)) throw new Error('Invalid mdsrs file store: expected an object.');
	const schemaVersion = value.schemaVersion;

	if (schemaVersion !== fileStoreSchemaVersion) {
		throw new Error(`Unsupported mdsrs file store schema version: ${String(schemaVersion)}`);
	}

	if (!Array.isArray(value.cards)) throw new Error('Invalid mdsrs file store: cards must be an array.');
	if (!Array.isArray(value.reviews)) {
		throw new Error('Invalid mdsrs file store: reviews must be an array.');
	}
	const nextReviewId = value.nextReviewId;
	if (typeof nextReviewId !== 'number' || !Number.isInteger(nextReviewId)) {
		throw new Error('Invalid mdsrs file store: nextReviewId must be an integer.');
	}

	return {
		cards: value.cards.map(parseStoredCard),
		reviews: value.reviews.map(parseStoredReview),
		nextReviewId
	};
};

const writeSnapshot = async (filePath: string, snapshot: FileStoreDocument) => {
	const directory = path.dirname(filePath);
	await mkdir(directory, { recursive: true });
	const temporaryPath = path.join(
		directory,
		`.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`
	);

	try {
		await writeFile(temporaryPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
		await rename(temporaryPath, filePath);
	} catch (error) {
		await rm(temporaryPath, { force: true });
		throw error;
	}
};

const parseStoredCard = (value: unknown): StoredCard => {
	if (!isRecord(value)) throw new Error('Invalid mdsrs file store: card must be an object.');

	return {
		cardHash: readString(value, 'cardHash'),
		deckName: readString(value, 'deckName'),
		filePath: readString(value, 'filePath'),
		familyHash: readNullableString(value, 'familyHash'),
		frontMarkdown: readString(value, 'frontMarkdown'),
		backMarkdown: readString(value, 'backMarkdown'),
		cardType: readCardType(value, 'cardType'),
		active: readBoolean(value, 'active'),
		addedAt: readString(value, 'addedAt'),
		lastSeenAt: readString(value, 'lastSeenAt'),
		performance: {
			lastReviewedAt: readNullableString(value.performance, 'lastReviewedAt'),
			stability: readNullableNumber(value.performance, 'stability'),
			difficulty: readNullableNumber(value.performance, 'difficulty'),
			intervalRaw: readNullableNumber(value.performance, 'intervalRaw'),
			intervalDays: readNullableNumber(value.performance, 'intervalDays'),
			dueDate: readNullableString(value.performance, 'dueDate'),
			reviewCount: readNumber(value.performance, 'reviewCount')
		}
	};
};

const parseStoredReview = (value: unknown): StoredReview => {
	if (!isRecord(value)) throw new Error('Invalid mdsrs file store: review must be an object.');

	return {
		reviewId: readNumber(value, 'reviewId'),
		cardHash: readString(value, 'cardHash'),
		reviewedAt: readString(value, 'reviewedAt'),
		grade: readGrade(value, 'grade'),
		stability: readNumber(value, 'stability'),
		difficulty: readNumber(value, 'difficulty'),
		intervalRaw: readNumber(value, 'intervalRaw'),
		intervalDays: readNumber(value, 'intervalDays'),
		dueDate: readString(value, 'dueDate')
	};
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value != null && !Array.isArray(value);

const readString = (record: unknown, key: string): string => {
	if (!isRecord(record) || typeof record[key] !== 'string') {
		throw new Error(`Invalid mdsrs file store: ${key} must be a string.`);
	}
	return record[key];
};

const readNullableString = (record: unknown, key: string): string | null => {
	if (!isRecord(record) || (record[key] !== null && typeof record[key] !== 'string')) {
		throw new Error(`Invalid mdsrs file store: ${key} must be a string or null.`);
	}
	return record[key];
};

const readNumber = (record: unknown, key: string): number => {
	if (!isRecord(record) || typeof record[key] !== 'number') {
		throw new Error(`Invalid mdsrs file store: ${key} must be a number.`);
	}
	return record[key];
};

const readNullableNumber = (record: unknown, key: string): number | null => {
	if (!isRecord(record) || (record[key] !== null && typeof record[key] !== 'number')) {
		throw new Error(`Invalid mdsrs file store: ${key} must be a number or null.`);
	}
	return record[key];
};

const readBoolean = (record: unknown, key: string): boolean => {
	if (!isRecord(record) || typeof record[key] !== 'boolean') {
		throw new Error(`Invalid mdsrs file store: ${key} must be a boolean.`);
	}
	return record[key];
};

const readCardType = (record: unknown, key: string): StoredCard['cardType'] => {
	const value = readString(record, key);
	if (value === 'basic' || value === 'cloze') return value;
	throw new Error(`Invalid mdsrs file store: ${key} must be basic or cloze.`);
};

const readGrade = (record: unknown, key: string): Grade => {
	const value = readString(record, key);
	if (value === 'forgot' || value === 'hard' || value === 'good' || value === 'easy') return value;
	throw new Error(`Invalid mdsrs file store: ${key} must be a review grade.`);
};

const isNotFoundError = (error: unknown) =>
	isRecord(error) && 'code' in error && error.code === 'ENOENT';
