# Daily Dose Backend API Testing Guide (Postman)

This document contains:
- Full API list for the current backend
- Postman setup and execution order
- Request/response examples
- Validation and negative test checklist
- Practical suggestions for production readiness

## 1. Base Setup

### 1.1 Run server

```bash
npm run dev
```

### 1.2 Postman environment variables

Create an environment named `DailyDose Local` with:

- `baseUrl` = `http://localhost:3000`
- `deviceId` = ``
- `articleId` = ``
- `swipedArticleId` = ``

### 1.3 Common response shape

Success:

```json
{
  "success": true,
  "data": {}
}
```

Error:

```json
{
  "success": false,
  "error": "error message"
}
```

## 2. Full API List

### 2.1 Health

- `GET /`

### 2.2 User APIs

- `POST /api/users/register`
- `GET /api/users/:deviceId`
- `POST /api/users/:deviceId/bookmarks/:articleId`
- `DELETE /api/users/:deviceId/bookmarks/:articleId`

### 2.3 Preference APIs

- `GET /api/preferences/categories`
- `GET /api/preferences/:deviceId`
- `PUT /api/preferences/:deviceId`

### 2.4 News APIs

- `GET /api/news/feed/:deviceId?page=1`
- `POST /api/news/swipe/:deviceId`
- `GET /api/news/:articleId`

## 3. Postman Test Flow (Recommended Order)

## 3.1 Health check

### Request
- Method: `GET`
- URL: `{{baseUrl}}/`

### Expected
- Status: `200`

### Tests script
```javascript
pm.test('Status is 200', function () {
  pm.response.to.have.status(200);
});

pm.test('Health has status message', function () {
  const body = pm.response.json();
  pm.expect(body).to.have.property('status');
});
```

## 3.2 Register device

### Request
- Method: `POST`
- URL: `{{baseUrl}}/api/users/register`

### Expected
- Status: `201`
- Response includes UUID `deviceId`

### Tests script
```javascript
pm.test('Status is 201', function () {
  pm.response.to.have.status(201);
});

pm.test('Save deviceId', function () {
  const body = pm.response.json();
  pm.expect(body.success).to.eql(true);
  pm.expect(body.data).to.have.property('deviceId');
  pm.environment.set('deviceId', body.data.deviceId);
});
```

## 3.3 Get categories

### Request
- Method: `GET`
- URL: `{{baseUrl}}/api/preferences/categories`

### Expected
- Status: `200`
- Categories contain all valid options

### Tests script
```javascript
pm.test('Status is 200', function () {
  pm.response.to.have.status(200);
});

pm.test('Contains all supported categories', function () {
  const body = pm.response.json();
  const expected = ['technology', 'politics', 'sports', 'business', 'science', 'health', 'entertainment', 'world'];

  pm.expect(body.success).to.eql(true);
  pm.expect(body.data).to.be.an('array');
  expected.forEach(function (c) {
    pm.expect(body.data).to.include(c);
  });
});
```

## 3.4 Save preferences

### Request
- Method: `PUT`
- URL: `{{baseUrl}}/api/preferences/{{deviceId}}`
- Body:

```json
{
  "categories": ["technology", "sports", "world"]
}
```

### Expected
- Status: `200`
- Message: `Preferences saved`

### Tests script
```javascript
pm.test('Status is 200', function () {
  pm.response.to.have.status(200);
});

pm.test('Preferences saved message', function () {
  const body = pm.response.json();
  pm.expect(body.success).to.eql(true);
  pm.expect(body.data.message).to.eql('Preferences saved');
});
```

## 3.5 Verify preferences

### Request
- Method: `GET`
- URL: `{{baseUrl}}/api/preferences/{{deviceId}}`

### Expected
- Status: `200`
- Selected categories present

### Tests script
```javascript
pm.test('Status is 200', function () {
  pm.response.to.have.status(200);
});

pm.test('Selected categories are present', function () {
  const body = pm.response.json();
  pm.expect(body.success).to.eql(true);
  pm.expect(body.data.categories).to.include('technology');
  pm.expect(body.data.categories).to.include('sports');
  pm.expect(body.data.categories).to.include('world');
});
```

## 3.6 Get feed (page 1)

### Request
- Method: `GET`
- URL: `{{baseUrl}}/api/news/feed/{{deviceId}}?page=1`

### Expected
- Status: `200`
- `data.items.length <= 20`
- Rate limit header exists (`RateLimit-Limit`)

### Tests script
```javascript
pm.test('Status is 200', function () {
  pm.response.to.have.status(200);
});

pm.test('Feed has items and page info', function () {
  const body = pm.response.json();
  pm.expect(body.success).to.eql(true);
  pm.expect(body.data).to.have.property('page');
  pm.expect(body.data).to.have.property('pageSize');
  pm.expect(body.data).to.have.property('items');
  pm.expect(body.data.items).to.be.an('array');
  pm.expect(body.data.items.length).to.be.at.most(20);
});

pm.test('Store first articleId for next requests', function () {
  const body = pm.response.json();
  if (body.data.items.length > 0) {
    pm.environment.set('articleId', body.data.items[0].articleId);
  }
});

pm.test('News rate-limit header exists', function () {
  pm.expect(pm.response.headers.has('RateLimit-Limit')).to.eql(true);
});
```

## 3.7 Get article detail

### Request
- Method: `GET`
- URL: `{{baseUrl}}/api/news/{{articleId}}`

### Expected
- Status: `200`
- Returns article detail payload

### Tests script
```javascript
pm.test('Status is 200', function () {
  pm.response.to.have.status(200);
});

pm.test('Article detail shape', function () {
  const body = pm.response.json();
  pm.expect(body.success).to.eql(true);
  pm.expect(body.data).to.have.property('articleId');
  pm.expect(body.data).to.have.property('title');
  pm.expect(body.data).to.have.property('category');
});
```

## 3.8 Swipe article

### Request
- Method: `POST`
- URL: `{{baseUrl}}/api/news/swipe/{{deviceId}}`
- Body:

```json
{
  "articleId": "{{articleId}}",
  "action": "like"
}
```

### Expected
- Status: `200`
- Message: `Swipe recorded successfully`
- `updatedWeight` returned

### Tests script
```javascript
pm.test('Status is 200', function () {
  pm.response.to.have.status(200);
});

pm.test('Swipe response shape', function () {
  const body = pm.response.json();
  pm.expect(body.success).to.eql(true);
  pm.expect(body.data.message).to.eql('Swipe recorded successfully');
  pm.expect(body.data.action).to.eql('like');
  pm.expect(body.data).to.have.property('updatedWeight');
});

pm.test('Store swiped article id', function () {
  pm.environment.set('swipedArticleId', pm.environment.get('articleId'));
});
```

## 3.9 Verify swiped article excluded from feed

### Request
- Method: `GET`
- URL: `{{baseUrl}}/api/news/feed/{{deviceId}}?page=1`

### Expected
- Swiped article should not be present in returned items

### Tests script
```javascript
pm.test('Status is 200', function () {
  pm.response.to.have.status(200);
});

pm.test('Swiped article does not reappear', function () {
  const body = pm.response.json();
  const swipedId = pm.environment.get('swipedArticleId');

  const found = body.data.items.some(function (item) {
    return item.articleId === swipedId;
  });

  pm.expect(found).to.eql(false);
});
```

## 3.10 Verify user profile learning signals

### Request
- Method: `GET`
- URL: `{{baseUrl}}/api/users/{{deviceId}}`

### Expected
- `swipeHistory` contains records
- `preferences.categoryWeights` reflects updates after swipes

### Tests script
```javascript
pm.test('Status is 200', function () {
  pm.response.to.have.status(200);
});

pm.test('Profile includes swipe history', function () {
  const body = pm.response.json();
  pm.expect(body.success).to.eql(true);
  pm.expect(body.data.swipeHistory).to.be.an('array');
});
```

## 3.11 Bookmark flow

### Add bookmark
- Method: `POST`
- URL: `{{baseUrl}}/api/users/{{deviceId}}/bookmarks/{{articleId}}`

Tests:
```javascript
pm.test('Bookmark add status 200', function () {
  pm.response.to.have.status(200);
});

pm.test('Bookmark add message', function () {
  const body = pm.response.json();
  pm.expect(body.success).to.eql(true);
  pm.expect(body.data.message).to.eql('Bookmark added successfully');
});
```

### Remove bookmark
- Method: `DELETE`
- URL: `{{baseUrl}}/api/users/{{deviceId}}/bookmarks/{{articleId}}`

Tests:
```javascript
pm.test('Bookmark delete status 200', function () {
  pm.response.to.have.status(200);
});

pm.test('Bookmark delete message', function () {
  const body = pm.response.json();
  pm.expect(body.success).to.eql(true);
  pm.expect(body.data.message).to.eql('Bookmark removed successfully');
});
```

## 4. Negative Testing Checklist

Run these to verify validation/error handling:

1. Invalid UUID
- `GET {{baseUrl}}/api/users/not-a-uuid`
- Expect `400`

2. Invalid ObjectId
- `GET {{baseUrl}}/api/news/123`
- Expect `400`

3. Invalid swipe action
- `POST {{baseUrl}}/api/news/swipe/{{deviceId}}`
- Body:
```json
{
  "articleId": "{{articleId}}",
  "action": "save"
}
```
- Expect `400`

4. Invalid category in preferences
- `PUT {{baseUrl}}/api/preferences/{{deviceId}}`
- Body:
```json
{
  "categories": ["invalid-category"]
}
```
- Expect `400`

5. News rate limit
- Call `GET /api/news/feed/{{deviceId}}?page=1` repeatedly (>60 within 15 minutes)
- Expect `429` and message:
  `Too many news requests. Please slow down and try again shortly.`

## 5. Security Header Checks

Use `GET {{baseUrl}}/` and verify response headers include:

- `X-Content-Type-Options: nosniff`
- `X-DNS-Prefetch-Control: off`
- `Access-Control-Allow-Origin: *`

These indicate Helmet and CORS are active.

## 6. Suggestions

1. Add one Postman collection with folders in this order:
- Health
- User
- Preferences
- News
- Negative tests

2. Add collection-level test helper to fail fast when `success === false` on success-path requests.

3. Add a regression monitor:
- Use Newman in CI to run this collection on every push.

4. Add seed endpoint/script for predictable test data:
- Makes feed/detail tests deterministic and faster.

5. Add auth/security prep for production:
- Restrict CORS origin in production env.
- Keep permissive CORS only for local development.

6. Track rate-limit behavior in tests:
- Add checks for `RateLimit-Limit`, `RateLimit-Remaining` headers on `/api/news`.

---

Maintainer note:
Update this file whenever API contract, validation rules, or response shape changes.
