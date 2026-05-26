import { error } from '@sveltejs/kit';
import { getCollection, renderExampleCard } from '$lib/server/collection';
import { findDeckNode, getDirectCards, getPathSegments } from '$lib/server/browse';
import { getPerformance } from '$lib/server/reviews';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const collection = await getCollection();
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
		cards: directCards.map((card) =>
			renderExampleCard({
				hash: card.hash,
				deckName: card.deckName,
				filePath: card.filePath,
				frontMarkdown: card.frontMarkdown,
				backMarkdown: card.backMarkdown,
				performance: getPerformance(card.hash)
			})
		)
	};
};
