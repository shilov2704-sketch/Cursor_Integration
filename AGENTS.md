# Язык общения

Всегда отвечай пользователю на русском языке, если он явно не попросил другой язык.

- Пояснения, статусы, вопросы и итоги — на русском.
- Код, имена файлов, идентификаторы, команды git, заголовки коммитов и PR — на английском.
- Не переключайся на английский только потому, что интерфейс Teams или Cursor на английском.

# Azure DevOps MCP — обязательно для багов и кода

Work item и код HubEx — **только MCP** `ado` / `user-ado`: `wit_create_work_item`, `wit_update_work_item`, `wit_add_work_item_comment`, `search_code`, `repo_get_file_content`, `repo_list_directory`.

Не используй HTTP `mcp.dev.azure.com`. Нужен stdio `@azure-devops/mcp` с PAT пользователя.

# HubEx MCP — живые данные DEV

Порядок всегда такой: **сначала код** в репозиториях HubEx через MCP `ado` (`search_code`, `repo_get_file_content`). MCP `hubex` (`@hubex/mcp`) — **дополнение** для живых данных DEV и воспроизведения (RW). Карточки Bug — только `ado`.

Не печатай `HUBEX_SERVICE_TOKEN` / `API_USER_TOKEN`. При воспроизведении можно создавать тестовые сущности через `hubex` (пакет помечает их `[MCP-TEST]`). Не трогай чужие боевые записи и не делай DELETE без явной просьбы.

Если `hubex` нет — анализ кода не останавливай; воспроизведение через `scripts/hubex-api.mjs` / Playwright.

Токен **нельзя** брать из git. ADO: секрет `AZURE_DEVOPS_PAT`. DEV HubEx: `.env` (локально) или Secrets с теми же именами. Не печатай значения.

`scripts/create-hubex-bug.mjs` — **только загрузка вложений**. **Запрещено** создавать Bug через REST, если MCP есть. Если MCP-инструментов нет — **не** создавай баг скриптом. Напиши, что нужно включить MCP на [cursor.com/agents](https://cursor.com/agents) → MCP.

Первая проверка прогона: `wit_get_work_item_type` (`project=HubEx`, `workItemType=Bug`).

# Баги HubEx

Org `melston`, project `HubEx`, type `Bug`. Поля шаблона: `ado/bug-templates.json`. Area Path **только** из этой таблицы:

| Ключ | Шаблон | Area Path | В ответе |
|---|---|---|---|
| web | Баг на WEB-приложение [DEV] | HubEx\\Frontend\\WebApp | Frontend |
| backend | Баг на backend [DEV] | HubEx\\Backend | Backend |
| mobile | Баг на МП [STG] (templateId `c0e0c23a-f7d6-4f57-83b7-445aba3a5d40`) | HubEx\\Frontend\\WorkerApp | МП |

Iteration: `HubEx\\Next-Backlog`. Не ставь Area `AdminApp` и другие пути вне таблицы.

Платформу выбирай **после анализа кода** (UI → API → сервис). Скрин веб-страницы ≠ баг на Frontend. Данные/опечатка в API → Backend. МП/android/ios/RN → mobile.

Теги: `DEV; {клиент}; Create Cursor agent`. Assign пустой, сразу очистить `System.AssignedTo`.

## Ссылка на тред

После «Страница/форма», перед «Действия». URL: `node scripts/extract-teams-thread.mjs --text "..."`. Не выдумывать. Нет ссылки — `не указан`.

## Вложения

Только при **первом** создании:

```bash
node scripts/create-hubex-bug.mjs --attach-to {id} --unassign --discover --attach-dir tmp/bug-attachments --thread-url "{url}"
```

Follow-up «поправь баг» — без `--attach-to`. Скрипт не прикрепляет файл, который уже есть на work item.

## Repro Steps

```html
<p><b>Тенант:</b> <i>…</i></p>
<p><b>Пользователь:</b> <i>…</i></p>
<p><b>Страница/форма:</b> <i>…</i></p>
<p><b>Тред Teams:</b> <a href="{url}">{url}</a></p>
<br>
<p><b>Действия:</b></p>
<p><i>…</i></p>
<br>
<p><b>Фактический результат:</b></p>
<p><i>…</i></p>
<br>
<p><b>Ожидаемый результат:</b></p>
<p><i>…</i></p>
```

Условие «если…» в title/шагах/факте — одно, как в треде. Не инвертировать.

# Команды Teams

### `@Cursor создай баг` / заведи баг

1. Анализ по skill `analyze-hubex-issue` (MCP).
2. Воспроизведение на DEV, tenant 5: сначала код, затем MCP `hubex` (RW); запасной путь — `scripts/hubex-api.mjs` / Playwright. Креды из Secrets, не светить.
3. Bug через MCP.
4. Анализ и результат воспроизведения — `wit_add_work_item_comment`.
5. Вложения один раз.
6. Ответ: `Сделал анализ и завел Bug на Backend/Frontend/МП: {url}`

### `@Cursor сделай анализ`

Только разбор. **Полный текст анализа в ответе.** Баг не создавать. DEV/Playwright не обязательны.

### Follow-up правки бага

Только update полей/комментарий. Не грузить вложения повторно.
