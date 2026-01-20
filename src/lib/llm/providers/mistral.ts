import { OpenAICompatibleProvider } from './base';

export class MistralSmallProvider extends OpenAICompatibleProvider {
  id = 'mistral-small';
  name = 'mistral';
  model = 'mistral-small-latest';
  displayName = 'Mistral Small (Mistral AI)';
  protected endpoint = 'https://api.mistral.ai/v1/chat/completions';

  protected getHeaders(): Record<string, string> {
    const apiKey = process.env.MISTRAL_API_KEY;
    if (!apiKey) {
      throw new Error('MISTRAL_API_KEY is not configured');
    }
    return {
      Authorization: `Bearer ${apiKey}`,
    };
  }
}
