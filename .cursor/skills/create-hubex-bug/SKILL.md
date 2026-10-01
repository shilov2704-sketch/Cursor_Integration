---
name: create-hubex-bug
description: Создать Bug в Azure DevOps HubEx. Использовать когда пользователь пишет «создай баг», «заведи баг», «заведи дефект» или create bug. Сначала поиск дублей, затем анализ кода, затем work item.
---

# Создать Bug HubEx

Синонимы: создай баг / заведи баг / заведи дефект / create bug. Команда в Teams **не меняется**.

**Порядок в одном прогоне:** поиск дублей → (если нет совпадения) анализ кода (MCP `ado`) → extract URL треда Teams → создать Bug (MCP, в Repro Steps кликабельная ссылка) → `--attach-to` **всегда** (допишет ссылку, если MCP её съел) → комментарий с анализом → короткий ответ в Teams. **Не воспроизводи** кейс на DEV HubEx. Прогон без строки «Тред Teams» в баге не заканчивай.

Не проси открыть Web/Desktop. Кроме вопроса про найденный дубль других уточнений не задавай.

**Сразу после чтения этого skill — только §1 (дубли).** Не вызывай `search_code` / `analyze-hubex-issue` / create, пока нет результата `search_workitem`. Не пиши в Teams «завел Bug», пока не выполнен `--attach-to`.

Если пользователь просит **только** «сделай анализ» / проанализируй **без** «создай/заведи баг» — этот skill **не** использовать: только `analyze-hubex-issue`, полный разбор **в ответе**, work item не создавать.

## 0. MCP обязателен для work item и кода

Создание, правки, комментарий, поиск кода и дублей — **только MCP** `ado` из этого прогона. Карта имён: `ado/mcp-tools.json`.

- Дубли: `search_workitem`; query `wit_get_query_results_by_id` / `wit_query_by_wiql`
- Код: `search_code`; файл `repo_file` `get_content` или `repo_get_file_content`
- Bug: `wit_work_item_write` `action=create` или `wit_create_work_item`
- Update: `wit_work_item_write` `action=update` или `wit_update_work_item`
- Комментарий: `wit_work_item_comment_write` `action=add` или `wit_add_work_item_comment`

Не пиши `call.py` / JSON-RPC к stdio MCP. Не сохраняй PAT в файл. Нет tools — не создавай баг через REST.

Первый вызов при «создай баг»: `search_workitem` (`searchText` из треда, `project=["HubEx"]`, `workItemType=["Bug"]`). Не `get_type` и не `search_code`. Если ответ HTML логина — MCP без PAT, остановись. `get_type` — только после дублей, перед анализом кода.

## 1. Дубли (до анализа и create)

Карта: `ado/duplicate-query.json`. Query [Active Bugs](https://dev.azure.com/melston/HubEx/_queries/query/6f6094ee-e025-4542-955c-783388b648ed/) — id `6f6094ee-e025-4542-955c-783388b648ed`. Это открытые Bug: не `Closed`, не `Released`, не `Rejected`.

Пропуск этого шага только если в **этом же треде** пользователь уже ответил, что показанные баги не подходят.

1. Из треда 3–7 ключевых слов кейса (экран, симптом, сущность). Не бери слова «баг», «ошибка», «HubEx».
2. `search_workitem`: `searchText` = эти слова, `project=["HubEx"]`, `workItemType=["Bug"]`, `top` 15–20. При пустом ответе — второй запрос с другими словами из треда.
3. Оставь только элементы, которые попали бы в Active Bugs (тип Bug, state не из `excludeStates`). Не выгружай всю query списком в чат.
4. Прочитай title / Repro у 3–5 самых близких (`wit_work_item` `get` или `wit_get_work_item`). Совпадение — **тот же кейс**, не «похожий экран».

**Нашёл совпадение** — анализ и create **не делай**. Ответ в Teams (без простыни):

```text
Похожий баг уже есть: https://melston.visualstudio.com/HubEx/_workitems/edit/{id}
Если этот баг не подходит — напишите, и я заведу новый со свежим анализом.
```

Несколько кандидатов — несколько ссылок, тот же вопрос. **Жди ответа пользователя.**

**Не нашёл** — переходи к анализу и create.

Follow-up «не подходит» / «не тот» / «заведи новый» / «это другой баг»: показанные id больше не дубли. Дальше анализ и новый Bug.

## 2. Анализ (если дублей нет или пользователь их отверг)

Следуй skill `analyze-hubex-issue`. Платформу бери из **причины**, не со скрина.

Шаблон и Area Path — только из `ado/bug-templates.json`, ничего не выдумывай:

| Ключ | Когда | Шаблон ADO | Area Path | В ответе Teams |
|---|---|---|---|---|
| `web` | вёрстка/UI веба, админка как UI | Баг на WEB-приложение [DEV] | `HubEx\Frontend\WebApp` | Frontend |
| `backend` | API, справочник, сид, 500, неверные данные с сервера | Баг на backend [DEV] | `HubEx\Backend` | Backend |
| `mobile` | МП, android, ios, RN, Worker App | Баг на МП [STG] | `HubEx\Frontend\WorkerApp` | МП |

МП: templateId `c0e0c23a-f7d6-4f57-83b7-445aba3a5d40`. Не используй Area `AdminApp` / другие пути вне таблицы.

Не вызывай MCP HubEx, `scripts/hubex-api.mjs`, Playwright.

## 3. Ссылка на тред Teams (обязательно)

Не пропускай этот шаг, даже если в промпте нет `https://teams.microsoft.com/...`.

1. Сохрани полный текст сообщения пользователя и контекст треда:

```bash
mkdir -p tmp
```

Файл: `tmp/teams-context.txt` (весь промпт, не вырезай).

2. Извлеки URL:

```bash
node scripts/extract-teams-thread.mjs --text-file tmp/teams-context.txt
```

Из JSON возьми поле `url`. Если оно не `null` — это и есть ссылка. Не выдумывай GUID.

3. В Repro Steps после «Страница/форма» и перед «Действия», `format: Html`:

```html
<p><b>Тред Teams:</b> <a href="{url}">{url}</a></p>
```

`url: null` в JSON — редкость. Не подставляй «не указан» заранее. Ссылка на канал Support (`source: channel-from-ids`) — валидный URL, её и вставляй.

## 4. Создать work item (MCP)

Поля: `System.Title`, Area/Iteration из шаблона, `System.Tags` = `DEV; {клиент}; Create Cursor agent`, `System.AssignedTo` = `""`, `Microsoft.VSTS.TCM.ReproSteps` `format: Html`.

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

Условие «если…» в title, шагах и фактическом результате — **одно и то же**, как в треде.

Сразу `wit_update_work_item`: `/fields/System.AssignedTo` = `""`.

## 5. Комментарий с анализом

`wit_add_work_item_comment`, `format: Markdown`, `project: HubEx`. Кратко: платформа, репозитории, цепочка UI→API, причина с путями, что проверить. Это не дублировать в ответе Teams.

## 6. Ссылка на тред и вложения — всегда после create

Даже если файлов нет, сразу:

```bash
node scripts/create-hubex-bug.mjs --attach-to {id} --unassign --discover --attach-dir tmp/bug-attachments --thread-url "{url}"
```

Скрипт допишет «Тред Teams» в Repro Steps, повесит Hyperlink и пропустит уже прикреплённые файлы. **Без этой команды ответ в Teams с ссылкой на новый Bug запрещён.**

Follow-up редактирования: `wit_update_work_item` / комментарий. **Не** запускай `--attach-to` и `--discover`, пока пользователь не прислал **новые** файлы (`--attach path`, без `--discover`). Если в баге нет ссылки на тред — тогда `--attach-to` с `--thread-url` без `--discover`.

## 7. Ответ в Teams (коротко)

Одна-две строки, без простыни анализа:

```text
Сделал анализ и завел Bug на Backend: https://melston.visualstudio.com/HubEx/_workitems/edit/{id}
Ранее созданных багов с данной проблемой не найдено.
```

Подставь Frontend / Backend / МП по шаблону. Вторую строку пиши только если create шёл после поиска без дублей (не после «не подходит»).
