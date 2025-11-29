# Botnama API Documentation

Botnama provides a RESTful API for managing requests, controlling playback, and integrating with external tools.
The base URL for all endpoints is `http://localhost:2101/api`.

## Authentication

### YouTube

- **GET** `/auth/youtube/login`
  - Initiates the YouTube OAuth flow. Redirects to Google's authentication page.
- **GET** `/auth/youtube/callback`
  - Callback URL for OAuth. Exchanges the authorization code for tokens.
- **GET** `/auth/youtube/status`
  - Checks the current authentication status.
  - **Query Params**: `refresh=1` (optional) to force a token refresh check.
  - **Response**: `{ ok: true, authenticated: boolean, channelUrl: string, broadcastId: string }`
- **POST** `/auth/youtube/logout`
  - Clears YouTube credentials.

### Niconico

- **POST** `/auth/niconico/login`
  - Logs in to Niconico using username and password.
  - **Body**: `{ "username": "...", "password": "..." }`
- **GET** `/auth/niconico/status`
  - Checks Niconico authentication status.
  - **Query Params**: `refresh=1` (optional).
  - **Response**: `{ ok: true, authenticated: boolean, userPageUrl: string, broadcastId: string }`
- **POST** `/auth/niconico/logout`
  - Clears Niconico credentials.

## Requests (Queue Management)

- **GET** `/requests`
  - Lists requests in the queue.
  - **Query Params**:
    - `status`: Filter by status (comma-separated, e.g., `QUEUED,PLAYING`).
    - `bucket`: Bucket name (default: `queue`).
    - `limit`: Max items to return.
    - `offset`: Pagination offset.
- **GET** `/requests/summary`
  - Returns a summary of the current queue state, including the currently playing item.
- **POST** `/requests/:id/play`
  - Forces a specific request to play immediately.
- **POST** `/requests/:id/skip`
  - Skips the specified request.
- **POST** `/requests/:id/delete`
  - Removes a request from the queue.
- **POST** `/requests/:id/reorder`
  - Moves a request to a new position.
  - **Body**: `{ "position": 1 }` (1-based index)
- **POST** `/requests/suspend`
  - Suspends (holds) multiple requests.
  - **Body**: `{ "ids": ["id1", "id2"] }`
- **POST** `/requests/resume`
  - Resumes suspended requests.
  - **Body**: `{ "ids": ["id1", "id2"] }`
- **POST** `/requests/clear`
  - Removes all requests from the queue.
- **POST** `/requests/intake/toggle`
  - Toggles whether new requests are accepted.
- **GET** `/requests/intake/status`
  - Returns the current intake status (`paused`: boolean).

## Overlay Control

- **POST** `/overlay/stop`
  - Stops playback and clears the current player.
- **POST** `/overlay/autoplay`
  - Toggles autoplay mode.
- **POST** `/overlay/shuffle`
  - Cycles through shuffle modes (off, on).
- **POST** `/overlay/pause`
  - Pauses the current video.
- **POST** `/overlay/resume`
  - Resumes the current video.
- **POST** `/overlay/seek`
  - Seeks to a specific position or by a delta.
  - **Body**: `{ "positionSec": 120 }` OR `{ "deltaSec": 10 }`

## Comments

- **GET** `/comments`
  - Lists recent comments.
  - **Query Params**: `limit` (default: 50).
- **POST** `/comments/clear`
  - Clears all comment history.
- **GET** `/comments/export`
  - Exports comments as CSV.
- **POST** `/hooks/mcv/comments`
  - Webhook for MultiCommentViewer integration.
  - **Headers**: `x-botnama-mcv-token` (must match `mcvAccessToken` in settings).
  - **Body**: MCV JSON payload.
- **POST** `/debug/comments`
  - Injects a fake comment for testing.
  - **Body**: `{ "message": "test comment", "userName": "tester" }`

## Rules

- **GET** `/rules`
  - Returns current rule settings.
- **POST** `/rules`
  - Updates rule settings.
  - **Body**: Partial rule object (e.g., `{ "maxDurationMinutes": 10 }`).
- **POST** `/rules/reload`
  - Reloads rules from disk.
- **GET** `/rules/ng-users`
  - Returns the list of NG users.
- **POST** `/rules/ng-users`
  - Adds a user to the NG list.
  - **Body**: `{ "userId": "...", "enable": true }`
- **DELETE** `/rules/ng-users/:userId`
  - Removes a user from the NG list.
- **POST** `/rules/ng-users/clear`
  - Clears the NG user list.

## Stocks (Saved Lists)

- **GET** `/stocks`
  - Lists available stock buckets.
- **POST** `/stocks`
  - Creates a new stock bucket.
  - **Body**: `{ "name": "my-list" }`
- **GET** `/stocks/:name`
  - Lists items in a stock bucket.
- **POST** `/stocks/:name/add`
  - Adds an item to a stock bucket.
  - **Body**: `{ "message": "http://..." }`
- **POST** `/stocks/:name/submit`
  - Submits items from a stock bucket to the main queue.
  - **Body**: `{ "ids": ["item-id-1"], "suspend": false }`
- **POST** `/stocks/:name/save`
  - Persists the stock bucket to disk.

## Logs

- **GET** `/logs`
  - Lists recent playback logs.
- **POST** `/logs/clear`
  - Clears playback history.
- **GET** `/logs/export`
  - Exports playback logs as CSV.

## System

- **GET** `/system/info`
  - Returns system information (versions, disk usage, etc.).
- **POST** `/system/update/yt-dlp`
  - Triggers a self-update of the `yt-dlp` binary.
- **GET** `/locale`
  - Returns the current UI locale.
- **POST** `/locale`
  - Sets the UI locale.
  - **Body**: `{ "locale": "ja" }` (or "en", "auto").

## Notifications

- **GET** `/notifications/settings`
  - Returns notification (telop) settings.
- **POST** `/notifications/settings`
  - Updates notification settings.
  - **Body**: `{ "notifyTelopEnabled": true, ... }`

## Server-Sent Events (SSE)

- **GET** `/stream`
  - Main event stream for the Dock UI.
  - **Events**: `requests`, `comments`, `logs`, `system`, `rules`.
- **GET** `/overlay-info/stream`
  - Event stream for the Info Overlay.
  - **Events**: `notify` (playback events), `locale`.
