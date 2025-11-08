/**
 * Netlify Lambda handler for NestJS AppModule
 * @param {object} event - Lambda event
 * @param {object} context - Lambda context
 * @returns {Promise<object>}
 */
const serverless = require('serverless-http');
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../../dist/app.module'); // تأكد المسار ده مظبوط حسب build
const express = require('express');
const app = express();

let server;

async function bootstrap() {
  if (!server) {
    const nestApp = await NestFactory.create(AppModule, app);
    await nestApp.init();
    server = serverless(app);
  }
  return server;
}

module.exports.handler = async (event, context) => {
  const lambdaHandler = await bootstrap();
  return lambdaHandler(event, context);
};
