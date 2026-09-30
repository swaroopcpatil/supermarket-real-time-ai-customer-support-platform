# API guide

All public traffic enters the API gateway at `http://localhost:8000`. Interactive
OpenAPI documentation is available at `/api/docs`; each service also exposes
`/api/docs` on its own mapped port for local diagnosis.

## Authentication

Register with `POST /api/auth/register` or log in with `POST /api/auth/login`.
Both return a JWT bearer token. The seed customer is
`customer@supermarket.com` / `password123` and the seed admin is
`admin@supermarket.com` / `admin123`.

## Customer endpoints

`POST /api/chat` sends a message and returns structured `ai_activity` with the
selected agent, tool names and citation metadata. `WS /api/chat/ws` accepts
`{"customer_id":"CUS-DEMO","message":"..."}` and emits `status`, `token`,
and `done` frames. Products, orders, tickets, refunds, and notifications are
available below their matching `/api/*` routes.

Errors include an `X-Request-ID` response header. Supply the same header in a
request to follow a trace through structured service logs.
