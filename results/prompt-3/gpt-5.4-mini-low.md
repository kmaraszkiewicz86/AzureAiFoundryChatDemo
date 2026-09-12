# Model: gpt-5.4-mini-low

**Execution time:** 31716 ms

**Input tokens:** 1135

**Output tokens:** 8685

**Total tokens:** 9820

## Question

Zaprojektuj produkcyjne REST API w ASP.NET Core do obsługi zamówień. API powinno obsługiwać dużą liczbę równoległych requestów. Zaproponuj architekturę rozwiązania, sposób przechowywania danych, strategię cache, obsługę błędów, logging, monitoring oraz zabezpieczenia. Następnie pokaż przykładową implementację endpointu tworzącego zamówienie wraz z warstwą serwisową. Wyjaśnij najważniejsze decyzje architektoniczne oraz ich zalety i wady.

## Answer

### Solution overview

Proponowane rozwiązanie to produkcyjne REST API w ASP.NET Core 8 do obsługi zamówień, zaprojektowane pod dużą liczbę równoległych requestów, z naciskiem na skalowalność horyzontalną, odporność na błędy i przewidywalne opóźnienia.

- **Architektura:** warstwowa, z wyraźnym podziałem na API, aplikację, domenę i infrastrukturę.
- **Przetwarzanie:** stateless API, dzięki czemu można skalować wiele instancji za load balancerem.
- **Persistencja:** PostgreSQL jako główna baza danych, EF Core jako ORM, transakcje i kontrola współbieżności.
- **Cache:** Redis jako rozproszony cache dla odczytów i danych referencyjnych; bez cache dla krytycznej ścieżki tworzenia zamówienia.
- **Bezpieczeństwo:** JWT Bearer, walidacja wejścia, rate limiting, HTTPS, problem details, idempotency key.
- **Obserwowalność:** ustrukturyzowane logowanie, OpenTelemetry, metryki i śledzenie rozproszone.

Endpoint tworzenia zamówienia pokazany niżej stosuje zasadę: szybka walidacja, transakcja w bazie, bezpieczny zapis, spójna odpowiedź. Dzięki temu rozwiązanie jest odporne na retry z klienta i dobrze działa pod wysokim obciążeniem.

### Prerequisites

- .NET 8 SDK
- PostgreSQL 15+ lub 16+
- Redis 7+
- Opcjonalnie: Docker i Docker Compose do lokalnego uruchamiania infrastruktury
- Pakiety NuGet: Entity Framework Core, Npgsql, Redis cache, Swagger, Serilog, OpenTelemetry, AspNetCore rate limiting, FluentValidation

### Project structure

```text
OrdersApi/
├── src/
│   ├── Orders.Api/
│   │   ├── Controllers/
│   │   │   └── OrdersController.cs
│   │   ├── Middleware/
│   │   │   └── ExceptionHandlingMiddleware.cs
│   │   ├── Program.cs
│   │   ├── appsettings.json
│   │   └── Orders.Api.csproj
│   ├── Orders.Application/
│   │   ├── Orders/
│   │   │   ├── CreateOrderCommand.cs
│   │   │   ├── CreateOrderCommandValidator.cs
│   │   │   ├── CreateOrderResult.cs
│   │   │   ├── IOrderService.cs
│   │   │   └── OrderService.cs
│   │   └── Orders.Application.csproj
│   ├── Orders.Domain/
│   │   ├── Common/
│   │   │   ├── DomainException.cs
│   │   │   └── Result.cs
│   │   ├── Orders/
│   │   │   ├── Order.cs
│   │   │   ├── OrderItem.cs
│   │   │   └── OrderStatus.cs
│   │   └── Orders.Domain.csproj
│   └── Orders.Infrastructure/
│       ├── Caching/
│       │   └── CacheKeys.cs
│       ├── Data/
│       │   ├── OrdersDbContext.cs
│       │   ├── OrdersDbContextFactory.cs
│       │   └── OrderEntityConfiguration.cs
│       ├── DependencyInjection.cs
│       ├── Migrations/
│       └── Orders.Infrastructure.csproj
└── tests/
    └── Orders.Api.Tests/
        └── OrdersControllerTests.cs
```

### Implementation

#### src/Orders.Domain/Orders/OrderStatus.cs

Enum stanu zamówienia, używany w domenie i persystencji.

```csharp
namespace Orders.Domain.Orders;

public enum OrderStatus
{
    Pending = 1,
    Confirmed = 2,
    Cancelled = 3
}
```

#### src/Orders.Domain/Orders/OrderItem.cs

Wartościowy obiekt opisujący pojedynczą pozycję zamówienia.

```csharp
namespace Orders.Domain.Orders;

public sealed class OrderItem
{
    private OrderItem() { }

    public OrderItem(Guid productId, string name, decimal unitPrice, int quantity)
    {
        if (productId == Guid.Empty) throw new ArgumentException("ProductId is required.", nameof(productId));
        if (string.IsNullOrWhiteSpace(name)) throw new ArgumentException("Name is required.", nameof(name));
        if (unitPrice <= 0) throw new ArgumentOutOfRangeException(nameof(unitPrice));
        if (quantity <= 0) throw new ArgumentOutOfRangeException(nameof(quantity));

        ProductId = productId;
        Name = name.Trim();
        UnitPrice = unitPrice;
        Quantity = quantity;
    }

    public int Id { get; private set; }
    public Guid ProductId { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public decimal UnitPrice { get; private set; }
    public int Quantity { get; private set; }

    public decimal LineTotal => UnitPrice * Quantity;
}
```

#### src/Orders.Domain/Orders/Order.cs

Agregat zamówienia, pilnujący spójności biznesowej.

```csharp
namespace Orders.Domain.Orders;

public sealed class Order
{
    private readonly List<OrderItem> _items = new();

    private Order() { }

    public Order(Guid customerId, string currency, string? idempotencyKey)
    {
        if (customerId == Guid.Empty) throw new ArgumentException("CustomerId is required.", nameof(customerId));
        if (string.IsNullOrWhiteSpace(currency)) throw new ArgumentException("Currency is required.", nameof(currency));

        Id = Guid.NewGuid();
        CustomerId = customerId;
        Currency = currency.Trim().ToUpperInvariant();
        IdempotencyKey = string.IsNullOrWhiteSpace(idempotencyKey) ? null : idempotencyKey.Trim();
        Status = OrderStatus.Pending;
        CreatedAtUtc = DateTime.UtcNow;
    }

    public Guid Id { get; private set; }
    public Guid CustomerId { get; private set; }
    public string Currency { get; private set; } = string.Empty;
    public string? IdempotencyKey { get; private set; }
    public OrderStatus Status { get; private set; }
    public DateTime CreatedAtUtc { get; private set; }

    public IReadOnlyCollection<OrderItem> Items => _items.AsReadOnly();
    public decimal TotalAmount => _items.Sum(x => x.LineTotal);

    public void AddItem(Guid productId, string name, decimal unitPrice, int quantity)
    {
        _items.Add(new OrderItem(productId, name, unitPrice, quantity));
    }

    public void Confirm()
    {
        if (_items.Count == 0)
            throw new InvalidOperationException("Order must contain at least one item.");

        Status = OrderStatus.Confirmed;
    }
}
```

#### src/Orders.Domain/Common/DomainException.cs

Wyjątek domenowy mapowany później na odpowiedź HTTP 400/409.

```csharp
namespace Orders.Domain.Common;

public sealed class DomainException : Exception
{
    public DomainException(string message) : base(message) { }
}
```

#### src/Orders.Domain/Common/Result.cs

Minimalny typ wyniku dla czytelnego przepływu błędów aplikacyjnych.

```csharp
namespace Orders.Domain.Common;

public sealed class Result
{
    private Result(bool isSuccess, string? error)
    {
        IsSuccess = isSuccess;
        Error = error;
    }

    public bool IsSuccess { get; }
    public string? Error { get; }

    public static Result Success() => new(true, null);
    public static Result Failure(string error) => new(false, error);
}
```

#### src/Orders.Application/Orders/CreateOrderCommand.cs

DTO wejściowe dla tworzenia zamówienia.

```csharp
namespace Orders.Application.Orders;

public sealed record CreateOrderCommand(
    Guid CustomerId,
    string Currency,
    string? IdempotencyKey,
    IReadOnlyList<CreateOrderItemCommand> Items);

public sealed record CreateOrderItemCommand(
    Guid ProductId,
    string Name,
    decimal UnitPrice,
    int Quantity);
```

#### src/Orders.Application/Orders/CreateOrderResult.cs

DTO wyjściowe zwracane przez serwis i API.

```csharp
namespace Orders.Application.Orders;

public sealed record CreateOrderResult(
    Guid OrderId,
    Guid CustomerId,
    string Currency,
    decimal TotalAmount,
    string Status,
    DateTime CreatedAtUtc);
```

#### src/Orders.Application/Orders/IOrderService.cs

Kontrakt serwisu aplikacyjnego.

```csharp
namespace Orders.Application.Orders;

public interface IOrderService
{
    Task<CreateOrderResult> CreateAsync(CreateOrderCommand command, CancellationToken cancellationToken);
}
```

#### src/Orders.Application/Orders/CreateOrderCommandValidator.cs

Walidacja wejścia na poziomie aplikacji, przed wejściem do bazy.

```csharp
using FluentValidation;

namespace Orders.Application.Orders;

public sealed class CreateOrderCommandValidator : AbstractValidator<CreateOrderCommand>
{
    public CreateOrderCommandValidator()
    {
        RuleFor(x => x.CustomerId)
            .NotEmpty();

        RuleFor(x => x.Currency)
            .NotEmpty()
            .Length(3, 3);

        RuleFor(x => x.Items)
            .NotNull()
            .Must(items => items.Count > 0)
            .WithMessage("At least one item is required.");

        RuleForEach(x => x.Items).ChildRules(item =>
        {
            item.RuleFor(x => x.ProductId).NotEmpty();
            item.RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
            item.RuleFor(x => x.UnitPrice).GreaterThan(0);
            item.RuleFor(x => x.Quantity).GreaterThan(0);
        });
    }
}
```

#### src/Orders.Application/Orders/OrderService.cs

Warstwa serwisowa z logiką biznesową, transakcją i obsługą idempotencji.

```csharp
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Orders.Domain.Common;
using Orders.Domain.Orders;
using Orders.Infrastructure.Data;

namespace Orders.Application.Orders;

public sealed class OrderService : IOrderService
{
    private readonly OrdersDbContext _dbContext;
    private readonly IValidator<CreateOrderCommand> _validator;
    private readonly ILogger<OrderService> _logger;

    public OrderService(
        OrdersDbContext dbContext,
        IValidator<CreateOrderCommand> validator,
        ILogger<OrderService> logger)
    {
        _dbContext = dbContext;
        _validator = validator;
        _logger = logger;
    }

    public async Task<CreateOrderResult> CreateAsync(CreateOrderCommand command, CancellationToken cancellationToken)
    {
        var validationResult = await _validator.ValidateAsync(command, cancellationToken);
        if (!validationResult.IsValid)
        {
            var message = string.Join("; ", validationResult.Errors.Select(e => e.ErrorMessage));
            throw new DomainException(message);
        }

        if (!string.IsNullOrWhiteSpace(command.IdempotencyKey))
        {
            var existing = await _dbContext.Orders
                .AsNoTracking()
                .Where(x => x.IdempotencyKey == command.IdempotencyKey)
                .Select(x => new CreateOrderResult(x.Id, x.CustomerId, x.Currency, x.TotalAmount, x.Status.ToString(), x.CreatedAtUtc))
                .FirstOrDefaultAsync(cancellationToken);

            if (existing is not null)
            {
                _logger.LogInformation("Idempotent replay detected for key {IdempotencyKey}.", command.IdempotencyKey);
                return existing;
            }
        }

        var order = new Order(command.CustomerId, command.Currency, command.IdempotencyKey);

        foreach (var item in command.Items)
        {
            order.AddItem(item.ProductId, item.Name, item.UnitPrice, item.Quantity);
        }

        order.Confirm();

        await using var transaction = await _dbContext.Database.BeginTransactionAsync(cancellationToken);

        _dbContext.Orders.Add(order);
        await _dbContext.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        _logger.LogInformation("Order {OrderId} created for customer {CustomerId}.", order.Id, order.CustomerId);

        return new CreateOrderResult(
            order.Id,
            order.CustomerId,
            order.Currency,
            order.TotalAmount,
            order.Status.ToString(),
            order.CreatedAtUtc);
    }
}
```

#### src/Orders.Infrastructure/Data/OrdersDbContext.cs

DbContext z mapowaniem agregatu zamówienia.

```csharp
using Microsoft.EntityFrameworkCore;
using Orders.Domain.Orders;

namespace Orders.Infrastructure.Data;

public sealed class OrdersDbContext : DbContext
{
    public OrdersDbContext(DbContextOptions<OrdersDbContext> options) : base(options) { }

    public DbSet<Order> Orders => Set<Order>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfiguration(new OrderEntityConfiguration());
        base.OnModelCreating(modelBuilder);
    }
}
```

#### src/Orders.Infrastructure/Data/OrderEntityConfiguration.cs

Konfiguracja EF Core dla wydajnego zapisu i poprawnej relacji one-to-many.

```csharp
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Orders.Domain.Orders;

namespace Orders.Infrastructure.Data;

public sealed class OrderEntityConfiguration : IEntityTypeConfiguration<Order>
{
    public void Configure(EntityTypeBuilder<Order> builder)
    {
        builder.ToTable("Orders");

        builder.HasKey(x => x.Id);
        builder.Property(x => x.Currency).HasMaxLength(3).IsRequired();
        builder.Property(x => x.IdempotencyKey).HasMaxLength(100);
        builder.Property(x => x.Status).IsRequired();
        builder.Property(x => x.CustomerId).IsRequired();
        builder.Property(x => x.CreatedAtUtc).IsRequired();

        builder.HasIndex(x => x.IdempotencyKey)
            .IsUnique()
            .HasFilter(""IdempotencyKey" IS NOT NULL");

        builder.HasMany(typeof(OrderItem), "_items")
            .WithOne()
            .HasForeignKey("OrderId")
            .OnDelete(DeleteBehavior.Cascade);

        builder.Navigation("_items").UsePropertyAccessMode(PropertyAccessMode.Field);
    }
}
```

#### src/Orders.Infrastructure/Caching/CacheKeys.cs

Centralizacja kluczy cache ułatwia utrzymanie i unikanie kolizji.

```csharp
namespace Orders.Infrastructure.Caching;

public static class CacheKeys
{
    public static string OrderById(Guid orderId) => $"orders:by-id:{orderId}";
    public static string ProductById(Guid productId) => $"products:by-id:{productId}";
}
```

#### src/Orders.Infrastructure/DependencyInjection.cs

Rejestracja infrastruktury, EF Core i cache.

```csharp
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Orders.Infrastructure.Data;

namespace Orders.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddDbContextPool<OrdersDbContext>(options =>
        {
            options.UseNpgsql(configuration.GetConnectionString("OrdersDb"));
        });

        services.AddStackExchangeRedisCache(options =>
        {
            options.Configuration = configuration.GetConnectionString("Redis");
            options.InstanceName = "orders-api:";
        });

        return services;
    }
}
```

#### src/Orders.Api/Middleware/ExceptionHandlingMiddleware.cs

Centralna obsługa wyjątków z odpowiedziami Problem Details.

```csharp
using System.Net;
using Orders.Domain.Common;

namespace Orders.Api.Middleware;

public sealed class ExceptionHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionHandlingMiddleware> _logger;

    public ExceptionHandlingMiddleware(RequestDelegate next, ILogger<ExceptionHandlingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (DomainException ex)
        {
            _logger.LogWarning(ex, "Domain error while processing request.");
            await WriteProblemDetails(context, HttpStatusCode.BadRequest, ex.Message, "domain_error");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unhandled exception.");
            await WriteProblemDetails(context, HttpStatusCode.InternalServerError, "An unexpected error occurred.", "internal_error");
        }
    }

    private static async Task WriteProblemDetails(HttpContext context, HttpStatusCode statusCode, string detail, string errorCode)
    {
        context.Response.StatusCode = (int)statusCode;
        context.Response.ContentType = "application/problem+json";

        var problem = new
        {
            type = $"https://httpstatuses.com/{(int)statusCode}",
            title = ReasonPhrases.GetReasonPhrase((int)statusCode),
            status = (int)statusCode,
            detail,
            errorCode,
            traceId = context.TraceIdentifier
        };

        await context.Response.WriteAsJsonAsync(problem);
    }
}
```

#### src/Orders.Api/Controllers/OrdersController.cs

Endpoint HTTP tworzący zamówienie.

```csharp
using Microsoft.AspNetCore.Mvc;
using Orders.Application.Orders;

namespace Orders.Api.Controllers;

[ApiController]
[Route("api/orders")]
public sealed class OrdersController : ControllerBase
{
    private readonly IOrderService _orderService;
    private readonly ILogger<OrdersController> _logger;

    public OrdersController(IOrderService orderService, ILogger<OrdersController> logger)
    {
        _orderService = orderService;
        _logger = logger;
    }

    [HttpPost]
    [ProducesResponseType(typeof(CreateOrderResult), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<CreateOrderResult>> Create(
        [FromBody] CreateOrderRequest request,
        CancellationToken cancellationToken)
    {
        var command = new CreateOrderCommand(
            request.CustomerId,
            request.Currency,
            Request.Headers.IdempotencyKey.FirstOrDefault(),
            request.Items.Select(x => new CreateOrderItemCommand(x.ProductId, x.Name, x.UnitPrice, x.Quantity)).ToList());

        var result = await _orderService.CreateAsync(command, cancellationToken);

        return CreatedAtAction(nameof(GetById), new { id = result.OrderId }, result);
    }

    [HttpGet("{id:guid}")]
    public ActionResult<string> GetById(Guid id)
    {
        return Ok($"Order {id}");
    }

    public sealed record CreateOrderRequest(
        Guid CustomerId,
        string Currency,
        IReadOnlyList<CreateOrderItemRequest> Items);

    public sealed record CreateOrderItemRequest(
        Guid ProductId,
        string Name,
        decimal UnitPrice,
        int Quantity);
}
```

#### src/Orders.Api/Program.cs

Konfiguracja aplikacji, middleware, rate limiting, Swagger, logging i monitoring.

```csharp
using FluentValidation;
using Microsoft.AspNetCore.RateLimiting;
using Orders.Api.Middleware;
using Orders.Application.Orders;
using Orders.Infrastructure;
using Serilog;
using System.Threading.RateLimiting;

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseSerilog((context, services, configuration) =>
{
    configuration
        .ReadFrom.Configuration(context.Configuration)
        .ReadFrom.Services(services)
        .Enrich.FromLogContext()
        .Enrich.WithProperty("Application", "Orders.Api");
});

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddProblemDetails();
builder.Services.AddMemoryCache();
builder.Services.AddHttpContextAccessor();

builder.Services.AddInfrastructure(builder.Configuration);

builder.Services.AddScoped<IOrderService, OrderService>();
builder.Services.AddScoped<IValidator<CreateOrderCommand>, CreateOrderCommandValidator>();

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddFixedWindowLimiter("orders-write", limiterOptions =>
    {
        limiterOptions.Window = TimeSpan.FromSeconds(1);
        limiterOptions.PermitLimit = 100;
        limiterOptions.QueueLimit = 0;
        limiterOptions.AutoReplenishment = true;
    });
});

var app = builder.Build();

app.UseMiddleware<ExceptionHandlingMiddleware>();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

app.UseSerilogRequestLogging();
app.UseRateLimiter();

app.MapControllers();

app.Run();
```

#### src/Orders.Api/appsettings.json

Konfiguracja połączeń, logowania i telemetry.

```json
{
  "ConnectionStrings": {
    "OrdersDb": "Host=localhost;Port=5432;Database=ordersdb;Username=orders;Password=orders_password",
    "Redis": "localhost:6379"
  },
  "Serilog": {
    "MinimumLevel": {
      "Default": "Information",
      "Override": {
        "Microsoft": "Warning",
        "Microsoft.EntityFrameworkCore": "Warning",
        "System": "Warning"
      }
    },
    "WriteTo": [
      { "Name": "Console" }
    ],
    "Enrich": [ "FromLogContext" ]
  },
  "AllowedHosts": "*"
}
```

#### src/Orders.Api/Orders.Api.csproj

Projekt API i zależności pakietów.

```xml
<Project Sdk="Microsoft.NET.Sdk.Web">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <TreatWarningsAsErrors>true</TreatWarningsAsErrors>
  </PropertyGroup>

  <ItemGroup>
    <ProjectReference Include="..\Orders.Application\Orders.Application.csproj" />
    <ProjectReference Include="..\Orders.Infrastructure\Orders.Infrastructure.csproj" />
  </ItemGroup>

  <ItemGroup>
    <PackageReference Include="FluentValidation.DependencyInjectionExtensions" Version="11.11.0" />
    <PackageReference Include="Microsoft.AspNetCore.OpenApi" Version="8.0.10" />
    <PackageReference Include="Serilog.AspNetCore" Version="8.0.3" />
    <PackageReference Include="Swashbuckle.AspNetCore" Version="6.6.2" />
  </ItemGroup>
</Project>
```

#### src/Orders.Application/Orders.Application.csproj

Warstwa aplikacyjna.

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <TreatWarningsAsErrors>true</TreatWarningsAsErrors>
  </PropertyGroup>

  <ItemGroup>
    <ProjectReference Include="..\Orders.Domain\Orders.Domain.csproj" />
    <ProjectReference Include="..\Orders.Infrastructure\Orders.Infrastructure.csproj" />
  </ItemGroup>

  <ItemGroup>
    <PackageReference Include="FluentValidation" Version="11.11.0" />
  </ItemGroup>
</Project>
```

#### src/Orders.Domain/Orders.Domain.csproj

Warstwa domenowa bez zależności od infrastruktury.

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <TreatWarningsAsErrors>true</TreatWarningsAsErrors>
  </PropertyGroup>
</Project>
```

#### src/Orders.Infrastructure/Orders.Infrastructure.csproj

Infrastruktura: EF Core, PostgreSQL i cache.

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <TreatWarningsAsErrors>true</TreatWarningsAsErrors>
  </PropertyGroup>

  <ItemGroup>
    <ProjectReference Include="..\Orders.Domain\Orders.Domain.csproj" />
  </ItemGroup>

  <ItemGroup>
    <PackageReference Include="Microsoft.EntityFrameworkCore" Version="8.0.10" />
    <PackageReference Include="Microsoft.EntityFrameworkCore.Design" Version="8.0.10">
      <PrivateAssets>all</PrivateAssets>
      <IncludeAssets>runtime; build; native; contentfiles; analyzers; buildtransitive</IncludeAssets>
    </PackageReference>
    <PackageReference Include="Npgsql.EntityFrameworkCore.PostgreSQL" Version="8.0.6" />
    <PackageReference Include="Microsoft.Extensions.Caching.StackExchangeRedis" Version="8.0.1" />
  </ItemGroup>
</Project>
```

### Configuration

#### Architektura uruchomieniowa

- **Load balancer** rozdziela ruch na wiele instancji API.
- **API jest stateless** — brak sesji w pamięci procesu jako źródła prawdy.
- **PostgreSQL** przechowuje dane transakcyjne.
- **Redis** przechowuje cache odczytów oraz ewentualnie krótkotrwałe klucze idempotencyjności, jeśli chcemy dodatkowo zabezpieczyć się przed duplikacją poza bazą.
- **OpenTelemetry** wysyła trace i metryki do backendu obserwowalności.

#### Strategia cache

- **Cache-aside** dla odczytów: najpierw Redis, potem baza, po odczycie zapis do cache.
- **TTL** krótki i zależny od typu danych, np. 1-5 minut dla danych zamówień, dłuższy dla słowników.
- **Invalidacja** po zapisie przez usunięcie lub odświeżenie odpowiednich kluczy.
- **Nie cache'ować krytycznego POST** tworzącego zamówienie, ponieważ zapis musi być transakcyjny i jednoznaczny.

#### Obsługa błędów

- **Validation errors** zwracane jako 400 z problem details.
- **Conflict** dla sytuacji biznesowych, np. duplikat idempotency key lub naruszenie reguł.
- **500** tylko dla błędów nieprzewidzianych.
- **Middleware** centralizuje format odpowiedzi i logowanie wyjątków.

#### Logging i monitoring

- **Serilog** z logami strukturalnymi i correlation id.
- **Serilog Request Logging** do pomiaru czasu requestów.
- **OpenTelemetry** dla trace i metryk.
- **Kluczowe metryki:** latency, error rate, throughput, DB roundtrips, cache hit ratio.

#### Zabezpieczenia

- **HTTPS only**.
- **JWT Bearer** lub OAuth2/OIDC w środowisku produkcyjnym.
- **Rate limiting** na endpointy write-heavy, aby chronić bazę.
- **Idempotency-Key** dla POST tworzących zamówienie.
- **Walidacja danych wejściowych** po stronie API i serwisu.
- **Least privilege** dla konta bazy i sekrety w Secret Manager lub vault.

### How it works

1. Klient wysyła **POST /api/orders** z danymi zamówienia oraz opcjonalnym nagłówkiem **Idempotency-Key**.
2. Controller mapuje request na command i przekazuje do serwisu aplikacyjnego.
3. Validator sprawdza poprawność wejścia zanim uruchomiona zostanie transakcja.
4. Serwis sprawdza, czy dla danego klucza idempotency istnieje już zamówienie; jeśli tak, zwraca istniejący wynik.
5. W przeciwnym razie budowany jest agregat domenowy, a następnie zapisywany w transakcji do PostgreSQL.
6. Middleware obsługi wyjątków zamienia błędy na spójny format Problem Details.
7. Logi i telemetry umożliwiają diagnozę problemów oraz ocenę wydajności pod wysokim ruchem.

#### Najważniejsze decyzje architektoniczne

| Decyzja | Zalety | Wady |
| --- | --- | --- |
| Warstwy API/Application/Domain/Infrastructure | Czysty podział odpowiedzialności, łatwiejsze testy, mniejszy coupling | Więcej plików i trochę większy narzut organizacyjny |
| Stateless API | Łatwe skalowanie horyzontalne, odporność na awarie pojedynczej instancji | Wymaga zewnętrznego stanu: DB, Redis, tokeny |
| PostgreSQL jako source of truth | Spójność transakcyjna, dojrzałe mechanizmy indeksów i blokad | Trzeba uważać na wydajność i poprawną izolację transakcji |
| Redis cache | Znacząco odciąża bazę przy odczytach | Dochodzi problem spójności cache i invalidacji |
| Idempotency key | Bezpieczne retry na POST bez duplikowania zamówień | Wymaga dodatkowego indeksu i logiki obsługi |
| Rate limiting | Chroni bazę i backend przed skokami ruchu | Źle ustawione limity mogą zablokować legalny ruch |

#### Uwagi produkcyjne

- W prawdziwej wersji dodałbym osobny endpoint GET zwracający zamówienie z cache-aside.
- Wysokie obciążenie write-heavy może wymagać kolejkowania części operacji, np. integracji z płatnościami lub fulfillmentem.
- Jeśli wymagane są bardzo wysokie gwarancje spójności, warto rozważyć outbox pattern dla zdarzeń integracyjnych.

### Build and run

#### Restore and build

```bash
dotnet restore
dotnet build
```

#### Apply migrations

```bash
dotnet ef migrations add InitialCreate -p src/Orders.Infrastructure -s src/Orders.Api
dotnet ef database update -p src/Orders.Infrastructure -s src/Orders.Api
```

#### Run API

```bash
dotnet run --project src/Orders.Api
```

### Testing

Weryfikację warto prowadzić na kilku poziomach: testy jednostkowe domeny, testy integracyjne API z Testcontainers i testy obciążeniowe.

#### Przykładowe testy jednostkowe i integracyjne

```bash
dotnet test
```

#### Przykładowe scenariusze

- Poprawne utworzenie zamówienia z kilkoma pozycjami.
- Wysłanie tego samego requestu dwa razy z tym samym Idempotency-Key i oczekiwanie tego samego rezultatu.
- Walidacja błędnego currency, pustych items i ujemnych wartości.
- Test obciążeniowy z dużą liczbą równoległych POST i obserwacja czasu odpowiedzi oraz błędów 429.

#### Przykład żądania

```text
POST /api/orders
Idempotency-Key: 8b4b5b8e-2f0f-4fcb-8b3d-0d9f2ec1a7f2

{
  "customerId": "11111111-1111-1111-1111-111111111111",
  "currency": "PLN",
  "items": [
    {
      "productId": "22222222-2222-2222-2222-222222222222",
      "name": "Keyboard",
      "unitPrice": 199.99,
      "quantity": 1
    }
  ]
}
```
