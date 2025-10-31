# Portfolio Chat UI

Portfolio with RAG chat ability.

## Dependencies

- [React Router](https://reactrouter.com/)
- [Cloudflare Worker](https://developers.cloudflare.com/workers/)

## Getting Started

### Installation

Install the dependencies:

```bash
pnpm install
```

### Development

Start the development server with HMR:

```bash
pnpm run dev
```

Your application will be available at `http://localhost:5173`.

## Building for Production

Create a production build:

```bash
pnpm run build
```

## Deployment

Deployment is done using the Wrangler CLI.

To build and deploy directly to production:

```sh
pnpm run deploy
```

To deploy a preview URL:

```sh
npx wrangler versions upload
```

You can then promote a version to production after verification or roll it out progressively.

```sh
npx wrangler versions deploy
```

## Status

[x] Healthcheck (connecting to service binding)
[ ] Panda-css
[ ] Answer voter
...