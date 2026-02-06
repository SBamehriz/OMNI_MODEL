# Test /v1/agent-step with and without max_cost.
# Prereq: API running (npm run dev:api), .env with SUPABASE_* and at least one provider key (e.g. OPENAI_API_KEY).
# - Without max_cost: expect 200 with output, model_used, cost (or 502 if all providers fail).
# - With very low max_cost: expect 400 max_cost_exceeded.
$base = "http://localhost:3000"
$key = "omni-dev-key-change-in-production"
$headers = @{
  "Content-Type" = "application/json"
  "Authorization" = "Bearer $key"
}

Write-Host "`n1. POST /v1/agent-step WITHOUT max_cost (expect 200 + output, model_used, cost)..." -ForegroundColor Cyan
$body1 = '{"messages":[{"role":"user","content":"Say hello in one word."}]}'
try {
  $r1 = Invoke-RestMethod -Uri "$base/v1/agent-step" -Method Post -Headers $headers -Body $body1
  Write-Host "   Status: 200 OK" -ForegroundColor Green
  Write-Host "   output: $($r1.output)" -ForegroundColor Gray
  Write-Host "   model_used: $($r1.model_used)" -ForegroundColor Gray
  Write-Host "   cost: $($r1.cost)" -ForegroundColor Gray
} catch {
  $status = $_.Exception.Response.StatusCode.value__
  $body = $_.ErrorDetails.Message
  Write-Host "   Status: $status" -ForegroundColor Red
  Write-Host "   Body: $body" -ForegroundColor Gray
}

Write-Host "`n2. POST /v1/agent-step WITH max_cost=0.0000001 (expect 400 max_cost_exceeded)..." -ForegroundColor Cyan
$body2 = '{"messages":[{"role":"user","content":"Say hello."}],"max_cost":0.0000001}'
try {
  $r2 = Invoke-RestMethod -Uri "$base/v1/agent-step" -Method Post -Headers $headers -Body $body2
  Write-Host "   Unexpected 200: $r2" -ForegroundColor Red
} catch {
  $status = $_.Exception.Response.StatusCode.value__
  $body = $_.ErrorDetails.Message
  if ($status -eq 400 -and $body -match "max_cost_exceeded") {
    Write-Host "   Status: 400 (max_cost_exceeded) as expected" -ForegroundColor Green
    Write-Host "   Body: $body" -ForegroundColor Gray
  } else {
    Write-Host "   Status: $status" -ForegroundColor $(if ($status -eq 400) { "Yellow" } else { "Red" })
    Write-Host "   Body: $body" -ForegroundColor Gray
  }
}

Write-Host "`nDone. Start dashboard with: npm run dev:dashboard" -ForegroundColor Cyan
