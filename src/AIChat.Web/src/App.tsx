import StreamingChat from './components/StreamingChat'
import './App.css'

function App() {
  return (
    <main>
      <h1>AI Chat Demo</h1>
      {/* Render the SignalR flow while preserving Chat.tsx as the synchronous implementation. */}
      <StreamingChat />
    </main>
  )
}

export default App
