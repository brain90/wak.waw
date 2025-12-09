#!/bin/bash

BASE_URL="http://localhost:8000"

test_qr() {
  echo "1. Testing /qr endpoint..."
  curl -s "$BASE_URL/qr" | jq
  echo ""
}

test_health() {
  echo "2. Testing /health endpoint..."
  curl -s "$BASE_URL/health" | jq
  echo ""
}

test_status() {
  echo "3. Testing /status endpoint..."
  curl -s "$BASE_URL/status" | jq
  echo ""
}

test_sync() {
  echo "4. Testing /sync endpoint..."
  curl -s "$BASE_URL/sync" | jq
  echo ""
}

test_send() {
  echo "5. Testing /send endpoint..."
  curl -s -X POST "$BASE_URL/send" \
    -H "Content-Type: application/json" \
    -d '{"number":"628118989999","message":"Man shabara zhafira"}' | jq
  echo ""
}

# Main execution
echo "=== Testing WhatsApp Bot Endpoints ==="
echo ""

#test_qr
test_sync # wajib sync kontak dahulu. agar tidak sembarang kirim pesan.
test_send
#test_health
#test_status

echo "=== All tests completed ==="
