<?php
declare(strict_types=1);
require dirname(__DIR__) . '/src/bootstrap.php';
use LaverdaApi\Auth\ClubAccess;
$password = 'fixture-only long passphrase';
$hash = ClubAccess::passwordHash($password);
if (!password_verify($password, $hash) || $hash === $password || $hash === ClubAccess::passwordHash($password)) {
    throw new RuntimeException('Password hashing or salting failed.');
}
foreach (['short', str_repeat('a', 73), str_repeat('a', 20) . "\0"] as $invalid) {
    try { ClubAccess::passwordHash($invalid); throw new LogicException('Invalid passphrase accepted.'); }
    catch (RuntimeException) { }
}
$process = proc_open([PHP_BINARY, dirname(__DIR__) . '/scripts/set-password.php', 'laverda', '--sql'],
    [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
fwrite($pipes[0], $password . "\n" . $password . "\n"); fclose($pipes[0]);
$sql = stream_get_contents($pipes[1]); $stderr = stream_get_contents($pipes[2]);
fclose($pipes[1]); fclose($pipes[2]);
if (proc_close($process) !== 0 || str_contains($sql . $stderr, $password)
    || !str_contains($sql, 'auth_version = auth_version + 1') || !str_contains($sql, 'DELETE FROM auth_sessions')) {
    throw new RuntimeException('Private password SQL generation failed.');
}
echo "PASS password policy, salted hashes and private SQL generation\n";
