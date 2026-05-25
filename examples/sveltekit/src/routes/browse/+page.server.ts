import { getCollection, renderExampleCard } from '$lib/server/collection';
import { getPerformance } from '$lib/server/reviews';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const collection = await getCollection();

	return {
		deckTree: collection.deckTree,
		cards: collection.cards.map((card) =>
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
