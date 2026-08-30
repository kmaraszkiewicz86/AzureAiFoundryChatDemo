# Prompt 1 — porównanie modeli

Data oceny: 2026-08-30.

## Oryginalne pytanie benchmarkowe

```text
1 prompt: Stwórz prostą aplikację konsolową Hello World w C# z użyciem najnowszej stabilnej wersji .NET. Pokaż kompletny kod oraz krótko wyjaśnij, jak uruchomić aplikację.
```

## Metryki

| Wdrożenie modelu | Tokeny wejściowe | Tokeny wyjściowe | Tokeny łącznie | Czas wykonania (ms) |
| --- | ---: | ---: | ---: | ---: |
| gpt-5.4-mini-low | 1066 | 871 | 1937 | 9739 |
| gpt-5.6-terra-medium | 1066 | 1098 | 2164 | 13777 |
| gpt-5.6-sol-high | 1066 | 1124 | 2190 | 16181 |

## Koszty tokenów (EUR)

| Wdrożenie modelu | Koszt wejścia (EUR) | Koszt wyjścia (EUR) | Koszt łączny (EUR) |
| --- | ---: | ---: | ---: |
| gpt-5.4-mini-low | 0,00070356 | 0,00344916 | 0,00415272 |
| gpt-5.6-terra-medium | 0,00187616 | 0,01158390 | 0,01346006 |
| gpt-5.6-sol-high | 0,00469040 | 0,02962864 | 0,03431904 |

Stawki Global Standard z cennika [Microsoft Azure OpenAI](https://azure.microsoft.com/en-us/pricing/details/azure-openai/) w EUR przekazanego w załączniku, stan na 2026-08-30. Za 1 mln tokenów wejścia / wyjścia: GPT-5.4 mini Global — 0,66 / 3,96 EUR; GPT-5.6 Terra Standard Global — 1,76 / 10,55 EUR; GPT-5.6 Sol Standard Global — 4,40 / 26,36 EUR. Dla Terra i Sol zastosowano wariant krótkiego kontekstu.

Koszt wejścia lub wyjścia = liczba odpowiednich tokenów × stawka / 1 000 000. Koszt łączny jest sumą obu kwot. To oszacowanie według zwykłych stawek wejścia i wyjścia; brak osobnych liczników cache uniemożliwia uwzględnienie jego rozliczenia.

## Porównanie jakościowe

| Kryterium | gpt-5.4-mini-low | gpt-5.6-terra-medium | gpt-5.6-sol-high |
| --- | --- | --- | --- |
| Poprawność | Poprawny kod Hello World, ale błędnie określa .NET 8 jako najnowszą stabilną wersję. | Poprawna platforma docelowa .NET 10 i spójny kod źródłowy. | Poprawna platforma docelowa .NET 10 i spójny kod źródłowy. |
| Kompletność | Zawiera oba pliki, polecenia uruchomienia, wyjaśnienie i oczekiwany wynik; nie spełnia wymagania wersji. | Obejmuje oba pliki, wymagania wstępne, tworzenie ręczne i przez CLI, uruchomienie oraz weryfikację. | Obejmuje oba pliki i uruchomienie; dodatkowo pokazuje bezpośrednie wykonanie pliku DLL. |
| Jakość kodu | Minimalna instrukcja najwyższego poziomu z niejawnymi dyrektywami using. | Minimalna instrukcja najwyższego poziomu ze standardowymi niejawnymi dyrektywami using. | Minimalny program z jawnym `using System`; poprawny przy wyłączonych niejawnych dyrektywach using. |
| Jakość architektury i projektu | Odpowiedni projekt konsolowy złożony z dwóch plików, bez zbędnych zależności i abstrakcji. | Równie odpowiedni, minimalny projekt. | Równie odpowiedni, minimalny projekt; jawne importy nie poprawiają tutaj architektury. |
| Jasność | Czytelna odpowiedź, ale po angielsku na polskie pytanie. | Wyjaśnienie po polsku; poleca dodać pliki przed ręcznym uruchomieniem. | Wyjaśnienie po polsku; instrukcja zastąpienia plików pojawia się po pierwszym poleceniu uruchomienia. |
| Zbędna rozwlekłość | Powtórzone instrukcje uruchamiania i testowania oraz ogólne omówienie konfiguracji wykraczają poza krótkie wyjaśnienie. | Więcej sekcji oraz zapewnień o bezpieczeństwie i konfiguracji, niż wymaga zadanie. | Kilka sposobów uruchomienia i ogólne omówienie bezpieczeństwa wykraczają poza oczekiwaną zwięzłość. |
| Przydatność praktyczna | Przydatny przykład dla .NET 8, ale wymaga poprawki na potrzeby tego benchmarku. | Najlepiej dopasowany do początkującego szukającego przykładu dla wymaganej aktualnej wersji. | Przydatny przykład dla aktualnej wersji, z dodatkową weryfikacją skompilowanego programu. |

## Istotne różnice

W dniu oceny najnowszą stabilną główną wersją jest .NET 10; .NET 8 nadal jest wspierany, ale nie jest najnowszy. .NET 11 pozostaje wersją zapoznawczą. Użycie `net10.0` spełnia więc wymaganie dotyczące wersji, natomiast przedstawienie .NET 8 jako najnowszego stabilnego wydania — nie. Źródła: [polityka wsparcia .NET firmy Microsoft](https://dotnet.microsoft.com/en-us/platform/support/policy) oraz [omówienie .NET 11 firmy Microsoft](https://learn.microsoft.com/en-us/dotnet/core/whats-new/dotnet-11/overview).

- **Decydująca jest poprawność wersji.** Głównym problemem Mini nie jest krótsza odpowiedź ani prostszy kod: model z przekonaniem wskazuje niewłaściwą najnowszą stabilną wersję. Terra i Sol spełniają to jawne wymaganie.
- **Kod jest podobnie prosty.** Wszystkie trzy odpowiedzi używają instrukcji najwyższego poziomu, pojedynczego wywołania wypisującego tekst w konsoli, analizy nullowalności i nie wymagają zewnętrznych pakietów. Sol wyłącza niejawne dyrektywy using i jawnie importuje `System`; jest to poprawne, a nie błędne, ale wnosi niewiele do tego przykładu.
- **Terra przedstawia najczytelniejszą kolejność przygotowania projektu.** W wariancie ręcznym wyraźnie wymaga dodania pokazanych plików przed uruchomieniem. Sol najpierw pokazuje `dotnet run`, a potem poleca zastąpić wygenerowane pliki. To drobny problem kolejności instrukcji, a nie niedziałający program Hello World.
- **Sol dodaje przydatny, lecz opcjonalny szczegół.** Polecenie `dotnet ./bin/Debug/net10.0/HelloWorld.dll` po domyślnej kompilacji Debug demonstruje uruchomienie skompilowanego programu. Osobne `dotnet restore` przed `dotnet run` jest w tym prostym scenariuszu zbędne, ponieważ run domyślnie wykonuje przywracanie zależności. Oba zachowania CLI opisuje [dokumentacja dotnet run firmy Microsoft](https://learn.microsoft.com/en-us/dotnet/core/tools/dotnet-run).
- **Interpunkcja w powitaniu nie stanowi istotnej różnicy jakościowej.** Mini wypisuje `Hello World`; Terra i Sol wypisują `Hello, World!`. Pytanie nie narzuca dokładnej treści wyniku.
- **Zużycie zasobów jest drugorzędne wobec poprawności.** Mini ma najniższe podane zużycie tokenów i czas, ale nie spełnia wymagania wersji. Terra zużywa o 26 tokenów wyjściowych mniej i kończy o 2404 ms wcześniej niż Sol w dostarczonych pomiarach.

## Wniosek

**gpt-5.6-terra-medium udzielił najlepszej odpowiedzi na ten prompt, nieznacznie wyprzedzając gpt-5.6-sol-high.** Wybiera poprawną stabilną wersję .NET, dostarcza kompletny minimalny kod, odpowiada po polsku i przedstawia czytelniejszą ścieżkę dla początkującego. Sol jest poprawny technicznie i dodaje bezpośrednie uruchomienie DLL, lecz dodatkowe szczegóły nie przeważają nad drobnym problemem kolejności instrukcji w tak prostym zadaniu. Mini zajmuje trzecie miejsce, ponieważ nieaktualne zalecenie dotyczące wersji narusza jawne wymaganie, mimo niższego czasu i zużycia tokenów.
