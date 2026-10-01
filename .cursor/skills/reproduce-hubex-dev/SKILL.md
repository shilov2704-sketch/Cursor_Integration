---
name: reproduce-hubex-dev
description: Воспроизвести кейс HubEx на DEV, tenant 5. API для backend, Python Playwright для frontend. Только при создании бага, не при «сделай анализ».
---

# Воспроизведение на DEV

Только когда пользователь **создаёт / заводит баг**. Если просил **только анализ** — этот skill не использовать.

Креды из `.env` / Cloud Agents Secrets. **Не печатай токены, TEST_PASS, `.env`.** Два набора ключей: Backend и Frontend (см. `.env.example`).

Перед вызовами: `node scripts/sync-dev-env.mjs`. Не делай `cat .env`.

Код уже должен быть просмотрен (skill `analyze-hubex-issue`). **Не вызывай MCP HubEx** (`hubex_*`). Воспроизведение — только скрипты ниже. Не удаляй и не ломай чужие данные.

## Backend

Ключи: `API_USER_TOKEN`, `SECOND_BASIC_TOKEN`, `POWER_USER_TOKEN`, `TENANT_ID`, `TENANT_MEMBER_ID`, `APP_ID`, `URL_DEV_HUBEX`, `USER_EMAIL`, `USER_PHONE`.

```bash
node scripts/hubex-api.mjs GET /нужная-ручка
node scripts/hubex-api.mjs --token power GET /нужная-ручка
```

## Frontend

Ключи: `TEST_USER`, `TEST_PASS`, `TEST_PHONE`, `TEST_TENANT`, `HOST_URL`, `URL_API_HUBEX`, `BASIC_TOKEN`, плюс общие `API_USER_TOKEN`, `POWER_USER_TOKEN`, `APP_ID`, `TENANT_ID`, `TENANT_MEMBER_ID`.

```bash
python scripts/repro_web.py /путь-экрана
node scripts/hubex-api.mjs --profile frontend GET /ручка
```

Логин на вебе — `TEST_USER` / `TEST_PASS` / `HOST_URL`. Скрин: `tmp/repro-web.png`.

## Нет кредов

Нет нужного набора — баг всё равно создай, в комментарии напиши, что воспроизведение пропущено. Токены в чат не проси.
