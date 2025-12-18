const crypto = require('crypto');
const http = require('http');

const secret = 'local-secret';
const payload = {
  user_id: 'hevy_user_123',
  workout: {
    title: 'Local Dev Workout',
    exercises: [
      { title: 'Bench Press', sets: [{ weight_kg: 100, reps: 5 }] }
    ]
  }
};

const payloadString = JSON.stringify(payload);
const signature = crypto.createHmac('sha256', secret).update(payloadString).digest('hex');

const options = {
  hostname: 'localhost',
  port: 8080,
  path: '/',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-hevy-signature': signature,
    'Content-Length': Buffer.byteLength(payloadString)
  }
};

console.log('Sending request to http://localhost:8080...');
console.log('Payload:', payloadString);
console.log('Signature:', signature);

const req = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  res.setEncoding('utf8');
  res.on('data', (chunk) => {
    console.log(`BODY: ${chunk}`);
  });
});

req.on('error', (e) => {
  console.error(`problem with request: ${e.message}`);
});

req.write(payloadString);
req.end();
