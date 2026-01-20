import { OpenAICompatibleProvider } from './base';

export class GroqLlama70BProvider extends OpenAICompatibleProvider {
  id = 'groq-llama-70b';
  name = 'groq';
  model = 'llama-3.3-70b-versatile';
  displayName = 'Llama 3.3 70B (Groq)';
  protected endpoint = 'https://api.groq.com/openai/v1/chat/completions';

  protected getHeaders(): Record<string, string> {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error('GROQ_API_KEY is not configured');
    }
    return {
      Authorization: `Bearer ${apiKey}`,
    };
  }
}
