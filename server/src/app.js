const fs = require('fs');
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const env = require('./config/env');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/error');

const app = express();
app.set('trust proxy', 1); // behind Render / Railway proxy -> correct req.secure for cookies
app.disable('x-powered-by');

app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      // Kakao (Daum) postcode search + Toss Payments SDK
      'script-src': ["'self'", 'https://t1.daumcdn.net', 'https://*.daumcdn.net', 'https://*.daum.net', 'https://*.kakao.com', 'https://js.tosspayments.com', 'https://*.tosspayments.com'],
      'frame-src': ["'self'", 'https://*.daum.net', 'https://*.kakao.com', 'https://*.tosspayments.com'],
      'connect-src': ["'self'", 'https://*.tosspayments.com', 'https://*.daum.net', 'https://*.kakao.com'],
      'img-src': ["'self'", 'data:', 'blob:', 'https:'],
      'style-src': ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net', 'https://fonts.googleapis.com'],
      'font-src': ["'self'", 'data:', 'https://cdn.jsdelivr.net', 'https://fonts.gstatic.com'],
    },
  },
  crossOriginEmbedderPolicy: false,
}));
// Only needed in development, when Vite serves the client on another port.
app.use(cors({ origin: env.clientUrl, credentials: true }));
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());
if (!env.isTest) app.use(morgan(env.isProd ? 'combined' : 'dev'));

// API documentation
const openapi = YAML.load(path.join(__dirname, 'docs/openapi.yaml'));
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapi, { customSiteTitle: 'WON AVENUE API' }));

app.use('/api', routes);
app.use('/api', notFound);

// In production the built React app is served by the same server (single URL, same-origin cookies).
const clientDist = path.join(__dirname, '../../client/dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist, { index: false, maxAge: '1h' }));
  app.get('/{*splat}', (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

app.use(notFound);
app.use(errorHandler);

module.exports = app;
