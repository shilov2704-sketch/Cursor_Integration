# Язык общения

Всегда отвечай пользователю на русском языке, если он явно не попросил другой язык.

- Пояснения, статусы, вопросы и итоги — на русском.
- Код, имена файлов, идентификаторы, команды git, заголовки коммитов и PR — на английском, если в проекте нет другой договорённости.
- Не переключайся на английский только потому, что интерфейс Teams или Cursor на английском.

# Azure DevOps MCP

Создавай Bug через MCP `wit_create_work_item` (сервер `ado` / `user-ado`), если инструмент доступен — и в Desktop, и в Cloud Agent / Teams.

Не проси подключить remote HTTP `mcp.dev.azure.com`: в Cursor он не логинится через Entra ID. Нужен stdio-сервер `@azure-devops/mcp` с PAT.

Если MCP-инструмента нет, создавай Bug сразу скриптом. Секрет `AZURE_DEVOPS_PAT` задаётся в Cursor Cloud Agents → Secrets и доступен как переменная окружения:

```bash
node scripts/create-hubex-bug.mjs --template web --title "Краткий заголовок" --tenant "..." --users "..." --page "..." --steps "..." --result "..."
```

- `--template`: `web` | `backend` | `mobile`
- Не печатай и не логируй значение токена
- Если скрипт вернул `id` и `url` — баг создан, отдай ссылку пользователю
- Если ошибка `AZURE_DEVOPS_PAT is missing` — секрет не попал в этот run
- Если пользователь просит создать баг — создавай сразу, не предлагай Desktop Agent как единственный путь

# Баги в Azure DevOps

Проект HubEx (org `melston`). Создавай work item типа `Bug` через MCP Azure DevOps: `wit_create_work_item`.

MCP не принимает `templateId`. Воспроизводи шаблон полями из `ado/bug-templates.json`.

| Платформа | Шаблон в ADO | Area Path | Tag |
|---|---|---|---|
| WEB | Баг на WEB-приложение [DEV] | HubEx\\Frontend\\WebApp | DEV |
| Backend | Баг на backend [DEV] | HubEx\\Backend | DEV |
| Мобильное приложение | Баг на МП [STG] | HubEx\\Frontend\\WorkerApp | DEV |

Общее: `System.IterationPath` = `HubEx\\Next-Backlog`. Assigned To не заполняй.

Обязательные поля при создании:

- `System.Title`
- `System.AreaPath`
- `System.IterationPath`
- `System.Tags` (значение `DEV`; не использовать `System.Tags-Add`)
- `Microsoft.VSTS.TCM.ReproSteps` в HTML (`format: Html`)

Структура Repro Steps:

```html
<p><b>Тенант:</b> <i>…</i></p>
<p><b>Пользователь:</b> <i>…</i></p>
<p><b>Страница/форма:</b> <i>…</i></p>
<br>
<p><b>Действия:</b></p>
<p><i>…</i></p>
<br>
<p><b>Результат:</b></p>
<p><i>…</i></p>
```

Если пользователь не уточнил платформу — спроси: WEB, Backend или МП. Не создавай баг без явной просьбы создать. После создания отдай ID и ссылку `https://melston.visualstudio.com/HubEx/_workitems/edit/{id}`.
