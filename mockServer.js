const express = require('express');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');
const multer = require('multer');

function loadMockData() {
  return JSON.parse(fs.readFileSync(path.join(__dirname, 'mockServerData.json'), 'utf-8'));
}

function createApp(mockData = loadMockData(), logger = console) {
  const app = express();
  app.use(cors());
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: true }));

  const upload = multer();

  Object.entries(mockData).forEach(([endpoint, config]) => {
    const method = config.requestMethod.toLowerCase();
    const handler = method === 'post' && config.dataType.toLowerCase() === 'formdata'
      ? [upload.none(), requestHandler]
      : requestHandler;

    app[method](`/${endpoint}`, handler);
    logger.log(`✔ Mocked ${method.toUpperCase()} /${endpoint}`);
  });

  function requestHandler(req, res) {
    const endpoint = req.path.substring(1);
    const config = mockData[endpoint];
    const method = config.requestMethod.toLowerCase();

    let requestData = {};
    if (method === 'post') {
      requestData = req.body;
    } else if (method === 'get') {
      requestData = req.query;
    }

    logger.log(`➡ API called: [${method.toUpperCase()}] /${endpoint}`);
    const loggedRequestData = { ...requestData };
    if ('password' in loggedRequestData) {
      loggedRequestData.password = '[REDACTED]';
    }
    logger.log(`📥 requestData = ${JSON.stringify(loggedRequestData, null, 2)}`);

    const scenario = config.scenarios.find((candidate) => {
      if (candidate.trigger.params) {
        return Object.entries(candidate.trigger.params).every(
          ([paramName, paramValue]) => requestData[paramName] === paramValue
        );
      }

      return requestData[candidate.trigger.paramName] === candidate.trigger.paramValue;
    });

    if (scenario) {
      const matchedParams = scenario.trigger.params
        ? Object.keys(scenario.trigger.params).join(', ')
        : `${scenario.trigger.paramName}=${scenario.trigger.paramValue}`;
      logger.log(`✅ Scenario matched: ${matchedParams}`);
      res.status(scenario.response.status).json(scenario.response.responseData);
    } else {
      logger.log('❌ No matching scenario');
      res.status(404).json({ error: 'No matching scenario' });
    }
  }

  return app;
}

function startServer(port = 3000) {
  const app = createApp();
  return app.listen(port, () => {
    console.log(`🚀 Mock API Server running at http://localhost:${port}`);
  });
}

if (require.main === module) {
  startServer();
}

module.exports = { createApp, startServer };
