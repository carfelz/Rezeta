import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { Logger } from '@nestjs/common'
import { AppModule } from './app.module.js'

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  })

  app.enableCors({
    origin: process.env['ALLOWED_ORIGINS']?.split(',') ?? 'http://localhost:5173',
    credentials: true,
  })

  const port = parseInt(process.env['PORT'] ?? '3000', 10)
  await app.listen(port)
  Logger.log(`API running on http://localhost:${port}`, 'Bootstrap')
}

bootstrap().catch((err: unknown) => {
  console.error('Fatal bootstrap error', err)
  process.exit(1)
})
