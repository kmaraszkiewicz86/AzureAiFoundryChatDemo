
## Wstęp
Artykuł będzie przedstawiał, jak można z pomocą React + SignalR + .NET API stworzyć prosty projekt, zawierający logikę AI, która będzie korzystać z technologii Azure AI Foundry. Dodam również 3 modele LLM: 1x low, 1x medium oraz 1x high, aby sprawdzić koszty oraz jakość odpowiedzi na 4 oddzielne prompty.
1. ### Proste zadanie — podstawowe generowanie kodu: <br />
	#### Prompt:  <br />
	Stwórz prostą aplikację konsolową Hello World w C# z użyciem najnowszej stabilnej wersji .NET. Pokaż kompletny kod oraz krótko wyjaśnij, jak uruchomić aplikację.
	- #### Dlaczego ten prompt?
		To bardzo proste zadanie, które pozwala sprawdzić podstawową jakość generowanego kodu oraz to, czy model nie komplikuje niepotrzebnie prostego problemu. Jest też dobrym punktem odniesienia do porównania liczby wykorzystanych tokenów, czasu odpowiedzi i kosztu pomiędzy modelami.

1. ### Średnio zaawansowane zadanie — implementacja REST API:  <br />
	#### Prompt:  <br />
	Stwórz proste REST API w ASP.NET Core do zarządzania listą produktów. Dodaj endpointy GET, POST i DELETE. Użyj kontrolerów, Dependency Injection, async/await oraz walidacji danych wejściowych. Dane mogą być przechowywane w pamięci. Pokaż wszystkie wymagane klasy oraz krótko opisz strukturę rozwiązania. 
	- #### Dlaczego ten prompt?: <br />
		To zadanie jest bliższe rzeczywistemu zastosowaniu modelu przez programistę. Pozwala sprawdzić, czy model poprawnie rozumie strukturę aplikacji ASP.NET Core, Dependency Injection, programowanie asynchroniczne oraz podstawowe zasady projektowania API. Odpowiedź powinna być wyraźnie bardziej rozbudowana niż w pierwszym teście, dlatego można również porównać wzrost liczby tokenów i kosztu.

1. ### Zaawansowane zadanie — architektura i implementacja:  <br />
	#### Prompt:  <br />
	Zaprojektuj produkcyjne REST API w ASP.NET Core do obsługi zamówień. API powinno obsługiwać dużą liczbę równoległych requestów. Zaproponuj architekturę rozwiązania, sposób przechowywania danych, strategię cache, obsługę błędów, logging, monitoring oraz zabezpieczenia. Następnie pokaż przykładową implementację endpointu tworzącego zamówienie wraz z warstwą serwisową. Wyjaśnij najważniejsze decyzje architektoniczne oraz ich zalety i wady.
	- #### Dlaczego ten prompt?  <br />
		Ten test wymaga od modelu nie tylko wygenerowania kodu, ale również analizy problemu i podejmowania decyzji architektonicznych. Pozwala sprawdzić jakość reasoning, znajomość zagadnień związanych z wydajnością, bezpieczeństwem i skalowaniem oraz umiejętność uzasadniania proponowanych rozwiązań. W tym przypadku będzie można sprawdzić, czy różnice pomiędzy słabszymi i mocniejszymi modelami są bardziej widoczne.

1. ### Analiza istniejącego kodu — Code Review

	#### Prompt:
	```text
	Przeanalizuj poniższy kod C#. Znajdź błędy, problemy związane z async/await, obsługą wyjątków, wydajnością oraz jakością kodu. Zaproponuj tylko niezbędne poprawki bez niepotrzebnego przepisywania całej implementacji. Wyjaśnij każdą zaproponowaną zmianę.
	
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
	
	#### Dlaczego ten prompt?
	
	To zadanie pozwala sprawdzić, czy model potrafi analizować istniejący kod zamiast generować rozwiązanie od zera. Kod zawiera kilka celowych problemów, między innymi niepoprawne użycie async/await, zbędne `Task.FromResult`, zbyt ogólny wyjątek oraz potencjalnie synchroniczne wywołanie repozytorium.
	
	Dzięki temu można łatwo porównać, czy różne modele wykrywają te same problemy, czy proponują minimalne i poprawne zmiany oraz jak dobrze uzasadniają swoje decyzje.

W artykule wyjaśnię również logikę UI oraz API, omówię, jak można stworzyć prompt w API, zawierający pytanie od użytkownika.

## Tworzenie serwisu AI Foundry na środowisku Azure

Wejdź na konto Azure 
https://portal.azure.com/
1. Zaloguj się albo stwórz konto jeżeli go nie masz. W głównym katalogu kliknij przycisk Create.

	<img width="536" height="340" alt="image" src="https://github.com/user-attachments/assets/302958eb-c5ae-4737-b168-50c206a05698" />

1. Potem w polu wyszukiwania wpisz AI foundry

	<img width="640" height="290" alt="image" src="https://github.com/user-attachments/assets/35f0074d-8c55-4ce0-98ca-b44e5be3074d" />

1. Wybierz Microsoft Foundry od Microsoft.

	<img width="1359" height="775" alt="image" src="https://github.com/user-attachments/assets/9f454e9f-78df-4cca-9c17-5b95144b37b0" />

1. Stwórz lub wybierz Resource Group:

	<img width="718" height="693" alt="image" src="https://github.com/user-attachments/assets/3e63ced0-bf38-449c-b073-ef78303aed87" />

1. Wypełnij pole Name oraz nazwę projektu.

	<img width="942" height="948" alt="image" src="https://github.com/user-attachments/assets/ee3a0efb-4db5-4a97-b4e5-4cd243c53af4" />

1. Kliknij przycisk 'Review + create', następnie 'Create'.

	Teraz, aby przejść do Azure AI Foundry, odszukaj zasób Azure:

	<img width="1376" height="442" alt="image" src="https://github.com/user-attachments/assets/a9c95e8f-30a6-4484-b32c-da9701463929" />

1. W następnym oknie kliknij przycisk Go to Foundry portal

	<img width="1395" height="729" alt="image" src="https://github.com/user-attachments/assets/b2ea9326-e8ab-4a02-a8c5-6b459cbcce28" />

1. Przejdź do wyboru modelu i kliknij 'Explore models'.

	<img width="1496" height="815" alt="image" src="https://github.com/user-attachments/assets/642bd1d7-358a-411e-a7c7-168596bb421f" />

1. Z listy wybierz model np. gpt-5.6-sol
   
	<img width="1588" height="310" alt="image" src="https://github.com/user-attachments/assets/806c3b79-527e-47ca-8e3b-86f242a01321" />

1. Na następnym ekranie wybierz Default settings lub Custom settings, w zależności od tego, czy chcesz użyć domyślnej nazwy i ustawień, czy skonfigurować je samodzielnie.

	<img width="1401" height="277" alt="image" src="https://github.com/user-attachments/assets/00489dcb-38ce-4ec2-b873-24a6239436f9" />

1. Ja wybiorę Custom settings i nazwę model po swojemu. Dla potrzeb tego artykułu stworzę 3 różne modele do testów, dzięki którym będę mógł porównać koszty oraz jakość odpowiedzi:
	- **"gpt-5.4-mini-low"** – użyty będzie model `gpt-5.4-mini`.  
	  Cena Global Standard za 1 mln tokenów: **€0.66 input / €3.96 output**.  
	  Jest około **2.67x tańszy od gpt-5.6-terra** oraz około **6.67x tańszy od gpt-5.6-sol**.
	
	- **"gpt-5.6-terra-medium"** – użyty będzie model `gpt-5.6-terra`.  
	  Cena Global Standard za 1 mln tokenów: **€1.76 input / €10.55 output**.  
	  Jest około **2.67x droższy od gpt-5.4-mini** oraz około **2.5x tańszy od gpt-5.6-sol**.
	
	- **"gpt-5.6-sol-high"** – użyty będzie model `gpt-5.6-sol`.  
	  Cena Global Standard za 1 mln tokenów: **€4.40 input / €26.36 output**.  
	  Jest około **6.67x droższy od gpt-5.4-mini** oraz około **2.5x droższy od gpt-5.6-terra**.

	### Źródła
	
	- [Microsoft Azure OpenAI pricing](https://azure.microsoft.com/en-us/pricing/details/azure-openai/)
	
	> **Uwaga:** Ceny zostały sprawdzone podczas tworzenia artykułu i dotyczą wariantu Global Standard. Cennik Microsoft Azure może ulec zmianie, dlatego przed wykonaniem własnych testów warto sprawdzić aktualne ceny na oficjalnej stronie Azure.

Ostatecznie moja lista deployment'u, jest pokazana na poniższym screen'ie:
	<img width="1594" height="312" alt="image" src="https://github.com/user-attachments/assets/a61084b1-5e75-43ce-9912-b14233580b6d" />

   
## Omówienie logiki po stronie UI

## Omówienie logiki po stronie API

## Analiza 4 pytań od użytkownika wraz z analizą jakości odpowiedzi, kosztów i ile tokenów jest wykorzystywane przez 3 różne modele.
Przedstawię poniżej analizę tego, jak różne LLM-y radzą sobie z pytaniami, ile tokenów wykorzystują oraz jakie są koszty poszczególnych zapytań. Trzeba przy tym pamiętać, że liczba zużytych tokenów może się różnić, dlatego przedstawione wyniki mogą być inne niż wyniki zaobserwowane na innych środowiskach.

## Analiza modeli

W artykule nie będą zamieszczane pełne odpowiedzi generowane przez poszczególne modele, ponieważ w przypadku bardziej rozbudowanych promptów mogą one być bardzo obszerne.

Dla każdego testu szczegółowe wyniki będą zapisywane w repozytorium GitHub projektu:

https://github.com/kmaraszkiewicz86/AzureAiFoundryChatDemo

Przy każdym porównaniu w artykule zostanie umieszczony link do odpowiedniego katalogu z wynikami. Dzięki temu będzie można sprawdzić:

- dokładną treść promptu użytego w teście,
- pełną odpowiedź wygenerowaną przez każdy z modeli,
- liczbę tokenów wejściowych,
- liczbę tokenów wyjściowych,
- łączną liczbę wykorzystanych tokenów,
- czas wykonania odpowiedzi,
- szczegółowe wyliczenie kosztu dla danego modelu,
- porównanie jakości odpowiedzi oraz opis najważniejszych różnic pomiędzy modelami.

Dla każdego promptu zostanie również przygotowane osobne podsumowanie jakościowe odpowiedzi wszystkich modeli.

Do wygenerowania tych podsumowań wykorzystałem aplikację Codex z modelem GPT-5.6 Sol High. Model analizował zapisane odpowiedzi i porównywał je między innymi pod kątem poprawności technicznej, kompletności, jakości kodu, podejścia architektonicznego, czytelności oraz praktycznej użyteczności.

Takie podejście pozwala zachować czytelność samego artykułu, a jednocześnie daje możliwość samodzielnego przejrzenia pełnych wyników i zweryfikowania, na jakiej podstawie zostały wyciągnięte poszczególne wnioski.

1. Najpierw zacznijmy od prostego pytania i zobaczymy jak sobie radzą 3 rózne modele poradzą, więc zaczynamy od pytania:
`Stwórz prostą aplikację konsolową Hello World w C# z użyciem najnowszej stabilnej wersji .NET. Pokaż kompletny kod oraz krótko wyjaśnij, jak uruchomić aplikację.`
<img width="1906" height="370" alt="image" src="https://github.com/user-attachments/assets/277af9ab-6db3-4703-b592-bdd29df3ea78" />
Wyniki są następujące:

1. Teraz przejdźmy do bardziej złożonego pytania:
`Stwórz proste REST API w ASP.NET Core do zarządzania listą produktów. Dodaj endpointy GET, POST i DELETE. Użyj kontrolerów, Dependency Injection, async/await oraz walidacji danych wejściowych. Dane mogą być przechowywane w pamięci. Pokaż wszystkie wymagane klasy oraz krótko opisz strukturę rozwiązania.`
<img width="1895" height="348" alt="image" src="https://github.com/user-attachments/assets/1b94c320-82c2-4e1a-9fc4-a8ec91b1d9fe" />
Wyniki są następujące:

1. Najpierw zacznijmy od prostego pytania i zobaczymy jak sobie radzą 3 rózne modele poradzą, więc zaczynamy od pytania:
`Zaprojektuj produkcyjne REST API w ASP.NET Core do obsługi zamówień. API powinno obsługiwać dużą liczbę równoległych requestów. Zaproponuj architekturę rozwiązania, sposób przechowywania danych, strategię cache, obsługę błędów, logging, monitoring oraz zabezpieczenia. Następnie pokaż przykładową implementację endpointu tworzącego zamówienie wraz z warstwą serwisową. Wyjaśnij najważniejsze decyzje architektoniczne oraz ich zalety i wady.`
Wyniki są następujące:

1. Na koniec pytanie na prosty refactoring danej metody, można sprawdzić jak dane modele poradzą sobię z refactoringiem:
`Przeanalizuj poniższy kod C#. Znajdź błędy, problemy związane z async/await, obsługą wyjątków, wydajnością oraz jakością kodu. Zaproponuj tylko niezbędne poprawki bez niepotrzebnego przepisywania całej implementacji. Wyjaśnij każdą zaproponowaną zmianę.
	
	public async Task<Product?> GetProductAsync(int id)
	{
	    var product = _repository.GetById(id);
	
	    if (product == null)
	    {
	        throw new Exception("Product not found");
	    }
	
	    return await Task.FromResult(product);
	}`
Wyniki są następujące:

## Źródła i materiały

Poniżej znajduje się lista źródeł wykorzystanych podczas tworzenia artykułu.

1. **Microsoft Azure Portal**  
   https://portal.azure.com/  
   Wykorzystane do utworzenia zasobu Microsoft Foundry oraz konfiguracji modeli używanych w projekcie.

2. **Azure OpenAI Service Pricing**  
   https://azure.microsoft.com/en-us/pricing/details/azure-openai/  
   Wykorzystane do sprawdzenia aktualnych cen tokenów dla modeli:
   - `gpt-5.4-mini`
   - `gpt-5.6-terra`
   - `gpt-5.6-sol`

3. **AzureAiFoundryChatDemo – GitHub Repository**  
   https://github.com/kmaraszkiewicz86/AzureAiFoundryChatDemo  
   Repozytorium zawierające kod źródłowy aplikacji przedstawionej w artykule.

> **Informacja:** Dokumentacja, funkcjonalności Microsoft Foundry oraz ceny modeli mogą zmieniać się w czasie. Informacje przedstawione w artykule były aktualne w momencie jego tworzenia. W przypadku cen modeli warto zawsze zweryfikować aktualny cennik na oficjalnej stronie Microsoft Azure.

