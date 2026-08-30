# Zbiorcze porównanie modeli — prompty 1–4

## Stawki i obliczanie kosztów

Przyjęto ceny **Global Standard w EUR**, według cennika [Microsoft Azure OpenAI](https://azure.microsoft.com/en-us/pricing/details/azure-openai/) przekazanego w załączniku, stan na **2026-08-30**. Terra i Sol korzystają ze stawek dla krótkiego kontekstu.

| Wdrożenie modelu | Pozycja cennika Azure | Wejście za 1 mln tokenów (EUR) | Wyjście za 1 mln tokenów (EUR) |
| --- | --- | ---: | ---: |
| gpt-5.4-mini-low | GPT-5.4 mini Global | 0,66 | 3,96 |
| gpt-5.6-terra-medium | GPT-5.6 Terra Standard Global — krótki kontekst | 1,76 | 10,55 |
| gpt-5.6-sol-high | GPT-5.6 Sol Standard Global — krótki kontekst | 4,40 | 26,36 |

Koszt = (tokeny wejściowe × stawka wejścia + tokeny wyjściowe × stawka wyjścia) / 1 000 000. To szacunkowy koszt tokenów według zwykłych stawek; brak osobnych liczników cache uniemożliwia uwzględnienie jego rozliczenia.

Zapowiedziana obniżka cen Sol w Azure obowiązuje od 1 września 2026 r., dlatego nie została zastosowana do wyceny na 30 sierpnia. Źródło: [komunikat Microsoft o GPT-5.6 w Foundry](https://azure.microsoft.com/en-us/blog/gpt-5-6-now-available-in-microsoft-foundry/).

## Łączne wyniki

Sumy obejmują cztery zapisane odpowiedzi każdego modelu. Średni czas to suma czasów odpowiedzi podzielona przez cztery; suma nie oznacza czasu ściennego równoległego uruchomienia modeli.

| Wdrożenie modelu | Tokeny wejściowe | Tokeny wyjściowe | Tokeny łącznie | Koszt łączny (EUR) | Łączny czas (ms) | Średni czas (ms) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| gpt-5.4-mini-low | 4446 | 14620 | 19066 | 0,06082956 | 70568 | 17642 |
| gpt-5.6-terra-medium | 4446 | 19191 | 23637 | 0,21029001 | 174944 | 43736 |
| gpt-5.6-sol-high | 4446 | 24248 | 28694 | 0,65873968 | 285219 | 71304,75 |

Łączny szacunkowy koszt tokenów wszystkich dwunastu odpowiedzi: **0,92985925 EUR**.

## Wyniki jakościowe poszczególnych promptów

| Prompt | Najmocniejszy model | Główna przewaga |
| --- | --- | --- |
| [1 — Hello World](prompt-1/comparison.md) | gpt-5.6-terra-medium | Poprawna wersja .NET 10, kompletny minimalny kod i czytelniejsza kolejność uruchomienia. |
| [2 — API produktów](prompt-2/comparison.md) | gpt-5.6-sol-high | Spójna obsługa błędów, wyjaśnienie kontraktu asynchronicznego i praktyczne przykłady. |
| [3 — API zamówień](prompt-3/comparison.md) | gpt-5.6-sol-high | Najbardziej konkretne mechanizmy współbieżności, idempotencji, wiarygodnych cen i izolacji danych klienta. |
| [4 — przegląd kodu async](prompt-4/comparison.md) | gpt-5.6-terra-medium | Lepsze dopasowanie poprawek do warunków i wymaganego kontraktu Task. |

## Porównanie końcowe

**gpt-5.4-mini-low** był najtańszy i najszybszy w każdym zadaniu, ale we wszystkich czterech porównaniach zajął trzecie miejsce. Błędna wersja .NET, brakujące zależności, problemy z generowaniem linku po POST oraz zmiana zachowania metody przy braku produktu ograniczają przydatność gotowych odpowiedzi. Niska cena nie rekompensuje tych błędów, gdy oczekiwany jest kod gotowy do użycia.

**gpt-5.6-terra-medium** wygrał prompty 1 i 4, a w pozostałych był drugi. Dobrze łączy prostotę, jasność i dopasowanie do zadania. Łącznie kosztował 0,21029001 EUR przy średnim czasie 43 736 ms, wyraźnie mniej niż Sol. Nadal wymaga kontroli: w API produktów pozostają problemy walidacji, a w API zamówień — zależności i współpraca transakcji z ponowieniami.

**gpt-5.6-sol-high** wygrał oba zadania dotyczące API. Jego przewaga była najbardziej widoczna w projekcie zamówień, gdzie podał konkretne mechanizmy ochrony danych i obsługi współbieżności. Był jednak najdroższy i najwolniejszy, a w zadaniu wymagającym minimalnych poprawek dodawał niepotrzebny kod i niepotwierdzoną regułę ID. Także jego rozwiązanie zamówień wymaga naprawy obsługi stanu przy ponowieniach.

## Wniosek

**Terra zapewnił najlepszy kompromis jakości, kosztu i czasu w tym zestawie. Sol był najmocniejszy w bardziej rozbudowanych zadaniach projektowych dotyczących API**, ale jego dodatkowy koszt nie przyniósł przewagi w prostym przykładzie ani w zadaniu minimalnej korekty kodu. Mini wygrywa ceną i szybkością, lecz wymagał największej ostrożności przy wykorzystaniu wyników. Żadna odpowiedź dotycząca produkcyjnego API zamówień nie była gotowa do wdrożenia bez poprawek.

