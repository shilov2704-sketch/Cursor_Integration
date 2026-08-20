---
name: create-hubex-bug
description: Создать Bug в Azure DevOps HubEx из Teams или Cloud Agent по шаблону WEB, Backend или Mobile. Использовать когда пользователь просит завести баг, дефект или work item.
---

# Создать Bug HubEx

Сначала вызови MCP `wit_create_work_item` (сервер `ado` / `user-ado`), если инструмент есть в этом прогоне. Шаблоны: `ado/bug-templates.json`.

Из Teams / Cloud Agent создавай баг сразу, в этом же прогоне. Не проси открыть Web или Desktop и не задавай вопросов, без ответа на которые баг не появится. `@Cursor` в треде про дефект = просьба создать. Платформу определи по треду (МП → mobile, API/ручка → backend, веб/страница/неясно → web).

## Обязательные поля

- `System.Title`
- `System.AreaPath` / `System.IterationPath` по шаблону
- `System.Tags` = `DEV; {имя клиента из треда}; Create Cursor agent`
- `System.AssignedTo` = пустая строка (поле Assign не заполнять)
- `Microsoft.VSTS.TCM.ReproSteps` (`format: Html`): Тенант, Пользователь, Страница/форма, Действия, **Фактический результат**, **Ожидаемый результат**. Не пиши один блок «Результат». Если ожидаемое в треде не сказано явно — сформулируй по смыслу бага.

Имя клиента бери из треда: тенант, название клиента, канал. Пример: `DEV; Frigoglass; Create Cursor agent`. Если клиента нет — `DEV; Create Cursor agent`. Не используй `System.Tags-Add`.

После создания сразу сними назначение: `wit_update_work_item` с `/fields/System.AssignedTo` = `""`. Процесс ADO назначает автора PAT, если этого не сделать.

## Вложения из треда

ADO MCP не умеет загружать файлы. После создания бага перенеси фото, видео и прочие файлы из треда скриптом.

1. Собери файлы из треда/чата: вложения в сообщении, пути к картинкам и видео, скачанные файлы.
2. Скопируй их в `tmp/bug-attachments/` в workspace, не переименовывая без нужды.
3. Выполни:

```bash
node scripts/create-hubex-bug.mjs --attach-to {id} --unassign --attach-dir tmp/bug-attachments
```

Или отдельные файлы: `--attach "path/to/file.png" --attach "path/to/clip.mp4"`.

Если бинарник недоступен (модель видит скриншот, но файла на диске нет) — всё равно создай баг, напиши какие вложения не удалось перенести и попроси приложить файлы в чат агента, затем догрузи тем же скриптом.

## Если MCP недоступен

```bash
node scripts/create-hubex-bug.mjs --template web --title "..." --tenant "Frigoglass" --users "..." --page "..." --steps "..." --result "..." --expected "..." --attach screenshot.png
```

Шаблоны: `web`, `backend`, `mobile`. Токен: `AZURE_DEVOPS_PAT`. Не выводи его. После успеха верни `https://melston.visualstudio.com/HubEx/_workitems/edit/{id}`.
