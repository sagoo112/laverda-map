using System.Text.Json;
using LaverdaApi.Models;

namespace LaverdaApi.Data;

public static class Seeder
{
    private static readonly JsonSerializerOptions Options = new() { PropertyNameCaseInsensitive = true };

    public static async Task SeedAsync(AppDbContext db)
    {
        if (await db.Places.AnyAsync()) return;

        var seedFile = Path.Combine(AppContext.BaseDirectory, "places.json");
        if (!File.Exists(seedFile))
        {
            Console.WriteLine($"[Seeder] places.json not found at {seedFile} — skipping seed.");
            return;
        }

        var json = await File.ReadAllTextAsync(seedFile);
        var placesFile = JsonSerializer.Deserialize<PlacesFile>(json, Options);

        if (placesFile?.Entries is null or { Count: 0 })
        {
            Console.WriteLine("[Seeder] No entries found in places.json.");
            return;
        }

        foreach (var entry in placesFile.Entries)
        {
            db.Places.Add(Place.FromEntry(entry));
        }

        await db.SaveChangesAsync();
        Console.WriteLine($"[Seeder] Seeded {placesFile.Entries.Count} places.");
    }
}
