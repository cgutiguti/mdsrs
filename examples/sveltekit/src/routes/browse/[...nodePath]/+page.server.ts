import { error } from '@sveltejs/kit';
import { getCollection, renderExampleCard } from '$lib/server/collection';
import { findDeckNode, getDirectCards, getPathSegments } from '$lib/server/browse';
import { getPerformance, syncStore } from '$lib/server/reviews';
import { buildSampleHistory, buildSampleStats } from '$lib/server/sample-history';
import type { PageServerLoad } from './$types';

export const prerender = true;

export const entries = async () => {
	const collection = await getCollection();
	return [
		{ nodePath: '' },
		...collection.deckTree.flatMap(function flatten(node): Array<{ nodePath: string }> {
			return [{ nodePath: node.path }, ...node.children.flatMap(flatten)];
		})
	];
};

export const load: PageServerLoad = async ({ params }) => {
	const collection = await getCollection();
	await syncStore(collection.cards);
	const nodePath = params.nodePath ?? '';
	const rootView = nodePath === '';
	const node = rootView ? null : findDeckNode(collection.deckTree, nodePath);

	if (!rootView && !node) {
		error(404, 'Deck not found');
	}

	const directCards = rootView ? [] : getDirectCards(collection.cards, nodePath);
	const childDecks = rootView ? collection.deckTree : (node?.children ?? []);

	return {
		nodePath,
		title: rootView ? 'Browse' : (node?.name ?? 'Browse'),
		breadcrumbs: getPathSegments(nodePath),
		childDecks,
		cards: await Promise.all(
			directCards.map(async (card) => {
				const history = buildSampleHistory(card);
				return renderExampleCard({
					hash: card.hash,
					deckName: card.deckName,
					filePath: card.filePath,
					frontMarkdown: card.frontMarkdown,
					backMarkdown: card.backMarkdown,
					cardType: card.content.type,
					performance: await getPerformance(card.hash),
					stats: buildSampleStats(history),
					history
				});
			})
		)
	};
};
