<?php

declare(strict_types=1);

/** @var array<string, mixed> $report */
/** @var string $nonce */
/** @var int $httpStatus */
$e = static fn (mixed $value): string => htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
$healthy = $report['status'] === 'Healthy';
$components = [
    'api' => ['API', 'Die Anwendung verarbeitet diese Anfrage.'],
    'database' => ['Datenbank', 'Verbindung und einfache Datenbankabfrage.'],
    'directory' => ['Ortsverzeichnis', 'Lesezugriff auf Club- und Ortstabellen.'],
    'authentication' => ['Anmeldesystem', 'Zugriff auf die Tabellen für Anmeldung und Sitzungen.'],
];
$labels = ['pass' => 'Verfügbar', 'fail' => 'Fehler', 'skipped' => 'Nicht geprüft'];
$passed = count(array_filter($report['checks'], static fn (array $check): bool => $check['status'] === 'pass'));
?>
<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <meta name="color-scheme" content="light">
  <title>Laverda API · Systemstatus</title>
  <style nonce="<?= $e($nonce) ?>"><?= file_get_contents(__DIR__ . '/status.css') ?></style>
</head>
<body>
  <div class="shell">
    <header class="topbar">
      <a class="brand" href="/health" aria-label="Laverda API Systemstatus">
        <span class="brand-mark" aria-hidden="true"><span>L</span></span>
        <span><strong>LAVERDA</strong><span class="brand-caption">API / SYSTEMSTATUS</span></span>
      </a>
      <span class="endpoint"><span class="endpoint-dot" aria-hidden="true"></span> API v1</span>
    </header>

    <main>
      <section class="intro" aria-labelledby="page-title">
        <p class="eyebrow">DIE VERBINDUNG ZUM CLUB.</p>
        <h1 id="page-title">Alles im Blick.</h1>
        <p class="intro-text">Der aktuelle technische Status der Laverda API.<br class="desktop-break"> Direkt geprüft, ohne Umwege.</p>
      </section>

      <section class="overview <?= $healthy ? 'is-healthy' : 'is-unhealthy' ?>" id="overview" aria-labelledby="overall-title">
        <div class="overview-top">
          <div class="overall-heading">
            <span class="signal" aria-hidden="true"><span></span></span>
            <div>
              <p class="eyebrow">AKTUELLER STATUS</p>
              <h2 id="overall-title" role="status"><?= $healthy ? 'Alle Systeme bereit' : 'Dienst eingeschränkt' ?></h2>
              <p id="overall-description"><?= $healthy ? 'Alle technischen Prüfungen sind erfolgreich.' : 'Mindestens eine technische Prüfung ist fehlgeschlagen.' ?></p>
            </div>
          </div>
          <span class="http-tag" id="http-status">HTTP <?= $httpStatus ?></span>
        </div>
        <div class="metrics">
          <div><p class="metric-label">LETZTE PRÜFUNG</p><time id="checked-at" datetime="<?= $e($report['checkedAt']) ?>"><?= $e($report['checkedAt']) ?> · UTC</time></div>
          <div><p class="metric-label">PRÜFDAUER</p><p class="metric-value" id="duration"><?= $e($report['durationMs']) ?> <span>ms</span></p></div>
          <div><p class="metric-label">KOMPONENTEN BEREIT</p><p class="metric-value" id="passed"><?= $passed ?> <span>/ 4</span></p></div>
        </div>
      </section>

      <div class="section-heading">
        <div><p class="eyebrow">IM DETAIL</p><h2>Die einzelnen Komponenten</h2></div>
        <span class="snapshot-label">Momentaufnahme</span>
      </div>
      <section class="components" aria-label="Technische Einzelprüfungen">
        <?php foreach ($components as $id => [$title, $description]): $check = $report['checks'][$id]; ?>
        <article class="component" data-check="<?= $e($id) ?>">
          <div class="component-top">
            <span class="component-icon" aria-hidden="true"><?= ['api' => '↗', 'database' => '▤', 'directory' => '⌖', 'authentication' => '⌁'][$id] ?></span>
            <span class="check-badge <?= $e($check['status']) ?>" data-state><span aria-hidden="true"></span><span data-label><?= $e($labels[$check['status']]) ?></span></span>
          </div>
          <h3><?= $e($title) ?></h3>
          <p class="component-description"><?= $e($description) ?></p>
          <div class="component-footer"><span>Prüfdauer</span><span data-duration><?= $check['durationMs'] === null ? '—' : $e($check['durationMs']) . ' ms' ?></span></div>
        </article>
        <?php endforeach; ?>
      </section>

      <section class="toolbar" aria-label="Status aktualisieren">
        <label class="auto-refresh"><input type="checkbox" id="auto-refresh" checked> Automatisch alle 60 Sekunden</label>
        <a href="/health?format=html" class="refresh-button" id="refresh"><span aria-hidden="true">↻</span> <span id="refresh-label">Jetzt prüfen</span></a>
      </section>
      <p id="refresh-message" class="refresh-message" role="status">Die Messwerte stammen aus dieser Anfrage.</p>

      <aside class="scope-note">
        <span class="note-icon" aria-hidden="true">i</span>
        <div><h2>Was wird hier geprüft?</h2><p>Verbindung und lesbarer Zugriff auf die benötigten Tabellen. Ortsinhalte, ein gesetztes Clubpasswort, Karten und Mailzustellung werden hier nicht geprüft. Diese Seite zeigt keine historische Verfügbarkeit.</p></div>
      </aside>
      <noscript><p class="noscript-note">Automatische Aktualisierung benötigt JavaScript. Über „Jetzt prüfen“ kannst du die Seite erneut laden.</p></noscript>
    </main>

    <footer>
      <p>Laverda API <span aria-hidden="true">/</span> Für die Menschen hinter den Motorrädern.</p>
      <a href="/health?format=json">JSON für Monitoring <span aria-hidden="true">↗</span></a>
    </footer>
  </div>
  <script id="health-data" type="application/json" nonce="<?= $e($nonce) ?>"><?= json_encode($report, JSON_THROW_ON_ERROR | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) ?></script>
  <script nonce="<?= $e($nonce) ?>"><?= file_get_contents(__DIR__ . '/status.js') ?></script>
</body>
</html>
