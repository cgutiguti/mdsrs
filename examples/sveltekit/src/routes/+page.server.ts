import { fail } from '@sveltejs/kit';
import { getCollection, renderExampleCard } from '$lib/server/collection';
import {
	getPerformance,
	getReviewQueue,
	grades,
	recordReview,
	resetReviews,
	syncStore
} from '$lib/server/reviews';
import type { Actions, PageServerLoad } from './$types';
import type { Grade } from '@mdsrs/core';

export const load: PageServerLoad = async () => {
	const collection = await getCollection();
	await syncStore(collection.cards);
	const queue = await getReviewQueue(collection.cards);
	const current = queue[0]?.card ?? null;

	return {
		totalCards: collection.cards.length,
		totalSources: collection.sources.length,
		totalAssets: collection.assets.length,
		dueCards: queue.length,
		currentCard: current
			? renderExampleCard({
					hash: current.hash,
					deckName: current.deckName,
					filePath: current.filePath,
					frontMarkdown: current.frontMarkdown,
					backMarkdown: current.backMarkdown,
					performance: await getPerformance(current.hash)
				})
			: null
	};
};

export const actions: Actions = {
	review: async ({ request }) => {
		const collection = await getCollection();
		await syncStore(collection.cards);
		const cardHashes = new Set(collection.cards.map((card) => card.hash));
		const data = await request.formData();
		const cardHash = data.get('cardHash');
		const grade = data.get('grade');

		if (typeof cardHash !== 'string' || !cardHashes.has(cardHash)) {
			return fail(400, { message: 'Card is not in the current collection.' });
		}

		if (typeof grade !== 'string' || !grades.has(grade as Grade)) {
			return fail(400, { message: 'Invalid review grade.' });
		}

		await recordReview(cardHash, grade as Grade);
		return { reviewed: true };
	},
	reset: async () => {
		resetReviews();
		return { reset: true };
	}
};
