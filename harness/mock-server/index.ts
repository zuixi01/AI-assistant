import { createMockServer } from './server';

const port = Number(process.env.MOCK_SERVER_PORT || 4100);
const server = createMockServer();

server.listen(port, '127.0.0.1', () => {
  console.log(`Mock server listening on http://127.0.0.1:${port}`);
});
