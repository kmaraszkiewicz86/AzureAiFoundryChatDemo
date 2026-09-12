# Model: gpt-5.6-terra-medium

**Execution time:** 45542 ms

**Input tokens:** 1093

**Output tokens:** 5051

**Total tokens:** 6144

## Question

Stwórz proste REST API w ASP.NET Core do zarządzania listą produktów. Dodaj endpointy GET, POST i DELETE. Użyj kontrolerów, Dependency Injection, async/await oraz walidacji danych wejściowych. Dane mogą być przechowywane w pamięci. Pokaż wszystkie wymagane klasy oraz krótko opisz strukturę rozwiązania.

## Answer

### Przegląd rozwiązania

Rozwiązanie to proste REST API w ASP.NET Core 10 do zarządzania produktami przechowywanymi w pamięci procesu. API udostępnia endpointy do pobierania produktów, dodawania produktu oraz usuwania produktu.

Warstwa kontrolera obsługuje HTTP, repozytorium odpowiada za przechowywanie danych, a Dependency Injection dostarcza implementację repozytorium do kontrolera. Operacje API używają asynchronicznego kontraktu `Task` oraz `await`.

### Wymagania

- .NET SDK 10.0 lub nowszy.
- Dowolny edytor, np. Visual Studio 2022, Rider lub Visual Studio Code.
- Brak zewnętrznych pakietów NuGet — wykorzystano wyłącznie ASP.NET Core.

### Struktura projektu

```text
ProductApi/
├── Controllers/
│   └── ProductsController.cs
├── Contracts/
│   └── CreateProductRequest.cs
├── Models/
│   └── Product.cs
├── Repositories/
│   ├── IProductRepository.cs
│   └── InMemoryProductRepository.cs
├── Properties/
│   └── launchSettings.json
├── ProductApi.csproj
└── Program.cs
```

### Implementacja

#### ProductApi.csproj

Plik projektu ASP.NET Core, skonfigurowany dla .NET 10.

```xml
<Project Sdk="Microsoft.NET.Sdk.Web">
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
  </PropertyGroup>
</Project>
```

#### Program.cs

Konfiguruje kontener Dependency Injection, rejestruje kontrolery oraz mapuje endpointy API.

```csharp
using ProductApi.Repositories;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();

builder.Services.AddSingleton<IProductRepository, InMemoryProductRepository>();

var app = builder.Build();

app.UseHttpsRedirection();

app.MapControllers();

app.Run();
```

#### Models/Product.cs

Model domenowy reprezentujący produkt zwracany przez API.

```csharp
namespace ProductApi.Models;

public sealed record Product(
    Guid Id,
    string Name,
    decimal Price,
    int Quantity,
    DateTimeOffset CreatedAtUtc);
```

#### Contracts/CreateProductRequest.cs

Model danych wejściowych dla endpointu POST. Atrybuty Data Annotations oraz walidacja własna zabezpieczają API przed niepoprawnymi wartościami.

```csharp
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace ProductApi.Contracts;

public sealed class CreateProductRequest : IValidatableObject
{
    [Required(AllowEmptyStrings = false)]
    [StringLength(120)]
    public string? Name { get; init; }

    [Range(typeof(decimal), "0.01", "1000000")]
    public decimal Price { get; init; }

    [Range(0, 1000000)]
    public int Quantity { get; init; }

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (string.IsNullOrWhiteSpace(Name))
        {
            yield return new ValidationResult(
                "Nazwa produktu nie może składać się wyłącznie z białych znaków.",
                new[] { nameof(Name) });
        }
    }
}
```

#### Repositories/IProductRepository.cs

Abstrakcja warstwy dostępu do danych. Dzięki interfejsowi implementację pamięciową można później zastąpić np. bazą danych.

```csharp
using ProductApi.Models;

namespace ProductApi.Repositories;

public interface IProductRepository
{
    Task<IReadOnlyCollection<Product>> GetAllAsync(CancellationToken cancellationToken);

    Task<Product?> GetByIdAsync(Guid id, CancellationToken cancellationToken);

    Task<Product> AddAsync(
        string name,
        decimal price,
        int quantity,
        CancellationToken cancellationToken);

    Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken);
}
```

#### Repositories/InMemoryProductRepository.cs

Implementacja repozytorium oparta o `ConcurrentDictionary`. Kolekcja jest bezpieczna dla współbieżnych żądań HTTP i żyje do czasu zatrzymania aplikacji.

```csharp
using System.Collections.Concurrent;
using System.Linq;
using ProductApi.Models;

namespace ProductApi.Repositories;

public sealed class InMemoryProductRepository : IProductRepository
{
    private readonly ConcurrentDictionary<Guid, Product> _products = new();

    public Task<IReadOnlyCollection<Product>> GetAllAsync(
        CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();

        IReadOnlyCollection<Product> products = _products.Values
            .OrderBy(product => product.CreatedAtUtc)
            .ToArray();

        return Task.FromResult(products);
    }

    public Task<Product?> GetByIdAsync(
        Guid id,
        CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();

        _products.TryGetValue(id, out var product);

        return Task.FromResult(product);
    }

    public Task<Product> AddAsync(
        string name,
        decimal price,
        int quantity,
        CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();

        Product product;

        do
        {
            product = new Product(
                Guid.NewGuid(),
                name,
                price,
                quantity,
                DateTimeOffset.UtcNow);
        }
        while (!_products.TryAdd(product.Id, product));

        return Task.FromResult(product);
    }

    public Task<bool> DeleteAsync(
        Guid id,
        CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var removed = _products.TryRemove(id, out _);

        return Task.FromResult(removed);
    }
}
```

#### Controllers/ProductsController.cs

Kontroler definiuje endpointy REST pod adresem `/api/products`. Atrybut `ApiController` automatycznie zwraca odpowiedź 400 Bad Request, gdy walidacja modelu wejściowego zakończy się błędem.

```csharp
using Microsoft.AspNetCore.Mvc;
using ProductApi.Contracts;
using ProductApi.Models;
using ProductApi.Repositories;

namespace ProductApi.Controllers;

[ApiController]
[Route("api/products")]
[Produces("application/json")]
public sealed class ProductsController : ControllerBase
{
    private readonly IProductRepository _productRepository;

    public ProductsController(IProductRepository productRepository)
    {
        _productRepository = productRepository;
    }

    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyCollection<Product>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyCollection<Product>>> GetAll(
        CancellationToken cancellationToken)
    {
        var products = await _productRepository.GetAllAsync(cancellationToken);

        return Ok(products);
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(Product), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<Product>> GetById(
        Guid id,
        CancellationToken cancellationToken)
    {
        var product = await _productRepository.GetByIdAsync(id, cancellationToken);

        return product is null ? NotFound() : Ok(product);
    }

    [HttpPost]
    [ProducesResponseType(typeof(Product), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<Product>> Create(
        [FromBody] CreateProductRequest request,
        CancellationToken cancellationToken)
    {
        var product = await _productRepository.AddAsync(
            request.Name!.Trim(),
            request.Price,
            request.Quantity,
            cancellationToken);

        return CreatedAtAction(
            nameof(GetById),
            new { id = product.Id },
            product);
    }

    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(
        Guid id,
        CancellationToken cancellationToken)
    {
        var deleted = await _productRepository.DeleteAsync(id, cancellationToken);

        return deleted ? NoContent() : NotFound();
    }
}
```

### Konfiguracja uruchomieniowa

#### Properties/launchSettings.json

Opcjonalny profil lokalny definiujący adresy HTTP i HTTPS używane podczas uruchomienia w środowisku deweloperskim.

```json
{
  "$schema": "https://json.schemastore.org/launchsettings.json",
  "profiles": {
    "ProductApi": {
      "commandName": "Project",
      "dotnetRunMessages": true,
      "launchBrowser": false,
      "applicationUrl": "https://localhost:7050;http://localhost:5050",
      "environmentVariables": {
        "ASPNETCORE_ENVIRONMENT": "Development"
      }
    }
  }
}
```

### Endpointy

| Metoda | Adres | Opis | Odpowiedzi |
| --- | --- | --- | --- |
| GET | /api/products | Zwraca wszystkie produkty. | 200 OK |
| GET | /api/products/{id} | Zwraca pojedynczy produkt według identyfikatora. | 200 OK, 404 Not Found |
| POST | /api/products | Tworzy produkt na podstawie danych JSON. | 201 Created, 400 Bad Request |
| DELETE | /api/products/{id} | Usuwa produkt o wskazanym identyfikatorze. | 204 No Content, 404 Not Found |

### Budowanie i uruchamianie

```bash
dotnet restore
dotnet build
dotnet run --launch-profile ProductApi
```

Po uruchomieniu API będzie dostępne pod adresem `https://localhost:7050`. W środowisku lokalnym certyfikat deweloperski może wymagać zaufania przez polecenie `dotnet dev-certs https --trust`.

### Testowanie API

#### Pobranie pustej listy produktów

```bash
curl -k https://localhost:7050/api/products
```

#### Dodanie produktu

```bash
curl -k -i -X POST https://localhost:7050/api/products \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Klawiatura mechaniczna\",\"price\":349.99,\"quantity\":10}"
```

#### Pobranie listy po dodaniu produktu

```bash
curl -k https://localhost:7050/api/products
```

#### Usunięcie produktu

Należy skopiować identyfikator `id` z odpowiedzi POST lub GET.

```bash
curl -k -i -X DELETE https://localhost:7050/api/products/TUTAJ_WSTAW_ID_PRODUKTU
```

#### Przykład błędnych danych

```bash
curl -k -i -X POST https://localhost:7050/api/products \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"   \",\"price\":0,\"quantity\":-1}"
```

Żądanie zwróci `400 Bad Request` wraz ze szczegółami błędów walidacji w formacie Problem Details.

### Decyzje architektoniczne i bezpieczeństwo

- **Kontrolery:** logika HTTP pozostaje w `ProductsController`, co ułatwia rozwój API i testowanie.
- **Dependency Injection:** kontroler zależy od interfejsu `IProductRepository`, a nie od konkretnej implementacji pamięciowej.
- **Asynchroniczność:** kontrakt repozytorium i akcje kontrolera używają `Task`, `async` oraz `await`. Przy zastąpieniu pamięci bazą danych interfejs nie wymaga zmiany.
- **Walidacja:** nazwa jest wymagana, ograniczona do 120 znaków i nie może składać się wyłącznie z białych znaków. Cena musi być większa od zera, a ilość nie może być ujemna.
- **Współbieżność:** `ConcurrentDictionary` pozwala bezpiecznie obsługiwać równoległe żądania bez własnych blokad.
- **HTTPS:** `UseHttpsRedirection` przekierowuje ruch HTTP na HTTPS, jeśli dostępny jest endpoint HTTPS.
- **Ograniczenie rozwiązania:** dane są tracone po restarcie procesu. W systemie produkcyjnym należy dodać trwałe repozytorium, uwierzytelnianie, autoryzację, logowanie, limity żądań i obsługę błędów globalnych.
