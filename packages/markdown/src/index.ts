import rehypeKatex, { type Options as KatexOptions } from 'rehype-katex';
import rehypeSanitize, { defaultSchema, type Options as SanitizeOptions } from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import remarkMath from 'remark-math';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';

export type AssetResolver = (url: string) => string;

export interface RenderMarkdownOptions {
	macros?: Record<string, string>;
	resolveAsset?: AssetResolver;
}

export interface RenderableCard {
	frontMarkdown: string;
	backMarkdown: string;
}

export interface RenderedCard {
	frontHtml: string;
	backHtml: string;
}

const mediaExtensions = {
	audio: new Set(['.mp3', '.wav', '.ogg', '.m4a', '.flac']),
	video: new Set(['.mp4', '.webm', '.mov', '.m4v'])
};

type UnistTree = Parameters<typeof visit>[0];

interface ImageNode extends Record<string, unknown> {
	url?: unknown;
	alt?: unknown;
	data?: unknown;
}

const extensionPattern = /\.[a-z0-9]+(?:[?#].*)?$/i;

export const getMediaExtension = (url: string) => {
	const path = url.split(/[?#]/, 1)[0]?.toLowerCase() ?? '';
	return path.match(extensionPattern)?.[0].replace(/[?#].*$/, '') ?? '';
};

const remarkMdsrsMedia = (resolveAsset: AssetResolver) => (tree: UnistTree) => {
	visit(tree, 'image', (node) => {
		const image = node as ImageNode;
		const originalUrl = typeof image.url === 'string' ? image.url : '';
		const resolvedUrl = resolveAsset(originalUrl);
		const extension = getMediaExtension(originalUrl);
		const alt = typeof image.alt === 'string' ? image.alt : '';

		if (mediaExtensions.audio.has(extension)) {
			image.data = {
				hName: 'audio',
				hProperties: {
					className: ['mdsrs-media', 'mdsrs-media-audio'],
					controls: true,
					src: resolvedUrl
				}
			};
			return;
		}

		if (mediaExtensions.video.has(extension)) {
			image.data = {
				hName: 'video',
				hProperties: {
					className: ['mdsrs-media', 'mdsrs-media-video'],
					controls: true,
					src: resolvedUrl
				}
			};
			return;
		}

		image.url = resolvedUrl;
		image.data = {
			hProperties: {
				alt,
				className: ['mdsrs-media', 'mdsrs-media-image'],
				decoding: 'async',
				loading: 'lazy'
			}
		};
	});
};

const schema: SanitizeOptions = {
	...defaultSchema,
	tagNames: [...(defaultSchema.tagNames ?? []), 'audio', 'video', 'source'],
	attributes: {
		...defaultSchema.attributes,
		'*': [
			...(defaultSchema.attributes?.['*'] ?? []),
			'className',
			['className', /^mdsrs-/, /^language-/, /^math/, /^katex/] as const
		],
		img: [
			...(defaultSchema.attributes?.img ?? []),
			'alt',
			'decoding',
			'loading',
			'src',
			'title'
		],
		audio: ['className', 'controls', 'src', 'title'],
		video: ['className', 'controls', 'src', 'title']
	},
	protocols: {
		...defaultSchema.protocols,
		src: [...(defaultSchema.protocols?.src ?? []), 'data']
	}
};

export const parseKatexMacros = (source: string) => {
	const macros: Record<string, string> = {};

	for (const rawLine of source.split(/\r?\n/)) {
		const line = rawLine.trim();
		if (!line || line.startsWith('%')) continue;
		const match = line.match(/^(\\[A-Za-z]+|\\.)\s+(.+)$/);
		if (match) macros[match[1] ?? ''] = match[2] ?? '';
	}

	return macros;
};

export const renderMarkdown = (markdown: string, options: RenderMarkdownOptions = {}) =>
{
	const katexOptions: KatexOptions = {
		...(options.macros ? { macros: options.macros } : {}),
		strict: false,
		trust: false
	};

	return String(
		unified()
			.use(remarkParse)
			.use(remarkMath)
			.use(remarkMdsrsMedia, options.resolveAsset ?? ((url: string) => url))
			.use(remarkRehype)
			.use(rehypeSanitize, schema)
			.use(rehypeKatex, katexOptions)
			.use(rehypeStringify)
			.processSync(markdown)
	);
};

export const renderCard = <T extends RenderableCard>(
	card: T,
	options: RenderMarkdownOptions = {}
): T & RenderedCard => ({
	...card,
	frontHtml: renderMarkdown(card.frontMarkdown, options),
	backHtml: renderMarkdown(card.backMarkdown, options)
});
