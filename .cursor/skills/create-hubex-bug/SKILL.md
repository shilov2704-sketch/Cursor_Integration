---
name: create-hubex-bug
description: Создать Bug в Azure DevOps HubEx из Teams или Cloud Agent по шаблону WEB, Backend или Mobile. Использовать когда пользователь просит завести баг, дефект или work item.
---

# Создать Bug HubEx

Сначала вызови MCP `wit_create_work_item` (сервер `ado` / `user-ado`), если инструмент есть в этом прогоне.

Поля: `System.Title`, `System.AreaPath`, `System.IterationPath`, `System.Tags` = `DEV`, `Microsoft.VSTS.TCM.ReproSteps` (`format: Html`). Шаблоны: `ado/bug-templates.json`.

Если MCP недоступен, сразу выполни:

```bash
node scripts/create-hubex-bug.mjs --template web --title "..." --tenant "..." --users "..." --page "..." --steps "..." --result "..."
```

Шаблоны: `web`, `backend`, `mobile`.

Токен берётся из окружения `AZURE_DEVOPS_PAT`. Не выводи его. После успеха верни ссылку `https://melston.visualstudio.com/HubEx/_workitems/edit/{id}`.
