---
name: create-hubex-bug
description: Создать Bug в Azure DevOps HubEx. Использовать только когда пользователь пишет «создай баг», «заведи баг», «заведи дефект» или create bug. Не использовать для «сделай анализ».
---

# Создать Bug HubEx

Только команда **создай баг** (заведи баг / заведи дефект / create bug). Если написали «сделай анализ» — не этот skill, баг не создавать.

Из Teams / Cloud Agent создавай баг сразу, в этом же прогоне. Не проси открыть Web или Desktop и не задавай вопросов, без ответа на которые баг не появится. Платформу определи по треду (МП → mobile, API/ручка → backend, веб/страница/неясно → web).

**Не заканчивай прогон**, пока не сделаны все три шага: создать work item → вставить ссылку на тред Teams → перенести вложения. Пропуск вложений или ссылки на тред — ошибка.

## 1. Ссылка на тред Teams (обязательно)

В `Microsoft.VSTS.TCM.ReproSteps` ссылка на тред — **следующая строка после «Страница/форма» и перед «Действия»**:

```html
<p><b>Тред Teams:</b> <a href="{url}">{url}</a></p>
```

Откуда взять `{url}` (по порядку):

1. Любая ссылка `https://teams.microsoft.com/...` в сообщении пользователя или в тексте треда.
2. Идентификаторы в контексте промпта / метаданных: `conversationId`, `channelId`, `teamId`, `messageId`, `tenantId`, `parentMessageId`. Собери deep link:

```text
https://teams.microsoft.com/l/message/{conversationId}/{messageId}?tenantId={tenantId}&groupId={teamId}&parentMessageId={parentMessageId}
```

`messageId` — id корневого сообщения треда (parent). Не выдумывай GUID и URL.

3. Если URL нет — пиши `<p><b>Тред Teams:</b> <i>не указан</i></p>` и в ответе пользователю попроси в следующем сообщении: в Teams у корневого сообщения треда **Copy link** / **Копировать ссылку** и прислать `@Cursor` — затем допиши в баг скриптом `--thread-url`.

Передай URL ещё и в скрипт: `--thread-url "{url}"` (он же добавит Hyperlink на work item).

## 2. Создать work item

Сначала MCP `wit_create_work_item` (сервер `ado` / `user-ado`), если инструмент есть. Шаблоны: `ado/bug-templates.json`.

### Обязательные поля

- `System.Title`
- `System.AreaPath` / `System.IterationPath` по шаблону
- `System.Tags` = `DEV; {имя клиента из треда}; Create Cursor agent`
- `System.AssignedTo` = пустая строка
- `Microsoft.VSTS.TCM.ReproSteps` (`format: Html`) — шаблон ниже. Не пиши один блок «Результат». Если ожидаемое в треде не сказано явно — сформулируй по смыслу бага.

Имя клиента бери из треда: тенант, название клиента, канал. Пример: `DEV; Frigoglass; Create Cursor agent`. Если клиента нет — `DEV; Create Cursor agent`. Не используй `System.Tags-Add`.

После создания сразу сними назначение: `wit_update_work_item` с `/fields/System.AssignedTo` = `""`.

### Repro Steps HTML

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

## 3. Вложения из треда (обязательно, сразу после создания)

ADO MCP **не умеет** загружать файлы. Картинку «видеть» недостаточно: в баг попадает только бинарник с диска. После создания **сразу** перенеси фото, видео и прочие файлы.

1. Найди файлы. Смотри пути в промпте, блоки вложений, `Read`/`Glob` по картинкам. Скопируй в `tmp/bug-attachments/` (имена сохрани). Типичные места:

   - пути вида `/tmp/...`, `uploads/`, `attachments/`
   - `tmp/bug-attachments/`
   - `~/.cursor/attachments`
   - `/opt/cursor/attachments`

   Пример поиска:

   ```bash
   mkdir -p tmp/bug-attachments
   find /tmp "$HOME/.cursor/attachments" /opt/cursor/attachments . -maxdepth 5 \( -iname '*.png' -o -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.gif' -o -iname '*.webp' -o -iname '*.mp4' -o -iname '*.mov' -o -iname '*.webm' -o -iname '*.pdf' \) 2>/dev/null
   ```

   Найденные файлы из треда скопируй в `tmp/bug-attachments/`. Не тащи служебные файлы репозитория.

2. **Всегда** выполни (даже если папка пустая — скрипт допишет ссылку на тред и снимет Assign):

```bash
node scripts/create-hubex-bug.mjs --attach-to {id} --unassign --attach-dir tmp/bug-attachments --thread-url "{url}"
```

Скрипт сам ищет файлы в известных каталогах (`--discover` включён по умолчанию для `--attach-to`). Картинки попадают и как AttachedFile, и в Repro Steps (`<img>`).

Отдельные пути: `--attach "path/to/file.png"`. Проверка без загрузки: `--list-discovered`.

3. Если бинарника нет (модель видит скриншот, файла на диске нет) — баг всё равно создай, в ответе явно напиши какие вложения **не** перенеслись и попроси приложить файлы в чат / follow-up `@Cursor`, затем догрузи тем же `--attach-to`.

Не пиши в финале «вложения перенесены», если `attached` в выводе скрипта пустой, а в треде были скриншоты.

## Если MCP недоступен

```bash
node scripts/create-hubex-bug.mjs --template web --title "..." --thread-url "https://teams.microsoft.com/l/message/..." --tenant "Frigoglass" --users "..." --page "..." --steps "..." --result "..." --expected "..." --attach screenshot.png
```

Шаблоны: `web`, `backend`, `mobile`. Токен: `AZURE_DEVOPS_PAT`. Не выводи его. После успеха верни `https://melston.visualstudio.com/HubEx/_workitems/edit/{id}`.
