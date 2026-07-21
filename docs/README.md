# Technical Article Outline

## 1. Introduction
- Explain the goal of the demo
- Describe why streaming matters for chat experiences
- Set expectations for the article

## 2. What We Are Building
- ASP.NET Core backend
- React frontend
- Azure AI Foundry streaming
- In-memory conversations

## 3. Solution Structure
- `src/AiChat.Api`
- `src/ai-chat-react`
- `docs/README.md`
- Root `README.md`

## 4. Backend Setup
- Target framework and project type
- Controller-based API
- Dependency Injection
- Options Pattern
- Launch settings on `http://localhost:5000`

## 5. Backend Data Flow
- `POST /api/chat` creates a conversation
- `GET /api/chat/{chatId}/stream` streams tokens with SSE
- Conversation storage in memory
- Cleanup and completion behavior

## 6. Azure AI Foundry Integration
- Configuration values in `appsettings.json`
- Deployment name for GPT-5.5
- Streaming request format
- Handling the no-configuration fallback for local development

## 7. Frontend Architecture
- React + TypeScript with Vite
- Axios service for chat creation
- Custom hook for state and streaming
- Small focused components

## 8. UI Walkthrough
- Question textbox
- Ask button
- Loading indicator
- Streaming answer area

## 9. End-to-End Request Flow
- User enters a question
- Frontend creates a chat
- Backend returns a chat ID
- Frontend opens the SSE stream
- Answer renders progressively

## 10. Running the Sample
- Install prerequisites
- Configure Azure AI Foundry
- Run the API
- Run the frontend
- Verify the stream

## 11. Conclusion
- Recap the key ideas
- Explain how to extend the sample in a future article
