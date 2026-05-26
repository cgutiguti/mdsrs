import type { Card, DeckTreeNode } from '@mdsrs/core';

export const flattenDeckTree = (nodes: DeckTreeNode[]): DeckTreeNode[] =>
	nodes.flatMap((node) => [node, ...flattenDeckTree(node.children)]);

export const findDeckNode = (nodes: DeckTreeNode[], nodePath: string) =>
	flattenDeckTree(nodes).find((node) => node.path === nodePath) ?? null;

export const getDirectCards = (cards: Card[], nodePath: string) =>
	cards.filter((card) => card.nodePath === nodePath);

export const getPathSegments = (nodePath: string) => {
	const parts = nodePath.split('/').filter(Boolean);
	return parts.map((part, index) => ({
		name: part,
		path: parts.slice(0, index + 1).join('/')
	}));
};
