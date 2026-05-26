# @mdsrs/cli

Command-line tools for Markdown-native spaced repetition collections.

## Commands

```sh
mdsrs init ./cards
mdsrs check ./cards
mdsrs export ./cards
mdsrs export ./cards --pretty
```

`init` creates a starter collection with basic, cloze, math, and nested deck
examples. `check` loads a collection and prints a short summary. `export` emits
the parsed collection as JSON for other tools.
