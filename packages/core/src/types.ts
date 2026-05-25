export type Grade = 'forgot' | 'hard' | 'good' | 'easy';

export type CardContent =
	| {
			type: 'basic';
			question: string;
			answer: string;
	  }
	| {
			type: 'cloze';
			text: string;
			start: number;
			end: number;
	  };

export interface DeckSource {
	deckName: string;
	filePath: string;
	text: string;
	folderPath?: string;
	nodePath?: string;
	displayName?: string;
}

export interface Card {
	hash: string;
	familyHash: string | null;
	deckName: string;
	filePath: string;
	folderPath: string;
	nodePath: string;
	displayName: string;
	range: [number, number];
	content: CardContent;
	frontMarkdown: string;
	backMarkdown: string;
}

export interface DeckTreeNode {
	path: string;
	name: string;
	cardCount: number;
	totalCardCount: number;
	children: DeckTreeNode[];
}

export interface CardPerformance {
	lastReviewedAt: string | null;
	stability: number | null;
	difficulty: number | null;
	intervalRaw: number | null;
	intervalDays: number | null;
	dueDate: string | null;
	reviewCount: number;
}

export interface ReviewResult {
	lastReviewedAt: string;
	grade: Grade;
	stability: number;
	difficulty: number;
	intervalRaw: number;
	intervalDays: number;
	dueDate: string;
	reviewCount: number;
}

export interface ReviewQueueItem {
	card: Card;
	performance: CardPerformance | null;
}

