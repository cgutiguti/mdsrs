# mdsrs SvelteKit example

A minimal SvelteKit app that demonstrates:

- loading Markdown cards from `cards/` with `@mdsrs/fs`
- building an in-memory due queue with `@mdsrs/core`
- rendering card faces with `@mdsrs/markdown`
- browsing parsed cards and deck counts

Run it with:

```sh
pnpm --filter @mdsrs/example-sveltekit dev
```

Review progress is stored in memory for the running server process.
