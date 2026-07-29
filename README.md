# leovegas-user-api

A RESTful CRUD API for a `User` resource (`name`, `email`, `password`, `role: USER|ADMIN`,
`access_token`), built with NestJS, MySQL, and TypeORM. Responses and errors follow the
[JSON:API](https://jsonapi.org/) specification, authorization is split between coarse
role-based gating and a fine-grained self-vs-other access policy, and every cross-layer
dependency is injected via an interface so the business logic is unit-testable without a
real database.

## Stack

- **NestJS** + TypeScript
- **MySQL** via **TypeORM** (repository pattern behind DI interfaces, migrations only —
  `synchronize` is always `false`)
- **class-validator** / **class-transformer** for request validation
- **bcrypt** for password hashing, an opaque persisted token (not JWT) for auth
- **Jest** for unit tests (all dependencies mocked/faked — no real DB in specs)
- **Docker Compose** for local MySQL

## Project layout

```
src/
  common/       # cross-cutting: JSON:API envelope/filter/pipe, guards, decorators, domain exceptions
  users/        # entity, repository, access policy, service, controller, DTOs, serializer
  auth/         # login, password hashing, token generation
  config/       # env validation (Joi) + typed config
migrations/     # TypeORM migrations
scripts/        # seed-admin.ts
```

Unit tests live in a `__tests__/` directory next to the files they cover (e.g.
`src/users/policies/__tests__/user-access.policy.spec.ts`), not co-located `*.spec.ts` files.

## Setup

```bash
npm install
cp .env.example .env      # adjust values if needed
docker compose up -d      # starts MySQL on localhost:3306
npm run migration:run
npm run seed:admin        # bootstraps the first ADMIN from ADMIN_SEED_EMAIL/ADMIN_SEED_PASSWORD
npm run start:dev
```

The API is served under the `/api` prefix, e.g. `http://localhost:3000/api/users`.

## Available scripts

```bash
npm run start:dev         # dev server, watch mode
npm run build              # production build
npm test                   # unit tests (no DB required)
npm run test:cov           # unit tests with coverage
npm run lint                # eslint --fix
npm run migration:generate  # generate a new migration from entity changes
npm run migration:run
npm run migration:revert
npm run seed:admin          # idempotent — safe to re-run
```

## API overview

All request/response bodies use `Content-Type: application/json` or
`application/vnd.api+json` (both accepted). Successful responses are wrapped in a JSON:API
envelope; errors come back as `{ "errors": [...] }`.

| Method | Path          | Auth                          | Notes                                             |
| ------ | ------------- | ------------------------------ | -------------------------------------------------- |
| POST   | `/auth/login` | none                           | body: `{ email, password }` → `{ user, accessToken }` |
| POST   | `/users`      | optional                       | anonymous → self-registers as `USER`; ADMIN caller can set `role` |
| GET    | `/users`      | ADMIN only                     | list all users                                      |
| GET    | `/users/:id`  | self or ADMIN                  | non-ADMIN requesting another id gets `403`, not `404` |
| PATCH  | `/users/:id`  | self (non-role fields) or ADMIN | changing `role` requires ADMIN                     |
| PUT    | `/users/:id`  | same as PATCH                  | aliased to the same handler (partial update either way) |
| DELETE | `/users/:id`  | ADMIN only, not self            | no one can delete their own account, including ADMIN |

Authenticate with `Authorization: Bearer <accessToken>` from the login response.

### Example: register, login, view self

```bash
curl -X POST localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice","email":"alice@example.com","password":"password123"}'

curl -X POST localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"password123"}'
# => { "user": {...}, "accessToken": "..." }

curl localhost:3000/api/users/<alice-id> \
  -H "Authorization: Bearer <accessToken>"
```

### Success envelope

```json
{
  "data": {
    "type": "users",
    "id": "82fcf9a3-8b6c-4f72-a15a-6259e5ab7a73",
    "attributes": {
      "name": "Alice",
      "email": "alice@example.com",
      "role": "USER",
      "createdAt": "2026-07-29T06:55:51.332Z",
      "updatedAt": "2026-07-29T06:55:51.332Z"
    }
  }
}
```

`password` and `access_token` never appear in `attributes` — enforced twice, independently:
the entity columns are `{ select: false }`, and the serializer explicitly whitelists which
fields it reads.

### Error envelope

Domain errors (403/404/409) and Nest's built-in guard/pipe errors all share the same shape:

```json
{ "errors": [{ "status": "403", "title": "Forbidden", "detail": "You may only view your own user record" }] }
```

Validation failures (422) return one error per invalid field, each with a `source.pointer`:

```json
{
  "errors": [
    { "status": "422", "title": "Unprocessable Entity", "detail": "email must be an email", "source": { "pointer": "/email" } },
    { "status": "422", "title": "Unprocessable Entity", "detail": "password must be longer than or equal to 8 characters", "source": { "pointer": "/password" } }
  ]
}
```

## Design decisions worth calling out

- **Opaque token, not JWT.** `access_token` is a column on the `User` row (per the spec's
  literal data model), generated by `crypto.randomBytes` and looked up on every request. This
  means a role promotion takes effect immediately on the next request — there's no
  stale-JWT-claims problem to work around, at the cost of a DB read per request.
- **Single `POST /users` for both registration and provisioning.** One code path: an
  anonymous caller is always forced to `USER`; an authenticated ADMIN caller's requested
  `role` is honored. Implemented via an `@OptionalAuth()` decorator + a guard that resolves
  `request.user` if a token is present without requiring one.
- **`RolesGuard` (coarse) vs. `UserAccessPolicy` (fine-grained).** Context-free rules
  ("must be ADMIN") live in a guard driven by `@Roles()` metadata. Everything involving
  "self vs. other" — view/list/update/delete — lives in a plain, framework-agnostic
  `UserAccessPolicy` class with zero Nest imports, so it's testable with no mocks at all.
- **A non-ADMIN requesting another user's id gets `403`, not `404`.** The access check runs
  before the repository lookup, so a non-admin can never use response codes to fingerprint
  which user ids exist.
- **No one can delete their own account, including ADMIN.** A literal reading of the spec.
  An ADMIN *can*, however, change their own role via `PATCH` — the spec only restricts that
  for `USER` — documented and pinned by a dedicated test in `user-access.policy.spec.ts`.
- **`JsonApiEnvelopeInterceptor` is scoped to `UsersController`, not global.** `POST
  /auth/login` returns `{ user, accessToken }`, which isn't a single JSON:API resource object
  — forcing it through the same envelope would require a special case that couples the
  interceptor back to one route. The error filter, by contrast, *is* global: a uniform error
  shape across the whole API (including auth errors) is a reasonable cross-cutting concern in
  a way resource-enveloping isn't.
- **Migrations, never `synchronize: true`.** More representative of how this would run in
  production.
- **Unit tests only, no e2e.** The spec calls for unit tests; all service/policy/guard/
  controller specs run against mocked interfaces with no real DB or HTTP server. Every phase
  was additionally verified manually against real Dockerized MySQL via curl during
  development (documented per-phase in `PROJECT_NOTES.md`), but that verification isn't
  encoded as automated e2e tests.

## SOLID mapping

- **SRP** — controller (HTTP), service (orchestration), repository (persistence), policy
  (authorization), serializer (output shaping), hasher/token-generator (crypto) are all
  separate classes.
- **OCP** — a new resource type needs a new serializer, not changes to
  `JsonApiEnvelopeInterceptor`; a new domain exception needs a `status`/`title`/`message`,
  not changes to `JsonApiExceptionFilter`.
- **LSP** — any `IUsersRepository` implementation (e.g. an in-memory test double) substitutes
  cleanly wherever the interface is depended on.
- **ISP** — `IUsersRepository` is a narrow domain contract, not the raw TypeORM
  `Repository`/`QueryBuilder` API; `IUserAccessPolicy` exposes only the four checks the
  domain actually needs.
- **DIP** — `UsersService`/`AuthService` depend only on interfaces/DI tokens
  (`IUsersRepository`, `IPasswordHasher`, `ITokenGenerator`, `IUserAccessPolicy`), never a
  concrete TypeORM/bcrypt/crypto class — this is what keeps every unit test DB-free.
