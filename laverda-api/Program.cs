using LaverdaApi.Data;
using LaverdaApi.Models;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("Default") ?? "Data Source=laverda.db"));

builder.Services.AddCors(options =>
    options.AddDefaultPolicy(policy =>
        policy.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader()));

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.Migrate();
    await Seeder.SeedAsync(db);
}

app.UseCors();

// GET /api/places  — optional ?type=club&country=CH&q=moto
app.MapGet("/api/places", async (AppDbContext db, string? type, string? country, string? q) =>
{
    var query = db.Places.AsQueryable();

    if (!string.IsNullOrWhiteSpace(type))
        query = query.Where(p => p.Type == type);
    if (!string.IsNullOrWhiteSpace(country))
        query = query.Where(p => p.Country == country);

    var places = await query.ToListAsync();

    if (!string.IsNullOrWhiteSpace(q))
    {
        var lower = q.ToLowerInvariant();
        places = places.Where(p =>
            (p.Name        ?? "").Contains(lower, StringComparison.OrdinalIgnoreCase) ||
            (p.Description ?? "").Contains(lower, StringComparison.OrdinalIgnoreCase) ||
            (p.Address     ?? "").Contains(lower, StringComparison.OrdinalIgnoreCase) ||
            (p.Country     ?? "").Contains(lower, StringComparison.OrdinalIgnoreCase))
            .ToList();
    }

    return Results.Ok(new { entries = places.Select(p => p.ToEntryDto()) });
});

// GET /api/places/{id}
app.MapGet("/api/places/{id}", async (string id, AppDbContext db) =>
{
    var place = await db.Places.FindAsync(id);
    return place is null ? Results.NotFound() : Results.Ok(place.ToEntryDto());
});

app.Run();
