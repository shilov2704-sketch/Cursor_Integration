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
node scripts/create-hubex-bug.mjs --template web --title "Краткий заголовок" --tenant "Frigoglass" --users "..." --page "..." --steps "..." --result "..." --expected "..." --attach screenshot.png
```

- `--template`: `web` | `backend` | `mobile`
- Не печатай и не логируй значение токена
- Если скрипт вернул `id` и `url` — баг создан, отдай ссылку пользователю
- Если ошибка `AZURE_DEVOPS_PAT is missing` — секрет не попал в этот run
- Если пользователь пишет **создай баг** — создавай сразу в этом же прогоне. Не предлагай открыть Web или Desktop. Не задавай уточняющих вопросов, из‑за которых работа встанет до ответа в другом чате.
- Если пишет **сделай анализ** — не создавай Bug.

# Баги в Azure DevOps

Проект HubEx (org `melston`). Создавай work item типа `Bug` через MCP Azure DevOps: `wit_create_work_item`.

MCP не принимает `templateId`. Воспроизводи шаблон полями из `ado/bug-templates.json`.

| Платформа | Шаблон в ADO | Area Path |
|---|---|---|
| WEB | Баг на WEB-приложение [DEV] | HubEx\\Frontend\\WebApp |
| Backend | Баг на backend [DEV] | HubEx\\Backend |
| Мобильное приложение | Баг на МП [STG] | HubEx\\Frontend\\WorkerApp |

Общее: `System.IterationPath` = `HubEx\\Next-Backlog`.

## Теги

`System.Tags` (не `System.Tags-Add`) всегда:

`DEV; {имя клиента из треда}; Create Cursor agent`

Имя клиента бери из треда Teams: тенант, клиент, канал. Пример: `DEV; Frigoglass; Create Cursor agent`. Если клиента нет — `DEV; Create Cursor agent`.

## Assign

Поле Assign / `System.AssignedTo` оставляй пустым. На создании передай пустую строку. Сразу после создания вызови `wit_update_work_item` с `/fields/System.AssignedTo` = `""`: процесс ADO иначе назначает владельца PAT.

## Вложения

Перенеси в баг все фото, видео и другие файлы из треда. У ADO MCP нет загрузки вложений — после создания:

1. Скопируй файлы из чата/треда в `tmp/bug-attachments/`
2. Выполни `node scripts/create-hubex-bug.mjs --attach-to {id} --unassign --attach-dir tmp/bug-attachments`

Если файла нет на диске (агент видит картинку, но бинарник недоступен) — напиши об этом и попроси приложить файл в чат, затем догрузи тем же скриптом.

Обязательные поля при создании:

- `System.Title`
- `System.AreaPath`
- `System.IterationPath`
- `System.Tags`
- `System.AssignedTo` (пусто)
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
<p><b>Фактический результат:</b></p>
<p><i>…</i></p>
<br>
<p><b>Ожидаемый результат:</b></p>
<p><i>…</i></p>
```

Не пиши один блок «Результат». Всегда разделяй: что произошло и как должно быть. Если ожидаемое в треде не сказано явно — сформулируй по смыслу бага.

## Команды из Teams

Две разные команды. Не путай.

### `@Cursor создай баг`

Создай Bug сразу (MCP или скрипт). Не делай анализ кода, если не просили. Skill: `create-hubex-bug`.

Платформу не спрашивай. Определи по треду:

- МП, мобильное, android, ios, worker app → `mobile`
- backend, API, ручка, 500, сервер → `backend`
- веб, страница, форма, сайдбар, браузер, QR, тултип → `web`
- неясно → `web`

В финальном сообщении дай ID и ссылку `https://melston.visualstudio.com/HubEx/_workitems/edit/{id}`.

Не спрашивай подтверждение и не проси открыть Web или Desktop.

### `@Cursor сделай анализ`

Только разбор причины по коду HubEx. **Не создавай Bug.** Skill: `analyze-hubex-issue`. Репозитории: `ado/code-repos.json`. MCP: `search_code`, `repo_get_file_content`, `repo_list_directory` (проект `HubEx`).

В ответе: проблема, какие репо смотрел, шаги воспроизведения, потенциальные причины с путями и фрагментами кода.

### Обе команды в одном сообщении

Сначала анализ, затем баг.

### Нет ни той ни другой команды

Не создавай work item. Напиши: укажите `@Cursor создай баг` или `@Cursor сделай анализ`.
