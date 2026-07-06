using LaverdaApi.Models;
using Microsoft.EntityFrameworkCore;

namespace LaverdaApi.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Place> Places => Set<Place>();
}
