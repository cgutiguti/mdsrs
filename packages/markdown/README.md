# @mdsrs/markdown

Safe Markdown, math, and media rendering for `mdsrs` card faces.

## Example

```ts
import { renderCard, renderMarkdown } from '@mdsrs/markdown';

const html = renderMarkdown('The derivative is $2x$.');
const card = renderCard({
	filePath: 'math/algebra.md',
	frontMarkdown: 'What is $x + x$?',
	backMarkdown: '$2x$'
});
```

## Media

Markdown image syntax is reused for media:

- `![alt](image.png)` renders an image.
- `![alt](clip.mp4)` renders a controlled video.
- `![alt](audio.mp3)` renders a controlled audio player.

Use `resolveAsset` to map Markdown URLs to application URLs.
