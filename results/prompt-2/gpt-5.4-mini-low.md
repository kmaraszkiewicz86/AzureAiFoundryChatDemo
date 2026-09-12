# Model: gpt-5.4-mini-low

**Execution time:** 18147 ms

**Input tokens:** 1093

**Output tokens:** 3475

**Total tokens:** 4568

## Question

Stwórz proste REST API w ASP.NET Core do zarządzania listą produktów. Dodaj endpointy GET, POST i DELETE. Użyj kontrolerów, Dependency Injection, async/await oraz walidacji danych wejściowych. Dane mogą być przechowywane w pamięci. Pokaż wszystkie wymagane klasy oraz krótko opisz strukturę rozwiązania.

## Answer

### Solution overview

To rozwiązanie przedstawia proste REST API w ASP.NET Core do zarządzania listą produktów. API udostępnia endpointy **GET**, **POST** i **DELETE**, korzysta z **kontrolera**, **Dependency Injection**, **async/await** oraz **walidacji danych wejściowych**. Dane są przechowywane w pamięci, więc aplikacja nie wymaga bazy danych ani dodatkowej infrastruktury.

Architektura jest celowo prosta, ale zgodna z dobrymi praktykami: warstwa API jest oddzielona od logiki biznesowej przez interfejs serwisu, a odpowiedzialność za przechowywanie danych w pamięci jest wydzielona do osobnej klasy. Dzięki temu kod jest łatwy do testowania, rozszerzania i późniejszej podmiany magazynu danych na bazę danych.

### Prerequisites

- .NET 8 SDK
- ASP.NET Core Web API
- Dowolne narzędzie do testowania HTTP, np. Swagger UI, Postman lub curl

W tym przykładzie nie są potrzebne żadne dodatkowe paczki NuGet, ponieważ wykorzystujemy wyłącznie wbudowane funkcje ASP.NET Core.

### Project structure

```text
ProductApi/
├── Controllers/
│   └── ProductsController.cs
├── Models/
│   ├── Product.cs
│   ├── ProductCreateRequest.cs
│   └── ProductResponse.cs
├── Services/
│   ├── IProductService.cs
│   └── InMemoryProductService.cs
├── Program.cs
└── ProductApi.csproj
```

### Implementation

#### ProductApi.csproj

Plik projektu definiuje aplikację webową opartą o .NET 8 i nie wymaga dodatkowych zależności.

```xml
<Project Sdk="Microsoft.NET.Sdk.Web">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <TreatWarningsAsErrors>true</TreatWarningsAsErrors>
  </PropertyGroup>
</Project>
```

#### Program.cs

Punkt startowy aplikacji rejestruje kontrolery, usługę produktów w DI oraz Swagger do wygodnego testowania endpointów.

```csharp
using ProductApi.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddSingleton<IProductService, InMemoryProductService>();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.MapControllers();

app.Run();
```

#### Models/Product.cs

Model domenowy reprezentuje produkt przechowywany w pamięci. Zawiera identyfikator, nazwę, cenę oraz datę utworzenia.

```csharp
namespace ProductApi.Models;

public sealed record Product(
    Guid Id,
    string Name,
    decimal Price,
    DateTime CreatedAtUtc);
```

#### Models/ProductCreateRequest.cs

Model żądania dla endpointu POST wykorzystuje atrybuty walidacyjne, aby kontroler automatycznie odrzucał niepoprawne dane.

```csharp
using System.ComponentModel.DataAnnotations;

namespace ProductApi.Models;

public sealed class ProductCreateRequest
{
    [Required]
    [StringLength(100, MinimumLength = 2)]
    public string Name { get; init; } = string.Empty;

    [Range(typeof(decimal), "0.01", "999999999.99")]
    public decimal Price { get; init; }
}
```

#### Models/ProductResponse.cs

Model odpowiedzi pozwala oddzielić kontrakt API od wewnętrznego modelu danych i zwraca spójny format odpowiedzi.

```csharp
namespace ProductApi.Models;

public sealed record ProductResponse(
    Guid Id,
    string Name,
    decimal Price,
    DateTime CreatedAtUtc);
```

#### Services/IProductService.cs

Interfejs serwisu definiuje kontrakt dla operacji na produktach i umożliwia łatwą podmianę implementacji w przyszłości.

```csharp
using ProductApi.Models;

namespace ProductApi.Services;

public interface IProductService
{
    Task<IReadOnlyCollection<Product>> GetAllAsync(CancellationToken cancellationToken);
    Task<Product?> GetByIdAsync(Guid id, CancellationToken cancellationToken);
    Task<Product> CreateAsync(string name, decimal price, CancellationToken cancellationToken);
    Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken);
}
```

#### Services/InMemoryProductService.cs

Implementacja przechowuje dane w pamięci i używa synchronizacji, aby była bezpieczna przy równoległych żądaniach. Metody są asynchroniczne zgodnie z wymaganiem, chociaż operacje in-memory są natychmiastowe.

```csharp
using System.Collections.Concurrent;
using ProductApi.Models;

namespace ProductApi.Services;

public sealed class InMemoryProductService : IProductService
{
    private readonly ConcurrentDictionary<Guid, Product> _products = new();

    public InMemoryProductService()
    {
        var seed1 = new Product(Guid.NewGuid(), "Laptop", 4499.99m, DateTime.UtcNow);
        var seed2 = new Product(Guid.NewGuid(), "Mysz", 99.90m, DateTime.UtcNow);
        _products[seed1.Id] = seed1;
        _products[seed2.Id] = seed2;
    }

    public Task<IReadOnlyCollection<Product>> GetAllAsync(CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        IReadOnlyCollection<Product> result = _products.Values
            .OrderBy(p => p.Name)
            .ToArray();

        return Task.FromResult(result);
    }

    public Task<Product?> GetByIdAsync(Guid id, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        _products.TryGetValue(id, out var product);
        return Task.FromResult(product);
    }

    public Task<Product> CreateAsync(string name, decimal price, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var product = new Product(
            Guid.NewGuid(),
            name.Trim(),
            price,
            DateTime.UtcNow);

        _products[product.Id] = product;
        return Task.FromResult(product);
    }

    public Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var removed = _products.TryRemove(id, out _);
        return Task.FromResult(removed);
    }
}
```

#### Controllers/ProductsController.cs

Kontroler wystawia endpointy REST: pobieranie listy produktów, dodawanie produktu i usuwanie po identyfikatorze. Walidacja modelu wejściowego odbywa się automatycznie dzięki **\[ApiController\]**.

```csharp
using Microsoft.AspNetCore.Mvc;
using ProductApi.Models;
using ProductApi.Services;

namespace ProductApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public sealed class ProductsController : ControllerBase
{
    private readonly IProductService _productService;

    public ProductsController(IProductService productService)
    {
        _productService = productService;
    }

    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyCollection<ProductResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyCollection<ProductResponse>>> GetAllAsync(CancellationToken cancellationToken)
    {
        var products = await _productService.GetAllAsync(cancellationToken);

        var response = products
            .Select(MapToResponse)
            .ToArray();

        return Ok(response);
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(ProductResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ProductResponse>> GetByIdAsync(Guid id, CancellationToken cancellationToken)
    {
        var product = await _productService.GetByIdAsync(id, cancellationToken);

        if (product is null)
        {
            return NotFound();
        }

        return Ok(MapToResponse(product));
    }

    [HttpPost]
    [ProducesResponseType(typeof(ProductResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<ProductResponse>> CreateAsync([FromBody] ProductCreateRequest request, CancellationToken cancellationToken)
    {
        var product = await _productService.CreateAsync(request.Name, request.Price, cancellationToken);
        var response = MapToResponse(product);

        return CreatedAtAction(nameof(GetByIdAsync), new { id = response.Id }, response);
    }

    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteAsync(Guid id, CancellationToken cancellationToken)
    {
        var removed = await _productService.DeleteAsync(id, cancellationToken);

        if (!removed)
        {
            return NotFound();
        }

        return NoContent();
    }

    private static ProductResponse MapToResponse(Product product)
        => new(product.Id, product.Name, product.Price, product.CreatedAtUtc);
}
```

### Configuration

Nie jest wymagany osobny plik konfiguracji poza standardowym **Program.cs**. Jeśli chcesz uruchamiać aplikację w środowisku deweloperskim z Swagger UI, wystarczy domyślne ustawienie **ASPNETCORE\_ENVIRONMENT=Development**.

Opcjonalnie można użyć pliku **launchSettings.json** w celu ustawienia portów i profilu uruchomieniowego. Poniżej przykładowa konfiguracja:

#### Properties/launchSettings.json

```json
{
  "profiles": {
    "ProductApi": {
      "commandName": "Project",
      "dotnetRunMessages": true,
      "launchBrowser": true,
      "applicationUrl": "https://localhost:7081;http://localhost:5081",
      "environmentVariables": {
        "ASPNETCORE_ENVIRONMENT": "Development"
      }
    }
  }
}
```

### Build and run

```bash
dotnet restore
dotnet build
dotnet run
```

Po uruchomieniu aplikacja będzie dostępna pod adresami wskazanymi w konfiguracji uruchomieniowej. W trybie Development Swagger UI będzie dostępny automatycznie.

### How it works

Żądanie HTTP trafia do **ProductsController**, który używa wstrzykniętego przez DI **IProductService**. Kontroler nie zna szczegółów przechowywania danych, dzięki czemu jest prosty i zgodny z zasadą pojedynczej odpowiedzialności.

Endpoint **GET /api/products** zwraca wszystkie produkty, **GET /api/products/{id}** pobiera pojedynczy produkt, **POST /api/products** tworzy nowy rekord, a **DELETE /api/products/{id}** usuwa produkt. W przypadku braku elementu zwracany jest status **404 Not Found**.

Walidacja wejścia działa na dwóch poziomach: atrybuty danych w **ProductCreateRequest** sprawdzają poprawność modelu, a atrybut **\[ApiController\]** automatycznie zwraca **400 Bad Request** dla niepoprawnego payloadu. Użycie **async/await** i tokenów anulowania zachowuje spójność z nowoczesnym stylem ASP.NET Core, nawet jeśli magazyn danych działa w pamięci.

Zastosowanie **ConcurrentDictionary** zwiększa bezpieczeństwo współbieżne przy wielu równoczesnych żądaniach. Dzięki temu aplikacja jest gotowa do lokalnego użycia i stanowi dobrą bazę pod późniejsze rozszerzenie o trwałe składowanie danych.

### Testing

Najprościej przetestować API przez Swagger UI lub curl. Poniżej przykładowe polecenia:

```bash
curl [https://localhost:7081/api/products](https://localhost:7081/api/products) -k

curl [https://localhost:7081/api/products](https://localhost:7081/api/products) \
  -k \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Klawiatura\",\"price\":249.99}"

curl -X DELETE [https://localhost:7081/api/products/{id](https://localhost:7081/api/products/{id)} -k
```

Weryfikacja poprawności powinna obejmować:

- otrzymanie listy produktów dla **GET**
- utworzenie produktu i zwrot **201 Created** dla **POST**
- odrzucenie pustej lub niepoprawnej nazwy oraz nieprawidłowej ceny
- zwrócenie **204 No Content** po poprawnym usunięciu
- zwrócenie **404 Not Found** przy próbie usunięcia lub pobrania nieistniejącego produktu
