import { fileURLToPath } from 'node:url';
import { loadCollection } from '@mdsrs/fs';
import { renderCard } from '@mdsrs/markdown';

const cardsRoot = fileURLToPath(new URL('../../../cards', import.meta.url));

export const getCollection = () => loadCollection(cardsRoot);

export const renderExampleCard = <T extends { frontMarkdown: string; backMarkdown: string }>(card: T) =>
	renderCard(card, {
		resolveAsset: (assetPath) => assetPath
	});
