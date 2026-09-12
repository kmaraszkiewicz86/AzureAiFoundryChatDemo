# Model: gpt-5.6-sol-high

**Execution time:** 171936 ms

**Input tokens:** 1135

**Output tokens:** 15206

**Total tokens:** 16341

## Question

Zaprojektuj produkcyjne REST API w ASP.NET Core do obsługi zamówień. API powinno obsługiwać dużą liczbę równoległych requestów. Zaproponuj architekturę rozwiązania, sposób przechowywania danych, strategię cache, obsługę błędów, logging, monitoring oraz zabezpieczenia. Następnie pokaż przykładową implementację endpointu tworzącego zamówienie wraz z warstwą serwisową. Wyjaśnij najważniejsze decyzje architektoniczne oraz ich zalety i wady.

## Answer

### Przegląd rozwiązania

Rozwiązanie wykorzystuje ASP.NET Core Minimal API na .NET 10, PostgreSQL jako źródło prawdy, Redis jako rozproszony cache oraz Entity Framework Core. Endpoint tworzenia zamówienia jest asynchroniczny, idempotentny i bezpieczny przy wielu równoległych żądaniach.

- **API:** stateless ASP.NET Core, możliwe poziome skalowanie wielu instancji.
- **Baza danych:** PostgreSQL, transakcje, atomowa rezerwacja magazynu i ograniczenia unikalności.
- **Cache:** Redis z cache-aside; baza pozostaje źródłem prawdy.
- **Odporność na duplikaty:** wymagany nagłówek `Idempotency-Key`.
- **Bezpieczeństwo:** JWT Bearer, autoryzacja domyślna, rate limiting, walidacja danych i brak zaufania do identyfikatora klienta z payloadu.
- **Diagnostyka:** strukturalne logi JSON, trace ID, OpenTelemetry, OTLP oraz health checks.
- **Obsługa błędów:** spójne odpowiedzi RFC 7807 Problem Details.

### Architektura

```text
Klient
  |
  | HTTPS + JWT + Idempotency-Key
  v
Load balancer / API gateway
  |
  +-- rate limiting, limity rozmiaru requestu, TLS
  |
  v
Wiele instancji Orders.Api
  |
  +-- Endpointy HTTP i walidacja
  +-- OrderService
  +-- EF Core DbContext Pool
  +-- Redis cache-aside
  +-- OpenTelemetry
  |
  +----------> PostgreSQL
  |             - zamówienia
  |             - pozycje zamówień
  |             - produkty i stan magazynowy
  |             - klucze idempotencji
  |
  +----------> Redis
  |
  +----------> OTLP Collector
                - metryki
                - trace'y
                - eksport do Prometheus/Grafana/Tempo/Jaeger
```

#### Model współbieżności

Stan magazynowy jest zmniejszany jednym atomowym poleceniem SQL odpowiadającym warunkowi `Stock >= Quantity`. Dzięki temu dwa równoległe requesty nie mogą sprzedać tej samej ostatniej sztuki. Całe zamówienie jest wykonywane w transakcji o poziomie izolacji `RepeatableRead`. W przypadku konfliktu serializacji strategia wykonania Npgsql ponawia transakcję.

Klucz idempotencji jest kluczem głównym tabeli. Dwa równoległe requesty z tym samym kluczem są rozstrzygane przez ograniczenie unikalności PostgreSQL, a nie przez blokadę w pamięci procesu. Mechanizm działa z wieloma instancjami API.

### Wymagania

- .NET SDK 10.0.
- PostgreSQL 16 lub nowszy.
- Redis 7 lub nowszy.
- Docker Compose do lokalnego uruchomienia infrastruktury.
- Dostawca JWT/OIDC w środowisku produkcyjnym.
- Opcjonalnie OpenTelemetry Collector.

### Struktura projektu

```text
Orders/
├── docker-compose.yml
└── src/
    └── Orders.Api/
        ├── Orders.Api.csproj
        ├── Program.cs
        ├── appsettings.json
        ├── Contracts/
        │   └── OrderContracts.cs
        ├── Domain/
        │   └── Entities.cs
        ├── Endpoints/
        │   └── OrderEndpoints.cs
        ├── Errors/
        │   └── ApiExceptionHandler.cs
        ├── Health/
        │   └── DependencyHealthChecks.cs
        ├── Persistence/
        │   └── OrdersDbContext.cs
        ├── Services/
        │   └── OrderService.cs
        └── Validation/
            └── CreateOrderRequestValidator.cs
```

### Implementacja

#### src/Orders.Api/Orders.Api.csproj

```xml
<Project Sdk="Microsoft.NET.Sdk.Web">
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <InvariantGlobalization>false</InvariantGlobalization>
  </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="FluentValidation.DependencyInjectionExtensions" Version="12.0.0" />
    <PackageReference Include="Microsoft.AspNetCore.Authentication.JwtBearer" Version="10.0.0" />
    <PackageReference Include="Microsoft.EntityFrameworkCore.Design" Version="10.0.0">
      <PrivateAssets>all</PrivateAssets>
      <IncludeAssets>runtime; build; native; contentfiles; analyzers; buildtransitive</IncludeAssets>
    </PackageReference>
    <PackageReference Include="Microsoft.Extensions.Caching.StackExchangeRedis" Version="10.0.0" />
    <PackageReference Include="Npgsql.EntityFrameworkCore.PostgreSQL" Version="10.0.0" />
    <PackageReference Include="OpenTelemetry.Exporter.OpenTelemetryProtocol" Version="1.14.0" />
    <PackageReference Include="OpenTelemetry.Extensions.Hosting" Version="1.14.0" />
    <PackageReference Include="OpenTelemetry.Instrumentation.AspNetCore" Version="1.14.0" />
    <PackageReference Include="OpenTelemetry.Instrumentation.Runtime" Version="1.14.0" />
    <PackageReference Include="StackExchange.Redis" Version="2.8.58" />
  </ItemGroup>
</Project>
```

#### src/Orders.Api/Program.cs

```csharp
using System.Diagnostics;
using System.Security.Claims;
using System.Text;
using System.Threading.RateLimiting;
using FluentValidation;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.HttpLogging;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using OpenTelemetry.Metrics;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;
using Orders.Api.Endpoints;
using Orders.Api.Errors;
using Orders.Api.Health;
using Orders.Api.Persistence;
using Orders.Api.Services;
using Orders.Api.Validation;
using StackExchange.Redis;

var builder = WebApplication.CreateBuilder(args);

builder.Logging.ClearProviders();
builder.Logging.AddJsonConsole();
builder.Logging.Configure(options =>
{
    options.ActivityTrackingOptions =
        ActivityTrackingOptions.TraceId |
        ActivityTrackingOptions.SpanId |
        ActivityTrackingOptions.ParentId;
});

builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<ApiExceptionHandler>();

var postgresConnection = builder.Configuration.GetConnectionString("Postgres")
    ?? throw new InvalidOperationException("Missing Postgres connection string.");

builder.Services.AddDbContextPool<OrdersDbContext>(options =>
{
    options.UseNpgsql(postgresConnection, npgsql =>
    {
        npgsql.EnableRetryOnFailure(
            maxRetryCount: 3,
            maxRetryDelay: TimeSpan.FromSeconds(2),
            errorCodesToAdd: null);
        npgsql.CommandTimeout(10);
    });

    options.UseQueryTrackingBehavior(QueryTrackingBehavior.TrackAll);
});

var redisConnection = builder.Configuration.GetConnectionString("Redis")
    ?? throw new InvalidOperationException("Missing Redis connection string.");

builder.Services.AddSingleton<IConnectionMultiplexer>(
    _ => ConnectionMultiplexer.Connect(redisConnection));

builder.Services.AddStackExchangeRedisCache(options =>
{
    options.Configuration = redisConnection;
    options.InstanceName = "orders-api:";
});

var signingKey = builder.Configuration["Jwt:SigningKey"]
    ?? throw new InvalidOperationException("Missing Jwt:SigningKey.");

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.MapInboundClaims = false;
        options.RequireHttpsMetadata = true;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidateAudience = true,
            ValidAudience = builder.Configuration["Jwt:Audience"],
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(signingKey)),
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromSeconds(30),
            NameClaimType = ClaimTypes.Name,
            RoleClaimType = "role"
        };
    });

builder.Services
    .AddAuthorizationBuilder()
    .SetFallbackPolicy(new AuthorizationPolicyBuilder()
        .RequireAuthenticatedUser()
        .Build());

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(
        context =>
        {
            var partitionKey =
                context.User.FindFirstValue("sub")
                ?? context.Connection.RemoteIpAddress?.ToString()
                ?? "anonymous";

            return RateLimitPartition.GetFixedWindowLimiter(
                partitionKey,
                _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = 100,
                    Window = TimeSpan.FromSeconds(1),
                    QueueLimit = 0,
                    AutoReplenishment = true
                });
        });
});

builder.Services.AddHttpLogging(options =>
{
    options.LoggingFields =
        HttpLoggingFields.RequestMethod |
        HttpLoggingFields.RequestPath |
        HttpLoggingFields.ResponseStatusCode |
        HttpLoggingFields.Duration;
});

builder.Services.AddValidatorsFromAssemblyContaining<CreateOrderRequestValidator>();
builder.Services.AddScoped<IOrderService, OrderService>();

builder.Services.AddHealthChecks()
    .AddCheck<DatabaseHealthCheck>("postgres", tags: ["ready"])
    .AddCheck<RedisHealthCheck>("redis", tags: ["ready"]);

builder.Services
    .AddOpenTelemetry()
    .ConfigureResource(resource => resource.AddService(
        serviceName: "orders-api",
        serviceVersion: typeof(Program).Assembly.GetName().Version?.ToString()))
    .WithTracing(tracing => tracing
        .AddAspNetCoreInstrumentation(options =>
        {
            options.Filter = context =>
                !context.Request.Path.StartsWithSegments("/health");
        })
        .AddOtlpExporter())
    .WithMetrics(metrics => metrics
        .AddAspNetCoreInstrumentation()
        .AddRuntimeInstrumentation()
        .AddOtlpExporter());

var app = builder.Build();

app.UseExceptionHandler();
app.UseHttpLogging();
app.UseAuthentication();
app.UseRateLimiter();
app.UseAuthorization();

app.MapHealthChecks("/health/live", new HealthCheckOptions
{
    Predicate = _ => false
}).AllowAnonymous();

app.MapHealthChecks("/health/ready", new HealthCheckOptions
{
    Predicate = registration => registration.Tags.Contains("ready")
}).AllowAnonymous();

app.MapOrderEndpoints();

app.Run();

public partial class Program;
```

#### src/Orders.Api/Domain/Entities.cs

```csharp
namespace Orders.Api.Domain;

public enum OrderStatus
{
    Created = 1,
    Paid = 2,
    Cancelled = 3
}

public sealed class Product
{
    public Guid Id { get; set; }
    public required string Name { get; set; }
    public decimal UnitPrice { get; set; }
    public int Stock { get; set; }
    public bool IsActive { get; set; }
}

public sealed class Order
{
    public Guid Id { get; set; }
    public Guid CustomerId { get; set; }
    public required string Number { get; set; }
    public OrderStatus Status { get; set; }
    public decimal TotalAmount { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public List<OrderLine> Lines { get; set; } = [];
}

public sealed class OrderLine
{
    public Guid Id { get; set; }
    public Guid OrderId { get; set; }
    public Order Order { get; set; } = null!;
    public Guid ProductId { get; set; }
    public required string ProductName { get; set; }
    public int Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal LineAmount { get; set; }
}

public sealed class IdempotencyRecord
{
    public required string Key { get; set; }
    public required string RequestHash { get; set; }
    public Guid? OrderId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
```

#### src/Orders.Api/Contracts/OrderContracts.cs

```csharp
namespace Orders.Api.Contracts;

public sealed record CreateOrderRequest(
    IReadOnlyCollection<CreateOrderLineRequest> Lines);

public sealed record CreateOrderLineRequest(
    Guid ProductId,
    int Quantity);

public sealed record OrderResponse(
    Guid Id,
    string Number,
    string Status,
    decimal TotalAmount,
    DateTimeOffset CreatedAt,
    IReadOnlyCollection<OrderLineResponse> Lines);

public sealed record OrderLineResponse(
    Guid ProductId,
    string ProductName,
    int Quantity,
    decimal UnitPrice,
    decimal LineAmount);

public sealed record CreateOrderResult(
    OrderResponse Order,
    bool IsReplay);
```

#### src/Orders.Api/Persistence/OrdersDbContext.cs

```csharp
using Microsoft.EntityFrameworkCore;
using Orders.Api.Domain;

namespace Orders.Api.Persistence;

public sealed class OrdersDbContext(DbContextOptions<OrdersDbContext> options)
    : DbContext(options)
{
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<OrderLine> OrderLines => Set<OrderLine>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<IdempotencyRecord> IdempotencyRecords =>
        Set<IdempotencyRecord>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Product>(entity =>
        {
            entity.ToTable("products");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Name).HasMaxLength(200).IsRequired();
            entity.Property(x => x.UnitPrice).HasPrecision(18, 2);
            entity.Property(x => x.Stock).IsRequired();
            entity.HasIndex(x => x.IsActive);
        });

        modelBuilder.Entity<Order>(entity =>
        {
            entity.ToTable("orders");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Number).HasMaxLength(50).IsRequired();
            entity.HasIndex(x => x.Number).IsUnique();
            entity.HasIndex(x => new { x.CustomerId, x.CreatedAt });
            entity.Property(x => x.Status)
                .HasConversion<string>()
                .HasMaxLength(30);
            entity.Property(x => x.TotalAmount).HasPrecision(18, 2);

            entity.HasMany(x => x.Lines)
                .WithOne(x => x.Order)
                .HasForeignKey(x => x.OrderId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<OrderLine>(entity =>
        {
            entity.ToTable("order_lines");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.ProductName).HasMaxLength(200).IsRequired();
            entity.Property(x => x.UnitPrice).HasPrecision(18, 2);
            entity.Property(x => x.LineAmount).HasPrecision(18, 2);
            entity.HasIndex(x => x.OrderId);
        });

        modelBuilder.Entity<IdempotencyRecord>(entity =>
        {
            entity.ToTable("idempotency_records");
            entity.HasKey(x => x.Key)
                .HasName("pk_idempotency_records");
            entity.Property(x => x.Key).HasMaxLength(128);
            entity.Property(x => x.RequestHash).HasMaxLength(64).IsRequired();
            entity.HasIndex(x => x.CreatedAt);
        });
    }
}
```

#### src/Orders.Api/Validation/CreateOrderRequestValidator.cs

```csharp
using FluentValidation;
using Orders.Api.Contracts;

namespace Orders.Api.Validation;

public sealed class CreateOrderRequestValidator
    : AbstractValidator<CreateOrderRequest>
{
    public CreateOrderRequestValidator()
    {
        RuleFor(x => x.Lines)
            .NotNull()
            .NotEmpty()
            .Must(lines => lines.Count <= 100)
            .WithMessage("An order can contain at most 100 lines.")
            .Must(HaveUniqueProducts)
            .WithMessage("A product can appear only once in an order.");

        RuleForEach(x => x.Lines)
            .SetValidator(new CreateOrderLineRequestValidator());
    }

    private static bool HaveUniqueProducts(
        IReadOnlyCollection<CreateOrderLineRequest> lines)
    {
        return lines.Select(x => x.ProductId).Distinct().Count() == lines.Count;
    }
}

public sealed class CreateOrderLineRequestValidator
    : AbstractValidator<CreateOrderLineRequest>
{
    public CreateOrderLineRequestValidator()
    {
        RuleFor(x => x.ProductId).NotEmpty();
        RuleFor(x => x.Quantity).InclusiveBetween(1, 10_000);
    }
}
```

#### src/Orders.Api/Errors/ApiExceptionHandler.cs

```csharp
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace Orders.Api.Errors;

public sealed class DomainConflictException(string message) : Exception(message);

public sealed class ResourceNotFoundException(string message) : Exception(message);

public sealed class ApiExceptionHandler(
    ILogger<ApiExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        if (exception is OperationCanceledException
            && httpContext.RequestAborted.IsCancellationRequested)
        {
            return false;
        }

        var (status, title, detail) = exception switch
        {
            DomainConflictException conflict =>
                (StatusCodes.Status409Conflict, "Conflict", conflict.Message),

            ResourceNotFoundException notFound =>
                (StatusCodes.Status404NotFound, "Not found", notFound.Message),

            _ => (
                StatusCodes.Status500InternalServerError,
                "Internal server error",
                "An unexpected error occurred.")
        };

        if (status >= 500)
        {
            logger.LogError(
                exception,
                "Unhandled exception. TraceId: {TraceId}",
                httpContext.TraceIdentifier);
        }
        else
        {
            logger.LogWarning(
                exception,
                "Request rejected with status {StatusCode}. TraceId: {TraceId}",
                status,
                httpContext.TraceIdentifier);
        }

        var problem = new ProblemDetails
        {
            Status = status,
            Title = title,
            Detail = detail,
            Instance = httpContext.Request.Path
        };

        problem.Extensions["traceId"] =
            System.Diagnostics.Activity.Current?.TraceId.ToString()
            ?? httpContext.TraceIdentifier;

        httpContext.Response.StatusCode = status;
        await httpContext.Response.WriteAsJsonAsync(
            problem,
            cancellationToken);

        return true;
    }
}
```

#### src/Orders.Api/Services/OrderService.cs

```csharp
using System.Data;
using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Distributed;
using Npgsql;
using Orders.Api.Contracts;
using Orders.Api.Domain;
using Orders.Api.Errors;
using Orders.Api.Persistence;

namespace Orders.Api.Services;

public interface IOrderService
{
    Task<CreateOrderResult> CreateAsync(
        Guid customerId,
        string idempotencyKey,
        CreateOrderRequest request,
        CancellationToken cancellationToken);

    Task<OrderResponse> GetAsync(
        Guid customerId,
        Guid orderId,
        CancellationToken cancellationToken);
}

public sealed class OrderService(
    OrdersDbContext db,
    IDistributedCache cache,
    ILogger<OrderService> logger) : IOrderService
{
    private static readonly JsonSerializerOptions CacheJsonOptions =
        new(JsonSerializerDefaults.Web);

    private readonly OrdersDbContext _db = db;
    private readonly IDistributedCache _cache = cache;
    private readonly ILogger<OrderService> _logger = logger;

    public async Task<CreateOrderResult> CreateAsync(
        Guid customerId,
        string idempotencyKey,
        CreateOrderRequest request,
        CancellationToken cancellationToken)
    {
        var requestHash = CalculateRequestHash(customerId, request);
        CreateOrderResult result;

        try
        {
            var strategy = _db.Database.CreateExecutionStrategy();

            result = await strategy.ExecuteAsync(async ct =>
            {
                await using var transaction =
                    await _db.Database.BeginTransactionAsync(
                        IsolationLevel.RepeatableRead,
                        ct);

                var existing = await _db.IdempotencyRecords
                    .AsNoTracking()
                    .SingleOrDefaultAsync(x => x.Key == idempotencyKey, ct);

                if (existing is not null)
                {
                    EnsureMatchingRequest(existing, requestHash);

                    if (existing.OrderId is null)
                    {
                        throw new DomainConflictException(
                            "The idempotent operation has not completed.");
                    }

                    var existingOrder = await LoadFromDatabaseAsync(
                        customerId,
                        existing.OrderId.Value,
                        ct);

                    await transaction.CommitAsync(ct);
                    return new CreateOrderResult(existingOrder, true);
                }

                var idempotencyRecord = new IdempotencyRecord
                {
                    Key = idempotencyKey,
                    RequestHash = requestHash,
                    CreatedAt = DateTimeOffset.UtcNow
                };

                _db.IdempotencyRecords.Add(idempotencyRecord);

                // Wczesny zapis wymusza sprawdzenie unikalności klucza
                // przed wykonaniem kosztownej części zamówienia.
                await _db.SaveChangesAsync(ct);

                var order = new Order
                {
                    Id = Guid.CreateVersion7(),
                    CustomerId = customerId,
                    Number = CreateOrderNumber(),
                    Status = OrderStatus.Created,
                    CreatedAt = DateTimeOffset.UtcNow,
                    TotalAmount = 0m
                };

                foreach (var requestedLine in request.Lines)
                {
                    var affectedRows = await _db.Products
                        .Where(product =>
                            product.Id == requestedLine.ProductId
                            && product.IsActive
                            && product.Stock >= requestedLine.Quantity)
                        .ExecuteUpdateAsync(
                            setters => setters.SetProperty(
                                product => product.Stock,
                                product => product.Stock - requestedLine.Quantity),
                            ct);

                    if (affectedRows != 1)
                    {
                        throw new DomainConflictException(
                            $"Product {requestedLine.ProductId} is unavailable " +
                            "or has insufficient stock.");
                    }

                    var product = await _db.Products
                        .AsNoTracking()
                        .Where(x => x.Id == requestedLine.ProductId)
                        .Select(x => new
                        {
                            x.Id,
                            x.Name,
                            x.UnitPrice
                        })
                        .SingleAsync(ct);

                    var lineAmount = product.UnitPrice * requestedLine.Quantity;

                    order.Lines.Add(new OrderLine
                    {
                        Id = Guid.CreateVersion7(),
                        ProductId = product.Id,
                        ProductName = product.Name,
                        Quantity = requestedLine.Quantity,
                        UnitPrice = product.UnitPrice,
                        LineAmount = lineAmount
                    });

                    order.TotalAmount += lineAmount;
                }

                idempotencyRecord.OrderId = order.Id;
                _db.Orders.Add(order);

                await _db.SaveChangesAsync(ct);
                await transaction.CommitAsync(ct);

                return new CreateOrderResult(Map(order), false);
            }, cancellationToken);
        }
        catch (DbUpdateException exception)
            when (IsIdempotencyKeyViolation(exception))
        {
            // Drugi równoległy request czeka na zakończenie pierwszej
            // transakcji, po czym otrzymuje naruszenie unikalności.
            _db.ChangeTracker.Clear();

            var existing = await _db.IdempotencyRecords
                .AsNoTracking()
                .SingleAsync(x => x.Key == idempotencyKey, cancellationToken);

            EnsureMatchingRequest(existing, requestHash);

            if (existing.OrderId is null)
            {
                throw new DomainConflictException(
                    "The idempotent operation has not completed.");
            }

            var existingOrder = await LoadFromDatabaseAsync(
                customerId,
                existing.OrderId.Value,
                cancellationToken);

            result = new CreateOrderResult(existingOrder, true);
        }

        await TryWriteCacheAsync(
            customerId,
            result.Order,
            cancellationToken);

        _logger.LogInformation(
            "Order {OrderId} created for customer {CustomerId}. Replay: {IsReplay}",
            result.Order.Id,
            customerId,
            result.IsReplay);

        return result;
    }

    public async Task<OrderResponse> GetAsync(
        Guid customerId,
        Guid orderId,
        CancellationToken cancellationToken)
    {
        var cacheKey = GetCacheKey(customerId, orderId);

        try
        {
            var cached = await _cache.GetStringAsync(
                cacheKey,
                cancellationToken);

            if (cached is not null)
            {
                var response = JsonSerializer.Deserialize<OrderResponse>(
                    cached,
                    CacheJsonOptions);

                if (response is not null)
                {
                    return response;
                }
            }
        }
        catch (Exception exception)
        {
            _logger.LogWarning(
                exception,
                "Redis read failed for order {OrderId}. Falling back to PostgreSQL.",
                orderId);
        }

        var order = await LoadFromDatabaseAsync(
            customerId,
            orderId,
            cancellationToken);

        await TryWriteCacheAsync(customerId, order, cancellationToken);
        return order;
    }

    private async Task<OrderResponse> LoadFromDatabaseAsync(
        Guid customerId,
        Guid orderId,
        CancellationToken cancellationToken)
    {
        var order = await _db.Orders
            .AsNoTracking()
            .Where(x => x.Id == orderId && x.CustomerId == customerId)
            .Select(x => new OrderResponse(
                x.Id,
                x.Number,
                x.Status.ToString(),
                x.TotalAmount,
                x.CreatedAt,
                x.Lines
                    .OrderBy(line => line.Id)
                    .Select(line => new OrderLineResponse(
                        line.ProductId,
                        line.ProductName,
                        line.Quantity,
                        line.UnitPrice,
                        line.LineAmount))
                    .ToArray()))
            .SingleOrDefaultAsync(cancellationToken);

        return order ?? throw new ResourceNotFoundException(
            $"Order {orderId} was not found.");
    }

    private async Task TryWriteCacheAsync(
        Guid customerId,
        OrderResponse order,
        CancellationToken cancellationToken)
    {
        try
        {
            await _cache.SetStringAsync(
                GetCacheKey(customerId, order.Id),
                JsonSerializer.Serialize(order, CacheJsonOptions),
                new DistributedCacheEntryOptions
                {
                    AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(10),
                    SlidingExpiration = TimeSpan.FromMinutes(2)
                },
                cancellationToken);
        }
        catch (Exception exception)
        {
            // Awaria cache nie może wycofać zatwierdzonego zamówienia.
            _logger.LogWarning(
                exception,
                "Redis write failed for order {OrderId}.",
                order.Id);
        }
    }

    private static OrderResponse Map(Order order)
    {
        return new OrderResponse(
            order.Id,
            order.Number,
            order.Status.ToString(),
            order.TotalAmount,
            order.CreatedAt,
            order.Lines.Select(line => new OrderLineResponse(
                line.ProductId,
                line.ProductName,
                line.Quantity,
                line.UnitPrice,
                line.LineAmount)).ToArray());
    }

    private static void EnsureMatchingRequest(
        IdempotencyRecord record,
        string requestHash)
    {
        if (!CryptographicOperations.FixedTimeEquals(
                Encoding.ASCII.GetBytes(record.RequestHash),
                Encoding.ASCII.GetBytes(requestHash)))
        {
            throw new DomainConflictException(
                "The Idempotency-Key was already used with a different request.");
        }
    }

    private static string CalculateRequestHash(
        Guid customerId,
        CreateOrderRequest request)
    {
        var canonical = new StringBuilder();
        canonical.Append(customerId.ToString("N"));

        foreach (var line in request.Lines.OrderBy(x => x.ProductId))
        {
            canonical
                .Append('|')
                .Append(line.ProductId.ToString("N"))
                .Append(':')
                .Append(line.Quantity.ToString(CultureInfo.InvariantCulture));
        }

        return Convert.ToHexString(
            SHA256.HashData(Encoding.UTF8.GetBytes(canonical.ToString())));
    }

    private static bool IsIdempotencyKeyViolation(
        DbUpdateException exception)
    {
        return exception.InnerException is PostgresException
        {
            SqlState: PostgresErrorCodes.UniqueViolation,
            ConstraintName: "pk_idempotency_records"
        };
    }

    private static string CreateOrderNumber()
    {
        return $"ORD-{DateTime.UtcNow:yyyyMMdd}-{Guid.CreateVersion7():N}";
    }

    private static string GetCacheKey(Guid customerId, Guid orderId)
    {
        return $"order:{customerId:N}:{orderId:N}";
    }
}
```

#### src/Orders.Api/Endpoints/OrderEndpoints.cs

```csharp
using System.Security.Claims;
using FluentValidation;
using Orders.Api.Contracts;
using Orders.Api.Services;

namespace Orders.Api.Endpoints;

public static class OrderEndpoints
{
    public static IEndpointRouteBuilder MapOrderEndpoints(
        this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints
            .MapGroup("/api/orders")
            .WithTags("Orders")
            .RequireAuthorization();

        group.MapPost("/", CreateOrderAsync);
        group.MapGet("/{orderId:guid}", GetOrderAsync);

        return endpoints;
    }

    private static async Task<IResult> CreateOrderAsync(
        HttpContext httpContext,
        CreateOrderRequest request,
        IValidator<CreateOrderRequest> validator,
        IOrderService orderService,
        CancellationToken cancellationToken)
    {
        var validation = await validator.ValidateAsync(
            request,
            cancellationToken);

        if (!validation.IsValid)
        {
            var errors = validation.Errors
                .GroupBy(error => error.PropertyName)
                .ToDictionary(
                    group => group.Key,
                    group => group
                        .Select(error => error.ErrorMessage)
                        .Distinct()
                        .ToArray());

            return Results.ValidationProblem(errors);
        }

        if (!TryGetCustomerId(httpContext.User, out var customerId))
        {
            return Results.Unauthorized();
        }

        if (!httpContext.Request.Headers.TryGetValue(
                "Idempotency-Key",
                out var keyValues))
        {
            return Results.Problem(
                statusCode: StatusCodes.Status400BadRequest,
                title: "Missing Idempotency-Key",
                detail: "The Idempotency-Key header is required.");
        }

        var idempotencyKey = keyValues.ToString().Trim();

        if (idempotencyKey.Length is < 8 or > 128)
        {
            return Results.Problem(
                statusCode: StatusCodes.Status400BadRequest,
                title: "Invalid Idempotency-Key",
                detail: "Idempotency-Key must contain from 8 to 128 characters.");
        }

        var result = await orderService.CreateAsync(
            customerId,
            idempotencyKey,
            request,
            cancellationToken);

        httpContext.Response.Headers["Idempotent-Replay"] =
            result.IsReplay ? "true" : "false";

        return Results.Created(
            $"/api/orders/{result.Order.Id}",
            result.Order);
    }

    private static async Task<IResult> GetOrderAsync(
        Guid orderId,
        ClaimsPrincipal user,
        IOrderService orderService,
        CancellationToken cancellationToken)
    {
        if (!TryGetCustomerId(user, out var customerId))
        {
            return Results.Unauthorized();
        }

        var order = await orderService.GetAsync(
            customerId,
            orderId,
            cancellationToken);

        return Results.Ok(order);
    }

    private static bool TryGetCustomerId(
        ClaimsPrincipal user,
        out Guid customerId)
    {
        return Guid.TryParse(
            user.FindFirstValue("sub"),
            out customerId);
    }
}
```

#### src/Orders.Api/Health/DependencyHealthChecks.cs

```csharp
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Orders.Api.Persistence;
using StackExchange.Redis;

namespace Orders.Api.Health;

public sealed class DatabaseHealthCheck(
    OrdersDbContext dbContext) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var canConnect = await dbContext.Database.CanConnectAsync(
                cancellationToken);

            return canConnect
                ? HealthCheckResult.Healthy("PostgreSQL is available.")
                : HealthCheckResult.Unhealthy("PostgreSQL is unavailable.");
        }
        catch (Exception exception)
        {
            return HealthCheckResult.Unhealthy(
                "PostgreSQL health check failed.",
                exception);
        }
    }
}

public sealed class RedisHealthCheck(
    IConnectionMultiplexer redis) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var latency = await redis.GetDatabase().PingAsync();

            return HealthCheckResult.Healthy(
                $"Redis latency: {latency.TotalMilliseconds:F1} ms.");
        }
        catch (Exception exception)
        {
            return HealthCheckResult.Unhealthy(
                "Redis health check failed.",
                exception);
        }
    }
}
```

#### src/Orders.Api/appsettings.json

```json
{
  "ConnectionStrings": {
    "Postgres": "Host=localhost;Port=5432;Database=orders;Username=orders;Password=orders_dev_password;Maximum Pool Size=200;Minimum Pool Size=10;Timeout=5;Command Timeout=10",
    "Redis": "localhost:6379,abortConnect=false,connectTimeout=3000,syncTimeout=3000"
  },
  "Jwt": {
    "Issuer": "https://identity.local",
    "Audience": "orders-api",
    "SigningKey": "development-only-signing-key-change-in-production-2026"
  },
  "Kestrel": {
    "Limits": {
      "MaxRequestBodySize": 1048576,
      "RequestHeadersTimeout": "00:00:10",
      "KeepAliveTimeout": "00:02:00",
      "MaxConcurrentConnections": 10000,
      "MaxConcurrentUpgradedConnections": 1000
    }
  },
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning",
      "Microsoft.EntityFrameworkCore.Database.Command": "Warning"
    }
  },
  "OTEL_EXPORTER_OTLP_ENDPOINT": "http://localhost:4317",
  "AllowedHosts": "*"
}
```

#### docker-compose.yml

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: orders
      POSTGRES_USER: orders
      POSTGRES_PASSWORD: orders_dev_password
    ports:
      - "5432:5432"
    volumes:
      - orders-postgres:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U orders -d orders"]
      interval: 5s
      timeout: 3s
      retries: 10

  redis:
    image: redis:7-alpine
    command: ["redis-server", "--appendonly", "yes"]
    ports:
      - "6379:6379"
    volumes:
      - orders-redis:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 10

volumes:
  orders-postgres:
  orders-redis:
```

### Utworzenie bazy i uruchomienie

Migracji nie należy wykonywać automatycznie podczas startu każdej repliki API. Przy wielu instancjach prowadziłoby to do wyścigów i niekontrolowanych zmian schematu. Migracje powinny być wersjonowane i uruchamiane jako osobny krok deploymentu.

```bash
docker compose up -d

dotnet tool install --global dotnet-ef --version 10.0.0

dotnet restore src/Orders.Api/Orders.Api.csproj

dotnet ef migrations add InitialCreate \
  --project src/Orders.Api/Orders.Api.csproj \
  --startup-project src/Orders.Api/Orders.Api.csproj \
  --output-dir Persistence/Migrations

dotnet ef database update \
  --project src/Orders.Api/Orders.Api.csproj \
  --startup-project src/Orders.Api/Orders.Api.csproj

dotnet run --project src/Orders.Api/Orders.Api.csproj
```

Wygenerowany katalog `Persistence/Migrations` należy zatwierdzić w repozytorium. Na środowisku produkcyjnym można wygenerować idempotentny skrypt:

```bash
dotnet ef migrations script --idempotent \
  --project src/Orders.Api/Orders.Api.csproj \
  --startup-project src/Orders.Api/Orders.Api.csproj \
  --output artifacts/orders-migration.sql
```

### Przykładowe dane i test endpointu

#### Dodanie produktów

```bash
docker compose exec postgres psql -U orders -d orders -c '
INSERT INTO products ("Id", "Name", "UnitPrice", "Stock", "IsActive")
VALUES
  ('11111111-1111-1111-1111-111111111111', 'Klawiatura', 299.99, 100, TRUE),
  ('22222222-2222-2222-2222-222222222222', 'Mysz', 149.50, 200, TRUE);
'
```

#### Utworzenie zamówienia

Zmienna `TOKEN` powinna zawierać JWT wystawiony przez skonfigurowanego dostawcę tożsamości. Claim `sub` musi być identyfikatorem klienta w formacie UUID.

```bash
curl -i http://localhost:5000/api/orders \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: 97874439-4c21-4f68-a917-a4e010468ec3" \
  -d '{
    "lines": [
      {
        "productId": "11111111-1111-1111-1111-111111111111",
        "quantity": 2
      },
      {
        "productId": "22222222-2222-2222-2222-222222222222",
        "quantity": 1
      }
    ]
  }'
```

Ponowienie identycznego requestu z tym samym kluczem zwraca to samo zamówienie oraz nagłówek `Idempotent-Replay: true`. Użycie tego samego klucza z innym payloadem zwraca `409 Conflict`.

#### Health checks

```bash
curl -i http://localhost:5000/health/live
curl -i http://localhost:5000/health/ready
```

#### Test współbieżności

Test integracyjny powinien wysłać wiele równoległych requestów na produkt z małym stanem magazynowym i sprawdzić, że liczba zaakceptowanych sztuk nigdy nie przekroczy stanu początkowego. Osobny test powinien wysłać ten sam klucz idempotencji z wielu połączeń i potwierdzić, że powstał dokładnie jeden rekord zamówienia.

```bash
seq 1 50 | xargs -P 20 -I {} curl -s -o /dev/null -w "%{http_code}\n" \
  http://localhost:5000/api/orders \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: concurrency-key-{}-2026" \
  -d '{
    "lines": [
      {
        "productId": "11111111-1111-1111-1111-111111111111",
        "quantity": 3
      }
    ]
  }'
```

### Przebieg tworzenia zamówienia

1. Middleware uwierzytelnia JWT i odrzuca przekroczenie limitu requestów.
2. Endpoint waliduje payload i nagłówek `Idempotency-Key`.
3. Identyfikator klienta jest pobierany wyłącznie z podpisanego claimu `sub`.
4. Serwis oblicza deterministyczny SHA-256 z klienta i znormalizowanej listy pozycji.
5. Rozpoczynana jest transakcja PostgreSQL.
6. Klucz idempotencji jest zapisywany przed właściwym zamówieniem.
7. Dla każdej pozycji wykonywana jest atomowa aktualizacja stanu magazynowego.
8. Ceny i nazwy produktów są kopiowane do pozycji zamówienia, dzięki czemu późniejsza zmiana katalogu nie modyfikuje historii.
9. Zamówienie i identyfikator rezultatu idempotencji są zapisywane w tej samej transakcji.
10. Po zatwierdzeniu odpowiedź jest zapisywana w Redis. Błąd Redis nie wycofuje zamówienia.
11. Odpowiedź `201 Created` zawiera adres zasobu w nagłówku `Location`.

### Cache

- **Wzorzec:** cache-aside dla odczytu zamówienia.
- **Klucz:** zawiera identyfikator klienta i zamówienia, co ogranicza ryzyko przecieku między klientami.
- **TTL:** 10 minut absolutnie i 2 minuty przesuwane.
- **Źródło prawdy:** PostgreSQL.
- **Awaria Redis:** odczyt przechodzi do bazy, a zapis cache jest traktowany jako best effort.
- **Niecache'owane operacje:** sprawdzanie magazynu, idempotencja i tworzenie zamówienia zawsze korzystają z bazy.

Dla bardzo dużego ruchu listy zamówień można cache'ować osobno, ale każda zmiana statusu musi unieważniać powiązane klucze. Przy wielu usługach warto użyć zdarzeń integracyjnych do invalidacji zamiast lokalnego cache.

### Logging i monitoring

- Logi są emitowane jako JSON do standardowego wyjścia i mogą być zbierane przez platformę kontenerową.
- ASP.NET Core automatycznie tworzy aktywność dla requestu, a trace ID i span ID są dodawane do logów.
- Nie są logowane body requestów, tokeny JWT ani nagłówki autoryzacyjne.
- OpenTelemetry eksportuje trace'y i metryki przez OTLP.
- Liveness informuje, czy proces działa. Readiness sprawdza PostgreSQL i Redis.

#### Rekomendowane alerty

| Metryka | Przykładowy alert |
| --- | --- |
| Odsetek odpowiedzi 5xx | Powyżej 1% przez 5 minut |
| p95 czasu POST /api/orders | Powyżej 500 ms przez 10 minut |
| Wyczerpanie puli PostgreSQL | Powyżej 80% przez 5 minut |
| Błędy lub opóźnienie Redis | Powyżej 100 ms albo seria timeoutów |
| Konflikty magazynowe 409 | Nagły wzrost względem wartości bazowej |
| Odrzucenia rate limitera | Wzrost 429 dla jednego klienta lub adresu IP |
| Readiness | Brak gotowych replik przez więcej niż minutę |

### Zabezpieczenia produkcyjne

- Cały ruch biznesowy powinien być obsługiwany wyłącznie przez HTTPS. TLS można zakończyć na zaufanym ingressie lub load balancerze.
- W produkcji zalecany jest zewnętrzny OIDC/OAuth 2.0 oraz podpis asymetryczny JWT. Symetryczny klucz w przykładzie służy lokalnemu uruchomieniu.
- Sekrety należy pobierać z Azure Key Vault, AWS Secrets Manager, Kubernetes Secrets lub równoważnego magazynu, a nie z repozytorium.
- Połączenia do PostgreSQL i Redis powinny używać TLS, prywatnej sieci oraz osobnych kont z minimalnymi uprawnieniami.
- Identyfikator klienta nie pochodzi z body, dzięki czemu klient nie może utworzyć zamówienia w imieniu innego użytkownika.
- Odczyt zamówienia filtruje jednocześnie po `OrderId` i `CustomerId`.
- Parametry EF Core zapobiegają SQL injection.
- Limit wielkości body, limit liczby pozycji i rate limiting ograniczają nadużycia zasobów.
- CORS jest domyślnie niedostępny. Jeśli API ma być wywoływane z przeglądarki, należy skonfigurować ścisłą listę dozwolonych originów.
- Przy tokenie przesyłanym w nagłówku Authorization i braku uwierzytelniania cookie klasyczny CSRF nie ma zastosowania.
- Należy skonfigurować zaufane proxy jawnie; nie wolno bezwarunkowo ufać nagłówkom `X-Forwarded-For` z Internetu.
- Retencja rekordów idempotencji powinna być realizowana zadaniem okresowym, na przykład po 24–72 godzinach, zgodnie z kontraktem API.

### Najważniejsze decyzje i kompromisy

| Decyzja | Zalety | Wady |
| --- | --- | --- |
| PostgreSQL jako źródło prawdy | Transakcje ACID, ograniczenia, dojrzałe indeksy i dobra kontrola współbieżności. | Skalowanie zapisów jest trudniejsze niż skalowanie stateless API; wymaga monitorowania puli i indeksów. |
| Atomowa aktualizacja magazynu | Brak oversellingu bez blokad aplikacyjnych i bez zależności od jednej instancji API. | Przy bardzo gorących produktach powstaje kontencja na wierszu. |
| Repeatable Read | Spójny obraz cen i produktów podczas tworzenia zamówienia. | Możliwe błędy serializacji i ponowienia zwiększające opóźnienie. |
| Idempotencja w PostgreSQL | Działa pomiędzy replikami i przeżywa restart procesu. | Każdy zapis zamówienia wymaga dodatkowego rekordu oraz polityki retencji. |
| Redis cache-aside | Odciąża bazę przy częstych odczytach i nie jest źródłem prawdy. | Możliwa chwilowa nieaktualność oraz dodatkowa infrastruktura. |
| Minimal API | Mały narzut, prosty routing i czytelny przykład pionowego wycinka. | Przy bardzo dużej liczbie endpointów wymaga konsekwentnej organizacji modułów. |
| EF Core DbContext Pool | Mniejszy koszt alokacji kontekstu przy dużej liczbie requestów. | Kontekst nie może przechowywać stanu zależnego od requestu poza standardowym trackingiem. |
| Synchroniczne tworzenie zamówienia | Klient natychmiast zna wynik rezerwacji magazynu. | Dłuższa ścieżka requestu; przy bardzo złożonym procesie lepsze może być przyjęcie komendy i odpowiedź 202. |

### Dalsze rozszerzenia produkcyjne

- **Transactional outbox:** zapis zdarzenia `OrderCreated` w tej samej transakcji i asynchroniczna publikacja do Kafka, RabbitMQ lub Azure Service Bus.
- **Płatności:** osobny proces lub saga; nie należy utrzymywać transakcji bazodanowej podczas wywołania zewnętrznego operatora płatności.
- **Read replicas:** odczyty historycznych zamówień mogą trafiać do replik, z uwzględnieniem opóźnienia replikacji.
- **Testy kontraktowe i integracyjne:** PostgreSQL i Redis uruchamiane przez Testcontainers zamiast providerów in-memory.
- **Load testing:** k6, NBomber lub Gatling z osobnymi scenariuszami dla unikalnych i powtarzanych kluczy idempotencji.
- **Autoscaling:** na podstawie CPU, liczby aktywnych requestów i czasu odpowiedzi, przy zachowaniu limitów połączeń bazy.
- **Architektura modułowa:** przy wzroście systemu moduły Orders, Catalog, Inventory i Payments mogą zostać rozdzielone, ale wymaga to komunikacji zdarzeniowej i obsługi eventual consistency.

> Najważniejszą zasadą jest niedopuszczenie, aby poprawność zamówienia zależała od pamięci pojedynczej instancji API albo od Redis. Krytyczne reguły współbieżności, idempotencji i stanu magazynowego są egzekwowane przez transakcyjne źródło prawdy.
