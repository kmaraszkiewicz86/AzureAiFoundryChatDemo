# Model: gpt-5.6-sol-high

**Execution time:** 36891 ms

**Input tokens:** 1152

**Output tokens:** 2660

**Total tokens:** 3812

## Question

Przeanalizuj poniższy kod C#. Znajdź błędy, problemy związane z async/await, obsługą wyjątków, wydajnością oraz jakością kodu. Zaproponuj tylko niezbędne poprawki bez niepotrzebnego przepisywania całej implementacji. Wyjaśnij każdą zaproponowaną zmianę.

```csharp
public async Task<Product?> GetProductAsync(int id)
{
    var product = _repository.GetById(id);

    if (product == null)
    {
        throw new Exception("Product not found");
    }

    return await Task.FromResult(product);
}
```

## Answer

### Ocena kodu

Metoda jest formalnie asynchroniczna, ale wszystkie operacje wykonuje synchronicznie. `Task.FromResult` nie zmienia synchronicznego odczytu w operację asynchroniczną, a użycie `await` tworzy niepotrzebną maszynę stanów.

- **Pozorna asynchroniczność:** `_repository.GetById(id)` blokuje bieżący wątek, jeśli wykonuje operację wejścia/wyjścia, na przykład zapytanie do bazy danych.
- **Zbędne `await Task.FromResult(...)`:** obiekt jest już dostępny, więc opakowanie go w ukończone zadanie nie daje korzyści.
- **Zbyt ogólny wyjątek:** `Exception` utrudnia rozróżnienie braku produktu od awarii infrastruktury lub błędu programistycznego.
- **Niespójna nullowalność:** metoda deklaruje `Product?`, mimo że dla braku produktu zawsze zgłasza wyjątek. Pomyślny wynik nigdy nie jest wartością `null`.
- **Brak anulowania:** prawdziwa operacja asynchroniczna powinna przyjmować `CancellationToken` i przekazywać go do repozytorium.
- **Brak walidacji identyfikatora:** niepoprawny identyfikator warto odrzucić przed wywołaniem repozytorium.

### Zalecana minimalna poprawka

Jeżeli repozytorium korzysta z bazy danych lub innego źródła wejścia/wyjścia, powinno udostępniać prawdziwie asynchroniczną metodę. Nie jest konieczne przebudowywanie pozostałej części implementacji.

#### ProductService.cs

```csharp
using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;

namespace Products;

public sealed class Product
{
    public int Id { get; init; }

    public required string Name { get; init; }
}

public interface IProductRepository
{
    Task<Product?> GetByIdAsync(
        int id,
        CancellationToken cancellationToken = default);
}

public sealed class ProductService
{
    private readonly IProductRepository _repository;

    public ProductService(IProductRepository repository)
    {
        _repository = repository
            ?? throw new ArgumentNullException(nameof(repository));
    }

    public async Task<Product> GetProductAsync(
        int id,
        CancellationToken cancellationToken = default)
    {
        ArgumentOutOfRangeException.ThrowIfNegativeOrZero(id);

        var product = await _repository.GetByIdAsync(
            id,
            cancellationToken);

        if (product is null)
        {
            throw new KeyNotFoundException(
                $"Product with ID {id} was not found.");
        }

        return product;
    }
}
```

### Wyjaśnienie zmian

1. **Wywołanie `GetByIdAsync` zamiast `GetById`.**

   Daje rzeczywistą asynchroniczność, o ile implementacja repozytorium używa asynchronicznego API źródła danych, na przykład `FindAsync` albo `SingleOrDefaultAsync` w Entity Framework Core. Poprawia to skalowalność aplikacji serwerowej, ponieważ wątek nie musi oczekiwać synchronicznie na operację wejścia/wyjścia.

2. **Usunięcie `Task.FromResult`.**

   `Task.FromResult` służy do utworzenia już zakończonego zadania. Nie wykonuje pracy w tle ani nie zwalnia wątku. Po prawdziwym `await` metoda może bezpośrednio zwrócić `product`.

3. **Zmiana wyniku z `Task<Product?>` na `Task<Product>`.**

   Kontrakt odpowiada rzeczywistemu zachowaniu: metoda zwraca produkt albo zgłasza wyjątek. Wywołujący nie musi wykonywać zbędnej kontroli wartości `null`.

4. **Użycie `KeyNotFoundException`.**

   Jest bardziej precyzyjne niż ogólny `Exception` i pozwala warstwie HTTP lub middleware odróżnić brak zasobu od błędu serwera. W większej domenie można zamiast niego zastosować istniejący wyjątek domenowy, na przykład `ProductNotFoundException`, ale tworzenie nowej hierarchii wyjątków nie jest konieczne dla tej poprawki.

5. **Dodanie `CancellationToken`.**

   Anulowanie żądania może zostać przekazane aż do sterownika bazy danych. Ogranicza to wykonywanie niepotrzebnej pracy po przerwaniu żądania przez klienta.

6. **Walidacja `id`.**

   Wartości niedodatnie są odrzucane jako błędny argument, bez niepotrzebnego zapytania do repozytorium. Brak produktu o poprawnym identyfikatorze pozostaje osobnym przypadkiem.

7. **Brak lokalnego bloku `try/catch`.**

   Metoda nie ma możliwości naprawienia błędu repozytorium, dlatego nie powinna przechwytywać wyjątków tylko po to, aby zgłosić je ponownie. Naturalna propagacja zachowuje typ wyjątku i pełny stos wywołań. Logowanie oraz mapowanie błędów na odpowiedzi HTTP najlepiej wykonać centralnie.

### Wariant dla repozytorium wyłącznie synchronicznego

Jeżeli repozytorium działa w pamięci albo z założenia ma wyłącznie synchroniczne API, metoda serwisu również powinna być synchroniczna. Nie należy używać `Task.Run` ani `Task.FromResult` tylko po to, aby zachować pozór asynchroniczności.

```csharp
public Product GetProduct(int id)
{
    ArgumentOutOfRangeException.ThrowIfNegativeOrZero(id);

    var product = _repository.GetById(id);

    if (product is null)
    {
        throw new KeyNotFoundException(
            $"Product with ID {id} was not found.");
    }

    return product;
}
```

Jeśli istniejący interfejs bezwzględnie wymaga zwrócenia `Task<Product>`, można zwrócić `Task.FromResult(product)` bez słów kluczowych `async` i `await`. Jest to jednak jedynie adapter kontraktu, a nie prawdziwa operacja asynchroniczna.

### Obsługa braku produktu jako zwykłego wyniku

Jeżeli brak produktu jest oczekiwanym przypadkiem biznesowym, alternatywnym i często prostszym kontraktem jest zwrócenie `null` bez wyjątku:

```csharp
public Task<Product?> GetProductAsync(
    int id,
    CancellationToken cancellationToken = default)
{
    ArgumentOutOfRangeException.ThrowIfNegativeOrZero(id);

    return _repository.GetByIdAsync(id, cancellationToken);
}
```

Należy wybrać jeden kontrakt konsekwentnie: albo `Product` i wyjątek dla braku zasobu, albo `Product?` i jawna obsługa `null` przez kod wywołujący. Nie należy jednocześnie deklarować nullable i zawsze zgłaszać wyjątku.

### Najważniejsze testy

- Dodatni identyfikator istniejącego produktu zwraca oczekiwany obiekt.
- Dodatni identyfikator nieistniejącego produktu powoduje `KeyNotFoundException`.
- Identyfikator równy zero lub ujemny powoduje `ArgumentOutOfRangeException` bez wywołania repozytorium.
- Anulowany token jest przekazywany do repozytorium, a operacja może zakończyć się `OperationCanceledException`.
- Wyjątki infrastrukturalne repozytorium nie są zastępowane ogólnym wyjątkiem i zachowują swój stos wywołań.
