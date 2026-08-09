import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { RedactingLogger } from './common/logger';

const DEFAULT_PORT = 4000;

async function bootstrap(): Promise<void> {
  // `rawBody` is what makes Chapa's webhook signature checkable (T-143): the
  // HMAC covers the bytes that were sent, and a re-serialised body is a
  // different document with a different hash.
  const app = await NestFactory.create(AppModule, {
    logger: new RedactingLogger(),
    rawBody: true,
  });
  const port = Number(process.env.API_PORT ?? DEFAULT_PORT);
  await app.listen(port);
  console.log(`api listening on http://localhost:${port}`);
}

void bootstrap();
