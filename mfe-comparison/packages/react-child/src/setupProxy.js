const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  // CORS middleware
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');
    
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    
    next();
  });
  
  // Add simple test endpoint
  app.get('/api/test', (req, res) => {
    res.json({ message: 'CORS is working from React child!', time: new Date().toISOString() });
  });
};