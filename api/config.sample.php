<?php
// Copy this file to config.php, add your Apify token, and upload config.php
// next to audit.php via FTP. Without a token the audit page falls back to
// asking the visitor for the details by hand.
//
//   Apify - fetches the listing. console.apify.com > Settings > API tokens
//
return [
  'APIFY_TOKEN'            => '',
  'APIFY_ACTOR_ID'         => 'tri_angle~airbnb-rooms-urls-scraper',
  'APIFY_BOOKING_ACTOR_ID' => 'voyager~booking-scraper',
];
