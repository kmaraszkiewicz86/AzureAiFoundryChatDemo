# Model: gpt-5.6-terra-medium

**Execution time:** 24513 ms

**Input tokens:** 1152

**Output tokens:** 2446

**Total tokens:** 3598

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

### Najważniejsze problemy

| Obszar | Problem | Skutek |
| --- | --- | --- |
| async/await | Metoda jest oznaczona jako `async`, ale nie wykonuje rzeczywistej operacji asynchronicznej. | Powstaje niepotrzebna maszyna stanów generowana przez kompilator. |
| Task.FromResult | `Task.FromResult(product)` opakowuje już pobrany, synchroniczny wynik w ukończone zadanie. | Nie daje asynchroniczności ani korzyści wydajnościowej. |
| Wydajność | `_repository.GetById(id)` jest metodą synchroniczną. | Jeżeli repozytorium wykonuje I/O, np. zapytanie do bazy danych, może blokować wątek obsługujący żądanie. |
| Obsługa wyjątków | Rzucany jest ogólny `Exception`. | Wywołujący nie może sensownie odróżnić braku produktu od błędu technicznego. |
| Nullability | Typ zwracany to `Task<Product?>`, chociaż metoda dla `null` rzuca wyjątek. | Kontrakt metody jest niespójny: wynik nigdy nie powinien być `null`. |

### Minimalna poprawka dla synchronicznego repozytorium

Jeżeli `GetById` jest świadomie synchroniczne i nie wykonuje blokującego I/O, metoda również powinna być synchroniczna. Jest to najprostsza i najbardziej spójna poprawka.

#### GetProduct

```csharp
public Product GetProduct(int id)
{
    var product = _repository.GetById(id);

    if (product is null)
    {
        throw new KeyNotFoundException("Product not found.");
    }

    return product;
}
```

- Usunięto `async`, ponieważ metoda nie oczekuje na żadną operację.
- Usunięto `Task.FromResult`, ponieważ niepotrzebnie tworzył ukończone zadanie.
- Zmieniono wynik na `Product`, ponieważ po udanym zakończeniu metody produkt jest zawsze dostępny.
- Zastąpiono ogólny `Exception` bardziej znaczącym `KeyNotFoundException`.

### Wariant zachowujący asynchroniczne API

Jeżeli sygnatura `GetProductAsync` musi pozostać asynchroniczna z powodu istniejącego kontraktu, a repozytorium nadal jest synchroniczne, można usunąć wyłącznie zbędne `async` i `await`.

#### GetProductAsync

```csharp
public Task<Product> GetProductAsync(int id)
{
    var product = _repository.GetById(id);

    if (product is null)
    {
        return Task.FromException<Product>(
            new KeyNotFoundException("Product not found."));
    }

    return Task.FromResult(product);
}
```

Ten wariant zachowuje charakter metody zwracającej `Task`, w tym przekazanie błędu jako uszkodzonego zadania. Nie rozwiązuje jednak problemu blokowania wątku przez synchroniczne repozytorium.

### Docelowa poprawka dla repozytorium wykonującego I/O

Jeżeli pobranie produktu używa bazy danych, HTTP, pliku lub innego I/O, właściwym rozwiązaniem jest asynchroniczność od warstwy repozytorium. Nie należy używać `Task.Run` do opakowania synchronicznego dostępu do bazy, ponieważ jedynie przenosi blokowanie na wątek puli wątków.

#### IProductRepository.cs

```csharp
using System.Threading;
using System.Threading.Tasks;

public interface IProductRepository
{
    Task<Product?> GetByIdAsync(int id, CancellationToken cancellationToken = default);
}
```

#### ProductService.cs

```csharp
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;

public async Task<Product> GetProductAsync(
    int id,
    CancellationToken cancellationToken = default)
{
    var product = await _repository
        .GetByIdAsync(id, cancellationToken)
        .ConfigureAwait(false);

    if (product is null)
    {
        throw new KeyNotFoundException("Product not found.");
    }

    return product;
}
```

- `GetByIdAsync` umożliwia nieblokujące oczekiwanie na I/O, pod warunkiem że implementacja repozytorium używa asynchronicznego API, np. `FindAsync`, `SingleOrDefaultAsync` lub asynchronicznego klienta HTTP.
- `CancellationToken` pozwala przerwać operację po anulowaniu żądania lub przekroczeniu limitu czasu.
- `ConfigureAwait(false)` jest bezpieczne i przydatne w kodzie bibliotecznym; w ASP.NET Core nie jest wymagane, ale nie szkodzi.
- Typ wyniku pozostaje `Task<Product>`, bo brak produktu jest reprezentowany wyjątkiem, a nie wartością `null`.

### Obsługa wyjątku

Nie należy dodawać lokalnego `try/catch` tylko po to, aby ponownie rzucić ten sam wyjątek. Taki kod nie wnosi wartości i może prowadzić do utraty szczegółów stosu wywołań, jeśli użyto by `throw ex;`.

Warstwa HTTP, np. kontroler lub centralny middleware obsługi wyjątków, powinna mapować `KeyNotFoundException` na odpowiedź HTTP 404. Dzięki temu warstwa aplikacyjna pozostaje niezależna od HTTP.

> Jeżeli brak produktu jest normalnym scenariuszem biznesowym, alternatywą jest zwracanie `Product?` bez rzucania wyjątku. Nie należy jednak jednocześnie deklarować wartości nullable i rzucać wyjątku dla `null`.

### Rekomendacja

Najmniejsza właściwa zmiana zależy od charakteru repozytorium:

1. Gdy repozytorium jest synchroniczne: zastosować wariant `GetProduct` bez `Task` i bez `async`.
2. Gdy repozytorium wykonuje I/O: dodać prawdziwe `GetByIdAsync` w repozytorium i użyć wariantu asynchronicznego z `CancellationToken`.
3. W obu przypadkach: zastąpić `Exception` konkretnym wyjątkiem oraz zmienić `Product?` na `Product`, jeśli brak produktu jest sygnalizowany wyjątkiem.
