const { io } = require('./extension/node_modules/socket.io-client');

function once(socket, event) {
  return new Promise((resolve) => socket.once(event, resolve));
}

function emitAck(socket, event, payload) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout: ${event}`)), 7000);
    socket.emit(event, payload, (response) => {
      clearTimeout(timer);
      resolve(response);
    });
  });
}

(async () => {
  const baseUrl = 'https://codus.onrender.com';
  const s1 = io(baseUrl, { transports: ['websocket'], timeout: 6000 });
  const s2 = io(baseUrl, { transports: ['websocket'], timeout: 6000 });

  await Promise.all([once(s1, 'connect'), once(s2, 'connect')]);

  const created = await emitAck(s1, 'create-room', { userName: 'SmokeHost' });
  if (!created || !created.roomId) throw new Error('room create failed');

  const joined = await emitAck(s2, 'join-room', { roomId: created.roomId, userName: 'SmokeGuest' });
  if (!joined || joined.error) throw new Error(joined?.error || 'room join failed');

  await new Promise((resolve) => {
    s2.once('chat-message', (msg) => {
      console.log(`CHAT_OK room=${msg.roomId} text=${msg.text}`);
      resolve();
    });
    s1.emit('chat-message', { roomId: created.roomId, text: 'smoke-test-message' });
  });

  console.log(`ROOM_OK room=${created.roomId} users=${joined.users.length}`);
  s1.disconnect();
  s2.disconnect();
})().catch((err) => {
  console.error(`SMOKE_FAIL ${err.message || String(err)}`);
  process.exitCode = 1;
});
