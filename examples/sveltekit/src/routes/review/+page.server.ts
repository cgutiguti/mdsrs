import { getCollection, renderExampleCard } from '$lib/server/collection';
import type { PageServerLoad } from './$types';

export const prerender = true;

export const load: PageServerLoad = async () => {
	const collection = await getCollection();

	return {
		totalCards: collection.cards.length,
		totalSources: collection.sources.length,
		totalAssets: collection.assets.length,
		cards: collection.cards.map((card) => renderExampleCard(card))
	};
};
