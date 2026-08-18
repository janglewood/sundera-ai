import { ConfigService } from '@nestjs/config';
import { OpenRouterImageGenerationProvider } from './openrouter-image-generation.provider';

describe('OpenRouterImageGenerationProvider', () => {
  const config = new ConfigService({
    OPENROUTER_API_KEY: 'test-key',
    OPENROUTER_MODEL: 'google/gemini-2.5-flash-image',
    OPENROUTER_BASE_URL: 'https://openrouter.ai/api/v1',
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('fires one request per variant with n=1 and decodes the responses', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            b64_json: Buffer.from('fake-image').toString('base64'),
            media_type: 'image/png',
          },
        ],
      }),
    });
    global.fetch = fetchMock;

    const provider = new OpenRouterImageGenerationProvider(config);
    const result = await provider.editImage({
      sourceImageDataUrl: 'data:image/png;base64,AAAA',
      prompt: 'Redesign this room',
      variantCount: 3,
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://openrouter.ai/api/v1/images');
    expect(init.headers.Authorization).toBe('Bearer test-key');

    const body = JSON.parse(init.body);
    expect(body).toEqual({
      model: 'google/gemini-2.5-flash-image',
      prompt: 'Redesign this room',
      n: 1,
      input_references: [
        { type: 'image_url', image_url: { url: 'data:image/png;base64,AAAA' } },
      ],
    });

    expect(result).toEqual([
      { buffer: Buffer.from('fake-image'), mimeType: 'image/png' },
      { buffer: Buffer.from('fake-image'), mimeType: 'image/png' },
      { buffer: Buffer.from('fake-image'), mimeType: 'image/png' },
    ]);
  });
});
