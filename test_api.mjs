fetch('http://localhost:3000/api/broadcast', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message: "test", adminId: process.env.ADMIN_TELEGRAM_ID })
})
.then(r => r.text())
.then(console.log)
.catch(console.error);
