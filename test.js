const https = require('https');
https.get('https://sad.adsgram.ai/js/sad.min.js', res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log(data.slice(0, 1000)));
});
