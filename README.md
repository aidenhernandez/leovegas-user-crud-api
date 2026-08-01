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
- **bcrypt** for password hashing, an opaque, expiring, persisted token (not JWT) for auth
- **@nestjs/throttler** for per-route rate limiting
- **@nestjs/swagger** for interactive API docs
- **Jest** for unit tests (all dependencies mocked/faked — no real DB in specs)
- **Docker Compose** for local MySQL
- **GitHub Actions** for CI (lint/build/test on every push)

## Project layout

```
src/
  common/       # cross-cutting: JSON:API envelope/filter/pipe, guards, decorators, domain exceptions
  users/        # entity, repository, access policy, service, controller, DTOs, serializer
  auth/         # login, logout, password hashing, token generation
  config/       # env validation (Joi) + typed config
migrations/     # TypeORM migrations
scripts/        # seed-admin.ts
docs/           # API_TESTING.md - full curl walkthrough of every endpoint/scenario
.github/workflows/  # CI (lint/build/test)
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

## Docker / MySQL

MySQL runs as a single Docker Compose service named `mysql`, defined in
`docker-compose.yml`, with its data persisted in a named volume (`mysql_data`) so it survives
container restarts. Credentials come from `docker-compose.yml`'s `environment` block and must
match `DB_*` in your `.env`.

If you've never used Docker before, all of the commands below are run from the project root
(`leovegas-user-api/`), and `docker compose` (the container tool) is separate from `npm`
(the Node tool) — you'll use both.

**Start it for the first time, or after it's been removed:**

```bash
docker compose up -d
```

This creates and starts the `mysql` container in the background (`-d` = detached). Safe to
run even if the container already exists — Compose won't recreate it unless the config
changed. Wait a few seconds for MySQL to finish initializing, then confirm it's healthy:

```bash
docker compose ps
# STATUS column should say "Up ... (healthy)"
```

If you're starting fresh (first run, or after removal), the schema won't exist yet — run
migrations and seed the first admin before starting the app:

```bash
npm run migration:run
npm run seed:admin
```

**Stop it** (keeps all data — the container and its volume stay on disk, just not running):

```bash
docker compose stop
```

**Start it again** after `stop` (same data, no migration/seed needed):

```bash
docker compose start
```

**Restart it** (stop + start in one step, e.g. after editing `docker-compose.yml`):

```bash
docker compose restart
```

**Remove the container entirely** but keep the data volume (container is gone, data isn't):

```bash
docker compose down
```

Bring it back with `docker compose up -d` — no re-migration needed, since the volume (and
the data in it) is untouched.

**Remove everything, including the data** (a true reset — you'll need to migrate + seed
again):

```bash
docker compose down -v   # -v also deletes the mysql_data volume
docker compose up -d
npm run migration:run
npm run seed:admin
```

**View logs** if something looks wrong (e.g. the app can't connect):

```bash
docker compose logs -f mysql   # Ctrl+C to stop following
```

**Common gotcha:** if `docker compose up -d` fails or the app can't connect, check that
Docker Desktop (or your Docker daemon) is actually running first — `docker compose` commands
need it, and the error messages when it's not running can be non-obvious (e.g. "Cannot
connect to the Docker daemon").

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

## CI

`.github/workflows/ci.yml` runs lint, build, and the unit test suite (all DB-free, so no
MySQL service container is needed) on every push/PR to `main`. It runs against GitHub's own
Actions infrastructure, so it only executes once this repo has a GitHub remote and something
is actually pushed to it — until then it exists as a checked-in, inspectable config, not a
running pipeline.

## API overview

All request/response bodies use `Content-Type: application/json` or
`application/vnd.api+json` (both accepted). Successful responses are wrapped in a JSON:API
envelope; errors come back as `{ "errors": [...] }`.

| Method | Path          | Auth                          | Notes                                             |
| ------ | ------------- | ------------------------------ | -------------------------------------------------- |
| POST   | `/auth/login` | none (rate-limited: 5/min/IP)  | body: `{ email, password }` → JSON:API user resource with `meta.accessToken` |
| POST   | `/auth/logout`| required                       | invalidates the caller's current access token       |
| POST   | `/users`      | optional (rate-limited: 10/min/IP) | anonymous → self-registers as `USER`; ADMIN caller can set `role` |
| GET    | `/users`      | ADMIN only                     | paginated: `?page=1&limit=20` (default; max `limit` 100) |
| GET    | `/users/:id`  | self or ADMIN                  | non-ADMIN requesting another id gets `403`, not `404` |
| PATCH  | `/users/:id`  | self (non-role fields) or ADMIN | changing `role` requires ADMIN                     |
| PUT    | `/users/:id`  | same as PATCH                  | aliased to the same handler (partial update either way) |
| DELETE | `/users/:id`  | ADMIN only, not self            | no one can delete their own account, including ADMIN |

Authenticate with `Authorization: Bearer <accessToken>`, using the token from
`data.meta.accessToken` in the login response. Tokens expire after
`ACCESS_TOKEN_TTL_SECONDS` (default 1 hour) and are also invalidated immediately by
`POST /auth/logout`.

For a full curl walkthrough of every endpoint and permission scenario (403-vs-404, the
validation error shape, the last-admin lockout, the duplicate-email race, rate limiting,
pagination, etc.), see [`docs/API_TESTING.md`](docs/API_TESTING.md). For an interactive,
try-it-in-the-browser reference, see [Interactive API docs](#interactive-api-docs-swagger)
below.

### Example: register, login, view self

```bash
curl -X POST localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice","email":"alice@example.com","password":"password123"}'

curl -X POST localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"password123"}'
# => { "data": { "type": "users", "id": "...", "attributes": {...}, "meta": { "accessToken": "..." } } }

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
fields it reads. `POST /auth/login` returns the same shape, with the token attached under
the resource object's `meta` member:

```json
{
  "data": {
    "type": "users",
    "id": "82fcf9a3-8b6c-4f72-a15a-6259e5ab7a73",
    "attributes": { "name": "Alice", "email": "alice@example.com", "role": "USER", "createdAt": "...", "updatedAt": "..." },
    "meta": { "accessToken": "9f2c...e71a" }
  }
}
```

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

Rate-limited requests (429) come back the same way, via Nest's built-in `ThrottlerException`:

```json
{ "errors": [{ "status": "429", "title": "ThrottlerException", "detail": "ThrottlerException: Too Many Requests" }] }
```

### Pagination

`GET /users` accepts `?page=` (default `1`) and `?limit=` (default `20`, max `100`), and
returns pagination info as a top-level `meta` member alongside `data`:

```json
{
  "data": [ { "type": "users", "id": "...", "attributes": { ... } } ],
  "meta": { "page": 2, "limit": 3, "totalCount": 11, "totalPages": 4 }
}
```

## Interactive API docs (Swagger)

With the server running, an interactive OpenAPI/Swagger UI is available at
`http://localhost:3000/api/docs` — every endpoint, request DTO, and the bearer-auth scheme
are documented there and can be tried directly from the browser (use the "Authorize" button
with a token from `POST /auth/login`). The raw OpenAPI document is at `/api/docs-json`.
Note that responses shown there reflect the request DTOs faithfully, but actual response
*bodies* are the hand-rolled JSON:API envelope described above (Swagger doesn't model that
dynamic per-request shape) — `docs/API_TESTING.md` is the source of truth for response
shapes.

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
- **A role change may never remove the last remaining ADMIN.** Deleting your own account is
  blocked, but changing your own *role* was originally left wide open — which meant a sole
  ADMIN demoting themselves to `USER` had no path back to ADMIN through the API at all. Fixed
  by having `UsersService.update()` derive a `wouldRemoveLastAdmin` fact (via a new
  `IUsersRepository.countByRole()`) and hand it to `UserAccessPolicy.canUpdate()` as a plain
  boolean, the same way `isRoleChange` already works — the policy stays the single,
  DB-agnostic source of truth for the decision; only the fact-gathering happens in the
  service.
- **`JsonApiEnvelopeInterceptor` is applied per-controller, not global.** Both
  `UsersController` and `AuthController` opt in explicitly with `@UseInterceptors(...)`
  rather than it being wired as an app-wide default — it stays resource-agnostic (it only
  wraps whatever resource object a controller hands it in `data`), so nothing about the
  interceptor itself needs to change as new resources are added. `POST /auth/login` returns
  a `users` resource object like every other user-related endpoint; the access token rides
  along as `data.meta.accessToken` — `meta` is a standard JSON:API resource-object member for
  exactly this kind of "extra, non-attribute info," so the login response stays a real JSON:API
  document instead of a one-off shape. The error filter, by contrast, *is* global: a uniform
  error shape across the whole API (including auth errors) is a reasonable cross-cutting
  concern in a way resource-enveloping isn't. `GET /users`' pagination `meta` needed a
  top-level sibling to `data` rather than a per-resource one, so the interceptor gained one
  small rule: a controller can pre-build the *whole* envelope (`{ data, meta }`) and the
  interceptor passes it through unchanged instead of wrapping it a second time — everything
  else about it (resource-agnostic, no per-resource-type branching) is untouched.
- **Access tokens expire, and can be explicitly invalidated.** A token issued by
  `POST /auth/login` is only valid for `ACCESS_TOKEN_TTL_SECONDS` (default 1 hour, tracked
  via a new `access_token_expires_at` column) and `POST /auth/logout` clears it immediately.
  Originally there was no expiry and no logout at all — a leaked or forgotten token stayed
  valid forever, with no way to revoke it short of another login overwriting it. `validateToken`
  checks the expiry alongside the token lookup, so an expired token fails the same way an
  unknown one does (`401`, same message) rather than needing a separate code path.
- **Rate limiting is layered: a generous global default, tighter per-route overrides.**
  `ThrottlerGuard` runs *before* `BearerTokenGuard` in the global guard order (registered
  first), so an excessive request is rejected before any token lookup happens at all.
  `POST /auth/login` (5/min/IP) and `POST /users` (10/min/IP) get stricter, explicit
  `@Throttle()` overrides — login is the brute-force target, registration is the
  duplicate-email-probing/spam target — while every other route falls back to the global
  default (30/min/IP).
- **`GET /users` pagination lives in the service, not the repository or controller.**
  `UsersController` only validates and forwards `page`/`limit`; `UsersService.findAll()`
  converts them into `skip`/`take` (persistence-appropriate terms) before calling
  `IUsersRepository.findAll()`, which uses TypeORM's `findAndCount()` to get the page and
  the total count in one query rather than two round trips.
- **Migrations, never `synchronize: true`.** More representative of how this would run in
  production.
- **Unit tests only, no e2e.** The spec calls for unit tests; all service/policy/guard/
  controller specs run against mocked interfaces with no real DB or HTTP server. Every phase
  was additionally verified manually against real Dockerized MySQL via curl during
  development (documented per-phase in `PROJECT_NOTES.md`), but that verification isn't
  encoded as automated e2e tests.

## Object-oriented design

The spec calls out OOP and SOLID as separate grading criteria, so this section covers the
four OOP pillars specifically — SOLID (below) is about how the classes are arranged;
this is about the classes themselves.

- **Encapsulation** — `src/users/entities/user.entity.ts` marks `password`/`accessToken`
  `{ select: false }` so they're hidden from default queries; `UsersService`
  (`src/users/users.service.ts`) hides every collaborator behind `private readonly`
  constructor properties, exposing only five public methods and no internal state;
  `UserAccessPolicy` (`src/users/policies/user-access.policy.ts`) hides all of the
  self-vs-other conditional logic behind four public yes/no methods — callers never see the
  branching, just the answer.
- **Abstraction** — `IUsersRepository`, `IUserAccessPolicy`, `IPasswordHasher`,
  `ITokenGenerator`, and `IResourceSerializer` (one each in
  `src/users/repositories/`, `src/users/policies/`, `src/auth/hashing/`, `src/auth/tokens/`,
  `src/common/jsonapi/serializers/`) each define *what* a collaborator does without saying
  *how* — `UsersService` calls `passwordHasher.hash(...)` with no idea it's bcrypt under the
  hood.
- **Inheritance** — `DomainException` (`src/common/exceptions/domain.exception.ts`) is an
  abstract base class; `ForbiddenActionException`, `UserNotFoundException`, and
  `DuplicateEmailException` each extend it, supplying only their own `status`/`title`/
  constructor logic and inheriting the rest. `JsonApiValidationPipe`
  (`src/common/pipes/jsonapi-validation.pipe.ts`) extends Nest's own `ValidationPipe`,
  reusing its validation machinery and overriding only the `exceptionFactory`.
- **Polymorphism** — `JsonApiExceptionFilter.catch()`
  (`src/common/jsonapi/jsonapi-exception.filter.ts`) calls `exception.status`/`.title`/
  `.message` on *any* `DomainException` without a per-subclass switch statement — each
  concrete exception answers those calls its own way. Likewise, `UsersService` and
  `AuthService` call methods on whatever `IUsersRepository` they were handed — the real
  `TypeOrmUsersRepository` in production, a hand-written fake in
  `src/users/__tests__/users.service.spec.ts` — with identical calling code either way.

## SOLID mapping

This is the primary grading axis for this project, so each principle below links to the
actual file(s) that demonstrate it, not just an abstract description.

- **SRP** — one responsibility per class, split across five layers that never leak into each
  other:
  - HTTP layer: `src/users/users.controller.ts`
  - Orchestration: `src/users/users.service.ts`
  - Persistence: `src/users/repositories/typeorm-users.repository.ts`
  - Authorization: `src/users/policies/user-access.policy.ts`
  - Output shaping: `src/users/serializers/user.serializer.ts`
  - Crypto: `src/auth/hashing/bcrypt-password-hasher.ts`,
    `src/auth/tokens/crypto-token-generator.ts`
- **OCP** — open for extension, closed for modification:
  - Adding a second resource type means writing one new serializer implementing
    `IResourceSerializer` (`src/common/jsonapi/serializers/serializer.interface.ts`) — nothing
    changes in `src/common/jsonapi/jsonapi-envelope.interceptor.ts`.
  - Adding a new business-rule error means a new `DomainException` subclass (see
    `src/common/exceptions/forbidden-action.exception.ts`,
    `user-not-found.exception.ts`, `duplicate-email.exception.ts`) — nothing changes in
    `src/common/jsonapi/jsonapi-exception.filter.ts`.
- **LSP** — `src/users/users.service.ts` depends on `IUsersRepository`
  (`src/users/repositories/users-repository.interface.ts`), not the concrete
  `TypeOrmUsersRepository`; any conforming implementation (e.g. an in-memory fake used in
  `src/users/__tests__/users.service.spec.ts`) substitutes without the service changing.
- **ISP** — `IUsersRepository` exposes only the handful of operations the domain needs, not
  TypeORM's full `Repository`/`QueryBuilder` surface; `IUserAccessPolicy`
  (`src/users/policies/user-access-policy.interface.ts`) exposes exactly
  `canView`/`canList`/`canUpdate`/`canDelete` and nothing else.
- **DIP** — `src/users/users.service.ts` and `src/auth/auth.service.ts` depend only on
  interfaces injected via Symbol tokens (`USERS_REPOSITORY`, `USER_ACCESS_POLICY`,
  `PASSWORD_HASHER`, `TOKEN_GENERATOR`), never a concrete TypeORM/bcrypt/crypto class. This is
  precisely what lets `src/users/__tests__/users.service.spec.ts` and
  `src/auth/__tests__/auth.service.spec.ts` mock everything and run with no real database.

**Where to see it all working together end-to-end:** `src/users/users.service.ts` is the
single best file to read first — its constructor shows all four injected interfaces at once,
and every method shows the policy check happening before the repository call.

**Where to see the authorization logic tested exhaustively with zero mocks:**
`src/users/policies/__tests__/user-access.policy.spec.ts` — `UserAccessPolicy` has no Nest or
TypeORM imports at all, so it's instantiated directly with plain objects.
