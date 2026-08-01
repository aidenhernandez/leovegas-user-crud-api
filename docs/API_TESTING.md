# API testing guide

A copy-pasteable curl walkthrough of every endpoint and every authorization/validation
scenario the app is designed to handle. Everything below was actually run against a live
instance (real Docker MySQL, not mocks) during development — the status codes and shapes
shown are what the API actually returns, not aspirational.

See the main [README](../README.md) for setup steps if the server isn't running yet.

## Prerequisites

```bash
docker compose up -d
npm run migration:run
npm run seed:admin        # bootstraps ADMIN_SEED_EMAIL/ADMIN_SEED_PASSWORD from .env
npm run start:dev
```

```bash
BASE=http://localhost:3000/api
```

`jq` is used below to pull ids/tokens out of responses; it's optional, just convenient
(`brew install jq` / `apt install jq`).

**Ready-to-use credentials** — no setup beyond the commands above needed:

- **ADMIN** (seeded by `npm run seed:admin`, from `.env.example`'s defaults):
  `admin@leovegas.test` / `ChangeMe123!`
- **USER**: there's no seeded regular user — register one with the very first curl command
  in section 1 below (e.g. `alice@example.com` / `password123`), then log in with it in
  section 2. That's the one extra step; everything else in this guide works as-is.

(If you've changed `ADMIN_SEED_EMAIL`/`ADMIN_SEED_PASSWORD` in your own `.env`, use those
values instead — the ones above are only what ships in `.env.example`.)

---

## 1. Registration (`POST /users`)

**Self-register as an anonymous caller — 201, forced to `USER`:**

```bash
curl -s -w "\n[%{http_code}]\n" -X POST $BASE/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice","email":"alice@example.com","password":"password123"}'
```

**Anonymous caller tries to self-assign `ADMIN` — ignored, still forced to `USER`:**

```bash
curl -s -w "\n[%{http_code}]\n" -X POST $BASE/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Mallory","email":"mallory@example.com","password":"password123","role":"ADMIN"}'
```

**Duplicate email — 409:**

```bash
curl -s -w "\n[%{http_code}]\n" -X POST $BASE/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice2","email":"alice@example.com","password":"password123"}'
# => {"errors":[{"status":"409","title":"Conflict","detail":"Email alice@example.com is already in use"}]}
```

**Invalid payload — 422, one error per field, each with a `source.pointer`:**

```bash
curl -s -w "\n[%{http_code}]\n" -X POST $BASE/users \
  -H "Content-Type: application/json" \
  -d '{"name":"","email":"not-an-email","password":"short"}'
```

**Unknown field — 422, whitelist rejection (`forbidNonWhitelisted`):**

```bash
curl -s -w "\n[%{http_code}]\n" -X POST $BASE/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Bob","email":"bob@example.com","password":"password123","isSuperCool":true}'
```

---

## 2. Login (`POST /auth/login`)

```bash
LOGIN=$(curl -s -X POST $BASE/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"password123"}')
echo "$LOGIN" | jq .
ALICE_TOKEN=$(echo "$LOGIN" | jq -r '.data.meta.accessToken')
ALICE_ID=$(echo "$LOGIN" | jq -r '.data.id')
```

Response is a real JSON:API resource object — the token rides in `meta`, not a one-off shape:

```json
{
  "data": {
    "type": "users",
    "id": "4cc3686a-...",
    "attributes": { "name": "Alice", "email": "alice@example.com", "role": "USER", "createdAt": "...", "updatedAt": "..." },
    "meta": { "accessToken": "9e38..." }
  }
}
```

**Wrong password / unknown email — both 401, same generic message (no account enumeration):**

```bash
curl -s -w "\n[%{http_code}]\n" -X POST $BASE/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"wrongpassword"}'

curl -s -w "\n[%{http_code}]\n" -X POST $BASE/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"nobody@example.com","password":"password123"}'
# both => {"errors":[{"status":"401","title":"Unauthorized","detail":"Invalid email or password"}]}
```

---

## 3. Authenticated self-access

**No token / invalid token on a protected route — 401:**

```bash
curl -s -w "\n[%{http_code}]\n" $BASE/users/$ALICE_ID
# => {"errors":[{"status":"401","title":"Unauthorized","detail":"Missing bearer token"}]}

curl -s -w "\n[%{http_code}]\n" $BASE/users/$ALICE_ID -H "Authorization: Bearer garbage-token"
# => {"errors":[{"status":"401","title":"Unauthorized","detail":"Invalid or expired access token"}]}
```

**View self — 200:**

```bash
curl -s -w "\n[%{http_code}]\n" $BASE/users/$ALICE_ID -H "Authorization: Bearer $ALICE_TOKEN"
```

**Full `PUT` resubmitting her own current, unchanged role — 200.** A spec-correct `PUT`
sends the complete representation, including the field that hasn't changed; this must not
be mistaken for a role-change attempt:

```bash
curl -s -w "\n[%{http_code}]\n" -X PUT $BASE/users/$ALICE_ID \
  -H "Authorization: Bearer $ALICE_TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Alice Updated","email":"alice@example.com","password":"password123","role":"USER"}'
```

**`PATCH` her own role to `ADMIN` — 403 (only ADMIN can change roles, including one's own):**

```bash
curl -s -w "\n[%{http_code}]\n" -X PATCH $BASE/users/$ALICE_ID \
  -H "Authorization: Bearer $ALICE_TOKEN" -H "Content-Type: application/json" \
  -d '{"role":"ADMIN"}'
```

---

## 4. Cross-user access as a non-admin

```bash
MALLORY_ID=<id from section 1>
```

**View / update another user — 403, not 404 (existence of `targetId` is never leaked to a
non-admin; the check runs before the repository lookup):**

```bash
curl -s -w "\n[%{http_code}]\n" $BASE/users/$MALLORY_ID -H "Authorization: Bearer $ALICE_TOKEN"

curl -s -w "\n[%{http_code}]\n" -X PATCH $BASE/users/$MALLORY_ID \
  -H "Authorization: Bearer $ALICE_TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Hacked"}'
```

**List users as a non-admin — 403:**

```bash
curl -s -w "\n[%{http_code}]\n" $BASE/users -H "Authorization: Bearer $ALICE_TOKEN"
```

**Delete self as a non-admin — 403 (`DELETE` is ADMIN-only, full stop):**

```bash
curl -s -w "\n[%{http_code}]\n" -X DELETE $BASE/users/$ALICE_ID -H "Authorization: Bearer $ALICE_TOKEN"
```

**A random, nonexistent id as a non-admin — still 403, not 404:**

```bash
curl -s -w "\n[%{http_code}]\n" $BASE/users/00000000-0000-0000-0000-000000000000 \
  -H "Authorization: Bearer $ALICE_TOKEN"
```

---

## 5. Admin operations

```bash
ADMIN_LOGIN=$(curl -s -X POST $BASE/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@leovegas.test","password":"ChangeMe123!"}')
ADMIN_TOKEN=$(echo "$ADMIN_LOGIN" | jq -r '.data.meta.accessToken')
ADMIN_ID=$(echo "$ADMIN_LOGIN" | jq -r '.data.id')
```

**List all users — 200 (ADMIN only):**

```bash
curl -s $BASE/users -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.data[] | {id, role: .attributes.role}'
```

**View any user directly — 200; a nonexistent id — 404 (contrast with the 403 a non-admin
gets for the exact same request — an ADMIN's response codes *can* reveal id existence, a
non-admin's can't):**

```bash
curl -s -w "\n[%{http_code}]\n" $BASE/users/$MALLORY_ID -H "Authorization: Bearer $ADMIN_TOKEN"

curl -s -w "\n[%{http_code}]\n" $BASE/users/00000000-0000-0000-0000-000000000000 \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Promote/demote another user's role — 200:**

```bash
curl -s -w "\n[%{http_code}]\n" -X PATCH $BASE/users/$MALLORY_ID \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"role":"ADMIN"}'
```

**An ADMIN changing their own role — 200, a documented judgment call** (the spec only
restricts self-role-change for `USER`) — **unless they're the sole remaining admin; see
section 6.**

**Delete another user — 204, then a 404 on that same id:**

```bash
curl -s -w "\n[%{http_code}]\n" -X DELETE $BASE/users/$MALLORY_ID -H "Authorization: Bearer $ADMIN_TOKEN"
curl -s -w "\n[%{http_code}]\n" $BASE/users/$MALLORY_ID -H "Authorization: Bearer $ADMIN_TOKEN"
```

**An ADMIN deleting themselves — still 403.** No one can delete their own account,
regardless of role:

```bash
curl -s -w "\n[%{http_code}]\n" -X DELETE $BASE/users/$ADMIN_ID -H "Authorization: Bearer $ADMIN_TOKEN"
```

---

## 6. Edge cases worth knowing about

**Concurrent duplicate-email registration.** Two requests for the same brand-new email
fired at the same instant: one wins (`201`), the other loses the race at the database's
unique index and comes back a clean `409` — never a raw `500`:

```bash
EMAIL="race-$(date +%s)@example.com"
for i in 1 2; do
  curl -s -w " [%{http_code}]\n" -X POST $BASE/users \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"Racer$i\",\"email\":\"$EMAIL\",\"password\":\"password123\"}" &
done
wait
```

**Last-admin lockout.** A role change may never leave the system with zero admins. With
exactly one admin remaining, that admin's own self-demotion is blocked with a specific
message (demoting them is fine as long as another admin still exists afterward):

```bash
# Assuming ADMIN_ID is currently the *only* ADMIN in the system:
curl -s -w "\n[%{http_code}]\n" -X PATCH $BASE/users/$ADMIN_ID \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"role":"USER"}'
# => {"errors":[{"status":"403","title":"Forbidden","detail":"Cannot change the role of the last remaining administrator"}]}
```

---

## 7. Logout and token expiry

**Logout invalidates the current token immediately (204), and the same token then fails (401):**

```bash
curl -s -w "\n[%{http_code}]\n" -X POST $BASE/auth/logout -H "Authorization: Bearer $ALICE_TOKEN"
# => 204

curl -s -w "\n[%{http_code}]\n" $BASE/users/$ALICE_ID -H "Authorization: Bearer $ALICE_TOKEN"
# => {"errors":[{"status":"401","title":"Unauthorized","detail":"Invalid or expired access token"}]}
```

**Tokens also expire on their own after `ACCESS_TOKEN_TTL_SECONDS`** (default 3600 = 1 hour).
To see this without waiting an hour, start the app with a short TTL for testing:

```bash
ACCESS_TOKEN_TTL_SECONDS=3 npm run start:dev
```

```bash
LOGIN=$(curl -s -X POST $BASE/auth/login -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"password123"}')
TOKEN=$(echo "$LOGIN" | jq -r '.data.meta.accessToken')

curl -s -w " [%{http_code}]\n" -o /dev/null $BASE/users/$ALICE_ID -H "Authorization: Bearer $TOKEN"
# => 200 (still valid)

sleep 4

curl -s -w "\n[%{http_code}]\n" $BASE/users/$ALICE_ID -H "Authorization: Bearer $TOKEN"
# => 401, same "Invalid or expired access token" message - an expired token and an unknown
# token are indistinguishable to the client, on purpose
```

---

## 8. Rate limiting

`POST /auth/login` is limited to 5 requests/minute/IP, `POST /users` to 10/minute/IP; every
other route falls back to a global default of 30/minute/IP. Limits are enforced by
`ThrottlerGuard`, which runs *before* authentication in the global guard order.

```bash
for i in $(seq 1 7); do
  curl -s -o /dev/null -w "attempt $i: [%{http_code}]\n" -X POST $BASE/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"nobody@example.com","password":"wrongpassword"}'
done
# first 5 (per rolling 60s window, across *all* recent requests from this IP - including
# any earlier logins in this walkthrough) => 401 (wrong credentials, but not blocked)
# once the limit is hit => 429
```

```json
{"errors":[{"status":"429","title":"ThrottlerException","detail":"ThrottlerException: Too Many Requests"}]}
```

Note the limit is per IP across *all* recent requests to that route within the window, not
per test run - if you've already logged in a few times in the last minute while working
through this guide, you'll hit `429` sooner than expect.

---

## 9. Pagination

`GET /users` accepts `?page=` (default `1`) and `?limit=` (default `20`, max `100`):

```bash
curl -s $BASE/users -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.meta'
# => {"page":1,"limit":20,"totalCount":11,"totalPages":1}

curl -s "$BASE/users?page=2&limit=3" -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.meta, [.data[].id]'
# => distinct rows from page=1, and meta.totalPages reflects the smaller page size

curl -s -w "\n[%{http_code}]\n" "$BASE/users?limit=500" -H "Authorization: Bearer $ADMIN_TOKEN"
# => 422, {"detail":"limit must not be greater than 100", "source":{"pointer":"/limit"}}

curl -s -w "\n[%{http_code}]\n" "$BASE/users?page=0" -H "Authorization: Bearer $ADMIN_TOKEN"
# => 422, {"detail":"page must not be less than 1", "source":{"pointer":"/page"}}
```
