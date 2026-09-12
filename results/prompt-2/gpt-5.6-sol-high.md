# Model: gpt-5.6-sol-high

**Execution time:** 60211 ms

**Input tokens:** 1093

**Output tokens:** 5258

**Total tokens:** 6351

## Question

Stwórz proste REST API w ASP.NET Core do zarządzania listą produktów. Dodaj endpointy GET, POST i DELETE. Użyj kontrolerów, Dependency Injection, async/await oraz walidacji danych wejściowych. Dane mogą być przechowywane w pamięci. Pokaż wszystkie wymagane klasy oraz krótko opisz strukturę rozwiązania.

## Answer

### Przegląd rozwiązania

Rozwiązanie implementuje proste REST API w ASP.NET Core na platformie .NET 10. API umożliwia pobieranie listy produktów, pobieranie pojedynczego produktu, dodawanie produktu oraz jego usuwanie.

- Kontroler oparty na atrybucie `[ApiController]`.
- Repozytorium w pamięci rejestrowane przez Dependency Injection.
- Asynchroniczne metody z obsługą `CancellationToken`.
- Walidacja żądań za pomocą Data Annotations.
- Bezpieczny dostęp współbieżny dzięki `ConcurrentDictionary` i `Interlocked`.
- Standardowe odpowiedzi HTTP: `200`, `201`, `204`, `400` i `404`.

### Wymagania

- .NET 10 SDK lub nowszy zgodny SDK.
- Dowolne IDE obsługujące ASP.NET Core, na przykład Visual Studio, JetBrains Rider albo Visual Studio Code.
- Nie są wymagane zewnętrzne pakiety NuGet.

### Struktura projektu

```text
ProductsApi/
├── Contracts/
│   └── CreateProductRequest.cs
├── Controllers/
│   └── ProductsController.cs
├── Models/
│   └── Product.cs
├── Repositories/
│   ├── IProductRepository.cs
│   └── InMemoryProductRepository.cs
├── ProductsApi.csproj
├── Program.cs
└── appsettings.json
```

Warstwa `Contracts` zawiera modele wejściowe API, `Models` reprezentuje dane domenowe, `Repositories` odpowiada za przechowywanie produktów, a `Controllers` udostępnia endpointy HTTP.

### Implementacja

#### ProductsApi.csproj

Projekt korzysta z zestawu SDK ASP.NET Core i nie wymaga dodatkowych zależności.

```xml
<Project Sdk="Microsoft.NET.Sdk.Web">

  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <InvariantGlobalization>false</InvariantGlobalization>
  </PropertyGroup>

</Project>
```

#### Program.cs

Punkt wejścia aplikacji konfiguruje kontrolery, odpowiedzi Problem Details oraz repozytorium jako singleton. Rejestracja singleton jest właściwa dla magazynu w pamięci, ponieważ wszystkie żądania muszą korzystać z tej samej kolekcji.

```csharp
using ProductsApi.Repositories;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddProblemDetails();

builder.Services.AddSingleton<IProductRepository, InMemoryProductRepository>();

var app = builder.Build();

app.UseExceptionHandler();
app.MapControllers();

app.Run();
```

#### Models/Product.cs

Model reprezentuje produkt zwracany klientowi.

```csharp
namespace ProductsApi.Models;

public sealed class Product
{
    public long Id { get; init; }

    public required string Name { get; init; }

    public string? Description { get; init; }

    public decimal Price { get; init; }

    public DateTimeOffset CreatedAtUtc { get; init; }
}
```

#### Contracts/CreateProductRequest.cs

Oddzielny model żądania uniemożliwia klientowi ustawianie identyfikatora i daty utworzenia. Atrybuty walidacyjne ograniczają długość tekstu i dopuszczalną cenę.

```csharp
using System.ComponentModel.DataAnnotations;

namespace ProductsApi.Contracts;

public sealed class CreateProductRequest
{
    [Required(ErrorMessage = "Nazwa produktu jest wymagana.")]
    [StringLength(
        100,
        MinimumLength = 2,
        ErrorMessage = "Nazwa produktu musi mieć od 2 do 100 znaków.")]
    public string Name { get; init; } = string.Empty;

    [StringLength(
        500,
        ErrorMessage = "Opis produktu może mieć maksymalnie 500 znaków.")]
    public string? Description { get; init; }

    [Range(
        typeof(decimal),
        "0.01",
        "999999999.99",
        ErrorMessage = "Cena musi mieścić się w zakresie od 0.01 do 999999999.99.")]
    public decimal Price { get; init; }
}
```

#### Repositories/IProductRepository.cs

Interfejs oddziela kontroler od konkretnego sposobu przechowywania danych. Implementację w pamięci można później zastąpić bazą danych bez zmiany kontrolera.

```csharp
using ProductsApi.Models;

namespace ProductsApi.Repositories;

public interface IProductRepository
{
    Task<IReadOnlyCollection<Product>> GetAllAsync(
        CancellationToken cancellationToken = default);

    Task<Product?> GetByIdAsync(
        long id,
        CancellationToken cancellationToken = default);

    Task<Product> CreateAsync(
        string name,
        string? description,
        decimal price,
        CancellationToken cancellationToken = default);

    Task<bool> DeleteAsync(
        long id,
        CancellationToken cancellationToken = default);
}
```

#### Repositories/InMemoryProductRepository.cs

Repozytorium przechowuje dane w bezpiecznej dla wielu wątków kolekcji. Ponieważ operacje w pamięci są synchroniczne i bardzo krótkie, nie używa się `Task.Run`; metody zwracają zakończone zadania.

```csharp
using System.Collections.Concurrent;
using ProductsApi.Models;

namespace ProductsApi.Repositories;

public sealed class InMemoryProductRepository : IProductRepository
{
    private readonly ConcurrentDictionary<long, Product> _products = new();
    private long _nextId;

    public InMemoryProductRepository()
    {
        AddInitialProduct(
            "Klawiatura mechaniczna",
            "Klawiatura z przełącznikami mechanicznymi.",
            349.99m);

        AddInitialProduct(
            "Mysz bezprzewodowa",
            "Ergonomiczna mysz z odbiornikiem USB.",
            129.90m);
    }

    public Task<IReadOnlyCollection<Product>> GetAllAsync(
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        IReadOnlyCollection<Product> products = _products.Values
            .OrderBy(product => product.Id)
            .ToArray();

        return Task.FromResult(products);
    }

    public Task<Product?> GetByIdAsync(
        long id,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        _products.TryGetValue(id, out var product);
        return Task.FromResult(product);
    }

    public Task<Product> CreateAsync(
        string name,
        string? description,
        decimal price,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var id = Interlocked.Increment(ref _nextId);

        var product = new Product
        {
            Id = id,
            Name = name.Trim(),
            Description = NormalizeDescription(description),
            Price = price,
            CreatedAtUtc = DateTimeOffset.UtcNow
        };

        if (!_products.TryAdd(id, product))
        {
            throw new InvalidOperationException(
                "Nie udało się dodać produktu do magazynu.");
        }

        return Task.FromResult(product);
    }

    public Task<bool> DeleteAsync(
        long id,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var removed = _products.TryRemove(id, out _);
        return Task.FromResult(removed);
    }

    private void AddInitialProduct(
        string name,
        string? description,
        decimal price)
    {
        var id = Interlocked.Increment(ref _nextId);

        var product = new Product
        {
            Id = id,
            Name = name,
            Description = description,
            Price = price,
            CreatedAtUtc = DateTimeOffset.UtcNow
        };

        _products.TryAdd(id, product);
    }

    private static string? NormalizeDescription(string? description)
    {
        return string.IsNullOrWhiteSpace(description)
            ? null
            : description.Trim();
    }
}
```

#### Controllers/ProductsController.cs

Kontroler udostępnia operacje REST. Każda metoda przekazuje token anulowania do repozytorium i używa `await`. Ograniczenie trasy `min(1)` odrzuca niepoprawne identyfikatory na poziomie routingu.

```csharp
using Microsoft.AspNetCore.Mvc;
using ProductsApi.Contracts;
using ProductsApi.Models;
using ProductsApi.Repositories;

namespace ProductsApi.Controllers;

[ApiController]
[Route("api/products")]
public sealed class ProductsController : ControllerBase
{
    private readonly IProductRepository _repository;

    public ProductsController(IProductRepository repository)
    {
        _repository = repository;
    }

    [HttpGet]
    [ProducesResponseType(
        typeof(IReadOnlyCollection<Product>),
        StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyCollection<Product>>> GetAll(
        CancellationToken cancellationToken)
    {
        var products = await _repository.GetAllAsync(cancellationToken);
        return Ok(products);
    }

    [HttpGet("{id:long:min(1)}")]
    [ProducesResponseType(typeof(Product), StatusCodes.Status200OK)]
    [ProducesResponseType(
        typeof(ProblemDetails),
        StatusCodes.Status404NotFound)]
    public async Task<ActionResult<Product>> GetById(
        long id,
        CancellationToken cancellationToken)
    {
        var product = await _repository.GetByIdAsync(
            id,
            cancellationToken);

        if (product is null)
        {
            return Problem(
                statusCode: StatusCodes.Status404NotFound,
                title: "Nie znaleziono produktu.",
                detail: $"Produkt o identyfikatorze {id} nie istnieje.");
        }

        return Ok(product);
    }

    [HttpPost]
    [ProducesResponseType(typeof(Product), StatusCodes.Status201Created)]
    [ProducesResponseType(
        typeof(ValidationProblemDetails),
        StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<Product>> Create(
        [FromBody] CreateProductRequest request,
        CancellationToken cancellationToken)
    {
        var product = await _repository.CreateAsync(
            request.Name,
            request.Description,
            request.Price,
            cancellationToken);

        return CreatedAtAction(
            nameof(GetById),
            new { id = product.Id },
            product);
    }

    [HttpDelete("{id:long:min(1)}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(
        typeof(ProblemDetails),
        StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(
        long id,
        CancellationToken cancellationToken)
    {
        var deleted = await _repository.DeleteAsync(
            id,
            cancellationToken);

        if (!deleted)
        {
            return Problem(
                statusCode: StatusCodes.Status404NotFound,
                title: "Nie znaleziono produktu.",
                detail: $"Produkt o identyfikatorze {id} nie istnieje.");
        }

        return NoContent();
    }
}
```

### Konfiguracja

#### appsettings.json

Konfiguracja ustawia podstawowy poziom logowania. Magazyn w pamięci nie wymaga connection stringa ani dodatkowych ustawień.

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "AllowedHosts": "*"
}
```

### Budowanie i uruchamianie

Pliki należy umieścić w katalogu `ProductsApi` zgodnie z przedstawioną strukturą, a następnie wykonać:

```bash
cd ProductsApi
dotnet restore
dotnet build
dotnet run --urls http://localhost:5000
```

API będzie dostępne pod adresem `http://localhost:5000/api/products`.

### Dostępne endpointy

| Metoda | Adres | Opis | Poprawna odpowiedź |
| --- | --- | --- | --- |
| `GET` | `/api/products` | Pobiera wszystkie produkty. | `200 OK` |
| `GET` | `/api/products/{id}` | Pobiera produkt o wskazanym identyfikatorze. | `200 OK` |
| `POST` | `/api/products` | Tworzy nowy produkt. | `201 Created` |
| `DELETE` | `/api/products/{id}` | Usuwa produkt. | `204 No Content` |

### Jak działa rozwiązanie

1. ASP.NET Core wybiera akcję kontrolera na podstawie metody HTTP i trasy.
2. Atrybut `[ApiController]` automatycznie sprawdza model wejściowy. Niepoprawny POST kończy się odpowiedzią `400 Bad Request` zawierającą szczegóły walidacji.
3. Kontroler otrzymuje `IProductRepository` przez konstruktor. Kontener DI dostarcza współdzieloną instancję `InMemoryProductRepository`.
4. Kontroler asynchronicznie wywołuje repozytorium i przekazuje token anulowania powiązany z żądaniem HTTP.
5. POST generuje identyfikator po stronie serwera i zwraca `201 Created` wraz z nagłówkiem `Location`.
6. Nieistniejące zasoby zwracają ustandaryzowaną odpowiedź Problem Details z kodem `404`.

Dane istnieją wyłącznie podczas działania procesu. Ponowne uruchomienie aplikacji przywraca dwa początkowe produkty.

### Testowanie

#### Pobranie wszystkich produktów

```bash
curl -i http://localhost:5000/api/products
```

#### Pobranie pojedynczego produktu

```bash
curl -i http://localhost:5000/api/products/1
```

#### Dodanie produktu

```bash
curl -i -X POST http://localhost:5000/api/products \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Monitor 27 cali",
    "description": "Monitor IPS o rozdzielczości 2560x1440.",
    "price": 1299.99
  }'
```

#### Sprawdzenie walidacji

Żądanie zwróci `400 Bad Request`, ponieważ nazwa jest zbyt krótka, a cena jest ujemna.

```bash
curl -i -X POST http://localhost:5000/api/products \
  -H "Content-Type: application/json" \
  -d '{
    "name": "A",
    "price": -10
  }'
```

#### Usunięcie produktu

```bash
curl -i -X DELETE http://localhost:5000/api/products/1
```

### Decyzje architektoniczne i bezpieczeństwo

- DTO wejściowy ogranicza możliwość nadpisania pól kontrolowanych przez serwer, takich jak identyfikator i data utworzenia.
- Limity długości tekstu oraz zakres ceny zabezpieczają API przed nieprawidłowymi i nadmiernie dużymi danymi wejściowymi.
- `ConcurrentDictionary` zapewnia poprawność przy równoległych żądaniach.
- Repozytorium jest abstrakcją, dzięki czemu implementację można zastąpić na przykład Entity Framework Core.
- Przykład nie zawiera uwierzytelniania ani autoryzacji. W systemie produkcyjnym operacje POST i DELETE powinny być chronione odpowiednią polityką dostępu.
- Przykładowe polecenia używają HTTP wyłącznie lokalnie. W środowisku produkcyjnym API powinno działać przez HTTPS.
- Magazyn w pamięci nie jest trwały ani współdzielony pomiędzy wieloma instancjami aplikacji, dlatego nadaje się głównie do demonstracji i testów.
