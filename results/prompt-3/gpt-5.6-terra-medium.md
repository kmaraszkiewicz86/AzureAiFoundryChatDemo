# Model: gpt-5.6-terra-medium

**Execution time:** 91112 ms

**Input tokens:** 1135

**Output tokens:** 10596

**Total tokens:** 11731

## Question

Zaprojektuj produkcyjne REST API w ASP.NET Core do obsługi zamówień. API powinno obsługiwać dużą liczbę równoległych requestów. Zaproponuj architekturę rozwiązania, sposób przechowywania danych, strategię cache, obsługę błędów, logging, monitoring oraz zabezpieczenia. Następnie pokaż przykładową implementację endpointu tworzącego zamówienie wraz z warstwą serwisową. Wyjaśnij najważniejsze decyzje architektoniczne oraz ich zalety i wady.

## Answer

### Architektura produkcyjnego API zamówień

Rozwiązanie wykorzystuje modularny monolit ASP.NET Core 10 z wyraźnym podziałem na warstwę HTTP, aplikacyjną, domenową i infrastrukturalną. Taka architektura pozwala szybko dostarczyć system, zachować transakcyjność oraz później wydzielić niezależne usługi, na przykład katalog produktów, płatności lub obsługę wysyłki.

- **ASP.NET Core Web API:** stateless API skalowane horyzontalnie za load balancerem.
- **PostgreSQL:** trwałe źródło prawdy dla zamówień, pozycji, produktów i komunikatów Outbox.
- **Redis:** cache-aside dla danych katalogowych odczytywanych często i zmienianych rzadziej.
- **EF Core:** mapowanie danych, transakcje oraz kontrola współbieżności.
- **Idempotencja:** unikalny klucz `Idempotency-Key` chroni przed podwójnym utworzeniem zamówienia podczas retry klienta.
- **Outbox pattern:** zdarzenie `OrderCreated` jest zapisywane w tej samej transakcji co zamówienie. Osobny worker może je niezawodnie przekazać do RabbitMQ, Kafka lub Azure Service Bus.
- **OpenTelemetry:** metryki, trace i logi mogą zostać wysłane do Prometheus, Grafana, Jaeger, Tempo lub Azure Monitor.

> W produkcji API powinno być uruchamiane w co najmniej dwóch replikach. PostgreSQL i Redis powinny działać jako usługi zarządzane lub klastry z replikacją, backupami, monitoringiem i planem odtworzeniowym.

### Najważniejsze decyzje architektoniczne

| Decyzja | Zaleta | Wada / ryzyko |
| --- | --- | --- |
| PostgreSQL jako source of truth | ACID, indeksy, transakcje i silna spójność danych zamówienia. | Wymaga prawidłowego strojenia połączeń, indeksów i backupów. |
| Redis cache-aside | Zmniejsza obciążenie bazy przy częstych odczytach katalogu. | Możliwe chwilowo nieaktualne dane; konieczna invalidacja cache po zmianie produktu. |
| Idempotency-Key | Bezpieczne retry po timeoutach oraz przy wielokrotnych kliknięciach klienta. | Klucze muszą być przechowywane wystarczająco długo, zwykle 24–72 godziny lub dłużej zależnie od biznesu. |
| Outbox pattern | Nie gubi zdarzeń pomiędzy zapisem zamówienia a publikacją do brokera. | Wymaga workera, retry, dead-letter queue i monitorowania opóźnień. |
| Optimistic concurrency | Nie blokuje niepotrzebnie rekordów przy dużej równoległości. | Konflikty aktualizacji trzeba obsługiwać przez retry albo odpowiedź 409 Conflict. |
| Rate limiting | Chroni API i bazę przed nadużyciami oraz nagłymi pikami ruchu. | Limity muszą być dobrane do profilu klientów; dla wielu instancji warto użyć limitowania rozproszonego. |

### Wymagania i pakiety

- .NET SDK 10.
- PostgreSQL 16 lub nowszy.
- Redis 7 lub nowszy.
- Opcjonalnie Docker Compose do lokalnego uruchomienia infrastruktury.
- W środowisku produkcyjnym sekret JWT, hasła baz danych i connection stringi muszą pochodzić z Secret Managera, Kubernetes Secrets, Azure Key Vault lub AWS Secrets Manager.

#### Orders.Api/Orders.Api.csproj

```xml
<Project Sdk="Microsoft.NET.Sdk.Web">
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
  </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="FluentValidation" Version="12.0.0" />
    <PackageReference Include="Microsoft.AspNetCore.Authentication.JwtBearer" Version="10.0.0" />
    <PackageReference Include="Microsoft.EntityFrameworkCore.Design" Version="10.0.0">
      <PrivateAssets>all</PrivateAssets>
    </PackageReference>
    <PackageReference Include="Microsoft.Extensions.Caching.StackExchangeRedis" Version="10.0.0" />
    <PackageReference Include="Npgsql.EntityFrameworkCore.PostgreSQL" Version="10.0.0" />
    <PackageReference Include="OpenTelemetry.Exporter.Prometheus.AspNetCore" Version="1.13.1-beta.1" />
    <PackageReference Include="OpenTelemetry.Extensions.Hosting" Version="1.13.1" />
    <PackageReference Include="OpenTelemetry.Instrumentation.AspNetCore" Version="1.13.1" />
    <PackageReference Include="OpenTelemetry.Instrumentation.Http" Version="1.13.1" />
    <PackageReference Include="Serilog.AspNetCore" Version="10.0.0" />
    <PackageReference Include="Serilog.Settings.Configuration" Version="10.0.0" />
    <PackageReference Include="Swashbuckle.AspNetCore" Version="9.0.6" />
  </ItemGroup>
</Project>
```

### Struktura projektu

```text
Orders.Api/
├── Contracts/
│   └── OrderContracts.cs
├── Controllers/
│   └── OrdersController.cs
├── Domain/
│   └── Entities.cs
├── Infrastructure/
│   ├── OrdersDbContext.cs
│   ├── ProductCatalog.cs
│   └── ProblemDetailsExceptionMiddleware.cs
├── Services/
│   └── OrderService.cs
├── Program.cs
├── appsettings.json
└── Orders.Api.csproj

docker-compose.yml
database-init.sql
```

### Implementacja

#### Orders.Api/Domain/Entities.cs

Encje domenowe zawierają zamówienie, pozycje, produkt oraz komunikat Outbox. Kwoty są przechowywane jako `decimal`, nigdy jako `double`.

```csharp
namespace Orders.Api.Domain;

public enum OrderStatus
{
    Created = 1,
    Confirmed = 2,
    Cancelled = 3
}

public sealed class Product
{
    public Guid Id { get; set; }
    public string Sku { get; set; } = null!;
    public string Name { get; set; } = null!;
    public decimal UnitPrice { get; set; }
    public bool IsActive { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
}

public sealed class Order
{
    public Guid Id { get; set; }
    public string OrderNumber { get; set; } = null!;
    public Guid CustomerId { get; set; }
    public string IdempotencyKey { get; set; } = null!;
    public OrderStatus Status { get; set; }
    public decimal TotalAmount { get; set; }
    public string Currency { get; set; } = null!;
    public DateTimeOffset CreatedAtUtc { get; set; }
    public List<OrderLine> Lines { get; set; } = [];
}

public sealed class OrderLine
{
    public Guid Id { get; set; }
    public Guid OrderId { get; set; }
    public Guid ProductId { get; set; }
    public string ProductName { get; set; } = null!;
    public decimal UnitPrice { get; set; }
    public int Quantity { get; set; }
    public decimal LineTotal { get; set; }
}

public sealed class OutboxMessage
{
    public Guid Id { get; set; }
    public string Type { get; set; } = null!;
    public string Payload { get; set; } = null!;
    public DateTimeOffset OccurredAtUtc { get; set; }
    public DateTimeOffset? ProcessedAtUtc { get; set; }
    public int RetryCount { get; set; }
}
```

#### Orders.Api/Contracts/OrderContracts.cs

Kontrakty HTTP nie ujawniają encji EF Core. Walidacja ogranicza rozmiar żądania, liczbę pozycji i ilości, co chroni aplikację przed kosztownymi payloadami.

```csharp
using FluentValidation;

namespace Orders.Api.Contracts;

public sealed record CreateOrderRequest(IReadOnlyList<CreateOrderLineRequest> Lines);

public sealed record CreateOrderLineRequest(Guid ProductId, int Quantity);

public sealed record OrderResponse(
    Guid Id,
    string OrderNumber,
    string Status,
    decimal TotalAmount,
    string Currency,
    DateTimeOffset CreatedAtUtc,
    IReadOnlyList<OrderLineResponse> Lines);

public sealed record OrderLineResponse(
    Guid ProductId,
    string ProductName,
    decimal UnitPrice,
    int Quantity,
    decimal LineTotal);

public sealed class CreateOrderRequestValidator : AbstractValidator<CreateOrderRequest>
{
    public CreateOrderRequestValidator()
    {
        RuleFor(x => x.Lines)
            .NotEmpty()
            .Must(lines => lines.Count <= 50)
            .WithMessage("Zamówienie może zawierać od 1 do 50 pozycji.");

        RuleForEach(x => x.Lines).ChildRules(line =>
        {
            line.RuleFor(x => x.ProductId).NotEmpty();
            line.RuleFor(x => x.Quantity).InclusiveBetween(1, 1000);
        });

        RuleFor(x => x.Lines)
            .Must(lines => lines.Select(x => x.ProductId).Distinct().Count() == lines.Count)
            .WithMessage("Produkt może wystąpić w zamówieniu tylko raz.");
    }
}
```

#### Orders.Api/Infrastructure/OrdersDbContext.cs

Konfiguracja zawiera indeks unikalny dla klucza idempotencji, indeksy wyszukiwania oraz ograniczenia długości i precyzji monetarnej.

```csharp
using Microsoft.EntityFrameworkCore;
using Orders.Api.Domain;

namespace Orders.Api.Infrastructure;

public sealed class OrdersDbContext(DbContextOptions<OrdersDbContext> options) : DbContext(options)
{
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<OrderLine> OrderLines => Set<OrderLine>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<OutboxMessage> OutboxMessages => Set<OutboxMessage>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Product>(entity =>
        {
            entity.ToTable("products");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Sku).HasMaxLength(64).IsRequired();
            entity.HasIndex(x => x.Sku).IsUnique();
            entity.Property(x => x.Name).HasMaxLength(256).IsRequired();
            entity.Property(x => x.UnitPrice).HasPrecision(18, 2);
        });

        modelBuilder.Entity<Order>(entity =>
        {
            entity.ToTable("orders");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.OrderNumber).HasMaxLength(40).IsRequired();
            entity.HasIndex(x => x.OrderNumber).IsUnique();
            entity.Property(x => x.IdempotencyKey).HasMaxLength(128).IsRequired();
            entity.HasIndex(x => new { x.CustomerId, x.IdempotencyKey }).IsUnique();
            entity.Property(x => x.Currency).HasMaxLength(3).IsRequired();
            entity.Property(x => x.TotalAmount).HasPrecision(18, 2);
            entity.HasMany(x => x.Lines)
                .WithOne()
                .HasForeignKey(x => x.OrderId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<OrderLine>(entity =>
        {
            entity.ToTable("order_lines");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.ProductName).HasMaxLength(256).IsRequired();
            entity.Property(x => x.UnitPrice).HasPrecision(18, 2);
            entity.Property(x => x.LineTotal).HasPrecision(18, 2);
            entity.HasIndex(x => x.OrderId);
        });

        modelBuilder.Entity<OutboxMessage>(entity =>
        {
            entity.ToTable("outbox_messages");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Type).HasMaxLength(256).IsRequired();
            entity.Property(x => x.Payload).HasColumnType("jsonb").IsRequired();
            entity.HasIndex(x => new { x.ProcessedAtUtc, x.OccurredAtUtc });
        });
    }
}
```

#### Orders.Api/Infrastructure/ProductCatalog.cs

Serwis katalogowy stosuje cache-aside. Cena jest zawsze pobierana po stronie serwera, więc klient nie może zmanipulować wartości zamówienia.

```csharp
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Distributed;
using Orders.Api.Domain;

namespace Orders.Api.Infrastructure;

public interface IProductCatalog
{
    Task<IReadOnlyDictionary<Guid, Product>> GetActiveProductsAsync(
        IReadOnlyCollection<Guid> productIds,
        CancellationToken cancellationToken);
}

public sealed class ProductCatalog(
    OrdersDbContext dbContext,
    IDistributedCache cache) : IProductCatalog
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public async Task<IReadOnlyDictionary<Guid, Product>> GetActiveProductsAsync(
        IReadOnlyCollection<Guid> productIds,
        CancellationToken cancellationToken)
    {
        var result = new Dictionary<Guid, Product>();
        var missingIds = new List<Guid>();

        foreach (var productId in productIds)
        {
            var cacheKey = $"products:v1:{productId}";
            var cached = await cache.GetStringAsync(cacheKey, cancellationToken);

            if (cached is null)
            {
                missingIds.Add(productId);
                continue;
            }

            var product = JsonSerializer.Deserialize<Product>(cached, JsonOptions);
            if (product is not null && product.IsActive)
            {
                result[productId] = product;
            }
        }

        if (missingIds.Count == 0)
        {
            return result;
        }

        var products = await dbContext.Products
            .AsNoTracking()
            .Where(x => missingIds.Contains(x.Id) && x.IsActive)
            .ToListAsync(cancellationToken);

        foreach (var product in products)
        {
            result[product.Id] = product;

            var cacheKey = $"products:v1:{product.Id}";
            var cacheValue = JsonSerializer.Serialize(product, JsonOptions);

            await cache.SetStringAsync(
                cacheKey,
                cacheValue,
                new DistributedCacheEntryOptions
                {
                    AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5)
                },
                cancellationToken);
        }

        return result;
    }
}
```

#### Orders.Api/Services/OrderService.cs

Serwis tworzy zamówienie i wiadomość Outbox w jednej transakcji. Unikalny indeks w bazie jest ostatecznym zabezpieczeniem przed wyścigiem równoległych requestów z tym samym kluczem idempotencji.

```csharp
using System.Data;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Orders.Api.Contracts;
using Orders.Api.Domain;
using Orders.Api.Infrastructure;

namespace Orders.Api.Services;

public interface IOrderService
{
    Task<OrderResponse> CreateAsync(
        Guid customerId,
        string idempotencyKey,
        CreateOrderRequest request,
        CancellationToken cancellationToken);

    Task<OrderResponse?> GetByIdAsync(Guid customerId, Guid orderId, CancellationToken cancellationToken);
}

public sealed class OrderService(
    OrdersDbContext dbContext,
    IProductCatalog productCatalog,
    ILogger<OrderService> logger) : IOrderService
{
    public async Task<OrderResponse> CreateAsync(
        Guid customerId,
        string idempotencyKey,
        CreateOrderRequest request,
        CancellationToken cancellationToken)
    {
        var existing = await FindByIdempotencyKeyAsync(customerId, idempotencyKey, cancellationToken);
        if (existing is not null)
        {
            return Map(existing);
        }

        var productIds = request.Lines.Select(x => x.ProductId).ToArray();
        var products = await productCatalog.GetActiveProductsAsync(productIds, cancellationToken);

        if (products.Count != productIds.Length)
        {
            var missing = productIds.Where(id => !products.ContainsKey(id));
            throw new InvalidOperationException(
                $"Nie znaleziono aktywnych produktów: {string.Join(", ", missing)}.");
        }

        var now = DateTimeOffset.UtcNow;
        var order = new Order
        {
            Id = Guid.NewGuid(),
            OrderNumber = $"ORD-{Guid.NewGuid():N}",
            CustomerId = customerId,
            IdempotencyKey = idempotencyKey,
            Status = OrderStatus.Created,
            Currency = "PLN",
            CreatedAtUtc = now
        };

        foreach (var requestLine in request.Lines)
        {
            var product = products[requestLine.ProductId];
            var lineTotal = product.UnitPrice * requestLine.Quantity;

            order.Lines.Add(new OrderLine
            {
                Id = Guid.NewGuid(),
                OrderId = order.Id,
                ProductId = product.Id,
                ProductName = product.Name,
                UnitPrice = product.UnitPrice,
                Quantity = requestLine.Quantity,
                LineTotal = lineTotal
            });
        }

        order.TotalAmount = order.Lines.Sum(x => x.LineTotal);

        await using var transaction = await dbContext.Database.BeginTransactionAsync(
            IsolationLevel.ReadCommitted,
            cancellationToken);

        try
        {
            dbContext.Orders.Add(order);
            dbContext.OutboxMessages.Add(new OutboxMessage
            {
                Id = Guid.NewGuid(),
                Type = "orders.order-created.v1",
                OccurredAtUtc = now,
                Payload = JsonSerializer.Serialize(new
                {
                    order.Id,
                    order.OrderNumber,
                    order.CustomerId,
                    order.TotalAmount,
                    order.Currency,
                    order.CreatedAtUtc
                })
            });

            await dbContext.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            logger.LogInformation(
                "Order {OrderId} with number {OrderNumber} was created for customer {CustomerId}",
                order.Id,
                order.OrderNumber,
                customerId);

            return Map(order);
        }
        catch (DbUpdateException)
        {
            await transaction.RollbackAsync(cancellationToken);
            dbContext.ChangeTracker.Clear();

            var concurrentOrder = await FindByIdempotencyKeyAsync(
                customerId,
                idempotencyKey,
                cancellationToken);

            if (concurrentOrder is not null)
            {
                return Map(concurrentOrder);
            }

            throw;
        }
    }

    public async Task<OrderResponse?> GetByIdAsync(
        Guid customerId,
        Guid orderId,
        CancellationToken cancellationToken)
    {
        var order = await dbContext.Orders
            .AsNoTracking()
            .Include(x => x.Lines)
            .SingleOrDefaultAsync(
                x => x.Id == orderId && x.CustomerId == customerId,
                cancellationToken);

        return order is null ? null : Map(order);
    }

    private Task<Order?> FindByIdempotencyKeyAsync(
        Guid customerId,
        string idempotencyKey,
        CancellationToken cancellationToken)
    {
        return dbContext.Orders
            .Include(x => x.Lines)
            .SingleOrDefaultAsync(
                x => x.CustomerId == customerId && x.IdempotencyKey == idempotencyKey,
                cancellationToken);
    }

    private static OrderResponse Map(Order order) =>
        new(
            order.Id,
            order.OrderNumber,
            order.Status.ToString(),
            order.TotalAmount,
            order.Currency,
            order.CreatedAtUtc,
            order.Lines
                .OrderBy(x => x.ProductName)
                .Select(x => new OrderLineResponse(
                    x.ProductId,
                    x.ProductName,
                    x.UnitPrice,
                    x.Quantity,
                    x.LineTotal))
                .ToArray());
}
```

#### Orders.Api/Infrastructure/ProblemDetailsExceptionMiddleware.cs

Middleware zwraca standard RFC 9457 Problem Details, nie ujawnia szczegółów wewnętrznych i loguje wyjątki z identyfikatorem trace.

```csharp
using Microsoft.AspNetCore.Mvc;

namespace Orders.Api.Infrastructure;

public sealed class ProblemDetailsExceptionMiddleware(
    RequestDelegate next,
    ILogger<ProblemDetailsExceptionMiddleware> logger)
{
    public async Task Invoke(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (InvalidOperationException exception)
        {
            logger.LogWarning(exception, "Business validation failure. TraceId: {TraceId}", context.TraceIdentifier);

            await WriteProblemAsync(
                context,
                StatusCodes.Status422UnprocessableEntity,
                "Nie można utworzyć zamówienia",
                exception.Message);
        }
        catch (Exception exception)
        {
            logger.LogError(exception, "Unhandled exception. TraceId: {TraceId}", context.TraceIdentifier);

            await WriteProblemAsync(
                context,
                StatusCodes.Status500InternalServerError,
                "Wewnętrzny błąd serwera",
                "Wystąpił nieoczekiwany błąd. Skontaktuj się z pomocą techniczną, podając identyfikator trace.");
        }
    }

    private static async Task WriteProblemAsync(
        HttpContext context,
        int status,
        string title,
        string detail)
    {
        context.Response.StatusCode = status;
        context.Response.ContentType = "application/problem+json";

        await context.Response.WriteAsJsonAsync(new ProblemDetails
        {
            Status = status,
            Title = title,
            Detail = detail,
            Instance = context.Request.Path
        });
    }
}
```

#### Orders.Api/Controllers/OrdersController.cs

Endpoint wymaga JWT, pobiera identyfikator klienta z claimu `sub`, waliduje nagłówek idempotencji i zwraca `201 Created`.

```csharp
using System.Security.Claims;
using FluentValidation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Orders.Api.Contracts;
using Orders.Api.Services;

namespace Orders.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/orders")]
public sealed class OrdersController(
    IOrderService orderService,
    IValidator<CreateOrderRequest> validator) : ControllerBase
{
    [HttpPost]
    [ProducesResponseType(typeof(OrderResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> Create(
        [FromBody] CreateOrderRequest request,
        [FromHeader(Name = "Idempotency-Key")] string? idempotencyKey,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(idempotencyKey) || idempotencyKey.Length > 128)
        {
            ModelState.AddModelError("Idempotency-Key", "Nagłówek Idempotency-Key jest wymagany i może mieć maksymalnie 128 znaków.");
            return ValidationProblem(ModelState);
        }

        var validationResult = await validator.ValidateAsync(request, cancellationToken);
        if (!validationResult.IsValid)
        {
            foreach (var error in validationResult.Errors)
            {
                ModelState.AddModelError(error.PropertyName, error.ErrorMessage);
            }

            return ValidationProblem(ModelState);
        }

        var subject = User.FindFirstValue("sub");
        if (!Guid.TryParse(subject, out var customerId))
        {
            return Forbid();
        }

        var response = await orderService.CreateAsync(
            customerId,
            idempotencyKey,
            request,
            cancellationToken);

        return CreatedAtAction(nameof(GetById), new { orderId = response.Id }, response);
    }

    [HttpGet("{orderId:guid}", Name = "GetOrderById")]
    [ProducesResponseType(typeof(OrderResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(Guid orderId, CancellationToken cancellationToken)
    {
        var subject = User.FindFirstValue("sub");
        if (!Guid.TryParse(subject, out var customerId))
        {
            return Forbid();
        }

        var order = await orderService.GetByIdAsync(customerId, orderId, cancellationToken);
        return order is null ? NotFound() : Ok(order);
    }
}
```

#### Orders.Api/Program.cs

```csharp
using System.Threading.RateLimiting;
using FluentValidation;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using OpenTelemetry.Metrics;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;
using Orders.Api.Contracts;
using Orders.Api.Infrastructure;
using Orders.Api.Services;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseSerilog((context, configuration) =>
    configuration.ReadFrom.Configuration(context.Configuration));

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddDbContextPool<OrdersDbContext>(options =>
    options.UseNpgsql(
        builder.Configuration.GetConnectionString("OrdersDb"),
        npgsql => npgsql.EnableRetryOnFailure(3)));

builder.Services.AddStackExchangeRedisCache(options =>
{
    options.Configuration = builder.Configuration.GetConnectionString("Redis");
    options.InstanceName = "orders-api:";
});

builder.Services.AddScoped<IProductCatalog, ProductCatalog>();
builder.Services.AddScoped<IOrderService, OrderService>();
builder.Services.AddScoped<IValidator<CreateOrderRequest>, CreateOrderRequestValidator>();

var jwt = builder.Configuration.GetSection("Jwt");
var signingKey = jwt["SigningKey"] ?? throw new InvalidOperationException("JWT signing key is missing.");

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.MapInboundClaims = false;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwt["Issuer"],
            ValidateAudience = true,
            ValidAudience = jwt["Audience"],
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(
                System.Text.Encoding.UTF8.GetBytes(signingKey)),
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromSeconds(30)
        };
    });

builder.Services.AddAuthorization();

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddFixedWindowLimiter("orders-write", limiterOptions =>
    {
        limiterOptions.PermitLimit = 30;
        limiterOptions.Window = TimeSpan.FromMinutes(1);
        limiterOptions.QueueLimit = 0;
        limiterOptions.AutoReplenishment = true;
    });
});

builder.Services.AddHealthChecks()
    .AddDbContextCheck<OrdersDbContext>("postgresql");

builder.Services.AddOpenTelemetry()
    .ConfigureResource(resource => resource.AddService("orders-api"))
    .WithTracing(tracing => tracing
        .AddAspNetCoreInstrumentation()
        .AddHttpClientInstrumentation())
    .WithMetrics(metrics => metrics
        .AddAspNetCoreInstrumentation()
        .AddRuntimeInstrumentation()
        .AddPrometheusExporter());

var app = builder.Build();

app.UseMiddleware<ProblemDetailsExceptionMiddleware>();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers().RequireRateLimiting("orders-write");
app.MapHealthChecks("/health/live", new HealthCheckOptions
{
    Predicate = _ => false
});
app.MapHealthChecks("/health/ready");
app.MapPrometheusScrapingEndpoint("/metrics");

app.Run();
```

### Konfiguracja

#### Orders.Api/appsettings.json

Wartości pokazane poniżej są przeznaczone wyłącznie do lokalnego developmentu. Produkcyjny klucz JWT nie może znajdować się w repozytorium ani pliku konfiguracyjnym obrazu kontenera.

```json
{
  "ConnectionStrings": {
    "OrdersDb": "Host=localhost;Port=5432;Database=orders;Username=orders;Password=orders",
    "Redis": "localhost:6379"
  },
  "Jwt": {
    "Issuer": "orders-api",
    "Audience": "orders-clients",
    "SigningKey": "development-only-signing-key-change-this-before-production-12345"
  },
  "Serilog": {
    "MinimumLevel": {
      "Default": "Information",
      "Override": {
        "Microsoft.AspNetCore": "Warning",
        "Microsoft.EntityFrameworkCore.Database.Command": "Warning"
      }
    },
    "WriteTo": [
      {
        "Name": "Console"
      }
    ],
    "Enrich": [
      "FromLogContext",
      "WithMachineName",
      "WithThreadId"
    ]
  },
  "AllowedHosts": "*"
}
```

#### database-init.sql

Skrypt inicjalizuje schemat i przykładowe produkty. W dojrzałym procesie CI/CD należy zastąpić go migracjami EF Core uruchamianymi jako osobny job przed wdrożeniem aplikacji.

```sql
CREATE TABLE products (
    "Id" uuid PRIMARY KEY,
    "Sku" varchar(64) NOT NULL UNIQUE,
    "Name" varchar(256) NOT NULL,
    "UnitPrice" numeric(18,2) NOT NULL,
    "IsActive" boolean NOT NULL,
    "UpdatedAtUtc" timestamptz NOT NULL
);

CREATE TABLE orders (
    "Id" uuid PRIMARY KEY,
    "OrderNumber" varchar(40) NOT NULL UNIQUE,
    "CustomerId" uuid NOT NULL,
    "IdempotencyKey" varchar(128) NOT NULL,
    "Status" integer NOT NULL,
    "TotalAmount" numeric(18,2) NOT NULL,
    "Currency" varchar(3) NOT NULL,
    "CreatedAtUtc" timestamptz NOT NULL,
    CONSTRAINT "UX_orders_customer_idempotency" UNIQUE ("CustomerId", "IdempotencyKey")
);

CREATE TABLE order_lines (
    "Id" uuid PRIMARY KEY,
    "OrderId" uuid NOT NULL REFERENCES orders("Id") ON DELETE CASCADE,
    "ProductId" uuid NOT NULL,
    "ProductName" varchar(256) NOT NULL,
    "UnitPrice" numeric(18,2) NOT NULL,
    "Quantity" integer NOT NULL,
    "LineTotal" numeric(18,2) NOT NULL
);

CREATE INDEX "IX_order_lines_OrderId" ON order_lines ("OrderId");

CREATE TABLE outbox_messages (
    "Id" uuid PRIMARY KEY,
    "Type" varchar(256) NOT NULL,
    "Payload" jsonb NOT NULL,
    "OccurredAtUtc" timestamptz NOT NULL,
    "ProcessedAtUtc" timestamptz NULL,
    "RetryCount" integer NOT NULL
);

CREATE INDEX "IX_outbox_messages_processed_occurred"
ON outbox_messages ("ProcessedAtUtc", "OccurredAtUtc");

INSERT INTO products ("Id", "Sku", "Name", "UnitPrice", "IsActive", "UpdatedAtUtc")
VALUES
('11111111-1111-1111-1111-111111111111', 'LAPTOP-001', 'Laptop Pro 14', 5999.00, true, now()),
('22222222-2222-2222-2222-222222222222', 'MOUSE-001', 'Mysz bezprzewodowa', 149.90, true, now());
```

#### docker-compose.yml

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: orders
      POSTGRES_USER: orders
      POSTGRES_PASSWORD: orders
    ports:
      - "5432:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./database-init.sql:/docker-entrypoint-initdb.d/database-init.sql:ro

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes

volumes:
  postgres-data:
```

### Uruchomienie i test endpointu

#### Polecenia

```bash
docker compose up -d
dotnet restore Orders.Api/Orders.Api.csproj
dotnet run --project Orders.Api/Orders.Api.csproj
```

#### Przykładowy request

Do testu wymagany jest poprawnie podpisany token JWT z claimem `sub` zawierającym UUID klienta. Ten sam `Idempotency-Key` i ten sam klient zwrócą istniejące zamówienie zamiast utworzyć nowe.

```bash
curl --request POST "https://localhost:5001/api/v1/orders" \
  --header "Authorization: Bearer YOUR_JWT_TOKEN" \
  --header "Idempotency-Key: 6e2ebfd7-87cd-40e3-b8aa-6e3cf2bcf76c" \
  --header "Content-Type: application/json" \
  --data '{
    "lines": [
      {
        "productId": "11111111-1111-1111-1111-111111111111",
        "quantity": 1
      },
      {
        "productId": "22222222-2222-2222-2222-222222222222",
        "quantity": 2
      }
    ]
  }'
```

### Przepływ tworzenia zamówienia

1. Load balancer przekazuje request do dowolnej stateless repliki API.
2. JWT middleware weryfikuje podpis, issuer, audience i czas życia tokenu.
3. Rate limiter ogranicza liczbę zapisów, chroniąc pulę połączeń i PostgreSQL.
4. Kontroler waliduje payload oraz nagłówek `Idempotency-Key`.
5. Serwis sprawdza, czy klient wcześniej nie utworzył zamówienia z tym samym kluczem.
6. Produkty i ich ceny są pobierane z Redis albo PostgreSQL. Cena z requestu klienta nie jest akceptowana.
7. Zamówienie, pozycje i wiadomość Outbox są zapisywane w jednej transakcji.
8. W razie wyścigu równoległych requestów unikalny indeks PostgreSQL zapewnia, że powstanie tylko jedno zamówienie.
9. Osobny worker powinien odczytywać nieprzetworzone rekordy Outbox przez `FOR UPDATE SKIP LOCKED`, publikować je do brokera i oznaczać jako przetworzone.

### Obsługa błędów, logging i monitoring

- **400 Bad Request:** niepoprawny JSON, brak lub błędny klucz idempotencji, błędy walidacji pól.
- **401 Unauthorized:** brak tokenu JWT albo token niepoprawny.
- **403 Forbidden:** token nie zawiera poprawnego claimu `sub`.
- **404 Not Found:** zamówienie nie istnieje lub nie należy do aktualnego klienta.
- **422 Unprocessable Entity:** produkt nieaktywny albo nie istnieje.
- **429 Too Many Requests:** przekroczony limit requestów.
- **500 Internal Server Error:** nieobsłużony błąd; szczegóły są wyłącznie w logach, a klient otrzymuje bezpieczny Problem Details.

Serilog zapisuje ustrukturyzowane logi. W środowisku produkcyjnym należy wysyłać je do centralnego systemu, na przykład Elasticsearch, Grafana Loki, Datadog lub Azure Application Insights. Nie należy logować tokenów JWT, haseł, pełnych danych osobowych ani danych kart płatniczych.

Endpoint `/metrics` udostępnia metryki Prometheus. Alarmy powinny obejmować: wzrost 5xx, p95/p99 latency, liczbę 429, wyczerpanie puli połączeń, opóźnienie Outbox, błędy Redis i niedostępność PostgreSQL. Endpoint `/health/live` jest przeznaczony dla liveness probe, a `/health/ready` dla readiness probe.

### Zabezpieczenia i zalecenia produkcyjne

- Wymuszać HTTPS, HSTS oraz TLS pomiędzy usługami wewnętrznymi.
- Przechowywać sekrety poza konfiguracją aplikacji i regularnie je rotować.
- Użyć krótkiego czasu życia access tokenów oraz OAuth 2.0/OpenID Connect z zewnętrznym Identity Providerem.
- Stosować polityki autoryzacji, na przykład role `orders.write` i `orders.read`, zamiast polegać tylko na uwierzytelnieniu.
- Wprowadzić maksymalny rozmiar body requestu na poziomie reverse proxy i ASP.NET Core.
- Stosować WAF, ochronę DDoS i rate limiting per użytkownik/IP/API key. W środowisku wieloreplikowym limit powinien być rozproszony, na przykład oparty o Redis.
- Używać osobnych kont bazodanowych z minimalnymi uprawnieniami oraz szyfrowania danych at rest.
- Regularnie wykonywać backupy PostgreSQL i okresowo testować procedurę odtworzenia.
- Nie uruchamiać migracji schematu automatycznie przez każdą replikę aplikacji. Migracje powinny być wykonywane jednokrotnie przez pipeline wdrożeniowy.
- Dla płatności nigdy nie przechowywać danych kart; użyć certyfikowanego operatora płatności i tokenizacji.
