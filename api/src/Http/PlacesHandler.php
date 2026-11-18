<?php

declare(strict_types=1);

namespace LaverdaApi\Http;

use LaverdaApi\Database;
use LaverdaApi\Places\PlaceRepository;

final class PlacesHandler
{
    public static function handle(string $tenantSlug, ?string $placeId, bool $isCollection): never
    {
        $repository = new PlaceRepository(Database::connect());

        if ($isCollection) {
            $places = $repository->listPublic(
                $tenantSlug,
                self::queryString('type'),
                self::queryString('country'),
                self::queryString('q'),
            );

            if ($places === null) {
                JsonResponse::send([
                    'error' => 'tenant_not_found',
                    'tenant' => $tenantSlug,
                ], 404);
            }

            JsonResponse::protectedData(['entries' => $places]);
        }

        $place = $repository->findPublic($tenantSlug, (string) $placeId);
        if ($place === null) {
            if (!$repository->hasActiveTenant($tenantSlug)) {
                JsonResponse::send([
                    'error' => 'tenant_not_found',
                    'tenant' => $tenantSlug,
                ], 404);
            }

            JsonResponse::send([
                'error' => 'place_not_found',
                'id' => $placeId,
            ], 404);
        }

        JsonResponse::protectedData($place);


    }
    private static function queryString(string $name): ?string
    {
        $value = $_GET[$name] ?? null;
        if ($value !== null && (!is_string($value) || strlen($value) > 500)) {
            JsonResponse::send(['error' => 'invalid_query_parameter', 'parameter' => $name], 400);
        }
        return is_string($value) ? $value : null;

    }
}
