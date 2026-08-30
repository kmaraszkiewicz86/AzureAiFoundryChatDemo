# Prompt 4 — porównanie modeli

Data oceny: 2026-08-30.

## Oryginalne pytanie benchmarkowe

````text
prompt 4:&#x20;

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
````

## Metryki

| Wdrożenie modelu | Tokeny wejściowe | Tokeny wyjściowe | Tokeny łącznie | Czas wykonania (ms) |
| --- | ---: | ---: | ---: | ---: |
| gpt-5.4-mini-low | 1152 | 1589 | 2741 | 10966 |
| gpt-5.6-terra-medium | 1152 | 2446 | 3598 | 24513 |
| gpt-5.6-sol-high | 1152 | 2660 | 3812 | 36891 |

## Koszty tokenów (EUR)

| Wdrożenie modelu | Koszt wejścia (EUR) | Koszt wyjścia (EUR) | Koszt łączny (EUR) |
| --- | ---: | ---: | ---: |
| gpt-5.4-mini-low | 0,00076032 | 0,00629244 | 0,00705276 |
| gpt-5.6-terra-medium | 0,00202752 | 0,02580530 | 0,02783282 |
| gpt-5.6-sol-high | 0,00506880 | 0,07011760 | 0,07518640 |

Stawki Global Standard z cennika [Microsoft Azure OpenAI](https://azure.microsoft.com/en-us/pricing/details/azure-openai/) w EUR przekazanego w załączniku, stan na 2026-08-30. Za 1 mln tokenów wejścia / wyjścia: GPT-5.4 mini Global — 0,66 / 3,96 EUR; GPT-5.6 Terra Standard Global — 1,76 / 10,55 EUR; GPT-5.6 Sol Standard Global — 4,40 / 26,36 EUR. Dla Terra i Sol zastosowano wariant krótkiego kontekstu.

Koszt wejścia lub wyjścia = liczba odpowiednich tokenów × stawka / 1 000 000. Koszt łączny jest sumą obu kwot. To oszacowanie według zwykłych stawek wejścia i wyjścia; brak osobnych liczników cache uniemożliwia uwzględnienie jego rozliczenia.

## Porównanie jakościowe

| Kryterium | gpt-5.4-mini-low | gpt-5.6-terra-medium | gpt-5.6-sol-high |
| --- | --- | --- | --- |
| Poprawność | Poprawnie rozpoznaje zbędną obsługę async, ale zaleca zmianę zachowania przy braku produktu i pomija moment zgłaszania wyjątków. | Dobra diagnoza blokowania, nullowalności i wyjątków; częściowo zachowuje zwracanie Task zakończonego błędem. | Poprawny przykład rzeczywistego I/O i wskazówki propagacji wyjątków; narzuca nieuzasadnioną regułę dodatniego ID. |
| Kompletność | Obejmuje główną optymalizację i alternatywy, lecz pomija istotne szczegóły kontraktu oraz wyjątków. | Obejmuje pracę synchroniczną, adapter Task, rzeczywiste asynchroniczne I/O, anulowanie i obsługę wyjątków. | Obejmuje te same główne zagadnienia oraz propozycje testów; pomija zastrzeżenie dotyczące momentu zgłaszania wyjątków w adapterze. |
| Jakość kodu | Końcowa metoda jest mała, ale wcześniejsze warianty powtarzają logikę, a wariant zgłaszający wyjątek zachowuje zbyt szeroką adnotację nullable. | Jasne przykłady na poziomie metod i znaczący typ wyjątku dla braku produktu; adapter nadal zmienia obsługę awarii repozytorium. | Czytelny przykład serwisu, ale dodana definicja modelu i interfejsu wykracza poza potrzeby przeglądu. |
| Jakość architektury i projektu | Zachowuje API zwracające Task, ale bez podstaw traktuje zwracanie null jako preferowany kontrakt biznesowy. | Najlepiej rozróżnia możliwości repozytorium i istniejący publiczny kontrakt Task. | Dobre przekazywanie asynchroniczności i anulowania między warstwami, ale niepotrzebnie rozszerza API oraz założenia domenowe. |
| Jasność | Przystępne polskie wyjaśnienie; powtarzane zalecenia i zbyt szerokie twierdzenia obniżają precyzję. | Jasna tabela porównawcza i warianty zależne od warunków; końcowe zalecenie zbyt słabo akcentuje zgodność. | Jasne numerowane wyjaśnienia i testy; opcjonalne zmiany projektowe zbyt stanowczo przedstawia jako konieczne poprawki. |
| Zbędna rozwlekłość | Najkrótsza odpowiedź, ale kilkakrotnie powtarza niemal tę samą metodę i wyjaśnienia. | Dłuższa niż potrzeba; trzy warianty i opcjonalne omówienie ConfigureAwait zwiększają szczegółowość. | Najbardziej rozbudowana; pełne definicje Product i serwisu oraz scenariusze walidacji przeczą prośbie o wąski zakres zmian. |
| Przydatność praktyczna | Przydatna dopiero po jawnym wyborze kontraktu zwracającego null i przeanalizowaniu semantyki wyjątków. | Najlepszy ogólny przegląd, z konkretnym zastrzeżeniem do adaptera wymagającym rozwiązania. | Przydatna przy świadomej migracji do asynchronicznego I/O, mniej odpowiednia jako żądana minimalna poprawka. |

## Istotne ustalenia i różnice

### 1. Wszystkie trzy odpowiedzi rozpoznają podstawowy problem async, ale jego znaczenie wymaga wyważenia

Wywołanie repozytorium jest synchroniczne, a oczekiwanie na `Task.FromResult(product)` nie sprawi, że przestanie blokować. Wszystkie trzy modele rozpoznają to poprawnie. Terra i Sol szczególnie jasno wyjaśniają problem skalowalności I/O i odrzucają `Task.Run` jako rozwiązanie synchronicznego dostępu do bazy.

Oczekiwanie na już zakończone zadanie nie wstrzymuje metody ani nie oznacza zmiany wątku. Usunięcie opakowania może wyeliminować narzut maszyny stanów, ale żadna odpowiedź nie mierzy tej korzyści; rzeczywiste blokujące I/O byłoby większym problemem. Adapter zwracający Task może też być uzasadniony wymaganiami istniejącego interfejsu, zamiast automatycznie stanowić antywzorzec. Zobacz [semantykę await w dokumentacji Microsoft](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/operators/await).

### 2. Sposób przekazywania wyjątków to najważniejszy pominięty szczegół

W oryginalnej metodzie async zarówno brak produktu, jak i wyjątek repozytorium powodują zakończenie zwróconego Task błędem. Po usunięciu `async` wyjątki występujące przed zwróceniem wyniku są zgłaszane synchronicznie podczas wywołania.

Różnice w zachowaniu metod:

| Zachowanie repozytorium | Oryginalna metoda | Końcowa metoda Mini | Adapter Task modelu Terra |
| --- | --- | --- | --- |
| Zwraca produkt | Task zakończony sukcesem z produktem | Task zakończony sukcesem z produktem | Task zakończony sukcesem z produktem |
| Zwraca null | Task zakończony błędem: Exception | Task zakończony sukcesem z null | Task zakończony błędem: KeyNotFoundException |
| Zgłasza TimeoutException | Task zakończony błędem: TimeoutException | Wyjątek synchroniczny: TimeoutException | Wyjątek synchroniczny: TimeoutException |

Terra zasługuje na uznanie za jawne użycie `Task.FromException<Product>` przy braku produktu. Wywołanie repozytorium pozostaje jednak poza mechanizmem zamiany błędu na Task, więc deklaracja zachowania sposobu przekazywania błędów jest tylko częściowo prawdziwa. Mini nie wspomina o tej zmianie zachowania. Proponowana przez Sol metoda z asynchronicznym I/O zachowuje przechwytywanie wyjątków przez mechanizm async, ale wskazówka dotycząca usunięcia async w synchronicznym adapterze również pomija to zastrzeżenie.

Ma to znaczenie dla kodu, który najpierw uzyskuje Task, a dopiero potem na niego oczekuje, albo łączy kilka wywołań: wyjątek może wystąpić, zanim Task zostanie zwrócony. Kod otaczający całe wyrażenie `await GetProductAsync(...)` blokiem try/catch może przechwycić obie formy. Zobacz [działanie wyjątków async w dokumentacji Microsoft](https://learn.microsoft.com/en-us/dotnet/csharp/asynchronous-programming/).

### 3. Preferowana poprawka Mini zmienia istniejący kontrakt braku produktu

Mini zaleca zwracanie null zamiast wyjątku. Może to być dobry projekt API, ale dostarczona implementacja celowo zgłasza wyjątek, a użytkownik prosi o niezbędne zmiany, nie przeprojektowanie. Nazwa metody nie przesądza, że ma ona zwracać null.

Pierwszy przykład zwracający null zawiera ponadto zbędne rozgałęzienie, później zastąpione krótszą wersją. Alternatywny wariant zgłaszający wyjątek poprawia jego typ na `InvalidOperationException`, ale zachowuje `Task<Product?>`. Terra i Sol w głównych przykładach pozostawiają traktowanie braku produktu jako błędu i używają bardziej precyzyjnego `KeyNotFoundException`.

Żaden z tych typów wyjątków nie powoduje automatycznie odpowiedzi HTTP 404; mapowanie należy do istniejącej polityki obsługi błędów na granicy aplikacji. Benchmark nie określa nawet, czy istnieje warstwa HTTP.

### 4. Terra najlepiej rozróżnia dostępne warianty, ale nadal ryzykuje zmianę publicznego API

Terra rozróżnia synchroniczne operacje w pamięci, wymagany kontrakt Task i rzeczywiste asynchroniczne I/O. To najlepsze rozumowanie uwzględniające brak informacji o repozytorium.

Początkowe i końcowe zalecenie zmiany nazwy metody na `GetProduct` oraz zwracania `Product` jest minimalne tylko wtedy, gdy można również zmienić kod wywołujący i interfejsy. Odpowiedź zawiera jednak alternatywę zachowującą Task, co znacząco ogranicza tę słabość. Zmiana adnotacji nullowalności tak, aby opisywały poprawny wynik różny od null, jest rozsądna, ale trzeba uwzględnić istniejące adnotacje interfejsów.

Użycie przez Terra `ConfigureAwait(false)` i dodatkowego parametru anulowania to zależne od kontekstu decyzje dotyczące bibliotek i I/O, a nie obowiązkowe poprawki tego fragmentu. Ostrzeżenie przed zbędnym przechwytywaniem i ponownym zgłaszaniem wyjątków jest przydatne; nie usuwa jednak potrzeby rozwiązania opisanego problemu semantyki adaptera.

### 5. Sol dodaje nieuzasadnione wymagania i zbędny kod otaczający

Sol dostarcza spójny przykład asynchronicznego I/O oraz przydatne testy i nie wprowadza nowej hierarchii wyjątków. Dodaje jednak własną definicję Product, interfejs repozytorium, przestrzeń nazw, konstruktor oraz regułę dopuszczającą wyłącznie dodatnie identyfikatory.

Nie ma podstaw, by uznać zerowe lub ujemne ID za niepoprawne. `ThrowIfNegativeOrZero(id)` zmienia zbiór akceptowanych danych wejściowych i jest uzasadnione tylko wtedy, gdy taka reguła domenowa już istnieje. Nowa postać Product nie ma związku z diagnozą metody, a rzeczywista obsługa asynchroniczności przez repozytorium pozostaje założeniem implementacyjnym.

Przekazywanie anulowania jest wartościowe, gdy obsługuje je źródło danych, lecz brak CancellationToken nie jest automatycznie błędem synchronicznego wyszukiwania. Te dodatki sprawiają, że Sol jest słabiej dopasowany do prośby, niż początkowo sugeruje szeroki zakres techniczny odpowiedzi.

### 6. Adnotacje nullowalności i sprawdzanie null to kwestie jakości, a nie udowodnione błędy wykonania

Terra i Sol poprawnie zauważają, że pomyślne wykonanie zwraca produkt różny od null. Adnotacja nullable jednak dopuszcza null, a nie wymaga, by metoda kiedykolwiek go zwróciła. Oryginalna sygnatura jest zbyt szeroka, ale nie stanowi niepoprawnego kontraktu C#. Kategoryczny zakaz łączenia nullable ze zgłaszaniem wyjątku jest zbyt mocny. Zobacz [dokumentację nullable reference types firmy Microsoft](https://learn.microsoft.com/en-us/dotnet/csharp/fundamentals/null-safety/nullable-reference-types).

Podobnie `is null` omija przeciążony operator równości, ale nie pokazano takiego przeciążenia w Product. To rozsądne drobne ulepszenie, a nie dowód, że oryginalne porównanie jest błędne. Sugestia Mini, że pierwotne opakowanie samo w sobie utrudnia testowanie, również nie wynika z fragmentu.

## Wniosek

**gpt-5.6-terra-medium udzielił najlepszej odpowiedzi na ten prompt**, nieznacznie wyprzedzając **gpt-5.6-sol-high**. Przewagą Terra jest rozumowanie zależne od warunków i jawne uwzględnienie wymaganego kontraktu Task, w tym zwracanie zadania zakończonego błędem przy braku produktu. Adapter nie zachowuje w pełni dotychczasowego zachowania, a zalecenie zmiany nazwy metody wymaga zastrzeżenia dotyczącego zgodności.

Sol dobrze wyjaśnia rzeczywiste asynchroniczne I/O, ale dodaje niepotwierdzoną regułę ID i więcej otaczającego kodu, niż uzasadnia prośba o minimalne zmiany. Mini jest najszybszy i najkrótszy, lecz preferowana poprawka zmienia zachowanie przy braku produktu i pomija szczegóły przekazywania wyjątków.

Terra zużyła o 214 tokenów wyjściowych mniej i potrzebowała o 12378 ms mniej niż Sol w tych uruchomieniach. Jest to drugorzędne wobec dopasowania technicznego: **żadna odpowiedź nie uwzględnia w pełni zgodności sposobu przekazywania wyjątków przy jednoczesnym ograniczeniu zmian do ustalonych wymagań.**
