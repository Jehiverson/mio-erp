import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeWithQwen, explicitAmount, QwenError, qwenEndpoint } from '../lib/apps/functions/src/qwen.js';

const input = {
  operationId: '123e4567-e89b-42d3-a456-426614174000',
  text: 'Jirafa artesanal de madera',
  image: '',
};
const config = { key: 'fake-test-key', region: 'ap-southeast-1', model: 'qwen-vl-plus' };
const draft = {
  name: 'Jirafa de madera',
  type: 'Artesanía',
  brand: null,
  size: null,
  origin: null,
  cost: null,
  price: null,
  description: 'Pieza de madera',
};
const completion = (value: unknown, finish = 'stop') =>
  new Response(
    JSON.stringify({
      choices: [
        {
          finish_reason: finish,
          message: { content: typeof value === 'string' ? value : JSON.stringify(value) },
        },
      ],
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
const fake = (fn: Parameters<typeof analyzeWithQwen>[2]) => fn!;
const kind = (name: string) => (error: unknown) => error instanceof QwenError && error.kind === name;

test('gateway Qwen envía notas/imagen y credencial sólo al endpoint de región permitido', async () => {
  let calls = 0;
  const imageInput = { ...input, image: 'data:image/jpeg;base64,/9j/' };
  const result = await analyzeWithQwen(
    imageInput,
    config,
    fake(async (url, init) => {
      calls++;
      assert.equal(url, qwenEndpoint(config.region));
      assert.equal(init?.method, 'POST');
      assert.equal((init?.headers as Record<string, string>).Authorization, 'Bearer fake-test-key');
      const body = JSON.parse(String(init?.body));
      assert.equal(body.model, config.model);
      assert.equal(body.messages[0].role, 'system');
      assert.equal(body.messages[1].content[0].text, input.text);
      assert.equal(body.messages[1].content[1].image_url.url, imageInput.image);
      assert.equal(body.response_format.type, 'json_object');
      assert.ok(init?.signal);
      return completion(draft);
    }),
  );
  assert.equal(calls, 1);
  assert.deepEqual(result, draft);
});
test('configuración inválida no hace peticiones', async () => {
  let calls = 0;
  const fetcher = fake(async () => {
    calls++;
    throw Error('No se debe llamar');
  });
  for (const patch of [
    { key: '' },
    { model: '' },
    { model: 'qwen;rm -rf' },
    { region: 'https://evil.invalid' },
  ])
    await assert.rejects(analyzeWithQwen(input, { ...config, ...patch }, fetcher), kind('configuration'));
  assert.equal(calls, 0);
});
test('fallas de red y timeout se convierten en errores seguros', async () => {
  for (const failure of [new Error('Detalle secreto'), new DOMException('aborted', 'TimeoutError')])
    await assert.rejects(
      analyzeWithQwen(
        input,
        config,
        fake(async () => {
          throw failure;
        }),
      ),
      (error: unknown) => kind('unavailable')(error) && !(error as Error).message.includes('Detalle secreto'),
    );
});
test('429 distingue rate-limit; errores HTTP no exponen respuesta del proveedor', async () => {
  for (const status of [429, 401, 403, 500])
    await assert.rejects(
      analyzeWithQwen(
        input,
        config,
        fake(async () => new Response('secreto del proveedor', { status })),
      ),
      (error: unknown) =>
        kind(status === 429 ? 'rate-limit' : 'unavailable')(error) &&
        !(error as Error).message.includes('secreto'),
    );
});
test('respuestas truncadas, markdown, JSON inválido y esquemas alterados se rechazan', async () => {
  const { size, ...missing } = draft;
  void size;
  const responses = [
    completion(draft, 'length'),
    completion('```json\n{}\n```'),
    completion('{'),
    completion(missing),
    completion({ ...draft, code: 'A0001' }),
    completion({ ...draft, cost: 'Q100' }),
    completion('x'.repeat(15001)),
    new Response('{"choices":[]}', { status: 200 }),
    new Response('<html>Error</html>', { status: 200 }),
  ];
  for (const response of responses)
    await assert.rejects(
      analyzeWithQwen(
        input,
        config,
        fake(async () => response),
      ),
      kind('invalid-response'),
    );
});
test('IA no debe conservar un precio/costo inventado cuando las notas no lo incluyen', async () => {
  const result = await analyzeWithQwen(
    input,
    config,
    fake(async () => completion({ ...draft, cost: 1200, price: 4900 })),
  );
  assert.equal(result.cost, null);
  assert.equal(result.price, null);
});
test('importes explícitos: etiquetas, moneda, decimales y separación natural con coma', () => {
  assert.equal(explicitAmount('costo Q98, precio Q245', 'cost'), 9800);
  assert.equal(explicitAmount('costo Q98, precio Q245', 'price'), 24500);
  assert.equal(explicitAmount('Coste: Q 15.25; precio de venta es GTQ 120.50', 'cost'), 1525);
  assert.equal(explicitAmount('Coste: Q 15.25; precio de venta es GTQ 120.50', 'price'), 12050);
  assert.equal(explicitAmount('costo=0', 'cost'), 0);
  assert.equal(explicitAmount('precio de Q1.5', 'price'), 150);
});
test('importes ambiguos, negativos, fuera de límite y sin etiqueta quedan pendientes', () => {
  for (const notes of [
    'Q98 y Q245',
    'pieza 98 de colección',
    'precio Q100; precio Q150',
    'precio 1,250',
    'precio 12.345',
    'precio -15',
    'precio 0',
    'precio 1000001',
    'precio USD15',
  ])
    assert.equal(explicitAmount(notes, 'price'), null, notes);
  assert.equal(explicitAmount('costo 25; costo 30', 'cost'), null);
  assert.equal(explicitAmount('costo -1', 'cost'), null);
});
test('gateway usa monto explícito de notas, incluso si el modelo devuelve otro', async () => {
  const result = await analyzeWithQwen(
    { ...input, text: 'Jirafa de madera; costo Q98; precio Q245' },
    config,
    fake(async () => completion({ ...draft, cost: 1, price: 2 })),
  );
  assert.equal(result.cost, 9800);
  assert.equal(result.price, 24500);
});

test('gateway envía todos los ángulos del producto en una sola petición', async () => {
  const images = ['data:image/jpeg;base64,/9j/', 'data:image/jpeg;base64,YWJj'];
  await analyzeWithQwen({ ...input, image: images[0], images }, config, fake(async (_, init) => {
    const body = JSON.parse(String(init?.body));
    const sent = body.messages[1].content.filter((part: { type: string }) => part.type === 'image_url');
    assert.deepEqual(sent.map((part: { image_url: { url: string } }) => part.image_url.url), images);
    return completion(draft);
  }));
});
