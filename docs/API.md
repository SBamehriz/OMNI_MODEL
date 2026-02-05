# Omni-Model Router — API contract

Contract only; no implementation. Use this for backend and dashboard alignment. Base URL is assumed (e.g. `https://api.example.com` or `/api` in monorepo).

---

## Authentication

All endpoints require an API key.

- **Header:** `Authorization: Bearer <api_key>` or `X-API-Key: <api_key>`
- Invalid or missing key → `401` with error body below.

---

## Error response shape

All errors use this structure:

```json
{
  "error": {
    "code": "string",
    "message": "string"
  },
  "request_id": "string"
}
```

Common codes: `invalid_api_key`, `rate_limited`, `invalid_request`, `provider_error`, `internal_error`.  
**Rate limits:** Placeholder e.g. 100 requests per minute per org; response `429` with same error shape.

---

## POST `/v1/chat`

Main routing endpoint. Sends the conversation to the router; the router selects a model and returns the reply.

### Request

**Headers:** `Authorization: Bearer <api_key>`, `Content-Type: application/json`

**Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `messages` | array | Yes | Chat messages (e.g. `{ "role": "user" \| "assistant" \| "system", "content": "..." }`) |
| `priority` | string | No | `"cheap"` \| `"balanced"` \| `"best"`. Default `"balanced"`. |
| `latency_pref` | string | No | `"fast"` \| `"normal"`. Default `"normal"`. |
| `max_cost` | number | No | Max allowed cost for this request (e.g. 0.02). |

Example:

```json
{
  "messages": [
    { "role": "user", "content": "Summarize this in one sentence." }
  ],
  "priority": "cheap",
  "latency_pref": "fast",
  "max_cost": 0.02
}
```

### Response (200)

| Field | Type | Description |
|-------|------|-------------|
| `output` | string | Model reply (e.g. first choice content). |
| `model_used` | string | Model identifier that was used. |
| `cost` | number | Actual cost for this request. |
| `latency_ms` | number | Round-trip latency in milliseconds. |
| `savings_estimate` | number | Estimated savings vs using a default premium model. |

Example:

```json
{
  "output": "This is a brief summary.",
  "model_used": "gpt-4o-mini",
  "cost": 0.003,
  "latency_ms": 420,
  "savings_estimate": 0.02
}
```

---

## POST `/v1/agent-step`

Used for AI agent workflows. Same idea as `/v1/chat`: one endpoint, router picks the model for this step. Request/response can mirror `/v1/chat` (e.g. `messages`, optional `priority`, `latency_pref`, `max_cost`; response `output`, `model_used`, `cost`, `latency_ms`, `savings_estimate`). Exact fields may be extended for agent-specific metadata (e.g. step id) without changing the core contract.

---

## GET `/v1/usage`

Returns cost and usage stats for the authenticated org (or user).

**Query (optional):** `from`, `to` (ISO dates) to scope the period.

**Response (200):** e.g. `total_requests`, `total_cost`, `estimated_savings`, `by_model` (array of model + count + cost). Exact fields TBD; dashboard consumes this.

---

## GET `/v1/models`

Lists models available for routing (from the model registry).

**Response (200):** Array of model entries, e.g. `provider`, `model_name`, `cost_input`, `cost_output`, `avg_latency`, `strengths`. Read-only; no auth beyond API key.

---

## POST `/v1/router/debug`

Explains how the router would (or did) choose a model for a given request. Used for debugging and transparency.

**Body:** Same as `/v1/chat` (e.g. `messages`, optional `priority`, `latency_pref`, `max_cost`).

**Response (200):** e.g. `task_type`, `considered_models` (list with scores or reasons), `selected_model`, `reason`. No actual call to a provider required; can be purely deterministic from request + registry.
