# Облачный агент Cursor в Teams

Пошаговая настройка **для сотрудника**. Репозиторий публичный: его можно подключить без приглашения. У каждого свои учётка Cursor и PAT Azure DevOps.

[Cursor_Integration](https://github.com/shilov2704-sketch/Cursor_Integration) — только **конфигурация агента** (команды, шаблоны багов, карта репозиториев HubEx). **Токен ADO в репозитории не хранится и из него не читается.** MCP работает только с PAT, который вы сами указали в своём Cursor.

Документация Cursor: [Teams](https://cursor.com/docs/integrations/microsoft-teams), [Cloud Agents](https://cursor.com/dashboard/cloud-agents).

---

## Как это устроено

```text
Вы в Teams:  @Cursor создай баг  /  @Cursor сделай анализ
        ↓
Ваш Cloud Agent (ваша учётка Cursor)
        ↓
Клонирует публичный Cursor_Integration  →  читает AGENTS.md, rules, skills
        ↓
Только ваш секрет AZURE_DEVOPS_PAT  +  ваш MCP Azure DevOps
        ↓
Баг или анализ в org melston / проект HubEx (от вашего имени в ADO)
```

В git нет рабочего `.cursor/mcp.json` с токеном. Облачный агент всё равно его не читает: MCP задаётся в **вашем** дашборде Cursor (шаг 5).

---

## Шаг 1. Репозиторий конфигурации

Репозиторий публичный: collaborator не нужен.

1. Откройте [shilov2704-sketch/Cursor_Integration](https://github.com/shilov2704-sketch/Cursor_Integration) и убедитесь, что страница открывается без запроса доступа.
2. Клонировать на диск **не обязательно**: Cloud Agent заберёт его сам, когда вы укажете `repo=shilov2704-sketch/Cursor_Integration`.

---

## Шаг 2. Cursor: GitHub и Cloud Agents

Войдите в **свою** учётку на [cursor.com](https://cursor.com).

1. [Dashboard → Integrations](https://cursor.com/dashboard/integrations) — подключите **GitHub**.
2. [Dashboard → Cloud Agents](https://cursor.com/dashboard/cloud-agents) — включите Cloud Agents. Нужен тариф с Cloud Agents и **usage-based pricing**.
3. Там же, если есть **Default repository**, укажите:

   `shilov2704-sketch/Cursor_Integration`

   Если поля нет — в каждом сообщении в Teams добавляйте `repo=shilov2704-sketch/Cursor_Integration`.

---

## Шаг 3. Свой PAT в Azure DevOps

Токен должен быть **ваш**, в организации **melston**. Чужой PAT и значения из репозитория не использовать.

1. Откройте [Create PAT](https://dev.azure.com/melston/_usersSettings/tokens) (учётка, которая может создавать Bug в проекте HubEx).
2. **New Token**:
   - Name: например `Cursor Cloud Agent`
   - Organization: `melston`
   - Expiration: по политике компании
   - Scopes:
     - **Work Items** → Read & write
     - **Code** → Read
3. Создайте токен и **сразу скопируйте**. Повторно значение не показывают.
4. Не кладите его в git, в чат и в файлы репозитория.

Баги в ADO создаются от имени владельца этого PAT. Assign агент оставляет пустым.

---

## Шаг 4. Секрет PAT в вашем Cursor

Секрет живёт только в **вашем** аккаунте Cloud Agent.

1. [Cloud Agents → Secrets](https://cursor.com/dashboard/cloud-agents) (раздел Secrets).
2. Добавьте секрет:
   - **Name** точно: `AZURE_DEVOPS_PAT`
   - **Value**: ваш PAT из шага 3
3. Сохраните.

Это не GitHub Secrets и не файлы репозитория. Без этого шага MCP ADO и скрипт создания бага не аутентифицируются.

---

## Шаг 5. MCP Azure DevOps — указать свой токен

MCP настраивается **у вас в Cursor**, не копируется из репозитория как готовый доступ.

1. Откройте [cursor.com/agents](https://cursor.com/agents) → MCP  
   или [Integrations](https://cursor.com/dashboard/integrations) → MCP.
2. **Add custom MCP**.
3. Транспорт: **stdio** (command).  
   Не HTTP и не `https://mcp.dev.azure.com/...` — через Entra ID в Cursor это не залогинится.
4. Вставьте конфиг. Токен — **только** ссылка на ваш секрет из шага 4, не строка из git:

```json
{
  "mcpServers": {
    "ado": {
      "command": "npx",
      "args": ["-y", "@azure-devops/mcp", "melston", "--authentication", "pat"],
      "env": {
        "PERSONAL_ACCESS_TOKEN": "${env:AZURE_DEVOPS_PAT}"
      }
    }
  }
}
```

`${env:AZURE_DEVOPS_PAT}` подставляет секрет **вашего** Cloud Agent. Если секрета нет — MCP не возьмёт токен из репозитория (его там нет).

5. Сохраните. Нужен **новый** прогон агента.

Шаблон MCP без секрета: `.cursor/mcp.json.example` (только `${env:AZURE_DEVOPS_PAT}`). Рабочий `.cursor/mcp.json` в git не хранится. Для Desktop задайте переменную окружения `AZURE_DEVOPS_PAT` или локальный mcp.json **вне git**.

Если MCP ещё не добавлен, а секрет PAT есть — `@Cursor создай баг` может сработать скриптом. **`@Cursor сделай анализ` без MCP не получится.**

---

## Шаг 6. Приложение Cursor в Microsoft Teams

Под **своей** учёткой Cursor.

1. [Integrations](https://cursor.com/dashboard/integrations) → **Microsoft Teams** → **Connect**.  
   Или [Cursor в Marketplace](https://marketplace.microsoft.com/en-us/product/WA200010720).
2. Установите (или откройте) приложение Cursor в Teams.
3. Подтвердите связку аккаунта, GitHub, usage-based pricing, privacy.
4. В Teams найдите **Cursor** и напишите:

```text
@Cursor help
```

Если просит Link account — войдите в свою учётку Cursor.

---

## Шаг 7. Проверка

В **треде канала** Teams (не личка и не групповой чат):

```text
@Cursor repo=shilov2704-sketch/Cursor_Integration ответь одним предложением, на каком языке будешь со мной говорить
```

Успех: карточка с репозиторием `Cursor_Integration`, ответ на русском, Web/Desktop открывать не пришлось.

---

## Шаг 8. Ежедневная работа

Только **тред канала**.

```text
@Cursor repo=shilov2704-sketch/Cursor_Integration создай баг
```

```text
@Cursor repo=shilov2704-sketch/Cursor_Integration сделай анализ
```

| Команда | Что делает |
|---|---|
| `создай баг` | Bug в HubEx по треду, ссылка в Teams. Код не разбирает. |
| `сделай анализ` | Код HubEx через **ваш** MCP. Баг не создаёт. |

Обе фразы сразу: сначала анализ, потом баг. Без команды work item не создаётся.

В баге: шаблон WEB/Backend/МП, теги `DEV` + клиент + `Create Cursor agent`, Assign пустой, фактический и ожидаемый результат.

---

## Если что-то не так

| Что видите | Что сделать |
|---|---|
| Агент взял не тот репозиторий | `repo=shilov2704-sketch/Cursor_Integration` в сообщении |
| Нет карточки / не стартует | Шаги 2 и 6: Cloud Agents, Teams Connect, `@Cursor help` |
| Просит открыть Web или Desktop | Писать в **треде канала** |
| «AZURE_DEVOPS_PAT is missing» | Шаги 3–4: **свой** PAT в Secrets, имя точно `AZURE_DEVOPS_PAT` |
| MCP не логинится / 401 | Шаг 5: свой токен в MCP через `${env:AZURE_DEVOPS_PAT}`, не из файлов репо |
| Баг 403 | У вашей учётки ADO есть права на HubEx, scope Work Items Read & write |
| Анализ без кода | Шаг 5 + у PAT scope **Code Read** |
| Баг от чужого имени | В ваших Secrets чужой PAT — замените на свой |

Токен в репозиторий не коммитить. Репозиторий задаёт только поведение агента.
