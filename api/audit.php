<?php
// POST api/audit.php — fetches the RAW Airbnb listing via Apify.
// Body: { "url": "https://www.airbnb.com/rooms/..." }
// Returns: { ok: true, item: {...raw scraper item...}, url }
// Normalization, scoring and all localization happen in the browser (lib/*.js).
declare(strict_types=1);

@ini_set('display_errors', '0'); // never let a host warning corrupt the JSON output

header('Content-Type: application/json; charset=utf-8');
@set_time_limit(150);

function out(int $status, array $body): void {
  http_response_code($status);
  echo json_encode($body);
  exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') out(405, ['ok' => false, 'code' => 'method']);

// A missing config is the normal state before the token is added - report it
// as "not configured" so the page can offer manual entry, not a 500.
$cfgPath = __DIR__ . '/config.php';
if (!is_file($cfgPath)) out(503, ['ok' => false, 'code' => 'scrape_unconfigured']);
$cfg = require $cfgPath;
$in  = json_decode(file_get_contents('php://input') ?: '', true) ?: [];
$url = trim((string)($in['url'] ?? ''));

// Returns [isAirbnbListing, isBookingListing, isAppShareLink] for a URL.
function iv_classify($u) {
  $host = (string)(parse_url($u, PHP_URL_HOST) ?: '');
  $path = (string)(parse_url($u, PHP_URL_PATH) ?: '');
  $airbnbHost  = preg_match('/(^|\.)airbnb\./i', $host);
  $bookingHost = preg_match('/(^|\.)booking\.com$/i', $host);
  return array(
    (bool)($airbnbHost  && preg_match('#/(rooms|h|luxury)/#', $path)),
    (bool)($bookingHost && preg_match('#^/hotel/#i', $path)),
    (bool)(preg_match('/(^|\.)abnb\.me$/i', $host)
        || ($airbnbHost  && preg_match('#^/l/#i', $path))
        || ($bookingHost && preg_match('#^/Share-#i', $path))),
  );
}

// Share links copied from the Airbnb / Booking mobile apps carry no listing id,
// only a redirect. Follow it once so a phone paste works like a desktop one.
function iv_resolve_short($u, $head) {
  $ch = curl_init($u);
  curl_setopt_array($ch, array(
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_MAXREDIRS      => 6,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_NOBODY         => $head,
    CURLOPT_CONNECTTIMEOUT => 10,
    CURLOPT_TIMEOUT        => 25,
    CURLOPT_USERAGENT      => 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  ));
  curl_exec($ch);
  return (string)curl_getinfo($ch, CURLINFO_EFFECTIVE_URL);
}

list($isAirbnb, $isBooking, $isShort) = iv_classify($url);

if (!$isAirbnb && !$isBooking && $isShort) {
  foreach (array(true, false) as $head) { // HEAD first; some hosts only answer GET
    $resolved = iv_resolve_short($url, $head);
    if ($resolved === '' || $resolved === $url) continue;
    list($a2, $b2, ) = iv_classify($resolved);
    if ($a2 || $b2) { $url = $resolved; $isAirbnb = $a2; $isBooking = $b2; break; }
  }
}

if (!$isAirbnb && !$isBooking) {
  out(400, ['ok' => false, 'code' => 'bad_url']);
}
if (empty($cfg['APIFY_TOKEN'])) out(503, ['ok' => false, 'code' => 'scrape_unconfigured']);

$actor = $isBooking
  ? (!empty($cfg['APIFY_BOOKING_ACTOR_ID']) ? $cfg['APIFY_BOOKING_ACTOR_ID'] : 'voyager~booking-scraper')
  : (!empty($cfg['APIFY_ACTOR_ID']) ? $cfg['APIFY_ACTOR_ID'] : 'tri_angle~airbnb-rooms-urls-scraper');
$endpoint = 'https://api.apify.com/v2/acts/' . $actor . '/run-sync-get-dataset-items'
          . '?token=' . rawurlencode($cfg['APIFY_TOKEN']) . '&timeout=100';

// A sample stay ~60 days out: far enough to dodge last-minute discounting,
// near enough to reflect current pricing. Airbnb only returns a price when
// dates are supplied, and the price drives the revenue calculator.
$checkIn  = gmdate('Y-m-d', time() + 60 * 86400);
$checkOut = gmdate('Y-m-d', time() + 65 * 86400);

$ch = curl_init($endpoint);
curl_setopt_array($ch, [
  CURLOPT_POST           => true,
  CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
  // Booking gets English output (the browser's text heuristics expect it)
  // and a one-item cap; a detail URL only yields one listing anyway.
  CURLOPT_POSTFIELDS     => json_encode([
    'startUrls' => [['url' => $url]],
    'checkIn'   => $checkIn,
    'checkOut'  => $checkOut,
    'adults'    => 2,
    'currency'  => 'EUR',
  ] + ($isBooking ? ['language' => 'en-us', 'maxItems' => 1] : [])),
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_CONNECTTIMEOUT => 15,
  CURLOPT_TIMEOUT        => 115,
]);
$res = curl_exec($ch);
if ($res === false) {
  $err = curl_error($ch);
  out(502, ['ok' => false, 'code' => 'scrape_failed', 'detail' => $err]);
}
$status = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
if ($status >= 300) {
  error_log('[audit.php] apify ' . $status . ' ' . substr((string)$res, 0, 300));
  out(502, ['ok' => false, 'code' => 'scrape_failed', 'detail' => 'HTTP ' . $status]);
}

$items = json_decode((string)$res, true);
$item  = null;
if (is_array($items)) {
  foreach ($items as $it) {
    if (is_array($it) && (isset($it['name']) || isset($it['title']) || isset($it['description']))) { $item = $it; break; }
  }
}
if (!$item) out(502, ['ok' => false, 'code' => 'scrape_empty']);

out(200, ['ok' => true, 'item' => $item, 'url' => $url]);
