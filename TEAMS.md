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
MCP Azure DevOps (обязателен) + MCP HubEx (живые данные DEV) + секрет AZURE_DEVOPS_PAT
        ↓
Анализ кода HubEx и Bug в org melston (от вашего имени в ADO)
```

В git нет рабочего `.cursor/mcp.json` с токеном (локальный Desktop-файл в `.gitignore`). Облачный агент **не подхватывает** MCP из репозитория: серверы `ado` и `hubex` нужно добавить в **вашем** дашборде Cursor (шаги 5 и 5b) и включить в MCP dropdown запуска.

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

Это не GitHub Secrets и не файлы репозитория. Без этого шага MCP ADO не аутентифицируется.

---

## Шаг 4b. Креды DEV HubEx для облачного агента

Локальный `.env` **не попадает** в git и **не уезжает** на VM Cloud Agent. Для Teams агент берёт те же значения из **Secrets**.

1. Откройте [Cloud Agents → Secrets](https://cursor.com/dashboard/cloud-agents).
2. Добавьте секреты **с теми же именами**, что в `.env` (каждое имя — отдельный секрет).

**Backend (API)**

| Name |
|---|
| `API_USER_TOKEN` |
| `SECOND_BASIC_TOKEN` |
| `POWER_USER_TOKEN` |
| `TENANT_ID` (значение `5`) |
| `TENANT_MEMBER_ID` |
| `APP_ID` |
| `URL_DEV_HUBEX` |
| `USER_EMAIL` |
| `USER_PHONE` |

**Frontend (Playwright)**

| Name |
|---|
| `TEST_USER` |
| `TEST_PASS` |
| `TEST_PHONE` |
| `TEST_TENANT` |
| `HOST_URL` |
| `URL_API_HUBEX` |
| `BASIC_TOKEN` |
| `API_USER_TOKEN` |
| `POWER_USER_TOKEN` |
| `APP_ID` |
| `TENANT_ID` |
| `TENANT_MEMBER_ID` |

Имена, которые есть в обоих списках, заведите **один раз**.

3. Value — как в вашем локальном `.env`. В чат не копируйте.

Cursor подставляет их в **переменные окружения** процесса агента. Скрипты `hubex-api.mjs` и `repro_web.py` читают env (и при старте VM могут собрать из них `.env` на диске, тоже не в git).

Без этого шага воспроизведение на DEV в Teams будет пропущено. Анализ и создание бага через ADO MCP от `AZURE_DEVOPS_PAT` не зависят.

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
      "type": "stdio",
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

5. Сохраните. В списке MCP сервер `ado` должен быть **включён** (toggle). Нужен **новый** прогон агента.

Шаблон: `.cursor/mcp.json.example`. Рабочий `.cursor/mcp.json` в git не хранится (у Desktop может быть свой путь к Node).

**Без этого шага `@Cursor создай баг` и анализ по коду не работают.** Запасного создания бага через REST больше нет.

---

## Шаг 5b. MCP HubEx — живые данные DEV

Дополнительный сервер [`@hubex/mcp`](https://www.npmjs.com/package/@hubex/mcp): живые данные DEV и воспроизведение (RW). **Сначала код в репозиториях через `ado`**, затем HubEx MCP. Карточки Bug создаёт только `ado`.

Токен в Cloud Agent нельзя ввести интерактивно, поэтому режим `service` и уже существующий секрет `API_USER_TOKEN`.

1. [cursor.com/agents](https://cursor.com/agents) → MCP → **Add custom MCP**.
2. Транспорт: **stdio**.

| Поле | Значение |
|---|---|
| Name | `hubex` |
| Command | `npx` |
| Args | `-y` |
| | `@hubex/mcp` |

Env (каждое имя — отдельная переменная):

| Name | Value |
|---|---|
| `HUBEX_ENV` | `dev` |
| `HUBEX_APPLICATION_ID` | `${env:APP_ID}` |
| `HUBEX_TENANT_ID` | `${env:TENANT_ID}` |
| `HUBEX_AUTH_MODE` | `service` |
| `HUBEX_SERVICE_TOKEN` | `${env:API_USER_TOKEN}` |
| `HUBEX_READONLY` | `false` |

3. Toggle `hubex` **включить**. Если сервер уже добавлен с `HUBEX_READONLY=true` — поменяйте на `false` и сохраните. Нужен новый прогон `@Cursor`.

Если MCP пишет ошибку про application id — в Secrets `APP_ID` должно быть то, что ждёт HubEx MCP (часто `5`). Не вставляйте сырой токен в поле Value.

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


| Команда         | Что делает                                                                 |
| --------------- | -------------------------------------------------------------------------- |
| `создай баг` / `заведи баг` | Анализ, воспроизведение DEV (tenant 5), затем Bug. В чат — короткая ссылка. |
| `сделай анализ` | Только разбор кода. Полный анализ в ответе. Баг не создаёт. |


Обе фразы сразу: тот же поток, что «заведи баг». Без команды work item не создаётся.

В баге: шаблон WEB / Backend / **МП**, теги `DEV` + клиент + `Create Cursor agent`, Assign пустой, ссылка на тред Teams, вложения один раз. Анализ и результат воспроизведения на DEV — в комментарии к багу.

Локально `.env` в корне — только ваш диск, в git не входит. Облачный агент его не видит: те же имена заведите в Secrets (шаг 4b). Значения в чат не присылать.

---

## Если что-то не так


| Что видите                     | Что сделать                                                                |
| ------------------------------ | -------------------------------------------------------------------------- |
| Агент взял не тот репозиторий  | `repo=shilov2704-sketch/Cursor_Integration` в сообщении                    |
| Нет карточки / не стартует     | Шаги 2 и 6: Cloud Agents, Teams Connect, `@Cursor help`                    |
| Просит открыть Web или Desktop | Писать в **треде канала**                                                  |
| «AZURE_DEVOPS_PAT is missing»  | Шаги 3–4: **свой** PAT в Secrets, имя точно `AZURE_DEVOPS_PAT`             |
| MCP не логинится / 401 / агент пишет «нет MCP» | Шаг 5: сервер `ado` **включён**; шаг 5b: сервер `hubex` включён |
| HubEx MCP 401 / нет application id | Secrets `API_USER_TOKEN` и `APP_ID` (часто `5`), toggle `hubex` |
| Агент создаёт баг через REST, не через MCP | Шаг 5 не выполнен или MCP выключен у Cloud Agent — включите `ado` и перезапустите |
| Баг 403                        | У вашей учётки ADO есть права на HubEx, scope Work Items Read & write      |
| Анализ без кода                | Шаг 5 + у PAT scope **Code Read**                                          |
| Воспроизведение на DEV пропущено / пустые токены | Шаг 4b: те же имена, что в `.env`, в Cloud Agents → Secrets |


Токен в репозиторий не коммитить. Репозиторий задаёт только поведение агента.