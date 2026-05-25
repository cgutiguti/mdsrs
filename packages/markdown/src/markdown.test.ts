import { describe, expect, it } from 'vitest';
import { getMediaExtension, parseKatexMacros, renderCard, renderMarkdown } from './index.js';

describe('parseKatexMacros', () => {
	it('parses command macro definitions and ignores comments', () => {
		expect(parseKatexMacros('% ignored\n\\RR \\mathbb{R}\n\\. \\cdot')).toEqual({
			'\\RR': '\\mathbb{R}',
			'\\.': '\\cdot'
		});
	});
});

describe('getMediaExtension', () => {
	it('extracts media extensions before query strings and fragments', () => {
		expect(getMediaExtension('./clip.MP4?download=1')).toBe('.mp4');
		expect(getMediaExtension('./diagram.svg#hash')).toBe('.svg');
		expect(getMediaExtension('/asset')).toBe('');
	});
});

describe('renderMarkdown', () => {
	it('renders safe markdown and strips unsafe HTML', () => {
		const html = renderMarkdown('Hello **world**.\n\n<script>alert(1)</script>');

		expect(html).toContain('<strong>world</strong>');
		expect(html).not.toContain('<script>');
	});

	it('renders inline math with macros', () => {
		const html = renderMarkdown('Use $\\RR$.', {
			macros: {
				'\\RR': '\\mathbb{R}'
			}
		});

		expect(html).toContain('katex');
		expect(html).toContain('mathbb');
	});

	it('resolves image URLs and adds stable media classes', () => {
		const html = renderMarkdown('![Plot](./plot.svg)', {
			resolveAsset: (url) => `/resolved/${url}`
		});

		expect(html).toContain('src="/resolved/./plot.svg"');
		expect(html).toContain('class="mdsrs-media mdsrs-media-image"');
		expect(html).toContain('loading="lazy"');
	});

	it('renders audio and video markdown images as controlled media elements', () => {
		const audio = renderMarkdown('![Pronunciation](./word.mp3)', {
			resolveAsset: (url) => `/media/${url}`
		});
		const video = renderMarkdown('![Clip](./clip.mp4)', {
			resolveAsset: (url) => `/media/${url}`
		});

		expect(audio).toContain('<audio');
		expect(audio).toContain('controls');
		expect(audio).toContain('src="/media/./word.mp3"');
		expect(video).toContain('<video');
		expect(video).toContain('controls');
		expect(video).toContain('src="/media/./clip.mp4"');
	});
});

describe('renderCard', () => {
	it('returns the original card data with rendered front and back html', () => {
		const card = {
			hash: 'card-hash',
			frontMarkdown: 'What is **x**?',
			backMarkdown: '$2x$'
		};
		const rendered = renderCard(card);

		expect(rendered.hash).toBe('card-hash');
		expect(rendered.frontHtml).toContain('<strong>x</strong>');
		expect(rendered.backHtml).toContain('katex');
	});
});

