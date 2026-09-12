
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

Zaczynamy od [StreamingChat.tsx](https://github.com/kmaraszkiewicz86/AzureAiFoundryChatDemo/tree/main/src/AIChat.Web/src/components/StreamingChat.tsx), czyli komponentu z formularzem i odpowiedziami modeli. Użytkownik wysyła jedno pytanie, a komponent pokazuje osobny wynik każdego wdrożenia; treść pojawia się stopniowo, w miarę odbierania fragmentów z API.

SignalR utrzymuje połączenie, przez które API przesyła do przeglądarki zdarzenia bez ponawiania zapytań o postęp. W tym projekcie odbiorcy dołączają do grupy przypisanej do `requestId`, a API kieruje do niej fragmenty i informacje o zakończeniu odpowiedzi.

1. **Formularz odczytuje pytanie, a komponent przechowuje stan widoku.**

   Pole `textarea` ma `name="question"`. Wpisywany tekst pozostaje w formularzu; komponent odczytuje go przy wysłaniu, natomiast w stanie React przechowuje pytanie już wysłane i postęp generowania:

   ```tsx
   const service = useRef(new StreamingChatService())
   const [state, setState] = useState<StreamingChatState>({
     submittedQuestion: '',
     responses: [],
     error: '',
     isLoading: false,
   })
   const { submittedQuestion, responses, error, isLoading } = state
   ```

   `service.current` daje kolejnym renderowaniom dostęp do tej samej używanej instancji serwisu. `submittedQuestion` pozwala wyświetlać pytanie przy odpowiedziach także po wyczyszczeniu formularza, `responses` zawiera wyniki modeli, `error` opisuje błąd całego żądania, a `isLoading` steruje dostępnością formularza.

   Powiązanie `<form onSubmit={handleSubmit}>` prowadzi do następującej metody:

   ```tsx
   async function handleSubmit(event: FormEvent<HTMLFormElement>) {
     event.preventDefault()
     if (isLoading) return

     const form = event.currentTarget
     const question = String(new FormData(form).get('question') ?? '').trim()
     if (!question) return

     const queued = await service.current.ask(question, (progress) => {
       setState({ submittedQuestion: question, ...progress })
     })
     if (queued) form.reset()
   }
   ```

   `preventDefault()` zatrzymuje standardowe wysłanie formularza przez przeglądarkę. `FormData` odczytuje pole po jego nazwie, `trim()` usuwa skrajne białe znaki, a dwa warunki pomijają wysłanie podczas generowania i pytanie bez treści.

   Callback przekazany do `ask` może zostać wywołany wiele razy: przy rozpoczęciu, nadejściu fragmentu i zakończeniu modelu. Każde `setState` przekazuje Reactowi nowy stan do wyświetlenia; wynik `queued` informuje o rozpoczęciu obsługi żądania, więc `form.reset()` może wyczyścić pole, gdy modele jeszcze generują odpowiedzi.

1. **Serwis przygotowuje nowe żądanie i ustala kolejność operacji.**

   Metoda `ask` w [streamingChatService.ts](https://github.com/kmaraszkiewicz86/AzureAiFoundryChatDemo/tree/main/src/AIChat.Web/src/services/streamingChatService.ts) łączy działania potrzebne do rozpoczęcia transmisji: kończy poprzednie połączenie, tworzy identyfikator pytania, przygotowuje stan oraz rejestruje odbiór zdarzeń.

   ```ts
   async ask(question: string, onProgress: (progress: StreamingProgress) => void): Promise<boolean> {
     const previousConnectionStopped = this.stop()
     const requestId = crypto.randomUUID()
     const connection = new ChatConnectionService()
     this.connection = connection
     this.onProgress = onProgress
     this.progress = { responses: [], isLoading: true, error: '' }
     this.subscribeToResponses(connection, requestId)
     onProgress(this.progress)

     try {
       await previousConnectionStopped
       if (this.connection !== connection) return false
       if (!await connection.start(requestId)) return false
       if (this.connection !== connection || !connection.isConnected) return false

       // The connection has joined its group, so the first model chunk already has a listener.
       await startStreamingQuestion(requestId, question)
       return this.connection === connection && connection.isConnected
     } catch {
       if (this.connection === connection) {
         this.failRequest(ChatErrors.StartFailed)
         await this.stop().catch(console.error)
       }
       return false
     }
   }
   ```

   `crypto.randomUUID()` tworzy identyfikator wspólny dla połączenia, żądania HTTP i późniejszych zdarzeń. `onProgress(this.progress)` od razu przekazuje stan `isLoading: true`, dzięki czemu formularz blokuje się jeszcze przed odpowiedzią API.

   Po każdym ważnym `await` serwis sprawdza, czy połączenie nadal jest bieżące. Jeżeli w międzyczasie komponent zamknął połączenie lub rozpoczęto inne żądanie, poprzednia operacja nie powinna kontynuować wysyłania pytania.

   Właściwe otwarcie połączenia wykonuje [chatConnectionService.ts](https://github.com/kmaraszkiewicz86/AzureAiFoundryChatDemo/tree/main/src/AIChat.Web/src/services/chatConnectionService.ts). Obiekt powstaje przez `new HubConnectionBuilder().withUrl(Environment.chatHubUrl).build()`, a metoda `start` łączy klienta i wywołuje metodę huba:

   ```ts
   async start(requestId: string): Promise<boolean> {
     if (this.stopped) return false
     await this.connection.start()
     if (this.stopped) return false
     await this.connection.invoke(ChatHubMethods.JoinRequest, requestId)
     return this.isConnected
   }
   ```

   `JoinRequest` musi zakończyć się przed `startStreamingQuestion`. Dzięki temu grupa ma już odbiorcę, gdy API zacznie wysyłać `ResponseStarted` i pierwsze fragmenty odpowiedzi; nazwa wywoływanej metody pochodzi ze stałej `ChatHubMethods.JoinRequest`.

1. **Axios przekazuje pytanie do API.**

   Funkcja `startStreamingQuestion` w [chatService.ts](https://github.com/kmaraszkiewicz86/AzureAiFoundryChatDemo/tree/main/src/AIChat.Web/src/services/chatService.ts) odpowiada za pojedyncze żądanie HTTP:

   ```ts
   export async function startStreamingQuestion(requestId: string, question: string): Promise<void> {
     const requestBody: AskStreamingQuestionRequest = {
       requestId,
       question: question.trim()
     }

     await axios.post(Environment.streamingChatUrl, requestBody)
   }
   ```

   Przesyłany JSON zawiera `requestId` oraz `question`. `await axios.post(...)` czeka na odpowiedź endpointu, który potwierdza przyjęcie pytania do kolejki statusem `202 Accepted`; właściwy tekst odpowiedzi jest obsługiwany przez wcześniej zarejestrowane zdarzenia.

   Adresy ustawia [environment.ts](https://github.com/kmaraszkiewicz86/AzureAiFoundryChatDemo/tree/main/src/AIChat.Web/src/environments/environment.ts): `apiUrl` ma wartość `http://localhost:5000`, `streamingChatUrl` wskazuje `/api/chat/stream`, a `chatHubUrl` to względna ścieżka `/hubs/chat`. W środowisku deweloperskim [vite.config.ts](https://github.com/kmaraszkiewicz86/AzureAiFoundryChatDemo/tree/main/src/AIChat.Web/vite.config.ts) przekierowuje ruch `/hubs` do API, z włączoną obsługą WebSocket przez `ws: true`; Axios korzysta bezpośrednio z adresu API.

1. **Zdarzenia trafiają do odpowiedzi właściwego modelu.**

   Nazwy zdarzeń są zebrane w [chatConstants.ts](https://github.com/kmaraszkiewicz86/AzureAiFoundryChatDemo/tree/main/src/AIChat.Web/src/constants/chatConstants.ts). Poniższy fragment `subscribeToResponses` pokazuje ich powiązanie ze statusem odpowiedzi oraz kontrolę identyfikatora pytania:

   ```ts
   const handle = (event: StreamingEvent, status: StreamingResponse['status']) => {
     if (this.connection !== connection || event.requestId.toLowerCase() !== requestId.toLowerCase()) return
     this.updateResponse(event, status)
   }

   connection.on(ChatEvents.Started, (event) => handle(event, ResponseStatus.Streaming))
   connection.on(ChatEvents.Chunk, (event) => handle(event, ResponseStatus.Streaming))
   connection.on(ChatEvents.Completed, (event) => handle(event, ResponseStatus.Completed))
   connection.on(ChatEvents.Failed, (event) => handle(event, ResponseStatus.Failed))
   ```

   `requestId` rozdziela pytania, a `llModelName` rozdziela modele odpowiadające na to samo pytanie. Sprawdzenie tożsamości połączenia dodatkowo odrzuca spóźnione zdarzenia poprzedniego połączenia.

   | Zdarzenie API | Dane istotne dla UI | Zmiana odpowiedzi |
   | --- | --- | --- |
   | `ResponseStarted` | Identyfikator pytania i nazwa modelu | Powstaje wpis ze statusem `streaming`. |
   | `ResponseChunk` | Dodatkowo `chunk` | Tekst jest dopisywany do dotychczasowej odpowiedzi. |
   | `ResponseCompleted` | Czas i dostępne liczniki tokenów | Status zmienia się na `completed`. |
   | `ResponseFailed` | Komunikat błędu i czas | Status zmienia się na `failed`. |

   Kształt komunikatu opisuje [StreamingEvent](https://github.com/kmaraszkiewicz86/AzureAiFoundryChatDemo/tree/main/src/AIChat.Web/src/models/streamingEvent.ts), a stan składanej odpowiedzi — [streamingChatState.ts](https://github.com/kmaraszkiewicz86/AzureAiFoundryChatDemo/tree/main/src/AIChat.Web/src/models/streamingChatState.ts). Pola takie jak `chunk` i liczniki tokenów są opcjonalne, ponieważ różne zdarzenia przekazują różne dane.

   Metoda `updateResponse` wykonuje całą aktualizację:

   ```ts
   private updateResponse(event: StreamingEvent, status: StreamingResponse['status']): void {
     const previous = this.progress.responses.find((response) => response.LLModelName === event.llModelName)
     const response: StreamingResponse = {
       LLModelName: event.llModelName,
       answer: (previous?.answer ?? '') + (event.chunk ?? ''),
       status,
       elapsedMilliseconds: event.elapsedMilliseconds ?? previous?.elapsedMilliseconds ?? 0,
       inputTokens: event.inputTokens ?? previous?.inputTokens,
       outputTokens: event.outputTokens ?? previous?.outputTokens,
       totalTokens: event.totalTokens ?? previous?.totalTokens,
       error: status === ResponseStatus.Failed ? event.error ?? ChatErrors.ModelFailed : undefined,
     }
     const responses = previous
       ? this.progress.responses.map((item) => item.LLModelName === event.llModelName ? response : item)
       : [...this.progress.responses, response]

     // The API announces all models before streaming, so loading ends after the last terminal event.
     this.progress = {
       responses,
       isLoading: responses.some((item) => item.status === ResponseStatus.Streaming),
       error: '',
     }
     this.onProgress?.(this.progress)
   }
   ```

   Najpierw `find` szuka wpisu o tej samej nazwie modelu. Przy `ResponseStarted` zwykle go jeszcze nie ma, więc powstaje pusty wynik; przy `ResponseChunk` wyrażenie `(previous?.answer ?? '') + (event.chunk ?? '')` dokleja nowy tekst. Fragmenty różnych modeli mogą przychodzić naprzemiennie, a każdy rozbudowuje własną odpowiedź.

   Operator `??` zachowuje poprzedni czas i statystyki, gdy nowe zdarzenie ich nie zawiera. `map` zastępuje zmieniony wpis, a operator spread dodaje nowy; na końcu callback przekazuje zaktualizowaną kolekcję do komponentu.

   `responses.some(...)` sprawdza, czy przynajmniej jeden model jeszcze odpowiada. Gdy pierwszy model wyśle `ResponseCompleted`, jego wynik jest gotowy, ale formularz pozostaje zablokowany, jeśli pozostałe wpisy nadal mają status `streaming`; API wcześniej zapowiada wszystkie modele zdarzeniami `ResponseStarted`.

1. **React wyświetla przyrastającą treść i metryki.**

   `StreamingChat.tsx` przechodzi po `responses`, a każdy element otrzymuje klucz `response.LLModelName`. Poniższy fragment wnętrza karty pokazuje warunki wyświetlania czasu, tokenów, treści i błędu:

   ```tsx
   <strong>Model:</strong> <u>{response.LLModelName}</u>
   {response.status !== 'streaming' && (
     <p><strong>Execution time:</strong> {response.elapsedMilliseconds} ms</p>
   )}
   {response.status === 'completed' && (
     <>
       <p><strong>Input tokens:</strong> {response.inputTokens ?? 'N/A'}</p>
       <p><strong>Output tokens:</strong> {response.outputTokens ?? 'N/A'}</p>
       <p><strong>Total tokens:</strong> {response.totalTokens ?? 'N/A'}</p>
     </>
   )}
   <p><strong>Question:</strong> {submittedQuestion}</p>
   <div>
     <p><strong>Answer:</strong></p>
     <div dangerouslySetInnerHTML={{ __html: sanitizeAnswerHtml(response.answer) }} />
     {response.status === 'failed' && <p>{response.error}</p>}
   </div>
   ```

   `Execution time` pojawia się po zmianie statusu ze `streaming`, także dla nieudanego modelu. Liczniki tokenów są pokazywane dla `completed`; `?? 'N/A'` zachowuje prawdziwe zero i pokazuje brak danych tylko wtedy, gdy licznik jest niedostępny.

   Serwis składa pełną dotychczasową odpowiedź HTML, którą komponent przy każdym odświeżeniu przekazuje do [sanitizeAnswerHtml](https://github.com/kmaraszkiewicz86/AzureAiFoundryChatDemo/tree/main/src/AIChat.Web/src/services/htmlSanitizer.ts). Funkcja parsuje tekst przez `DOMParser`, usuwa zablokowane elementy i ogranicza tagi, atrybuty, klasy oraz linki do reguł z `Environment`. Tak przygotowany fragment trafia do `dangerouslySetInnerHTML`, co pozwala wyświetlać nagłówki, listy, tabele i bloki kodu otrzymane od modelu.

   `isLoading` jest jednocześnie używane w `disabled` pola i przycisku oraz w napisie „Streaming...”. Po zakończeniu wszystkich modeli stan przechodzi na `false`, a użytkownik może wysłać następne pytanie.

1. **Błędy i zamykanie widoku mają własną obsługę.**

   W `ask` błąd rozpoczęcia połączenia lub żądania HTTP prowadzi do `failRequest(ChatErrors.StartFailed)` i zamknięcia połączenia. `subscribeToResponses` ma także `onClose`: jeżeli połączenie zniknie podczas generowania, wywołuje `failRequest(ChatErrors.ConnectionLost)`.

   `failRequest` zachowuje gotowe wyniki, oznacza trwające jako `failed`, zapisuje komunikat i wyłącza `isLoading`. Błąd pojedynczego modelu przychodzi natomiast jako `ResponseFailed` i aktualizuje tylko jego wpis.

   Komponent porządkuje połączenie również przy odmontowaniu:

   ```tsx
   useEffect(() => {
     const chatService = service.current
     return () => {
       void chatService.stop().catch(console.error)
     }
   }, [])
   ```

   `StreamingChatService.stop()` najpierw usuwa odniesienie do aktywnego połączenia, co blokuje późne aktualizacje jego stanu. Następnie `ChatConnectionService.stop()` odpina zarejestrowane zdarzenia i zamyka połączenie; po ukończeniu odpowiedzi nastąpi to przy następnym pytaniu albo odmontowaniu komponentu.

## Omówienie logiki po stronie API

Żądanie z UI przechodzi przez `AIChatController`, kolejkę `StreamingChatQueue`, usługę `StreamingChatBackgroundService` i serwis `AIChatService`. Kontroler przyjmuje pracę, usługa w tle ją wykonuje, a zdarzenia generowane przez serwis AI wracają do grupy przypisanej do pytania.

1. **Rejestracja usług łączy elementy całego przepływu.**

   W [Program.cs](https://github.com/kmaraszkiewicz86/AzureAiFoundryChatDemo/tree/main/src/AiChat.Api/Program.cs) `AddControllers()` włącza obsługę kontrolerów, a konfiguracja jest wiązana z klasą opcji:

   ```csharp
   builder.Services.Configure<AzureOpenAIOptions>(builder.Configuration.GetSection("AzureOpenAI"));

   // Register the SignalR transport and the singleton channel shared by the endpoint and hosted worker.
   builder.Services.AddSignalR();
   builder.Services.AddSingleton<StreamingChatQueue>();
   builder.Services.AddSingleton<IAIChatService, AIChatService>();
   builder.Services.AddHostedService<StreamingChatBackgroundService>();
   ```

   `AddSingleton<StreamingChatQueue>()` zapewnia wspólną kolejkę dla kontrolera i usługi w tle. `AddSingleton<IAIChatService, AIChatService>()` określa implementację serwisu AI, którą dostarcza Dependency Injection, natomiast `AddHostedService` rejestruje usługę uruchamianą wraz z aplikacją.

   `app.MapControllers()` udostępnia trasy kontrolerów, a `app.MapHub<ChatHub>("/hubs/chat")` określa adres używany przez klienta. Polityka CORS `Frontend` dopuszcza z `http://localhost:5173` żądania POST z nagłówkiem `Content-Type`, co odpowiada wywołaniu Axios wykonywanemu przez UI.

1. **Połączenie dołącza do grupy, a endpoint przyjmuje pytanie.**

   Zanim UI wykona POST, wywołuje `JoinRequest` w [ChatHub.cs](https://github.com/kmaraszkiewicz86/AzureAiFoundryChatDemo/tree/main/src/AiChat.Api/Hubs/ChatHub.cs):

   ```csharp
   public Task JoinRequest(Guid requestId)
   {
       return Groups.AddToGroupAsync(
           Context.ConnectionId,
           GetRequestGroupName(requestId));
   }
   ```

   `Context.ConnectionId` identyfikuje konkretne połączenie z przeglądarką. `GetRequestGroupName(requestId)` zwraca `request-{requestId}`, więc ten sam identyfikator użyty później przy publikowaniu zdarzenia wskazuje właściwą grupę.

   Następnie `POST /api/chat/stream` uruchamia metodę `AskStreaming` klasy `AIChatController` w [ChatController.cs](https://github.com/kmaraszkiewicz86/AzureAiFoundryChatDemo/tree/main/src/AiChat.Api/Controllers/ChatController.cs). Atrybut kontrolera `[Route("api/chat")]` i atrybut metody `[HttpPost("stream")]` wspólnie tworzą tę trasę:

   ```csharp
   [HttpPost("stream")]
   public async Task<IActionResult> AskStreaming(
       [FromBody] AskStreamingQuestionRequest request,
       CancellationToken cancellationToken)
   {
       // The controller deliberately hands work to the channel; AI processing happens in the hosted service.
       await streamingChatQueue.EnqueueAsync(
           new StreamingChatRequest(request.RequestId, request.Question),
           cancellationToken);

       return Accepted(new
       {
           request.RequestId
       });
   }
   ```

   Parametr `[FromBody]` jest odczytywany z JSON do [AskStreamingQuestionRequest](https://github.com/kmaraszkiewicz86/AzureAiFoundryChatDemo/tree/main/src/AiChat.Api/Models/AskStreamingQuestionRequest.cs): `RequestId` ma typ `Guid`, a `Question` jest tekstem. Kontroler tworzy [StreamingChatRequest](https://github.com/kmaraszkiewicz86/AzureAiFoundryChatDemo/tree/main/src/AiChat.Api/Models/StreamingChatRequest.cs), przekazuje go do kolejki i zwraca `Accepted` z identyfikatorem.

   `202 Accepted` kończy obsługę tego żądania HTTP po dodaniu pracy do kolejki. To dlatego formularz może zostać wyczyszczony, a odpowiedzi nadal przyrastać: dalsze generowanie wykonuje usługa w tle, korzystająca z własnego tokenu zatrzymania.

1. **Kolejka przekazuje pracę do usługi działającej w tle.**

   W [StreamingChatQueue.cs](https://github.com/kmaraszkiewicz86/AzureAiFoundryChatDemo/tree/main/src/AiChat.Api/Services/StreamingChatQueue.cs) kanał jest tworzony w następujący sposób:

   ```csharp
   private readonly Channel<StreamingChatRequest> _channel =
       Channel.CreateUnbounded<StreamingChatRequest>(new UnboundedChannelOptions
       {
           SingleReader = true
       });
   ```

   `Channel` łączy zapis z kontrolera z asynchronicznym odczytem w usłudze w tle. `CreateUnbounded` oznacza brak ustalonego limitu pojemności, a `SingleReader = true` deklaruje jednego czytelnika; dane są przechowywane w pamięci procesu API.

   ```csharp
   public ValueTask EnqueueAsync(
       StreamingChatRequest request,
       CancellationToken cancellationToken = default)
   {
       return _channel.Writer.WriteAsync(request, cancellationToken);
   }
   ```

   `EnqueueAsync` przekazuje zapis do `_channel.Writer.WriteAsync`. Odczytująca metoda `ReadAllAsync` zwraca `_channel.Reader.ReadAllAsync(cancellationToken)`, którego elementami są kolejne pytania.

   W [StreamingChatBackgroundService.cs](https://github.com/kmaraszkiewicz86/AzureAiFoundryChatDemo/tree/main/src/AiChat.Api/BackgroundServices/StreamingChatBackgroundService.cs) ASP.NET Core uruchamia `ExecuteAsync`; poniższa pętla oczekuje na elementy kanału i przekazuje je serwisowi AI:

   ```csharp
   protected override async Task ExecuteAsync(CancellationToken stoppingToken)
   {
       // A single channel reader keeps request processing ordered while each request can stream several models.
       await foreach (StreamingChatRequest request in streamingChatQueue.ReadAllAsync(stoppingToken))
       {
           try
           {
               await aiChatService.AskQuestionsStreamingAsync(
                   request.RequestId,
                   request.Question,
                   stoppingToken);
           }
           catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
           {
               break;
           }
           catch (Exception ex)
           {
               // Isolate failures so one request cannot terminate the long-running background worker.
               logger.LogError(
                   ex,
                   "Streaming chat request {RequestId} failed.",
                   request.RequestId);
           }
       }
   }
   ```

   `await foreach` pozwala czekać na następny element kanału bez ręcznego odpytywania kolejki. `await aiChatService.AskQuestionsStreamingAsync(...)` wewnątrz pętli sprawia, że następne pytanie ruszy dopiero po zakończeniu bieżącego; równoległość modeli jest realizowana wewnątrz serwisu AI.

   `stoppingToken` pochodzi z `BackgroundService` i jest sygnalizowany przy zatrzymaniu aplikacji. Kończące się żądanie HTTP nie steruje już tym etapem, a zamknięcie połączenia w UI samo w sobie nie wysyła do API polecenia anulowania generowania.

   Błąd całego pytania jest zapisywany wraz z `RequestId` przez `ILogger`, po czym pętla może obsłużyć następny element. Anulowanie związane z zatrzymaniem aplikacji kończy pętlę przez `break`.

1. **Serwis AI przygotowuje klienta i uruchamia wszystkie wdrożenia.**

   Konstruktor [AIChatService.cs](https://github.com/kmaraszkiewicz86/AzureAiFoundryChatDemo/tree/main/src/AiChat.Api/Services/AIChatService.cs) otrzymuje `IOptions<AzureOpenAIOptions>` oraz `IHubContext<ChatHub>`. Pierwsza zależność dostarcza ustawienia, a druga pozwala publikować zdarzenia z serwisu; utworzenie klienta wygląda tak:

   ```csharp
   AzureOpenAIClientOptions clientOptions = new()
   {
       NetworkTimeout = TimeSpan.FromMinutes(5)
   };

   _client = new AzureOpenAIClient(
       new Uri(_options.Endpoint),
       new ApiKeyCredential(_options.ApiKey),
       clientOptions);
   ```

   Ustawienia `Endpoint`, `ApiKey` i `DeploymentNames` definiuje [AzureOpenAIOptions.cs](https://github.com/kmaraszkiewicz86/AzureAiFoundryChatDemo/tree/main/src/AiChat.Api/Options/AzureOpenAIOptions.cs). W tym kodzie klient uwierzytelnia się przez `ApiKeyCredential`, a `NetworkTimeout` ustawiono na pięć minut.

   Metoda `AskQuestionsStreamingAsync` ma dwa etapy: najpierw zapowiada wszystkie modele, potem uruchamia ich odpowiedzi:

   ```csharp
   public async Task AskQuestionsStreamingAsync(
       Guid requestId,
       string question,
       CancellationToken cancellationToken = default)
   {
       // Publish all start events first so React knows every active model before any model can complete.
       foreach (string deploymentName in _options.DeploymentNames)
       {
           await _chatHubContext.Clients
               .Group(ChatHub.GetRequestGroupName(requestId))
               .SendAsync(
                   "ResponseStarted",
                   new
                   {
                       RequestId = requestId,
                       LLModelName = deploymentName
                   },
                   cancellationToken);
       }

       List<Task> askQuestionTasks = [];

       // Stream all configured deployments concurrently, matching the synchronous fan-out behavior.
       foreach (string deploymentName in _options.DeploymentNames)
       {
           askQuestionTasks.Add(
               AskStreamingAsync(
                   requestId,
                   question,
                   deploymentName,
                   cancellationToken));
       }

       await Task.WhenAll(askQuestionTasks);
   }
   ```

   Pierwsza pętla wysyła `ResponseStarted` z `RequestId` oraz `LLModelName` dla każdego wdrożenia. Dzięki temu UI zakłada wszystkie wpisy przed nadejściem zakończenia któregokolwiek modelu i poprawnie wylicza wspólne `isLoading`.

   Druga pętla wywołuje `AskStreamingAsync` bez oczekiwania na zakończenie każdego modelu osobno. Zwrócone zadania trafiają do listy, a `Task.WhenAll` czeka na całą grupę: fragmenty modeli mogą więc przychodzić naprzemiennie, choć pytania w kolejce są wykonywane po kolei.

1. **Pytanie staje się promptem przekazywanym do wybranego modelu.**

   W `AskStreamingAsync` stoper startuje przed przygotowaniem promptu. `GenerateChatPrompt(question)` wstawia pytanie użytkownika do szablonu tekstowego zapisanego w tej samej klasie; początek szablonu brzmi:

   ```text
   You are an expert .NET software architect and developer.

   Create a complete technical solution for the following question:

   {{question}}

   Return only an HTML fragment that can be inserted directly into an
   existing React answer container.
   ```

   W szablonie C# `{{question}}` jest miejscem wstawienia treści pytania. Dalej metoda określa dopuszczalne elementy HTML, kontener `vertical-stack`, sekcje `vertical-stack-item`, kompletność przykładów i kodowanie znaków w blokach kodu; to wyjaśnia, skąd bierze się format odpowiedzi wyświetlany przez React.

   Przygotowany tekst jest używany tutaj:

   ```csharp
   string chatPrompt = GenerateChatPrompt(question);
   ChatClient chatClient = _client.GetChatClient(deploymentName);
   ChatMessage[] messages = [new UserChatMessage(chatPrompt)];
   ChatTokenUsage? tokenUsage = null;

   AsyncCollectionResult<StreamingChatCompletionUpdate> chatResponseStreaming = chatClient.CompleteChatStreamingAsync(
       messages,
       cancellationToken: cancellationToken);
   ```

   `GetChatClient(deploymentName)` wybiera konkretne wdrożenie. Tablica `messages` zawiera jedną `UserChatMessage` z całym wygenerowanym promptem, czyli pytaniem razem z instrukcjami; metoda nie dołącza historii wcześniejszych pytań.

   `CompleteChatStreamingAsync` udostępnia asynchroniczną kolekcję aktualizacji. Lokalne `tokenUsage` należy do pojedynczego wywołania modelu, podobnie jak stoper, dlatego czasy i tokeny nie mieszają się między wdrożeniami.

1. **Każda aktualizacja modelu jest przetwarzana i wysyłana do UI.**

   Serwis odczytuje strumień w pętli, zachowuje dostępne statystyki i przekazuje niepuste fragmenty tekstu:

   ```csharp
   await foreach (StreamingChatCompletionUpdate update in chatResponseStreaming)
   {
       // Usage contains request totals and may arrive in a final update without any text.
       tokenUsage = update.Usage ?? tokenUsage;

       foreach (ChatMessageContentPart contentPart in update.ContentUpdate)
       {
           if (string.IsNullOrEmpty(contentPart.Text))
           {
               continue;
           }

           // Forward each text delta immediately and retain the originating deployment name.
           await _chatHubContext.Clients
               .Group(ChatHub.GetRequestGroupName(requestId))
               .SendAsync(
                   "ResponseChunk",
                   new
                   {
                       RequestId = requestId,
                       LLModelName = deploymentName,
                       Chunk = contentPart.Text
                   },
                   cancellationToken);
       }
   }
   ```

   `update.ContentUpdate` może zawierać części tekstu, które nie stanowią jeszcze całej odpowiedzi ani kompletnej sekcji HTML. Każde `contentPart.Text` trafia do `ResponseChunk`, a omówiony wcześniej serwis UI dokleja je do dotychczasowego wyniku.

   `IHubContext<ChatHub>` umożliwia wysyłanie zdarzeń z `AIChatService`. Wywołanie `.Group(ChatHub.GetRequestGroupName(requestId))` wskazuje tę samą grupę, do której przeglądarka dołączyła przez `JoinRequest`, a `LLModelName` wskazuje kartę modelu do aktualizacji.

   `tokenUsage = update.Usage ?? tokenUsage` zachowuje ostatnie otrzymane statystyki. Aktualizacja zawierająca zużycie tokenów może przyjść bez tekstu, dlatego odczyt `Usage` znajduje się przed pętlą po `ContentUpdate`; serwis zachowuje podane liczniki całego wywołania, zamiast sumować je dla każdego fragmentu.

1. **Zakończenie strumienia przekazuje metryki, a błąd kończy odpowiedź danego modelu.**

   Po wyjściu z pętli serwis zatrzymuje stoper i publikuje `ResponseCompleted`:

   ```csharp
   stopwatch.Stop();

   // Mark only this deployment as complete; other deployment streams may still be running.
   await _chatHubContext.Clients
       .Group(ChatHub.GetRequestGroupName(requestId))
       .SendAsync(
           "ResponseCompleted",
           new
           {
               RequestId = requestId,
               LLModelName = deploymentName,
               stopwatch.ElapsedMilliseconds,
               InputTokens = tokenUsage?.InputTokenCount,
               OutputTokens = tokenUsage?.OutputTokenCount,
               TotalTokens = tokenUsage?.TotalTokenCount
           },
           cancellationToken);
   ```

   Czas jest liczony od wejścia do `AskStreamingAsync` do zakończenia odczytu strumienia i wysyłania fragmentów. Obejmuje więc także pracę wykonywaną podczas przekazywania treści do UI, natomiast nie obejmuje wcześniejszego oczekiwania pytania w kolejce.

   `InputTokens`, `OutputTokens` i `TotalTokens` pochodzą ze statystyk zwróconych przez model. Jeżeli ich nie otrzymano, operator `?.` pozostawia wartości `null`; po stronie UI są one prezentowane jako `N/A`. Serwis nie wylicza liczby tokenów na podstawie długości otrzymanego tekstu.

   W przeglądarce `ResponseCompleted` uruchamia `updateResponse` ze statusem `completed`. Zdarzenie nie zawiera nowego `chunk`, więc zachowany zostaje już złożony tekst, dopisywane są metryki i ponownie wyliczane jest `isLoading`; formularz odblokuje się po zakończeniu ostatniego trwającego modelu.

   Obsługa wyjątków rozróżnia zatrzymanie aplikacji od błędu danego modelu. `OperationCanceledException` przy anulowanym tokenie jest przekazywany do usługi w tle, a pozostały wyjątek zatrzymuje pomiar, składa komunikat z `ex.Message` i ewentualnego wyjątku wewnętrznego oraz wysyła:

   ```csharp
   await _chatHubContext.Clients
       .Group(ChatHub.GetRequestGroupName(requestId))
       .SendAsync(
           "ResponseFailed",
           new
           {
               RequestId = requestId,
               LLModelName = deploymentName,
               Error = errorMessageStringBuilder.ToString(),
               stopwatch.ElapsedMilliseconds
           },
           cancellationToken);
   ```

   `ResponseFailed` pozwala UI zachować dotychczasowy tekst, pokazać błąd przy właściwym modelu i zakończyć jego stan `streaming`. Pozostałe zadania modeli mogą dalej dostarczać swoje fragmenty i wyniki.

## Analiza 4 pytań od użytkownika wraz z analizą jakości odpowiedzi, kosztów i ile tokenów jest wykorzystywane przez 3 różne modele.
Przedstawię poniżej analizę tego, jak różne LLM-y radzą sobie z pytaniami, ile tokenów wykorzystują oraz jakie są koszty poszczególnych zapytań. Trzeba przy tym pamiętać, że liczba zużytych tokenów może się różnić, dlatego przedstawione wyniki mogą być inne niż wyniki zaobserwowane na innych środowiskach.


## Analiza modeli

W artykule nie będą zamieszczane pełne odpowiedzi generowane przez poszczególne modele, ponieważ w przypadku bardziej rozbudowanych promptów mogą one być bardzo obszerne.

Dla każdego testu szczegółowe wyniki będą zapisywane w repozytorium GitHub projektu:

[https://github.com/kmaraszkiewicz86/AzureAiFoundryChatDemo/tree/main/results](https://github.com/kmaraszkiewicz86/AzureAiFoundryChatDemo/tree/main/results)

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

1. **Proste generowanie kodu — aplikacja Hello World.** Sprawdzimy, czy modele wybiorą najnowszą stabilną wersję .NET, przygotują kompletny, minimalny kod i krótko wyjaśnią, jak go uruchomić, bez niepotrzebnego komplikowania rozwiązania.

   Stwórz prostą aplikację konsolową Hello World w C# z użyciem najnowszej stabilnej wersji .NET. Pokaż kompletny kod oraz krótko wyjaśnij, jak uruchomić aplikację.

   <img width="1906" height="370" alt="image" src="https://github.com/user-attachments/assets/277af9ab-6db3-4703-b592-bdd29df3ea78" />

   Wyniki są następujące:

   | Model | Pełna odpowiedź | Tokeny wejściowe | Tokeny wyjściowe | Tokeny łącznie | Koszt łączny (EUR) |
   | --- | --- | ---: | ---: | ---: | ---: |
   | gpt-5.4-mini-low | [Otwórz odpowiedź](https://github.com/kmaraszkiewicz86/AzureAiFoundryChatDemo/blob/main/results/prompt-1/gpt-5.4-mini-low.md) | 1066 | 871 | 1937 | 0,00415272 |
   | gpt-5.6-sol-high | [Otwórz odpowiedź](https://github.com/kmaraszkiewicz86/AzureAiFoundryChatDemo/blob/main/results/prompt-1/gpt-5.6-sol-high.md) | 1066 | 1124 | 2190 | 0,03431904 |
   | gpt-5.6-terra-medium | [Otwórz odpowiedź](https://github.com/kmaraszkiewicz86/AzureAiFoundryChatDemo/blob/main/results/prompt-1/gpt-5.6-terra-medium.md) | 1066 | 1098 | 2164 | 0,01346006 |

   [Szczegółowe porównanie odpowiedzi modeli](https://github.com/kmaraszkiewicz86/AzureAiFoundryChatDemo/blob/main/results/prompt-1/comparison.md)

   **Skrót oceny:** Najlepiej wypadł **gpt-5.6-terra-medium**, nieznacznie wyprzedzając **gpt-5.6-sol-high**. Oba modele poprawnie wskazały .NET 10 jako najnowszą stabilną wersję i przygotowały kompletny przykład. Terra przedstawił nieco czytelniejszą kolejność przygotowania i uruchomienia projektu. **gpt-5.4-mini-low** był najtańszy i najszybszy, ale błędnie wskazał .NET 8 jako najnowszą stabilną wersję, dlatego zajął trzecie miejsce.

1. **Implementacja REST API — zarządzanie produktami.** Sprawdzimy, czy modele przygotują spójne API z endpointami GET, POST i DELETE, wykorzystując kontrolery, Dependency Injection, async/await oraz walidację danych wejściowych. Ocenimy również kompletność wymaganych klas i prostotę przechowywania danych w pamięci.

   Stwórz proste REST API w ASP.NET Core do zarządzania listą produktów. Dodaj endpointy GET, POST i DELETE. Użyj kontrolerów, Dependency Injection, async/await oraz walidacji danych wejściowych. Dane mogą być przechowywane w pamięci. Pokaż wszystkie wymagane klasy oraz krótko opisz strukturę rozwiązania.

   <img width="1895" height="348" alt="image" src="https://github.com/user-attachments/assets/1b94c320-82c2-4e1a-9fc4-a8ec91b1d9fe" />

   Wyniki są następujące:

   | Model | Pełna odpowiedź | Tokeny wejściowe | Tokeny wyjściowe | Tokeny łącznie | Koszt łączny (EUR) |
   | --- | --- | ---: | ---: | ---: | ---: |
   | gpt-5.4-mini-low | [Otwórz odpowiedź](https://github.com/kmaraszkiewicz86/AzureAiFoundryChatDemo/blob/main/results/prompt-2/gpt-5.4-mini-low.md) | 1093 | 3475 | 4568 | 0,01448238 |
   | gpt-5.6-sol-high | [Otwórz odpowiedź](https://github.com/kmaraszkiewicz86/AzureAiFoundryChatDemo/blob/main/results/prompt-2/gpt-5.6-sol-high.md) | 1093 | 5258 | 6351 | 0,14341008 |
   | gpt-5.6-terra-medium | [Otwórz odpowiedź](https://github.com/kmaraszkiewicz86/AzureAiFoundryChatDemo/blob/main/results/prompt-2/gpt-5.6-terra-medium.md) | 1093 | 5051 | 6144 | 0,05521173 |

   [Szczegółowe porównanie odpowiedzi modeli](https://github.com/kmaraszkiewicz86/AzureAiFoundryChatDemo/blob/main/results/prompt-2/comparison.md)

   **Skrót oceny:** Najlepiej wypadł **gpt-5.6-sol-high**, nieznacznie wyprzedzając **gpt-5.6-terra-medium**. Sol przygotował najbardziej kompletny przykład, z dobrą obsługą błędów, jasnym wyjaśnieniem kontraktu asynchronicznego i praktycznymi przykładami użycia API. Terra był prostszą i tańszą alternatywą. Oba modele miały jednak problem z walidacją wartości `decimal` zależną od ustawień regionalnych. **gpt-5.4-mini-low** był najtańszy i najszybszy, ale jego rozwiązanie zawierało brakującą zależność Swaggera oraz problem z `CreatedAtAction`, dlatego zajął trzecie miejsce.

1. **Architektura i implementacja API — zamówienia przy dużej współbieżności.** Sprawdzimy, jak modele zaprojektują obsługę wielu równoległych żądań, dobiorą sposób przechowywania danych i cache oraz uwzględnią obsługę błędów, logowanie, monitoring i zabezpieczenia. Ocenimy także przykład tworzenia zamówienia z warstwą serwisową oraz uzasadnienie zalet i wad decyzji architektonicznych.

   Zaprojektuj produkcyjne REST API w ASP.NET Core do obsługi zamówień. API powinno obsługiwać dużą liczbę równoległych requestów. Zaproponuj architekturę rozwiązania, sposób przechowywania danych, strategię cache, obsługę błędów, logging, monitoring oraz zabezpieczenia. Następnie pokaż przykładową implementację endpointu tworzącego zamówienie wraz z warstwą serwisową. Wyjaśnij najważniejsze decyzje architektoniczne oraz ich zalety i wady.

   Wyniki są następujące:

   | Model | Pełna odpowiedź | Tokeny wejściowe | Tokeny wyjściowe | Tokeny łącznie | Koszt łączny (EUR) |
   | --- | --- | ---: | ---: | ---: | ---: |
   | gpt-5.4-mini-low | [Otwórz odpowiedź](https://github.com/kmaraszkiewicz86/AzureAiFoundryChatDemo/blob/main/results/prompt-3/gpt-5.4-mini-low.md) | 1135 | 8685 | 9820 | 0,03514170 |
   | gpt-5.6-sol-high | [Otwórz odpowiedź](https://github.com/kmaraszkiewicz86/AzureAiFoundryChatDemo/blob/main/results/prompt-3/gpt-5.6-sol-high.md) | 1135 | 15206 | 16341 | 0,40582416 |
   | gpt-5.6-terra-medium | [Otwórz odpowiedź](https://github.com/kmaraszkiewicz86/AzureAiFoundryChatDemo/blob/main/results/prompt-3/gpt-5.6-terra-medium.md) | 1135 | 10596 | 11731 | 0,11378540 |

   [Szczegółowe porównanie odpowiedzi modeli](https://github.com/kmaraszkiewicz86/AzureAiFoundryChatDemo/blob/main/results/prompt-3/comparison.md)

   **Skrót oceny:** Najlepiej wypadł **gpt-5.6-sol-high**, przed **gpt-5.6-terra-medium** i **gpt-5.4-mini-low**. Sol przygotował najbardziej konkretne mechanizmy obsługi współbieżności, idempotencji, pobierania wiarygodnych cen, izolacji danych klienta oraz awarii cache. Jego rozwiązanie zawierało jednak istotny problem ze stanem `DbContext` podczas ponowień i wymaga poprawek przed wykorzystaniem produkcyjnym. Terra zaproponował wartościowe podejście z kluczem idempotencji ograniczonym do klienta oraz wzorcem Outbox, ale miał problemy z zależnościami i połączeniem jawnych transakcji z mechanizmem ponowień EF Core. Mini był najtańszy i najszybszy, ale zawierał najwięcej rozbieżności pomiędzy deklarowaną gotowością produkcyjną a faktyczną implementacją.

1. **Przegląd kodu i minimalna refaktoryzacja — metoda `GetProductAsync`.** Sprawdzimy, czy modele rozpoznają problemy związane z async/await, wyjątkami, wydajnością i jakością kodu oraz zaproponują tylko niezbędne poprawki. Ważne będzie wyjaśnienie każdej zmiany bez niepotrzebnego przepisywania całej implementacji.

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

   Wyniki są następujące:

   | Model | Pełna odpowiedź | Tokeny wejściowe | Tokeny wyjściowe | Tokeny łącznie | Koszt łączny (EUR) |
   | --- | --- | ---: | ---: | ---: | ---: |
   | gpt-5.4-mini-low | [Otwórz odpowiedź](https://github.com/kmaraszkiewicz86/AzureAiFoundryChatDemo/blob/main/results/prompt-4/gpt-5.4-mini-low.md) | 1152 | 1589 | 2741 | 0,00705276 |
   | gpt-5.6-sol-high | [Otwórz odpowiedź](https://github.com/kmaraszkiewicz86/AzureAiFoundryChatDemo/blob/main/results/prompt-4/gpt-5.6-sol-high.md) | 1152 | 2660 | 3812 | 0,07518640 |
   | gpt-5.6-terra-medium | [Otwórz odpowiedź](https://github.com/kmaraszkiewicz86/AzureAiFoundryChatDemo/blob/main/results/prompt-4/gpt-5.6-terra-medium.md) | 1152 | 2446 | 3598 | 0,02783282 |

   [Szczegółowe porównanie odpowiedzi modeli](https://github.com/kmaraszkiewicz86/AzureAiFoundryChatDemo/blob/main/results/prompt-4/comparison.md)

   **Skrót oceny:** Najlepiej wypadł **gpt-5.6-terra-medium**, nieznacznie wyprzedzając **gpt-5.6-sol-high**. Terra najlepiej rozróżnił sytuację, w której repozytorium pozostaje synchroniczne, od rzeczywistego asynchronicznego I/O i uwzględnił możliwość zachowania istniejącego kontraktu `Task`. Sol poprawnie wyjaśnił asynchroniczne I/O i propagowanie anulowania, ale dodał więcej kodu niż wymagał prosty refactoring oraz nieuzasadnioną regułę wymagającą dodatniego ID. Mini był najtańszy i najkrótszy, lecz jego preferowana poprawka zmieniała zachowanie metody przy braku produktu i pomijała istotne różnice w sposobie propagowania wyjątków.

## Końcowe podsumowanie

[Szczegółowe końcowe porównanie modeli](https://github.com/kmaraszkiewicz86/AzureAiFoundryChatDemo/blob/main/results/final-comparison.md)

| Model | Tokeny wejściowe | Tokeny wyjściowe | Tokeny łącznie | Koszt łączny (EUR) |
| --- | ---: | ---: | ---: | ---: |
| gpt-5.4-mini-low | 4446 | 14620 | 19066 | 0,06082956 |
| gpt-5.6-sol-high | 4446 | 24248 | 28694 | 0,65873968 |
| gpt-5.6-terra-medium | 4446 | 19191 | 23637 | 0,21029001 |

Łączny szacunkowy koszt tokenów wszystkich dwunastu odpowiedzi wyniósł **0,92985925 EUR**.

**gpt-5.4-mini-low** był najtańszy i najszybszy we wszystkich czterech testach, ale w każdym porównaniu jakościowym zajął trzecie miejsce. Jego odpowiedzi zawierały między innymi błędne wskazanie wersji .NET, brakujące zależności, problem z generowaniem linku po `POST` oraz zmianę zachowania refaktoryzowanej metody przy braku produktu.

**gpt-5.6-terra-medium** wygrał prompty 1 i 4, a w promptach 2 i 3 zajął drugie miejsce. Zapewnił najlepszy kompromis pomiędzy jakością odpowiedzi, kosztem i czasem generowania. Był wyraźnie tańszy od Sol, jednocześnie zachowując wysoką jakość techniczną odpowiedzi.

**gpt-5.6-sol-high** wygrał prompty 2 i 3, czyli oba bardziej rozbudowane zadania dotyczące projektowania API. Największą przewagę pokazał przy projektowaniu produkcyjnego API zamówień, gdzie zaproponował najbardziej konkretne mechanizmy związane ze współbieżnością, idempotencją i ochroną danych. Był jednak zdecydowanie najdroższym i najwolniejszym z porównywanych modeli, a jego dodatkowa szczegółowość nie dawała przewagi w prostszych zadaniach.

**Ostatecznie gpt-5.6-terra-medium zapewnił najlepszy kompromis jakości, kosztu i czasu w całym zestawie testów. gpt-5.6-sol-high był najmocniejszy w bardziej złożonych zadaniach projektowych dotyczących API, natomiast gpt-5.4-mini-low wygrywał ceną i szybkością, ale wymagał największej ostrożności przy praktycznym wykorzystaniu wygenerowanego kodu.**

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

> **Informacja:** Dokumentacja, funkcjonalności Microsoft Foundry oraz ceny modeli mogą zmieniać się w czasie. Informacje przedstawione w artykule były aktualne w momencie jego tworzenia. W przypadku cen modeli warto zawsze zweryfikować aktualny cennik na oficjalnej stronie Microsoft Azure.

## Kod źródłowy i materiały projektu

Kod źródłowy aplikacji, pełne odpowiedzi wygenerowane przez testowane modele, wyniki poszczególnych testów oraz szczegółowe porównania można znaleźć w repozytorium GitHub projektu:

https://github.com/kmaraszkiewicz86/AzureAiFoundryChatDemo
