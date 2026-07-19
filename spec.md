# MultiCallculator — Product and Data Specification

## Product

MultiCallculator — веб-инструмент для менеджеров Global Cleaning и 112 Cleaning. Менеджер выбирает вид работ, вводит параметры объекта и получает предварительную стоимость, срок выполнения и готовый текст для клиента.

Основные сценарии:

1. Менеджер создаёт клиента и его объект.
2. Для объекта менеджер создаёт расчёт: пожар, металл или кирпичный фасад.
3. Менеджер меняет параметры и сохраняет новую версию, не теряя предыдущую.
4. Менеджер копирует итоговый текст и отправляет его клиенту.
5. Администратор управляет пользователями и видит все расчёты компании.

Роли:

- `admin` — управляет пользователями и всеми данными рабочего пространства;
- `manager` — создаёт клиентов, объекты, расчёты и их версии.

## Data

Это целевая data-схема для будущего backend. Текущее приложение работает без сервера, а сохранённые расчёты фасада хранит в `localStorage`. При подключении базы данных источником правды должна стать схема ниже.

### 1. Workspace

Рабочее пространство компании. Изолирует пользователей и клиентов одной компании от данных другой.

| field | type | nullable | key | note |
|---|---|---:|---|---|
| `id` | uuid | no | PK | Уникальный идентификатор |
| `name` | string | no | — | Название компании или команды |
| `status` | workspace_status | no | — | Текущее состояние рабочего пространства |
| `created_at` | datetime | no | — | Дата создания |

### 2. User

Пользователь MultiCallculator: администратор или менеджер.

| field | type | nullable | key | note |
|---|---|---:|---|---|
| `id` | uuid | no | PK | Уникальный идентификатор |
| `workspace_id` | uuid | no | FK → Workspace.id | Рабочее пространство пользователя |
| `name` | string | no | — | Имя пользователя |
| `email` | string | no | UNIQUE | Email для входа |
| `role` | user_role | no | — | Роль и уровень доступа |
| `status` | user_status | no | — | Активен или архивирован |
| `created_at` | datetime | no | — | Дата создания |

### 3. Client

Заказчик, для которого выполняются расчёты.

| field | type | nullable | key | note |
|---|---|---:|---|---|
| `id` | uuid | no | PK | Уникальный идентификатор |
| `workspace_id` | uuid | no | FK → Workspace.id | Владелец данных клиента |
| `name` | string | no | — | Имя человека или название организации |
| `phone` | string | yes | — | Контактный телефон |
| `email` | string | yes | — | Контактный email |
| `status` | client_status | no | — | Активный или архивный клиент |
| `created_at` | datetime | no | — | Дата создания |

### 4. ServiceObject

Объект клиента, на котором планируются работы: квартира, склад, фасад или металлоконструкции.

| field | type | nullable | key | note |
|---|---|---:|---|---|
| `id` | uuid | no | PK | Уникальный идентификатор |
| `client_id` | uuid | no | FK → Client.id | Клиент-владелец объекта |
| `title` | string | no | — | Короткое название объекта |
| `address` | string | yes | — | Адрес объекта |
| `status` | object_status | no | — | Активный или архивный объект |
| `created_at` | datetime | no | — | Дата создания |

### 5. Calculation

Карточка расчёта для конкретного объекта. Определяет тип калькулятора и хранит общий жизненный цикл расчёта.

| field | type | nullable | key | note |
|---|---|---:|---|---|
| `id` | uuid | no | PK | Уникальный идентификатор |
| `service_object_id` | uuid | no | FK → ServiceObject.id | Объект, для которого сделан расчёт |
| `created_by_user_id` | uuid | no | FK → User.id | Менеджер — автор расчёта |
| `type` | calculation_type | no | — | Пожар, металл или фасад |
| `status` | calculation_status | no | — | Черновик, финальный или архивный |
| `title` | string | no | — | Название расчёта |
| `created_at` | datetime | no | — | Дата создания |

### 6. CalculationVersion

Неизменяемая версия расчёта. При изменении площади, ставки или коэффициентов создаётся новая запись.

| field | type | nullable | key | note |
|---|---|---:|---|---|
| `id` | uuid | no | PK | Уникальный идентификатор версии |
| `calculation_id` | uuid | no | FK → Calculation.id | Родительский расчёт |
| `created_by_user_id` | uuid | no | FK → User.id | Автор этой версии |
| `version` | integer | no | UNIQUE* | Порядковый номер внутри расчёта |
| `input_data` | json | no | — | Все введённые площади, ставки, коэффициенты и опции |
| `output_data` | json | no | — | Итог, срок, ставка, предупреждение и текст для клиента |
| `created_at` | datetime | no | — | Дата сохранения версии |

`UNIQUE*` означает составную уникальность пары `calculation_id + version`.

Пример содержимого версии:

```json
{
  "calculation_id": "6dc63ca0-3269-4ff4-bf1a-f28c69b1e28f",
  "version": 2,
  "input_data": {
    "area": 500,
    "baseRate": 300,
    "heightCoef": 1.2,
    "brickCoef": 1.0
  },
  "output_data": {
    "total": 237600,
    "effectiveRate": 475.2,
    "days": 4,
    "warning": "Рабочая зона",
    "clientText": "Предварительная оценка работ..."
  }
}
```

### Связи и cardinality

| Parent | Связь | Child | Реализация |
|---|---|---|---|
| Workspace | 1:N | User | `User.workspace_id` |
| Workspace | 1:N | Client | `Client.workspace_id` |
| Client | 1:N | ServiceObject | `ServiceObject.client_id` |
| ServiceObject | 1:N | Calculation | `Calculation.service_object_id` |
| User | 1:N | Calculation | `Calculation.created_by_user_id` |
| Calculation | 1:N | CalculationVersion | `CalculationVersion.calculation_id` |
| User | 1:N | CalculationVersion | `CalculationVersion.created_by_user_id` |

Связей N:M в текущей модели нет, поэтому отдельная junction-таблица не требуется.

## Lookups

### user_role

| value | meaning |
|---|---|
| `admin` | Управляет пользователями и видит все данные |
| `manager` | Работает с клиентами, объектами и расчётами |

### calculation_type

| value | meaning |
|---|---|
| `fire` | Расчёт работ после пожара |
| `metal` | Расчёт очистки металла |
| `facade` | Расчёт очистки кирпичного фасада |

### calculation_status

| value | meaning |
|---|---|
| `draft` | Расчёт в работе |
| `final` | Согласованный вариант |
| `archived` | Расчёт скрыт из активной работы, но сохранён |

### Остальные статусы

| lookup | values |
|---|---|
| `workspace_status` | `active`, `archived` |
| `user_status` | `active`, `archived` |
| `client_status` | `active`, `archived` |
| `object_status` | `active`, `archived` |

## Lifecycle and access rules

- Данные принадлежат `Workspace`; пользователи разных рабочих пространств не видят данные друг друга.
- В первом рабочем пространстве менеджеры видят общих клиентов, объекты и расчёты компании.
- Автор расчёта и каждой версии фиксируется через `created_by_user_id`.
- Изменение параметров не перезаписывает старую версию, а создаёт новую `CalculationVersion`.
- Версии расчётов не редактируются и не удаляются в обычном пользовательском сценарии.
- Клиенты, объекты, пользователи и расчёты архивируются изменением `status`, а не удаляются физически.
- Секреты, пароли и API-ключи в таблицах не хранятся.

## ASCII relationship diagram

```text
┌───────────────┐
│   Workspace   │
│───────────────│
│ id         PK │
│ name          │
│ status        │
└───────┬───────┘
        │ 1:N
        ├──────────────────────────┐
        ▼                          ▼
┌───────────────┐          ┌───────────────┐
│     User      │          │    Client     │
│───────────────│          │───────────────│
│ id         PK │          │ id         PK │
│ workspace_id FK│         │ workspace_id FK│
│ role          │          │ name          │
└───────┬───────┘          └───────┬───────┘
        │                           │ 1:N
        │                           ▼
        │                   ┌────────────────┐
        │                   │ ServiceObject  │
        │                   │────────────────│
        │                   │ id          PK │
        │                   │ client_id   FK │
        │                   │ title          │
        │                   └───────┬────────┘
        │                           │ 1:N
        │                           ▼
        │  creates          ┌────────────────┐
        └──────────────────►│  Calculation   │
                            │────────────────│
                            │ id          PK │
                            │ object_id   FK │
                            │ created_by  FK │
                            │ type           │
                            └───────┬────────┘
                                    │ 1:N
                                    ▼
                            ┌────────────────────┐
                            │ CalculationVersion │
                            │────────────────────│
                            │ id              PK │
                            │ calculation_id  FK │
                            │ created_by      FK │◄──── User 1:N
                            │ version            │
                            └────────────────────┘
```

В диаграмме сокращены подписи некоторых FK для компактности:

- `Calculation.object_id` = `Calculation.service_object_id`;
- `created_by` = `created_by_user_id`.
