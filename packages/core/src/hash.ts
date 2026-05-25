import { createHash } from 'node:crypto';
import type { CardContent } from './types.js';

export const hashText = (text: string) => createHash('sha256').update(text).digest('hex');

export const hashCardContent = (content: CardContent) => {
	if (content.type === 'basic') {
		return hashText(`Basic\0${content.question}\0${content.answer}`);
	}

	return hashText(`Cloze\0${content.text}\0${content.start}\0${content.end}`);
};

export const hashCardFamily = (content: CardContent) =>
	content.type === 'cloze' ? hashText(`Cloze\0${content.text}`) : null;

