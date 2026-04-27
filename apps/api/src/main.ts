import 'reflect-metadata'
import { resolve } from 'path'
import { config as loadEnv } from 'dotenv'
import { NestFactory } from '@nestjs/core'
import { Logger } from '@nestjs/common'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import { AppModule } from './app.module.js'

// Load .env before NestJS initializes — path is relative to this file so it's
// reliable regardless of the cwd pnpm uses when running the script.
loadEnv({
  path: resolve(__dirname, '../../..', '.env'),
  override: true,
})

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  })

  app.enableCors({
    origin: process.env['ALLOWED_ORIGINS']?.split(',').map((o) => o.trim()) ?? [
      'http://localhost:5173',
      'http://localhost:5174',
    ],
    credentials: true,
  })

  // ── Swagger / OpenAPI ────────────────────────────────────────────────────
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Rezeta API')
    .setDescription(
      'Medical ERP REST API.\n\n' +
        '## Autenticación\n\n' +
        '**Desde Swagger (recomendado):** Haz clic en **Authorize** → sección OAuth2 → ' +
        'ingresa tu email y password → clic en **Authorize**. ' +
        'Todos los endpoints protegidos quedarán autenticados automáticamente.\n\n' +
        '**Manual:** Llama `POST /v1/auth/dev/token` con `{ "email", "password" }`, ' +
        'copia el `access_token` y pégalo en **Authorize → BearerAuth**.\n\n' +
        '> `POST /v1/auth/dev/token` solo funciona fuera de producción.',
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'Firebase ID Token',
        description: 'Firebase ID Token. Obtén uno con POST /v1/auth/dev/token.',
      },
      'firebase-jwt',
    )
    .addOAuth2(
      {
        type: 'oauth2',
        description: 'Inicia sesión directamente con credenciales de Firebase.',
        flows: {
          password: {
            tokenUrl: '/v1/auth/dev/token',
            scopes: {},
          },
        },
      },
      'firebase-oauth2',
    )
    .build()

  const document = SwaggerModule.createDocument(app, swaggerConfig)
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  })

  const port = parseInt(process.env['PORT'] ?? '3000', 10)
  await app.listen(port)
  Logger.log(`API running on http://localhost:${port}`, 'Bootstrap')
  Logger.log(`Swagger docs: http://localhost:${port}/docs`, 'Bootstrap')
}

bootstrap().catch((err: unknown) => {
  console.error('Fatal bootstrap error', err)
  process.exit(1)
})
