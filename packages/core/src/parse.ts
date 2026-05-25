import { hashCardContent, hashCardFamily } from './hash.js';
import { renderBackMarkdown, renderFrontMarkdown } from './render.js';
import type { Card, CardContent, DeckSource } from './types.js';

export class MdsrsParseError extends Error {
	constructor(
		message: string,
		readonly filePath: string,
		readonly line: number
	) {
		super(`${message} Location: ${filePath}:${line + 1}`);
	}
}

const defaultNodePath = (filePath: string) => {
	const parts = filePath.replace(/\.md$/, '').split('/').filter(Boolean);
	return (parts.at(-1) === 'index' ? parts.slice(0, -1) : parts).join('/');
};

const lineKind = (line: string) => {
	if (line.startsWith('Q:')) return ['question', line.slice(2).trim()] as const;
	if (line.startsWith('A:')) return ['answer', line.slice(2).trim()] as const;
	if (line.startsWith('C:')) return ['cloze', line.slice(2).trim()] as const;
	if (line.trim() === '---') return ['separator', ''] as const;
	return ['text', line] as const;
};

const makeCard = (source: DeckSource, range: [number, number], content: CardContent): Card => ({
	hash: hashCardContent(content),
	familyHash: hashCardFamily(content),
	deckName: source.deckName,
	filePath: source.filePath,
	folderPath: source.folderPath ?? '',
	nodePath: source.nodePath ?? defaultNodePath(source.filePath),
	displayName: source.displayName ?? source.deckName,
	range,
	content,
	frontMarkdown: renderFrontMarkdown(content),
	backMarkdown: renderBackMarkdown(content)
});

export const parseDeck = (source: DeckSource): Card[] => {
	const cards: Card[] = [];
	let state:
		| { type: 'start' }
		| { type: 'question'; question: string; startLine: number }
		| { type: 'answer'; question: string; answer: string; startLine: number }
		| { type: 'cloze'; text: string; startLine: number } = { type: 'start' };

	const lines = source.text.split(/\r?\n/);
	const finishBasic = (line: number, question: string, answer: string, startLine: number) => {
		cards.push(
			makeCard(source, [startLine, line], {
				type: 'basic',
				question: question.trim(),
				answer: answer.trim()
			})
		);
	};
	const finishCloze = (line: number, text: string, startLine: number) => {
		cards.push(...parseClozeCards(source, [startLine, line], text));
	};

	for (const [lineNumber, rawLine] of lines.entries()) {
		const [kind, text] = lineKind(rawLine);

		if (state.type === 'start') {
			if (kind === 'question') state = { type: 'question', question: text, startLine: lineNumber };
			else if (kind === 'answer')
				throw new MdsrsParseError('Found answer tag without a question.', source.filePath, lineNumber);
			else if (kind === 'cloze') state = { type: 'cloze', text, startLine: lineNumber };
			continue;
		}

		if (state.type === 'question') {
			if (kind === 'answer')
				state = {
					type: 'answer',
					question: state.question,
					answer: text,
					startLine: state.startLine
				};
			else if (kind === 'text') state = { ...state, question: `${state.question}\n${text}` };
			else if (kind === 'question')
				throw new MdsrsParseError('New question without answer.', source.filePath, lineNumber);
			else
				throw new MdsrsParseError(
					'Found invalid tag while reading a question.',
					source.filePath,
					lineNumber
				);
			continue;
		}

		if (state.type === 'answer') {
			if (kind === 'text') state = { ...state, answer: `${state.answer}\n${text}` };
			else {
				finishBasic(lineNumber, state.question, state.answer, state.startLine);
				if (kind === 'question') state = { type: 'question', question: text, startLine: lineNumber };
				else if (kind === 'cloze') state = { type: 'cloze', text, startLine: lineNumber };
				else if (kind === 'separator') state = { type: 'start' };
				else
					throw new MdsrsParseError(
						'Found answer tag while reading an answer.',
						source.filePath,
						lineNumber
					);
			}
			continue;
		}

		if (kind === 'text') state = { ...state, text: `${state.text}\n${text}` };
		else {
			finishCloze(lineNumber, state.text, state.startLine);
			if (kind === 'question') state = { type: 'question', question: text, startLine: lineNumber };
			else if (kind === 'cloze') state = { type: 'cloze', text, startLine: lineNumber };
			else if (kind === 'separator') state = { type: 'start' };
			else
				throw new MdsrsParseError(
					'Found answer tag while reading a cloze card.',
					source.filePath,
					lineNumber
				);
		}
	}

	const lastLine = Math.max(lines.length - 1, 0);
	if (state.type === 'question') {
		throw new MdsrsParseError(
			'File ended while reading a question without an answer.',
			source.filePath,
			lastLine
		);
	}
	if (state.type === 'answer') finishBasic(lastLine, state.question, state.answer, state.startLine);
	if (state.type === 'cloze') finishCloze(lastLine, state.text, state.startLine);

	return uniqueCards(cards);
};

export const parseCollection = (sources: DeckSource[]) => uniqueCards(sources.flatMap(parseDeck));

const uniqueCards = (cards: Card[]) => {
	const seen = new Set<string>();
	return cards
		.filter((card) => {
			if (seen.has(card.hash)) return false;
			seen.add(card.hash);
			return true;
		})
		.sort((left, right) => left.hash.localeCompare(right.hash));
};

const parseClozeCards = (source: DeckSource, range: [number, number], rawText: string) => {
	const text = rawText.trim();
	let cleanText = '';
	let open: number | null = null;
	const ranges: Array<[number, number]> = [];

	for (let index = 0; index < text.length; index++) {
		const char = text[index];
		const previous = text[index - 1];
		const next = text[index + 1];
		const isImageBracket = char === '[' && previous === '!';
		const isEscapedBracket = (char === '[' || char === ']') && previous === '\\';

		if (char === '\\' && (next === '[' || next === ']')) continue;
		if (char === '[' && !isImageBracket && !isEscapedBracket) {
			open = cleanText.length;
			continue;
		}
		if (char === ']' && open !== null && !isEscapedBracket) {
			ranges.push([open, cleanText.length - 1]);
			open = null;
			continue;
		}
		cleanText += char;
	}

	if (ranges.length === 0) {
		throw new MdsrsParseError(
			'Cloze card must contain at least one cloze deletion.',
			source.filePath,
			range[0]
		);
	}

	return ranges.map(([start, end]) =>
		makeCard(source, range, {
			type: 'cloze',
			text: cleanText,
			start,
			end
		})
	);
};

