# Sources and reconstruction notes

## Conversation provenance

Primary product context: [Plan Multiplayer Game](chatgpt-conversation://6a9dca04-79b4-83ea-b3e9-d831f9fe5fa5), read on 2026-09-06. The retrieval returned five conversation turns with no older page and no attachments. It includes the original 3D concept, the later 2D pivot, the promo-generation request, the user's approval/name/model-planning request, and the request to populate the repository.

The promo-generation turn has no image or assistant generation prompt in the returned data. The user's “This is perfect” establishes approval, but does not reveal the image. [ART_DIRECTION.md](ART_DIRECTION.md) therefore distinguishes written direction from unverified image details.

The latest user request for this package explicitly requires top-down 2D, likely PixiJS, Next.js/Vercel, server authority, Redis and Postgres, and documentation only. That request takes priority over older alternatives. This package is a coherent synthesis, not a verbatim transcript or a claim that each proposed parameter was approved in the original conversation.

## Official technical references checked 2026-09-06

- [Vercel WebSockets](https://vercel.com/docs/functions/websockets): beta support, connection lifecycle, cross-instance considerations and external state. Use it to recheck runtime behavior during M1.
- [PixiJS introduction](https://pixijs.com/8.x/guides/getting-started/intro): the preferred 2D renderer's scope. Check the selected version's APIs before implementation.
- [GPT-6 Astra model](https://developers.openai.com/api/docs/models/gpt-6-astra): model identity and supported reasoning efforts.
- [GPT-5.6 Luna model](https://developers.openai.com/api/docs/models/gpt-5.6-luna): currently documented Luna identity; does not establish a “Luna 4.6” identifier.

Room leases, transaction/outbox design, map sizes, cooldowns, asset dimensions, acceptance budgets and milestone normalization are proposed project design choices. They are not vendor guarantees. No benchmark, pricing comparison or hosting account entitlement is asserted. Recheck account-specific availability and limits when implementation reaches the relevant service.
