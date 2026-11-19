<?php

declare(strict_types=1);

// Copy to config.local.php beside public/ on the server, then edit that private copy.
// Use single-quoted strings; escape a literal apostrophe as \' and a backslash as \\.
// Never commit config.local.php or place it inside public/.
return [
    'DB_HOST' => 'localhost',
    'DB_PORT' => '3306',
    'DB_NAME' => 'api_laverda',
    'DB_USER' => 'your_database_user',
    'DB_PASSWORD' => 'REPLACE_WITH_DATABASE_PASSWORD',
    'CORS_ALLOWED_ORIGIN' => '*',
    'PLAY_TEST_PUBLIC_DIRECTORY' => '0',
];
