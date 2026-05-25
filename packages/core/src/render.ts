import type { CardContent } from './types.js';

export const renderFrontMarkdown = (content: CardContent) => {
	if (content.type === 'basic') return content.question;
	return `${content.text.slice(0, content.start)}[...]${content.text.slice(content.end + 1)}`;
};

export const renderBackMarkdown = (content: CardContent) => {
	if (content.type === 'basic') return content.answer;
	return `${content.text.slice(0, content.start)}**${content.text.slice(content.start, content.end + 1)}**${content.text.slice(content.end + 1)}`;
};

