# Prompt 3 — porównanie modeli

Data oceny: 2026-08-30.

## Oryginalne pytanie benchmarkowe

```text
next prompt 3: Zaprojektuj produkcyjne REST API w ASP.NET Core do obsługi zamówień. API powinno obsługiwać dużą liczbę równoległych requestów. Zaproponuj architekturę rozwiązania, sposób przechowywania danych, strategię cache, obsługę błędów, logging, monitoring oraz zabezpieczenia. Następnie pokaż przykładową implementację endpointu tworzącego zamówienie wraz z warstwą serwisową. Wyjaśnij najważniejsze decyzje architektoniczne oraz ich zalety i wady.
```

## Metryki

| Wdrożenie modelu | Tokeny wejściowe | Tokeny wyjściowe | Tokeny łącznie | Czas wykonania (ms) |
| --- | ---: | ---: | ---: | ---: |
| gpt-5.4-mini-low | 1135 | 8685 | 9820 | 31716 |
| gpt-5.6-terra-medium | 1135 | 10596 | 11731 | 91112 |
| gpt-5.6-sol-high | 1135 | 15206 | 16341 | 171936 |

## Koszty tokenów (EUR)

| Wdrożenie modelu | Koszt wejścia (EUR) | Koszt wyjścia (EUR) | Koszt łączny (EUR) |
| --- | ---: | ---: | ---: |
| gpt-5.4-mini-low | 0,00074910 | 0,03439260 | 0,03514170 |
| gpt-5.6-terra-medium | 0,00199760 | 0,11178780 | 0,11378540 |
| gpt-5.6-sol-high | 0,00499400 | 0,40083016 | 0,40582416 |

Stawki Global Standard z cennika [Microsoft Azure OpenAI](https://azure.microsoft.com/en-us/pricing/details/azure-openai/) w EUR przekazanego w załączniku, stan na 2026-08-30. Za 1 mln tokenów wejścia / wyjścia: GPT-5.4 mini Global — 0,66 / 3,96 EUR; GPT-5.6 Terra Standard Global — 1,76 / 10,55 EUR; GPT-5.6 Sol Standard Global — 4,40 / 26,36 EUR. Dla Terra i Sol zastosowano wariant krótkiego kontekstu.

Koszt wejścia lub wyjścia = liczba odpowiednich tokenów × stawka / 1 000 000. Koszt łączny jest sumą obu kwot. To oszacowanie według zwykłych stawek wejścia i wyjścia; brak osobnych liczników cache uniemożliwia uwzględnienie jego rozliczenia.

## Porównanie jakościowe

| Kryterium | gpt-5.4-mini-low | gpt-5.6-terra-medium | gpt-5.6-sol-high |
| --- | --- | --- | --- |
| Poprawność | Jednoznaczne błędy składni i użycia API; brak implementacji uwierzytelniania oraz deklarowanego bezpieczeństwa ponowień. | Brakujące zależności i niezgodne połączenie transakcji z ponowieniami uniemożliwiają niezawodne tworzenie zamówień. | Najlepszy projekt głównej logiki, ale istotne błędy stanu przy ponowieniach i obsługi wejścia null. |
| Kompletność | Omawia zagadnienia opisowo; GET jest atrapą, a konfiguracja telemetrii i zabezpieczeń pozostaje niepełna. | Zawiera rzeczywisty GET, JWT, cache produktów, schemat i transakcyjny zapis Outbox; brak publikowania wiadomości. | Zawiera rezerwację zapasów, skrót żądania, GET z awaryjnym odczytem z bazy, eksport telemetrii i testy stanu usług; Outbox pozostaje propozycją. |
| Jakość kodu | Zrozumiały układ warstw, lecz nieużywane typy i błędy integracji obniżają jakość. | Czytelny podział kontroler/serwis/katalog; zbyt szeroka obsługa wyjątków i braki zależności obniżają jakość. | Przydatne prywatne metody pomocnicze i precyzyjne wykrywanie konfliktów; długi serwis oraz niebezpieczne ponowne użycie kontekstu wymagają poprawy. |
| Jakość architektury i projektu | Sensowny zarys bezstanowego API i relacyjnej bazy, ale słabe egzekwowanie krytycznych reguł biznesowych. | Spójny zarys modularnego monolitu i unikalność kluczy w obrębie klienta; nieaktualny cache katalogu wpływa na składanie zamówienia. | Najlepsze konkretne mechanizmy współbieżności i odczyty ograniczone do klienta; słabościami są globalne klucze idempotencji i gotowość zależna od cache. |
| Jasność | Polskie wyjaśnienie z angielskimi nagłówkami; kilka deklaracji przeczy implementacji. | Jasne polskie omówienie i kompromisy, lecz deklaracje o optymistycznej współbieżności i bezpiecznych błędach wykraczają poza kod. | Szczegółowe wyjaśnienie spójności i rywalizacji o zasoby; nadmierna pewność co do poprawności ponowień. |
| Zbędna rozwlekłość | Mimo najkrótszej odpowiedzi powtarza deklaracje architektoniczne i dodaje nieużywany kod pomocniczy. | Powtarzane listy zaleceń produkcyjnych i rozbudowane przygotowanie środowiska; wiele dodatkowych szczegółów jest jednak istotnych. | Najdłuższa odpowiedź; powtarza opis przepływu i zabezpieczeń oraz dodaje rozbudowaną konfigurację operacyjną, choć dodatkowa logika główna jest przydatna. |
| Przydatność praktyczna | Zarys koncepcyjny wymagający znacznych poprawek. | Przydatny punkt wyjścia dla katalogu i Outbox po naprawie kompilacji oraz transakcji. | Najlepsza implementacja referencyjna do nauki, ale niegotowa do produkcji w dostarczonej postaci. |

## Istotne ustalenia

### Mini: deklaracje gotowości produkcyjnej nie mają pokrycia w implementacji

- **Błędy blokujące kompilację:** wyrażenie filtra `.HasFilter(""IdempotencyKey" IS NOT NULL");` zawiera niepoprawny zapis cudzysłowów w ciągu C#. Kontroler używa również `Request.Headers.IdempotencyKey`, które nie jest standardową właściwością `IHeaderDictionary`; nie dostarczono własnego elementu o tej nazwie.
- **Granica zaufania:** żądanie dostarcza `CustomerId`, nazwy produktów i ceny jednostkowe. Brakuje rejestracji uwierzytelniania, odpowiedniego middleware i atrybutu autoryzacji. Wywołujący może wybrać innego klienta i dowolne dodatnie ceny; sprawdzenie dodatniej wartości nie zapewnia wiarygodnej kwoty zamówienia.
- **Idempotencja:** opcjonalny, globalnie unikalny klucz jest sprawdzany przed zapisem. Zamierzony indeks unikalny może zapobiec duplikatom po poprawieniu składni, ale przegrany równoległy zapis nie jest obsługiwany jako ponowienie zwracające wcześniejszy wynik. Ogólny middleware zwraca zamiast tego 500. Klucze nie są ograniczone do klienta, a treść żądania nie jest porównywana, więc istniejący klucz może zwrócić wynik innego żądania.
- **Niepełna integracja:** nazwana polityka ograniczania ruchu nie jest przypisana do endpointu ani ustawiona jako ograniczenie globalne. OpenTelemetry jest opisane, ale niezarejestrowane. `GetById` zwraca tekst bez odczytu z magazynu danych. Projekt warstwy aplikacyjnej zależy bezpośrednio od infrastruktury, a `Result` i metody pomocnicze kluczy cache zwiększają ilość kodu, nie uczestnicząc w tworzeniu zamówienia.

Odpowiedź używa sensownego słownictwa architektonicznego i cienkiego kontrolera, lecz nie rekompensuje to brakujących zabezpieczeń działania systemu.

### Terra: lepszy podział odpowiedzialności i Outbox, ale błędna konfiguracja transakcji

Terra pobiera tożsamość klienta z JWT, ogranicza odczyty i unikalność kluczy idempotencji do klienta, pobiera ceny po stronie serwera oraz wspólnie zapisuje zamówienie i wiadomość Outbox. Rzeczywisty GET i inicjalizacja SQL są bardziej przydatne niż atrapa Mini.

Pozostają jednak problemy:

- **Brakujące pakiety:** `AddDbContextCheck` wymaga `Microsoft.Extensions.Diagnostics.HealthChecks.EntityFrameworkCore`, a `AddRuntimeInstrumentation` wymaga `OpenTelemetry.Instrumentation.Runtime`. Żaden z nich nie występuje w dostarczonym projekcie. Zobacz [konfigurację testów stanu usług w dokumentacji Microsoft](https://learn.microsoft.com/en-us/aspnet/core/host-and-deploy/health-checks?view=aspnetcore-10.0#entity-framework-core-dbcontext-probe) oraz [instrumentację środowiska uruchomieniowego OpenTelemetry](https://github.com/open-telemetry/opentelemetry-dotnet-contrib/blob/main/src/OpenTelemetry.Instrumentation.Runtime/README.md).
- **Błąd blokujący tworzenie zamówienia:** `EnableRetryOnFailure(3)` połączono z jawną transakcją bez umieszczenia całej operacji w delegacie strategii wykonania. EF Core odrzuca to połączenie podczas wykonywania operacji bazodanowych wewnątrz transakcji. Naprawienie samych zależności nie wystarczy więc do uruchomienia POST tworzącego nowe zamówienie. Zobacz [wymagania EF Core dotyczące transakcji i ponowień](https://learn.microsoft.com/en-us/ef/core/miscellaneous/connection-resiliency#execution-strategies-and-transactions).
- **Ujawnianie szczegółów błędów:** każdy `InvalidOperationException` jest klasyfikowany jako błąd biznesowy, a jego komunikat zwracany ze statusem 422. Obejmuje to również błędy frameworka i programistyczne, w tym opisany błąd transakcji. Odpowiedź poleca użytkownikowi podać identyfikator śledzenia, lecz nie umieszcza go w tworzonym Problem Details.
- **Niepełny kontrakt ponowień:** ten sam klient i klucz, ale inna treść żądania, zwracają stare zamówienie bez wykrycia różnicy. Obsługa równoległych zapisów przechwytuje wszystkie `DbUpdateException`, zamiast rozpoznawać konkretne oczekiwane naruszenie unikalności.
- **Powiązanie składania zamówienia z cache:** Redis dostarcza ceny i informacje o aktywności produktów ważne nawet przez pięć minut; przy składaniu zamówienia nie są one ponownie weryfikowane w PostgreSQL. Wyjątki Redis również przerywają tę operację, zamiast powodować awaryjny odczyt z bazy. Sekwencyjne wywołania cache dla każdego produktu zwiększają liczbę operacji sieciowych.
- **Braki ochrony i telemetrii:** jedna wspólna polityka 30 żądań na minutę obejmuje wszystkie endpointy kontrolerów, również GET; nie jest to limit osobny dla klienta ani rozproszony. Śledzenie ma instrumentację, lecz nie ma eksportera. Optymistyczna współbieżność została opisana, ale nie zaimplementowano tokenu współbieżności ani równoważnego mechanizmu aktualizacji.

Zapis Outbox jest rzeczywistą zaletą, lecz publikowanie wiadomości wyraźnie pozostawiono do realizacji przez przyszły proces roboczy.

### Sol: najlepsze podejście do współbieżności, ale istotny błąd ponowień

Sol implementuje warunkowe atomowe zmniejszanie zapasów, wiarygodne ceny pobierane z bazy, transakcję obejmującą zapisy magazynu, zamówienia i idempotencji, skrót z kanonicznej postaci żądania oraz wykrywanie konkretnego ograniczenia idempotencji. Odczyty i klucze cache uwzględniają tożsamość klienta. Awarie cache są przechwytywane, a eksportery śledzenia i metryk skonfigurowane. To merytoryczne ulepszenia, a nie korzyści wynikające wyłącznie z długości odpowiedzi.

Ograniczenia pozostają istotne:

- **Stan przy ponowieniach nie jest resetowany:** kod przekazany strategii wykonania ponownie używa tego samego `_db`. Przed aktualizacją zapasów zapisuje i śledzi `IdempotencyRecord`. Jeśli późniejsza operacja powoduje wycofanie transakcji i ponowienie, następna próba tworzy kolejną encję z tym samym kluczem, podczas gdy pierwsza nadal jest śledzona. Może to wywołać wyjątek konfliktu tożsamości śledzonych encji zamiast skutecznego ponowienia. Zewnętrzne `ChangeTracker.Clear()` obsługuje tylko osobną ścieżkę naruszenia unikalności, a nie ponowienia po błędach przejściowych. Przewidywanie wynika z [zasad rozpoznawania tożsamości encji w EF Core](https://learn.microsoft.com/en-us/ef/core/change-tracking/identity-resolution); [Npgsql 10 jawnie klasyfikuje błędy serializacji transakcji i zakleszczenia jako przejściowe](https://github.com/npgsql/npgsql/blob/v10.0.0/src/Npgsql/PostgresException.cs).
- **Koszty rywalizacji o zasoby:** produkty są aktualizowane w kolejności podanej w żądaniu, a nie według stałej kolejności zakładania blokad. Zamówienia zawierające kilka częściowo wspólnych produktów mogą prowadzić do zakleszczeń. Dwie operacje bazodanowe z await na każdą pozycję dodatkowo wydłużają transakcję; odpowiedź nie przedstawia wyników testów obciążeniowych potwierdzających deklarowaną skalowalność.
- **Zakres klucza:** klucze idempotencji są globalnie unikalne. Uwzględnienie klienta w skrócie żądania zapobiega zwróceniu odpowiedzi innego klienta, ale klucz jednego klienta nadal koliduje z identycznym kluczem drugiego. Złożony klucz klient/klucz zastosowany przez Terra ma lepiej dobrany zakres unikalności.
- **Walidacja:** po `NotNull()` i `NotEmpty()` występują predykaty `Must` odwołujące się do kolekcji. Domyślna kaskada FluentValidation kontynuuje sprawdzanie po wcześniejszych niepowodzeniach, więc kolekcja null przekazana do tego walidatora powoduje wyjątek zamiast błędów walidacji. Elementy null również psują predykat unikalności. Same adnotacje nullowalności C# nie odrzucają takiego JSON. Zobacz [działanie kaskady FluentValidation](https://docs.fluentvalidation.net/en/latest/cascade.html) oraz [egzekwowanie nullowalności w System.Text.Json](https://learn.microsoft.com/en-us/dotnet/standard/serialization/system-text-json/nullable-annotations). Mini i Terra zawierają podobne niebezpieczne predykaty kolekcji, choć MVC może odrzucić część wejść null przed uruchomieniem ich walidatorów.
- **Sprzeczność w dostępności:** Redis jest traktowany jako opcjonalny w operacjach serwisu, lecz obowiązkowy w testach gotowości. Jeśli routing wdrożenia korzysta z wyniku tych testów, awaria Redis może wyłączyć z obsługi ruchu wszystkie repliki, mimo możliwości odczytu z bazy.
- **Niedokończone elementy produkcyjne:** publikowanie Outbox, retencja i szersze polityki autoryzacji nie są zaimplementowane. Sol opisuje je jednak jako rozszerzenia, zamiast udawać, że już istnieją.

## Wniosek

**gpt-5.6-sol-high udzielił najlepszej odpowiedzi na ten prompt**, przed **gpt-5.6-terra-medium** i **gpt-5.4-mini-low**.

Sol wygrywa dzięki konkretnym mechanizmom kontroli współbieżności zapasów, idempotencji uwzględniającej treść żądania, wiarygodnym cenom, odczytom ograniczonym do klienta i obsłudze awarii cache — nie dzięki długości. Błąd stanu przy ponowieniach bezpośrednio dotyczy wymaganego scenariusza dużej współbieżności i musi zostać naprawiony przed użyciem produkcyjnym. Klucz ograniczony do klienta i transakcyjny zapis Outbox u Terra są przydatnymi zaletami, lecz brakujące zależności oraz niezgodność transakcji z ponowieniami stanowią bardziej bezpośrednie przeszkody. Mini jest najszybszy i najkrótszy, ale ma największą rozbieżność między deklaracjami produkcyjnymi a działającymi zabezpieczeniami.

W porównaniu z Terra model Sol zużył o 4610 tokenów wyjściowych więcej i potrzebował o 80824 ms więcej w dostarczonych uruchomieniach. Ulepszenia techniczne są istotne, lecz nie dowodzą opłacalności ani gotowości produkcyjnej. **Żadnej z trzech odpowiedzi nie można bezpiecznie wdrożyć bez zmian.**
