# Язык общения

Всегда отвечай пользователю на русском языке, если он явно не попросил другой язык.

- Пояснения, статусы, вопросы и итоги — на русском.
- Код, имена файлов, идентификаторы, команды git, заголовки коммитов и PR — на английском, если в проекте нет другой договорённости.
- Не переключайся на английский только потому, что интерфейс Teams или Cursor на английском.

# Azure DevOps MCP

## Cursor Desktop (локальный Agent)

Создавай Bug через MCP `wit_create_work_item`.

## Обязательно для Cloud Agent и Microsoft Teams

Этот прогон **не имеет** Azure DevOps MCP. Не пиши про MCP, не проси подключить `mcp.dev.azure.com`, не ссылайся на GitHub Secrets.

Секрет `AZURE_DEVOPS_PAT` уже задан в Cursor Cloud Agents и доступен процессу как переменная окружения. Создавай Bug **только** командой:

```bash
node scripts/create-hubex-bug.mjs --template web --title "Краткий заголовок" --tenant "..." --users "..." --page "..." --steps "..." --result "..."
```

- `--template`: `web` | `backend` | `mobile`
- Не печатай и не логируй значение токена
- Если скрипт вернул `id` и `url` — баг создан, отдай ссылку пользователю
- Если ошибка `AZURE_DEVOPS_PAT is missing` — секрет не попал в этот run; нужен новый агент после проверки имени секрета
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
