# Laverda directory

`app/` contains the Expo/React Native mobile app. `api/` contains the small
framework-free PHP REST API backed by PDO/MariaDB, suitable for Hosttech shared
hosting. The mobile app never connects to MariaDB.

Start with [app setup](app/README.md), [API setup/deployment](api/README.md), and
[implementation and verification notes](IMPLEMENTATION.md).

## Layout

```text
app/src/app/              providers and navigation
app/src/features/        places, resources, club
app/src/shared/          design system, HTTP and safe links
app/scripts/             reproducible public fallback generation
api/public/              web document root only
api/src/Http/            routing and HTTP handlers
api/src/Places/          repository, DTO and import validation
api/database/            baseline schema and tracked migrations
api/places.json          authoritative seed; never required by the runtime API
archive/data/            retained historical datasets
.github/workflows/       app and API checks
```

The older REVIEW.md records an earlier pass; IMPLEMENTATION.md supersedes its
statements about the password gate, architecture and current validation.
