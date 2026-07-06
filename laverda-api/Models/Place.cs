using System.Text.Json;
using System.Text.Json.Serialization;
using System.ComponentModel.DataAnnotations;

namespace LaverdaApi.Models;

// EF Core entity — all location fields are flattened to avoid a join table.
public class Place
{
    [Key]
    public string Id { get; set; } = "";
    public string? Type { get; set; }
    public string? Category { get; set; }
    public string? Name { get; set; }
    public string? Address { get; set; }
    public string Url { get; set; } = "";
    public string? Status { get; set; }
    public string? Description { get; set; }
    public string? Country { get; set; }
    public string? Visibility { get; set; }
    public bool? Verified { get; set; }
    public string? LinkType { get; set; }
    public string? TagsJson { get; set; }
    public int? Priority { get; set; }
    public string? LastCheckedAt { get; set; }
    public string? LocationMode { get; set; }
    public double? LocationLat { get; set; }
    public double? LocationLng { get; set; }
    public string? LocationLabel { get; set; }
    public string? NavigationUrl { get; set; }

    public EntryDto ToEntryDto() => new()
    {
        Id = Id,
        Type = Type,
        Category = Category,
        Name = Name,
        Address = Address,
        Url = Url,
        Status = Status,
        Description = Description,
        Country = Country,
        Visibility = Visibility,
        Verified = Verified,
        LinkType = LinkType,
        Tags = TagsJson != null ? JsonSerializer.Deserialize<string[]>(TagsJson) : null,
        Priority = Priority,
        LastCheckedAt = LastCheckedAt,
        Location = LocationLat.HasValue && LocationLng.HasValue ? new LocationDto
        {
            Mode = LocationMode ?? "exact",
            Lat = LocationLat.Value,
            Lng = LocationLng.Value,
            Label = LocationLabel
        } : null,
        NavigationUrl = NavigationUrl
    };

    public static Place FromEntry(EntryDto e) => new()
    {
        Id = e.Id,
        Type = e.Type,
        Category = e.Category,
        Name = e.Name,
        Address = e.Address,
        Url = e.Url,
        Status = e.Status,
        Description = e.Description,
        Country = e.Country,
        Visibility = e.Visibility,
        Verified = e.Verified,
        LinkType = e.LinkType,
        TagsJson = e.Tags != null ? JsonSerializer.Serialize(e.Tags) : null,
        Priority = e.Priority,
        LastCheckedAt = e.LastCheckedAt,
        LocationMode = e.Location?.Mode,
        LocationLat = e.Location?.Lat,
        LocationLng = e.Location?.Lng,
        LocationLabel = e.Location?.Label,
        NavigationUrl = e.NavigationUrl
    };
}

// DTO shape matches the TypeScript Entry type exactly.
public class EntryDto
{
    public string Id { get; set; } = "";
    public string? Type { get; set; }
    public string? Category { get; set; }
    public string? Name { get; set; }
    public string? Address { get; set; }
    public string Url { get; set; } = "";
    public string? Status { get; set; }
    public string? Description { get; set; }
    public string? Country { get; set; }
    public string? Visibility { get; set; }
    public bool? Verified { get; set; }
    public string? LinkType { get; set; }
    public string[]? Tags { get; set; }
    public int? Priority { get; set; }
    public string? LastCheckedAt { get; set; }
    public LocationDto? Location { get; set; }
    public string? NavigationUrl { get; set; }
}

public class LocationDto
{
    public string Mode { get; set; } = "exact";
    public double Lat { get; set; }
    public double Lng { get; set; }
    public string? Label { get; set; }
}

public class PlacesFile
{
    [JsonPropertyName("entries")]
    public List<EntryDto> Entries { get; set; } = new();
}
