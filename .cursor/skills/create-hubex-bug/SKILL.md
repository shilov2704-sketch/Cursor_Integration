---
name: create-hubex-bug
description: Создать Bug в Azure DevOps HubEx из Teams или Cloud Agent по шаблону WEB, Backend или Mobile. Использовать когда пользователь просит завести баг, дефект или work item.
---

# Создать Bug HubEx

В Cloud Agent и Microsoft Teams нет Azure DevOps MCP. Не пытайся вызывать `wit_create_work_item`.

Сразу выполни:

```bash
node scripts/create-hubex-bug.mjs --template web --title "..." --tenant "..." --users "..." --page "..." --steps "..." --result "..."
```

Шаблоны: `web`, `backend`, `mobile`.

Токен берётся из окружения `AZURE_DEVOPS_PAT`. Не выводи его. После успеха верни ссылку `https://melston.visualstudio.com/HubEx/_workitems/edit/{id}`.
