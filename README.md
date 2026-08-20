# Cursor Integration — агент HubEx в Teams

Публичный репозиторий **конфигурации** облачного агента Cursor. Сам продукт HubEx здесь не лежит: агент читает эти правила, а в Azure DevOps ходит с **вашим** PAT.

Токены в git не хранятся. MCP ADO каждый подключает у себя: [cursor.com/agents](https://cursor.com/agents) → MCP.

## Что умеет

В **треде канала** Microsoft Teams:

| Команда | Результат |
|---|---|
| `@Cursor создай баг` | Bug в проекте HubEx (org `melston`) по тексту треда |
| `@Cursor сделай анализ` | Разбор по коду репозиториев HubEx. Баг не создаётся |

## Как подключиться

Пошаговая инструкция: **[TEAMS.md](TEAMS.md)**.

Кратко:

1. Своя учётка [Cursor](https://cursor.com) и Cloud Agents.
2. Default repository: `shilov2704-sketch/Cursor_Integration`.
3. Свой PAT Azure DevOps (org `melston`: Work Items Read & write, Code Read).
4. Секрет Cloud Agents с именем `AZURE_DEVOPS_PAT`.
5. MCP на [cursor.com/agents](https://cursor.com/agents) → MCP (stdio, не HTTP).
6. Приложение Cursor в Teams, затем в треде канала `@Cursor создай баг` или `@Cursor сделай анализ`.

## Что в репозитории

| Путь | Назначение |
|---|---|
| `AGENTS.md` | Правила для Cloud Agent |
| `TEAMS.md` | Инструкция для сотрудников |
| `.cursor/rules/`, `.cursor/skills/` | Команды, шаблоны багов, анализ |
| `ado/bug-templates.json` | Поля Bug в HubEx |
| `ado/code-repos.json` | Какие репозитории HubEx смотреть при анализе |
| `scripts/create-hubex-bug.mjs` | Создание бага и вложений, если MCP недоступен |
| `.cursor/mcp.json.example` | Пример MCP **без** токена |

Рабочий `.cursor/mcp.json` в git не коммитится.
