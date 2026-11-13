<?php
// POST api/market.php - how a villa compares with same-size listings around it.
// Body: { "lat": -8.81, "lng": 115.11, "beds": 5, "id": "51414187" }   (id = Airbnb listing id, optional)
// Returns aggregates only: the comp set is the AirDNA listings with exactly the same number of
// bedrooms, nearest first, widened step by step until there are at least MIN_COMPS of them
// (30, so the top 10% is never fewer than 3 listings).
// The dataset (api/data/market-bali.php, built by _build/market/build_market.py) never leaves
// the server. Kept to PHP 7 syntax: the host runs an older PHP.
@ini_set('display_errors', '0');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

const MIN_COMPS = 30;
const RADII = array(3, 5, 8, 12, 20, 40);

function out($status, $body) {
  http_response_code($status);
  echo json_encode($body);
  exit;
}
function km($a, $b, $c, $d) {
  $r = M_PI / 180;
  $h = pow(sin(($c - $a) * $r / 2), 2) + cos($a * $r) * cos($c * $r) * pow(sin(($d - $b) * $r / 2), 2);
  return 2 * 6371 * asin(sqrt($h));
}
function quantile($vals, $q) {
  if (!count($vals)) return null;
  sort($vals);
  $i = ($q * (count($vals) - 1));
  $lo = (int)floor($i); $hi = (int)ceil($i);
  return $vals[$lo] + ($vals[$hi] - $vals[$lo]) * ($i - $lo);
}
function med($vals) { return quantile($vals, 0.5); }
function col($rows, $i, $positiveOnly) {
  $out = array();
  foreach ($rows as $r) { if (!$positiveOnly || $r[$i] > 0) $out[] = $r[$i]; }
  return $out;
}
function r0($v) { return $v === null ? null : (int)round($v); }
function r1($v) { return $v === null ? null : round($v, 1); }
function r2($v) { return $v === null ? null : round($v, 2); }

if ($_SERVER['REQUEST_METHOD'] !== 'POST') out(405, array('ok' => false, 'code' => 'method'));
$in = json_decode(file_get_contents('php://input'), true);
if (!is_array($in)) out(400, array('ok' => false, 'code' => 'bad_input'));
$beds = isset($in['beds']) ? (int)$in['beds'] : 0;
$lat = isset($in['lat']) && is_numeric($in['lat']) ? (float)$in['lat'] : null;
$lng = isset($in['lng']) && is_numeric($in['lng']) ? (float)$in['lng'] : null;
$id = isset($in['id']) ? preg_replace('/[^0-9v]/', '', (string)$in['id']) : '';
if ($beds < 1 || $beds > 30) out(400, array('ok' => false, 'code' => 'no_bedrooms'));

$file = __DIR__ . '/data/market-bali.php';
if (!is_file($file)) out(503, array('ok' => false, 'code' => 'no_data'));
$raw = file_get_contents($file);
$data = json_decode(substr($raw, strpos($raw, "\n") + 1), true);
if (!is_array($data) || empty($data['rows'])) out(503, array('ok' => false, 'code' => 'no_data'));
// columns: id lat lng beds rev adr occ days rating reviews sh min flags tier upd
list($ID, $LAT, $LNG, $BEDS, $REV, $ADR, $OCC, $DAYS, $RATING, $REVIEWS, $SH, $MIN, $FLAGS) = range(0, 12);

$self = null;
if ($id !== '') {
  foreach ($data['rows'] as $r) { if ((string)$r[$ID] === $id) { $self = $r; break; } }
}
// Outside Bali (or no location at all): compare with every same-size listing on the island.
if (($lat === null || $lng === null) && $self) { $lat = $self[$LAT]; $lng = $self[$LNG]; }
$inBali = $lat !== null && $lng !== null && $lat > -9.0 && $lat < -8.0 && $lng > 114.4 && $lng < 115.8;

$same = array();
foreach ($data['rows'] as $r) {
  if ($r[$BEDS] !== $beds || ($self && $r[$ID] === $self[$ID])) continue;
  $r[] = $inBali ? km($lat, $lng, $r[$LAT], $r[$LNG]) : 0;
  $same[] = $r;
}
$DIST = 15;
$comps = $same; $radius = null;
if ($inBali) {
  foreach (RADII as $km) {
    $within = array();
    foreach ($same as $r) { if ($r[$DIST] <= $km) $within[] = $r; }
    if (count($within) >= MIN_COMPS) { $comps = $within; $radius = $km; break; }
  }
}
if (count($comps) < 5) out(200, array('ok' => false, 'code' => 'too_few', 'n' => count($comps)));

$revs = col($comps, $REV, true);
$p90 = quantile($revs, 0.9);
$top = array();
foreach ($comps as $r) { if ($r[$REV] >= $p90) $top[] = $r; }

$amen = array();
foreach ($data['flags'] as $name => $bit) {
  $inTop = 0; $inAll = 0;
  foreach ($top as $r) { if ($r[$FLAGS] & $bit) $inTop++; }
  foreach ($comps as $r) { if ($r[$FLAGS] & $bit) $inAll++; }
  $amen[$name] = array('top' => r0(100 * $inTop / count($top)), 'all' => r0(100 * $inAll / count($comps)));
}
$shTop = 0; foreach ($top as $r) { $shTop += $r[$SH]; }

$profile = function ($rows) use ($REV, $ADR, $OCC, $DAYS, $RATING, $REVIEWS, $MIN) {
  return array(
    'revenue' => r0(med(col($rows, $REV, true))), 'adr' => r0(med(col($rows, $ADR, true))),
    'occupancy' => r1(med(col($rows, $OCC, true))), 'days' => r0(med(col($rows, $DAYS, true))),
    'rating' => r2(med(col($rows, $RATING, true))), 'reviews' => r0(med(col($rows, $REVIEWS, false))),
    'minStay' => r0(med(col($rows, $MIN, true))),
  );
};

$selfOut = null;
if ($self) {
  $below = 0; foreach ($revs as $v) { if ($v < $self[$REV]) $below++; }
  $selfOut = array(
    'revenue' => $self[$REV], 'adr' => $self[$ADR], 'occupancy' => $self[$OCC], 'days' => $self[$DAYS],
    'rating' => $self[$RATING], 'reviews' => $self[$REVIEWS], 'superhost' => (bool)$self[$SH], 'minStay' => $self[$MIN],
    'flags' => $self[$FLAGS], 'percentile' => r0(100 * $below / max(1, count($revs))),
  );
}

out(200, array(
  'ok' => true, 'source' => $data['source'], 'dataTo' => substr($data['newest'], 0, 7),
  'beds' => $beds, 'n' => count($comps), 'radiusKm' => $radius, 'area' => $inBali ? 'near' : 'bali',
  'market' => array_merge($profile($comps), array('p75' => r0(quantile($revs, 0.75)), 'p90' => r0($p90))),
  'top' => array_merge($profile($top), array('n' => count($top), 'superhostShare' => r0(100 * $shTop / count($top)))),
  'amenities' => $amen,
  'self' => $selfOut,
));
