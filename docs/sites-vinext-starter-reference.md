# Sites and vinext starter reference

This page preserves the generic hosting, data-binding, and authentication notes that originally appeared in the repository README. They describe optional capabilities of the vinext and ChatGPT Sites starter; they are not part of the COG terrain adapter itself.

Return to the [Raster Terrain Lab README](../README.md).

## Starter runtime

The project began with a full-stack starter running on [vinext](https://github.com/cloudflare/vinext), with optional Cloudflare D1 and Drizzle support.

### Prerequisite

- Node.js `>=22.13.0`

This starter does not use `wrangler.jsonc`.

## Included starter structure

- Edit site code under `app/`.
- `.openai/hosting.json` declares optional Sites D1 and R2 bindings.
- `vite.config.ts` simulates declared bindings for local development.
- `db/schema.ts` starts intentionally empty.
- `examples/d1/` contains an optional D1 example surface.
- `drizzle.config.ts` supports local migration generation when needed.

## Optional D1 and Drizzle support

The application does not currently require D1 for its COG terrain workflow. The starter retains an empty database schema and a separate example for future features that need lightweight persistence.

- Define an application schema in `db/schema.ts`.
- Review `examples/d1/` for the optional example surface.
- Run `npm run db:generate` after making schema changes to generate Drizzle migrations.
- See the [Drizzle D1 guide](https://orm.drizzle.team/docs/get-started/d1-new) for setup details.

## Workspace authentication headers

Signed-in visitors receive both `oai-authenticated-user-id` and `oai-authenticated-user-email`. Private Sites require every visitor to sign in; public Sites may also have anonymous visitors, for whom neither header is present.

The user ID is stable for the same user on the same Site and different across Sites. Email and name are intended for display or contact purposes.

SIWC-authenticated workspace sites may also receive `oai-authenticated-user-full-name` when the user's SIWC profile has a non-empty `name` claim. The full-name value is percent-encoded UTF-8 and is accompanied by `oai-authenticated-user-full-name-encoding: percent-encoded-utf-8`.

Treat the full name as optional and fall back to email when it is absent:

```tsx
import { headers } from "next/headers";

export default async function Home() {
  const requestHeaders = await headers();
  const userId = requestHeaders.get("oai-authenticated-user-id");
  const email = requestHeaders.get("oai-authenticated-user-email");
  const encodedFullName = requestHeaders.get("oai-authenticated-user-full-name");
  const fullName =
    encodedFullName &&
    requestHeaders.get("oai-authenticated-user-full-name-encoding") ===
      "percent-encoded-utf-8"
      ? decodeURIComponent(encodedFullName)
      : null;

  const displayName = fullName ?? email;
  // ...
}
```

## Optional dispatch-owned ChatGPT sign-in

Import the ready-to-use helpers from `app/chatgpt-auth.ts` when the site needs optional or required ChatGPT sign-in:

- Use `getChatGPTUser()` for optional signed-in UI.
- Use `requireChatGPTUser(returnTo)` for server-rendered pages that should send anonymous visitors through Sign in with ChatGPT.
- Use `chatGPTSignInPath(returnTo)` and `chatGPTSignOutPath(returnTo)` for browser links or actions.
- Pass a same-origin relative `returnTo` path for the destination after sign-in or sign-out. The helper validates and safely encodes it.
- Mark protected pages with `export const dynamic = "force-dynamic"` because they depend on per-request identity headers.

Dispatch owns `/signin-with-chatgpt`, `/signout-with-chatgpt`, `/callback`, the OAuth cookies, and identity-header injection. Do not implement application routes for those reserved paths. Routes that do not import and call the helper remain anonymous-compatible.

SIWC establishes identity only; it does not prove workspace membership. Use the Sites hosting platform's access-policy controls for workspace-wide restrictions, or enforce explicit server-side membership or allow-list checks.

Use SIWC for account pages, user-specific dashboards, saved records, and write actions tied to the current ChatGPT user. Leave public content anonymous.

## Related references

- [vinext documentation](https://github.com/cloudflare/vinext)
- [Drizzle D1 guide](https://orm.drizzle.team/docs/get-started/d1-new)
