# Security Specification — Khmer Wonder Studio

## 1. Data Invariants
1. **Owner-Only User Profiles (`/users/{userId}`)**: Only the authenticated, email-verified user whose `request.auth.uid == userId` may read, create, or update their own profile document. No blanket `list` queries on `/users`.
2. **Owner-Only Subcollections (`/users/{userId}/transcripts/{transcriptId}`, `/users/{userId}/videoPrompts/{videoId}`)**: Subcollection documents must verify parent ownership (`request.auth.uid == userId`), enforce parent existence via `exists(/databases/$(database)/documents/users/$(userId))` on create, and bind `incoming().uid == request.auth.uid`.
3. **Immutable 3D Game Leaderboard Entries (`/gameScores/{scoreId}`)**: Signed-in users may list/get non-PII scores (`playerName`, `score`, `lotuses`, `distance`, `uid`, `createdAt`) bounded to verified records; creation requires verified auth, `incoming().uid == request.auth.uid`, numeric bounds (`0 <= score <= 1000000`), and `createdAt == request.time`. Updates are forbidden; owners may delete their own score entries.
4. **No Shadow Fields / No Oversized Strings / Strict Server Timestamps**: Every entity enforces `keys().hasAll(...) && keys().hasOnly(...)`, string `.size()` ceilings matching `firebase-blueprint.json`, bounded array lengths (`friends.size() <= 30`), `isValidId()` on single-document IDs, and `request.time` timestamp integrity.

## 2. The "Dirty Dozen" Adversarial Payloads (Must Return PERMISSION_DENIED)
1. **Unauthenticated Read on `/users/{uid}`**: `auth = null` attempting `get /users/alice`.
2. **Cross-User Profile Read**: `auth.uid = 'bob'` attempting `get /users/alice`.
3. **Unverified Email Write**: `auth.uid = 'alice'`, `email_verified = false` attempting `create /users/alice`.
4. **Shadow Field Injection on Profile Create**: Creating `/users/alice` with extra field `isAdmin: true`.
5. **Identity Spoofing on Game Score**: `auth.uid = 'bob'` creating `/gameScores/s1` with `uid: 'alice'`.
6. **Score Tampering / Update After Creation**: `auth.uid = 'alice'` updating `/gameScores/s1` to `score: 999999`.
7. **ID Poisoning Attack**: Writing to `/gameScores/` + 200-char junk ID with invalid characters.
8. **Denial-of-Wallet Oversized Transcript**: Creating `/users/alice/transcripts/t1` with a 50KB `transcript` string (> 8000 chars).
9. **Unbounded Array Attack**: Updating `/users/alice` with 100 entries in `friends` (> 30 max).
10. **Forged Client Timestamp**: Creating `/users/alice/transcripts/t2` with a backdated `createdAt` (`!= request.time`).
11. **Immutable Field Mutation**: Updating `/users/alice` attempting to alter `uid` or `createdAt`.
12. **Orphaned Subcollection Write**: Creating `/users/newuser/transcripts/t1` when parent `/users/newuser` does not exist.
