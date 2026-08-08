import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { RedactingLogger } from './common/logger';

const DEFAULT_PORT = 4000;

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: new RedactingLogger() });
  const port = Number(process.env.API_PORT ?? DEFAULT_PORT);
  await app.listen(port);
  console.log(`api listening on http://localhost:${port}`);
}

void bootstrap();
