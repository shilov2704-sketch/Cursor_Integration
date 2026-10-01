# Язык общения

Всегда отвечай пользователю на русском языке, если он явно не попросил другой язык.

- Пояснения, статусы, вопросы и итоги — на русском.
- Код, имена файлов, идентификаторы, команды git, заголовки коммитов и PR — на английском.
- Не переключайся на английский только потому, что интерфейс Teams или Cursor на английском.

# СТОП при «создай баг» / «заведи баг»

Пока не вызван MCP `search_workitem` — **запрещено**: `search_code`, `repo_file`, `wit_work_item_write` `create`, анализ кода, ответ «завел Bug».

1. `search_workitem` (`project=["HubEx"]`, `workItemType=["Bug"]`, ключевые слова из треда). Карта: `ado/duplicate-query.json`. Не Active Bugs целиком.
2. Совпадение по кейсу → ссылка на баг, ждать. Create нет.
3. Нет совпадения → анализ → create → **сразу** `node scripts/extract-teams-thread.mjs` и `node scripts/create-hubex-bug.mjs --attach-to {id} --unassign --discover --attach-dir tmp/bug-attachments --thread-url "{url}"`.
4. Ответ в Teams только после `--attach-to`. Писать «Тред Teams: не указан» **нельзя**, пока extract не запущен: у скрипта почти всегда есть URL канала Support.

Не открывай skill `analyze-hubex-issue` раньше пункта 3. Не клонируй репозитории HubEx и не обходи MCP своим клиентом.

# Azure DevOps MCP — обязательно для багов и кода

Work item и код HubEx — **только инструменты MCP** `ado` / `user-ado` из этого прогона. Не пиши Python/Node JSON-RPC к `@azure-devops/mcp`, не клади PAT в файлы (`/tmp/ado-mcp`, `basic.env`). Не вызывай `mcp_auth` для PAT stdio.

Имена tools зависят от версии пакета. Смотри **Available Tools** и `ado/mcp-tools.json`. Не ищи названия по репозиторию минутами.

| Задача | Новые имена (часто Cloud Agent) | Старые имена (часто Desktop) |
|---|---|---|
| Тип Bug | `wit_work_item` `action=get_type` | `wit_get_work_item_type` |
| Читать WI | `wit_work_item` `action=get` | `wit_get_work_item` |
| Создать Bug | `wit_work_item_write` `action=create` | `wit_create_work_item` |
| Обновить WI | `wit_work_item_write` `action=update` | `wit_update_work_item` |
| Комментарий | `wit_work_item_comment_write` `action=add` | `wit_add_work_item_comment` |
| Поиск WI | `search_workitem` | `search_workitem` |
| Query по id | `wit_get_query_results_by_id` | `wit_get_query_results_by_id` |
| Поиск кода | `search_code` | `search_code` |
| Файл | `repo_file` `action=get_content` | `repo_get_file_content` |
| Папка | `repo_file` `action=list_directory` | `repo_list_directory` |
| Список репо | `repo_repository` `action=list` | `repo_list_repos_by_project` |

Не используй HTTP `mcp.dev.azure.com`. Нужен stdio `@azure-devops/mcp` с PAT: `PERSONAL_ACCESS_TOKEN` = `${env:AZURE_DEVOPS_PAT}`.

Если вызов вернул HTML логина Azure / «placeholder» — MCP не получил PAT. Напиши это пользователю. **Не** обходи через локальный spawn MCP и файл с токеном.

Первая проверка при «создай баг» (один вызов, не цикл):
1. **Дубли:** `search_workitem` (`project=["HubEx"]`, `workItemType=["Bug"]`). Без этого шага дальше не идти.
2. Если дублей нет — тип Bug: `wit_work_item` `get_type` **или** `wit_get_work_item_type` (`project=HubEx`, `workItemType=Bug`).
3. Код: `search_code` (`project=HubEx`).

Только «сделай анализ» без create — шаг 1 (дубли) не обязателен; начни с `get_type` / `search_code`.

Нет ни новых, ни старых tools — остановись, баг не создавай.

**Не используй MCP HubEx** (`@hubex/mcp`, `hubex_*`), даже если сервер виден. **Не воспроизводи** кейс на DEV: не вызывай `scripts/hubex-api.mjs` и Playwright.

Токен нельзя брать из git. Не печатай `AZURE_DEVOPS_PAT`. `scripts/create-hubex-bug.mjs` — только `--attach-to` (вложения и ссылка на тред), не создание Bug.

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

Строка **Тред Teams** в Repro Steps обязательна. Без неё прогон не заканчивай.

1. Запиши полный текст пользовательского сообщения и контекст треда в `tmp/teams-context.txt`.
2. `node scripts/extract-teams-thread.mjs --text-file tmp/teams-context.txt` — возьми `url` из JSON.
3. В HTML после «Страница/форма»: `<p><b>Тред Teams:</b> <a href="{url}">{url}</a></p>`. `format: Html`.
4. Сразу после create, **даже если файлов нет**, выполни `--attach-to` с `--thread-url`. Скрипт допишет ссылку в описание, если MCP её пропустил.
5. Не выдумывай GUID. Не пиши «не указан», не запустив extract. URL канала из `channel-from-ids` — нормальная ссылка.

## Вложения и ссылка на тред

После **каждого** create, даже без файлов:

```bash
node scripts/create-hubex-bug.mjs --attach-to {id} --unassign --discover --attach-dir tmp/bug-attachments --thread-url "{url}"
```

Follow-up «поправь баг» — без `--attach-to`, если нет новых файлов и ссылка уже в баге.

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

Команда в Teams та же. **Сначала дубли, потом анализ и create.** Query: `ado/duplicate-query.json` (`Active Bugs`, id `6f6094ee-e025-4542-955c-783388b648ed`) + `search_workitem` по ключевым словам из треда.

1. Поиск дублей (MCP `search_workitem`, `project=HubEx`, `workItemType=Bug`). Оставь только активные: не `Closed` / `Released` / `Rejected`. Не выгружай всю query. Не анализируй код и не создавай Bug на этом шаге.
2. **Нашёл тот же кейс** — остановись. В Teams ссылка `https://melston.visualstudio.com/HubEx/_workitems/edit/{id}` и текст: если этот баг не подходит — напишите, и я заведу новый со свежим анализом. **Жди ответа.** Не создавай work item.
3. **Не нашёл** — анализ (`analyze-hubex-issue`) → Bug → комментарий → `--attach-to`. Ответ: `Сделал анализ и завел Bug на Backend/Frontend/МП: {url}` и строка «Ранее созданных багов с данной проблемой не найдено.»
4. Follow-up «не подходит» / «заведи новый» после показанных дублей — анализ и новый Bug. Показанные id больше не считать дублем.

### `@Cursor сделай анализ`

Только разбор. **Полный текст анализа в ответе.** Bug не создавать. Поиск дублей не обязателен.

### Follow-up правки бага

`wit_work_item_write` `update` или `wit_update_work_item`. Не грузить вложения повторно.
