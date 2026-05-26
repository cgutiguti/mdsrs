import type { CardContent } from './types.js';

export const renderFrontMarkdown = (content: CardContent) => {
	if (content.type === 'basic') return content.question;
	return `${content.text.slice(0, content.start)}[...]${content.text.slice(content.end + 1)}`;
};

export const renderBackMarkdown = (content: CardContent) => {
	if (content.type === 'basic') return content.answer;
	if (isInsideInlineMath(content.text, content.start, content.end)) return content.text;
	return `${content.text.slice(0, content.start)}**${content.text.slice(content.start, content.end + 1)}**${content.text.slice(content.end + 1)}`;
};

const isInsideInlineMath = (text: string, start: number, end: number) => {
	let inMath = false;

	for (let index = 0; index < text.length; index++) {
		const char = text[index];
		const previous = text[index - 1];
		if (char !== '$' || previous === '\\') continue;

		if (!inMath && index < start) {
			inMath = true;
			continue;
		}

		if (inMath && index > end) return true;
		if (inMath) inMath = false;
	}

	return false;
};
