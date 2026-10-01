---
name: create-hubex-bug
description: Создать Bug в Azure DevOps HubEx. Использовать когда пользователь пишет «создай баг», «заведи баг», «заведи дефект» или create bug. Сначала анализ кода, затем work item.
---

# Создать Bug HubEx

Синонимы: создай баг / заведи баг / заведи дефект / create bug.

**Порядок в одном прогоне:** анализ кода (MCP `ado`) → extract URL треда Teams → создать Bug (MCP, в Repro Steps кликабельная ссылка) → `--attach-to` **всегда** (допишет ссылку, если MCP её съел) → комментарий с анализом → короткий ответ в Teams. **Не воспроизводи** кейс на DEV HubEx. Прогон без строки «Тред Teams» в баге не заканчивай.

Не проси открыть Web/Desktop. Не задавай вопросов, без которых баг не появится.

Если пользователь просит **только** «сделай анализ» / проанализируй **без** «создай/заведи баг» — этот skill **не** использовать: только `analyze-hubex-issue`, полный разбор **в ответе**, work item не создавать.

## 0. MCP обязателен для work item и кода

Создание, правки полей, комментарий, поиск кода — **только** MCP `ado` / `user-ado`:

- `search_code`, `repo_get_file_content`, `repo_list_directory`
- `wit_create_work_item`, `wit_update_work_item`, `wit_add_work_item_comment`, `wit_get_work_item`

`scripts/create-hubex-bug.mjs` — **только вложения** (и ссылка на тред, если MCP её не записал). **Запрещено** создавать Bug этим скриптом, если MCP доступен. Если MCP-инструментов нет — **не** создавай баг через REST. Напиши: подключите MCP `ado` на [cursor.com/agents](https://cursor.com/agents) → MCP (stdio, `npx -y @azure-devops/mcp melston --authentication pat`, `PERSONAL_ACCESS_TOKEN` = `${env:AZURE_DEVOPS_PAT}`).

Первым вызовом проверь MCP: `wit_get_work_item_type` с `project=HubEx`, `workItemType=Bug`.

## 1. Анализ (всегда)

Следуй skill `analyze-hubex-issue`. Платформу бери из **причины**, не со скрина.

Шаблон и Area Path — только из `ado/bug-templates.json`, ничего не выдумывай:

| Ключ | Когда | Шаблон ADO | Area Path | В ответе Teams |
|---|---|---|---|---|
| `web` | вёрстка/UI веба, админка как UI | Баг на WEB-приложение [DEV] | `HubEx\Frontend\WebApp` | Frontend |
| `backend` | API, справочник, сид, 500, неверные данные с сервера | Баг на backend [DEV] | `HubEx\Backend` | Backend |
| `mobile` | МП, android, ios, RN, Worker App | Баг на МП [STG] | `HubEx\Frontend\WorkerApp` | МП |

МП: templateId `c0e0c23a-f7d6-4f57-83b7-445aba3a5d40`. Не используй Area `AdminApp` / другие пути вне таблицы.

Не вызывай MCP HubEx, `scripts/hubex-api.mjs`, Playwright.

## 2. Ссылка на тред Teams (обязательно)

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

`url: null` — `<p><b>Тред Teams:</b> <i>не указан</i></p>`. В Teams это не разворачивай длинным текстом.

## 3. Создать work item (MCP)

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

## 4. Комментарий с анализом

`wit_add_work_item_comment`, `format: Markdown`, `project: HubEx`. Кратко: платформа, репозитории, цепочка UI→API, причина с путями, что проверить. Это не дублировать в ответе Teams.

## 5. Ссылка на тред и вложения — всегда после create

Даже если файлов нет, сразу:

```bash
node scripts/create-hubex-bug.mjs --attach-to {id} --unassign --discover --attach-dir tmp/bug-attachments --thread-url "{url}"
```

Скрипт допишет «Тред Teams» в Repro Steps, повесит Hyperlink и пропустит уже прикреплённые файлы.

Follow-up редактирования: `wit_update_work_item` / комментарий. **Не** запускай `--attach-to` и `--discover`, пока пользователь не прислал **новые** файлы (`--attach path`, без `--discover`). Если в баге нет ссылки на тред — тогда `--attach-to` с `--thread-url` без `--discover`.

## 6. Ответ в Teams (коротко)

Одна-две строки, без простыни анализа:

```text
Сделал анализ и завел Bug на Backend: https://melston.visualstudio.com/HubEx/_workitems/edit/{id}
```

Подставь Frontend / Backend / МП по шаблону.
