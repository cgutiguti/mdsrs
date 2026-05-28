import path from 'node:path';
import { loadCollection } from '@mdsrs/fs';
import { renderCard } from '@mdsrs/markdown';

const cardsRoot = path.resolve('cards');

export const getCollection = () => loadCollection(cardsRoot);

export const renderExampleCard = <T extends { frontMarkdown: string; backMarkdown: string }>(card: T) =>
	renderCard(card, {
		resolveAsset: (assetPath) => assetPath
	});
