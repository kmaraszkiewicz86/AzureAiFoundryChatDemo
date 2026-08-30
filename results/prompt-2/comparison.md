# Prompt 2 — porównanie modeli

Data oceny: 2026-08-30.

## Oryginalne pytanie benchmarkowe

```text
next prompt 2 -> Stwórz proste REST API w ASP.NET Core do zarządzania listą produktów. Dodaj endpointy GET, POST i DELETE. Użyj kontrolerów, Dependency Injection, async/await oraz walidacji danych wejściowych. Dane mogą być przechowywane w pamięci. Pokaż wszystkie wymagane klasy oraz krótko opisz strukturę rozwiązania.
```

## Metryki

| Wdrożenie modelu | Tokeny wejściowe | Tokeny wyjściowe | Tokeny łącznie | Czas wykonania (ms) |
| --- | ---: | ---: | ---: | ---: |
| gpt-5.4-mini-low | 1093 | 3475 | 4568 | 18147 |
| gpt-5.6-terra-medium | 1093 | 5051 | 6144 | 45542 |
| gpt-5.6-sol-high | 1093 | 5258 | 6351 | 60211 |

## Koszty tokenów (EUR)

| Wdrożenie modelu | Koszt wejścia (EUR) | Koszt wyjścia (EUR) | Koszt łączny (EUR) |
| --- | ---: | ---: | ---: |
| gpt-5.4-mini-low | 0,00072138 | 0,01376100 | 0,01448238 |
| gpt-5.6-terra-medium | 0,00192368 | 0,05328805 | 0,05521173 |
| gpt-5.6-sol-high | 0,00480920 | 0,13860088 | 0,14341008 |

Stawki Global Standard z cennika [Microsoft Azure OpenAI](https://azure.microsoft.com/en-us/pricing/details/azure-openai/) w EUR przekazanego w załączniku, stan na 2026-08-30. Za 1 mln tokenów wejścia / wyjścia: GPT-5.4 mini Global — 0,66 / 3,96 EUR; GPT-5.6 Terra Standard Global — 1,76 / 10,55 EUR; GPT-5.6 Sol Standard Global — 4,40 / 26,36 EUR. Dla Terra i Sol zastosowano wariant krótkiego kontekstu.

Koszt wejścia lub wyjścia = liczba odpowiednich tokenów × stawka / 1 000 000. Koszt łączny jest sumą obu kwot. To oszacowanie według zwykłych stawek wejścia i wyjścia; brak osobnych liczników cache uniemożliwia uwzględnienie jego rozliczenia.

## Porównanie jakościowe

| Kryterium | gpt-5.4-mini-low | gpt-5.6-terra-medium | gpt-5.6-sol-high |
| --- | --- | --- | --- |
| Poprawność | Brak zależności Swaggera uniemożliwia kompilację; POST wskazuje również niewłaściwą nazwę akcji MVC. | Główny przepływ jest spójny; występuje opisany niżej wspólny problem walidacji ceny zależnej od ustawień regionalnych. | Główny przepływ jest spójny; występuje ten sam problem ustawień regionalnych oraz przypadek brzegowy normalizacji nazwy. |
| Kompletność | Pokazano wszystkie główne typy, ale brakuje wymaganej konfiguracji pakietów. | Zawiera projekt, kontroler, repozytorium, kontrakty, profil uruchomieniowy i przykłady HTTP. | Zawiera projekt, kontroler, repozytorium, kontrakty, konfigurację, obsługę błędów i przykłady HTTP. |
| Jakość kodu | Czytelny serwis i niemutowalne rekordy, ale błędy integracji obniżają jakość prostego kodu. | Czytelne, zwięzłe repozytorium i kontroler; walidacja białych znaków jest zbędna. | Czytelny model z właściwościami init-only, atomowe generowanie ID, normalizacja i jawne odpowiedzi błędów; inicjalizacja danych częściowo powiela logikę tworzenia. |
| Jakość architektury i projektu | Rozsądny podział kontroler/serwis; identyczne rekordy domenowe i odpowiedzi zwiększają nakład mapowania. | Prosty podział kontroler/repozytorium z poprawnie współdzielonym magazynem typu singleton. | Podobny podział, z Problem Details i obsługą wyjątków; nieco więcej kodu i konfiguracji. |
| Jasność | Polskie wyjaśnienia z angielskimi nagłówkami; deklaracje o zależnościach przeczą Program.cs. | Jasne polskie wyjaśnienie, tabela endpointów i wyraźnie opisane ograniczenia trwałości danych. | Dobre wyjaśnienie synchronicznych operacji w pamięci za kontraktem opartym na Task, lokalnej konfiguracji i danych istniejących tylko w procesie. |
| Zbędna rozwlekłość | Swagger i powtarzane wyjaśnienia rozbudowują proste zadanie bez działającej konfiguracji. | Omówienie endpointów i powtarzane uwagi projektowe są dłuższe niż potrzeba; własna walidacja niewiele wnosi. | Długie omówienie, dodatkowe pola produktu, metody inicjalizacji danych i domyślne ustawienie globalizacji wykraczają poza minimum. |
| Przydatność praktyczna | Wymaga naprawy kompilacji i POST przed niezawodnym użyciem. | Dobry, prosty punkt wyjścia, z zastrzeżeniem dotyczącym walidacji. | Najlepszy ogólny przykład dydaktyczny, z zastrzeżeniami dotyczącymi walidacji; szczególnie przydatne są lokalne polecenia i obsługa błędów. |

## Istotne ustalenia i różnice

### 1. Mini ma dwa poważne błędy integracji

- **Zależność wymagana do kompilacji:** `Program.cs` wywołuje `AddSwaggerGen`, `UseSwagger` i `UseSwaggerUI`, lecz dostarczony projekt nie zawiera odwołania do pakietu Swashbuckle ani kroku jego instalacji. Sam wybór Web SDK nie zapewnia tych API. Pokazany projekt nie skompiluje się więc w dostarczonej postaci. Stwierdzenie, że nie są potrzebne dodatkowe pakiety, jest nieprawdziwe. Zobacz [konfigurację Swashbuckle w dokumentacji Microsoft](https://learn.microsoft.com/en-us/aspnet/core/tutorials/getting-started-with-swashbuckle?view=aspnetcore-8.0).
- **Generowanie nagłówka Location po POST:** `CreatedAtAction(nameof(GetByIdAsync), ...)` odwołuje się do akcji `GetByIdAsync`, podczas gdy domyślne konwencje MVC udostępniają ją jako `GetById`. Nie pokazano nadpisania nazwy akcji ani zmiany ustawienia usuwania przyrostka. Po naprawieniu kompilacji pozostaje problem generowania URL: już po dodaniu produktu może wystąpić błąd zamiast zapowiedzianej poprawnej odpowiedzi 201. Terra i Sol używają zgodnych nazw `GetById`. Wynika to z [konwencji usuwania przyrostka Async w MVC](https://learn.microsoft.com/en-us/dotnet/api/microsoft.aspnetcore.mvc.mvcoptions.suppressasyncsuffixinactionnames?view=aspnetcore-10.0).

### 2. Wszystkie trzy odpowiedzi mają problem walidacji zależnej od ustawień regionalnych

Każda odpowiedź używa granic `Range` dla typu decimal zapisanych jako tekst, w tym `"0.01"`, bez parsowania niezależnego od ustawień regionalnych. Oba warianty zakresu akceptują wartość decimal `1` przy `en-US`, lecz przy `pl-PL` powodują wyjątek konwersji. W efekcie poprawny POST może zakończyć się błędem walidacji na hoście używającym przecinka dziesiętnego. Ustawienie `InvariantGlobalization=false` u Sol tego nie naprawia. Microsoft opisuje odpowiednie [ustawienie ParseLimitsInInvariantCulture](https://learn.microsoft.com/en-us/dotnet/api/system.componentmodel.dataannotations.rangeattribute.parselimitsininvariantculture?view=net-10.0). Jest to wspólne ograniczenie, a nie powód do faworyzowania jednej odpowiedzi.

Znaczenie mają też dwie mniejsze różnice w walidacji:

- Dodatkowe sprawdzanie białych znaków przez Terra powiela domyślne zachowanie `[Required]`; `[Required]` już odrzuca tekst złożony wyłącznie ze spacji. Zobacz [RequiredAttribute](https://learn.microsoft.com/en-us/dotnet/api/system.componentmodel.dataannotations.requiredattribute?view=net-10.0).
- Mini i Sol sprawdzają minimum dwóch znaków przed usunięciem otaczających spacji. Wartość `" A "` przechodzi sprawdzanie długości, ale zostaje zapisana jako `"A"`. Jest to sprzeczne z ich własnym zamiarem dotyczącym znormalizowanej nazwy; Terra nie narzuca minimum dwóch znaków.

### 3. Terra i Sol spełniają główne wymagania strukturalne

Oba rozwiązania zawierają kontrolery, wstrzykiwanie zależności przez konstruktor, repozytoria w pamięci typu singleton, kolekcje współbieżne, przekazywanie anulowania oraz metody oparte na Task wywoływane z await. Zwracanie `Task.FromResult` jest rozsądne przy natychmiastowych operacjach w pamięci; żadne rozwiązanie nie używa sztucznych opóźnień ani `Task.Run`. Sol wyjaśnia to rozróżnienie szczególnie jasno.

Terra używa identyfikatorów GUID, początkowo pustego magazynu, pola ilości oraz lokalnego profilu HTTPS. Sol używa identyfikatorów liczbowych generowanych przez `Interlocked`, dwóch produktów początkowych, opcjonalnego opisu oraz jawnych poleceń HTTP dla localhost. Są to alternatywne wybory demonstracyjne, a nie same w sobie kryteria przewagi jakościowej. Oba rozwiązania oddzielają wejściowe DTO od identyfikatorów generowanych przez serwer.

Sol dodaje przydatne odpowiedzi Problem Details dla brakujących produktów oraz konfigurację obsługi wyjątków. Poprawia to obsługę błędów bez wprowadzania kolejnej warstwy serwisowej. Nie sprawia jednak, że każda odpowiedź 404 na poziomie routingu staje się Problem Details, ani nie usuwa błędów walidacji. Terra pozostaje mniejszym, sensownym rozwiązaniem.

## Wniosek

**gpt-5.6-sol-high udzielił najlepszej ogólnej odpowiedzi na ten prompt, nieznacznie wyprzedzając gpt-5.6-terra-medium.** Jego przewagą są spójna obsługa błędów, jasne wyjaśnienie kontraktu asynchronicznego i praktyczne przykłady całego przepływu — a nie większa długość odpowiedzi. Terra jest mocną, prostszą alternatywą i w tych uruchomieniach zużyła o 207 tokenów wyjściowych mniej oraz potrzebowała o 14669 ms mniej czasu. Oba rozwiązania wymagają poprawek walidacji, zanim można uznać je za odporne na błędy przykłady.

Mini jest najszybszy i zużywa najmniej tokenów, lecz zajmuje trzecie miejsce, ponieważ brakujące zależności i błędne generowanie linku po POST przeważają nad tymi oszczędnościami.
