import type { Card, DeckTreeNode } from './types.js';

const titleize = (value: string) =>
	value
		.split(/[-_\s]+/)
		.filter(Boolean)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(' ');

const ensureNode = (nodes: Map<string, DeckTreeNode>, path: string, fallbackName: string) => {
	let node = nodes.get(path);
	if (node) return node;

	node = {
		path,
		name: fallbackName,
		cardCount: 0,
		totalCardCount: 0,
		children: []
	};
	nodes.set(path, node);

	return node;
};

export const buildDeckTree = (cards: Card[]): DeckTreeNode[] => {
	const nodes = new Map<string, DeckTreeNode>();
	nodes.set('', { path: '', name: 'All', cardCount: 0, totalCardCount: 0, children: [] });

	for (const card of cards) {
		const nodePath = card.nodePath;
		const parts = nodePath.split('/').filter(Boolean);

		for (let index = 0; index < parts.length; index++) {
			const path = parts.slice(0, index + 1).join('/');
			ensureNode(nodes, path, index === parts.length - 1 ? card.displayName : titleize(parts[index]));
		}

		const node = ensureNode(nodes, nodePath, card.displayName);
		node.name = card.displayName;
		node.cardCount += 1;

		for (let index = 0; index <= parts.length; index++) {
			const ancestorPath = parts.slice(0, index).join('/');
			const ancestor = nodes.get(ancestorPath);
			if (ancestor) ancestor.totalCardCount += 1;
		}
	}

	for (const node of nodes.values()) {
		node.children = [];
	}

	for (const node of nodes.values()) {
		if (!node.path) continue;
		const parentPath = node.path.split('/').slice(0, -1).join('/');
		nodes.get(parentPath)?.children.push(node);
	}

	const sortNodes = (items: DeckTreeNode[]) => {
		items.sort((left, right) => left.name.localeCompare(right.name));
		for (const item of items) sortNodes(item.children);
		return items;
	};

	return sortNodes(nodes.get('')?.children ?? []);
};

