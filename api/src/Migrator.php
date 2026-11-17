<?php

declare(strict_types=1);

namespace LaverdaApi;

use PDO;
use RuntimeException;

final class Migrator
{
    public function __construct(private readonly PDO $pdo, private readonly string $directory)
    {
    }
    /** @return list<string> */
    public function migrate(): array
    {
        $lockName = 'laverda:migrations:' . (string) $this->pdo->query('SELECT DATABASE()')->fetchColumn();
        $lock = $this->pdo->prepare('SELECT GET_LOCK(?, 10)');
        $lock->execute([$lockName]);
        if ((int) $lock->fetchColumn() !== 1) {
            throw new RuntimeException('Could not acquire migration lock.');
        }
        try {
            $this->pdo->exec('CREATE TABLE IF NOT EXISTS schema_migrations (
                version VARCHAR(200) PRIMARY KEY, checksum CHAR(64) NOT NULL,
                applied_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
            ) ENGINE=InnoDB');
            $this->pdo->exec(file_get_contents($this->directory . '/schema.sql'));
            $files = glob($this->directory . '/migrations/*.sql') ?: [];
            sort($files, SORT_STRING);
            $applied = [];
            foreach ($files as $file) {
                $version = basename($file);
                $sql = file_get_contents($file);
                if ($sql === false) {
                    throw new RuntimeException('Migration unreadable: ' . $version);
                }
                $checksum = hash('sha256', $sql);
                $lookup = $this->pdo->prepare('SELECT checksum FROM schema_migrations WHERE version = ?');
                $lookup->execute([$version]);
                $previous = $lookup->fetchColumn();
                if ($previous !== false) {
                    if (!hash_equals((string) $previous, $checksum)) {
                        throw new RuntimeException('Applied migration changed: ' . $version);
                    }
                    continue;
                }
                $this->pdo->exec($sql);
                $insert = $this->pdo->prepare('INSERT INTO schema_migrations (version, checksum) VALUES (?, ?)');
                $insert->execute([$version, $checksum]);
                $applied[] = $version;
            }
            return $applied;
        } finally {
            $release = $this->pdo->prepare('SELECT RELEASE_LOCK(?)');
            $release->execute([$lockName]);
        }
    }
}
